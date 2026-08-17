"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, SkipForward, SlidersHorizontal, X, Layers, Target } from "lucide-react";
import { PokerTable, type TableHand } from "@/components/drill/poker-table";
import { ActionBar, type DrillAction } from "@/components/drill/action-bar";
import { GtoFeedback } from "@/components/drill/gto-feedback";
import { RangeDrill } from "@/components/drill/range-drill";
import {
  fetchDrillBatch,
  fetchDrillBatchBySuggestion,
  fetchDrillFacets,
  type DrillHand,
  type DrillFacet,
} from "@/lib/services/drill-service";
import { useDrillFilters, type DrillFilterKey } from "@/lib/poker/use-drill-filters";
import { matchUserActionToGtoNode, describeAction } from "@/lib/poker/gto-verdict";
import { parseBoard, parseHeroCombo } from "@/lib/poker/parse-board";
import { computeStylizedSeatLayout, type SeatLayoutSlot } from "@/lib/poker/seat-layout";
import { T, F, num } from "@/lib/poker/drill-theme";

const ALL_POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BB", "BTN", "SB"];

// Vilão real do spot, extraído do próprio drillId — confirmado no banco
// (9 prefixos válidos, todos no padrão mtt_{stack}bb_{heroPos}_vs_
// {villainPos}[_srp]). Antes usávamos 4 posições decorativas fixas
// (SB/CO/BB/MP) sem relação com a mão; agora só acende a cor de quem
// realmente abriu/agiu contra o herói naquele spot. Se o formato não
// bater (drillId fora do padrão), não inventa vilão — mesa mostra só o
// herói, igual à regra do resto do produto (nunca exibir dado que não
// existe).
const VILLAIN_TOKEN_TO_POS: Record<string, string> = {
  utg: "UTG",
  "utg1": "UTG+1",
  mp: "MP",
  hj: "HJ",
  co: "CO",
  btn: "BTN",
  sb: "SB",
  bb: "BB",
};

function parseVillainPosition(drillId: string): string | null {
  const match = /^mtt_\d+bb_[a-z0-9]+_vs_([a-z0-9]+)/i.exec(drillId);
  if (!match) return null;
  return VILLAIN_TOKEN_TO_POS[match[1].toLowerCase()] ?? null;
}

function buildSeatInvolvement(heroPosition: string, villainPosition: string | null) {
  return ALL_POSITIONS.map((pos) => ({
    pos,
    hero: pos === heroPosition,
    inHand: pos !== heroPosition && pos === villainPosition,
  }));
}

const SIDEBAR_SECTIONS: { key: DrillFilterKey; label: string; options: string[] }[] = [
  { key: "position", label: "Posição", options: ["BB", "BTN", "SB"] },
  { key: "action", label: "Situação", options: ["vs Open", "3-Bet"] },
  { key: "street", label: "Rua", options: ["Flop", "Turn", "River"] },
];

function actionsFromGtoNodes(rawActions: string[]): DrillAction[] {
  return rawActions.map((raw, i) => {
    const desc = describeAction(raw);
    const keys = ["Q", "W", "E"];
    return {
      id: `${desc.type}-${i}`,
      type: desc.type as DrillAction["type"],
      label: desc.label,
      key: keys[i],
      sizing: desc.sizing,
      primary: i === 0,
    };
  });
}

function FilterChip({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "Sem mãos para esta combinação" : undefined}
      style={{
        fontFamily: F,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        border: active ? "1px solid rgba(255,255,255,0.9)" : disabled ? "1px dashed rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "#FFFFFF" : disabled ? "transparent" : "rgba(255,255,255,0.02)",
        color: active ? "#111111" : disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)",
        textDecoration: disabled ? "line-through" : "none",
        transition: "all 160ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function FilterSidebar({
  filters, onSet, facets, activeCount, disabled, disabledReason,
}: {
  filters: Record<DrillFilterKey, string | null>;
  onSet: (key: DrillFilterKey, value: string | null) => void;
  facets: DrillFacet[];
  activeCount: number;
  disabled: boolean;
  disabledReason?: string;
}) {
  const counts = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    SIDEBAR_SECTIONS.forEach(({ key, options }) => {
      out[key] = {};
      options.forEach((opt) => {
        out[key][opt] = facets
          .filter((r) => r[key] === opt)
          .filter((r) => SIDEBAR_SECTIONS.every(({ key: k }) => k === key || !filters[k] || r[k] === filters[k]))
          .reduce((s, r) => s + r.n, 0);
      });
    });
    return out;
  }, [facets, filters]);

  const toggle = (key: DrillFilterKey, opt: string) => {
    const nextValue = filters[key] === opt ? null : opt;
    onSet(key, nextValue);
    SIDEBAR_SECTIONS.forEach(({ key: k }) => {
      if (k === key || !filters[k]) return;
      const ok = facets.some(
        (r) => r[key] === (nextValue ?? r[key]) && SIDEBAR_SECTIONS.every(({ key: kk }) => kk === key || !filters[kk] || r[kk] === filters[kk])
      );
      if (!ok) onSet(k, null);
    });
  };

  return (
    <aside style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          Filtros GTO
        </span>
        {activeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {disabled && disabledReason && (
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{disabledReason}</div>
        )}

        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.key} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
              {section.label}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {section.options.map((opt) => (
                <FilterChip
                  key={opt}
                  label={opt}
                  active={filters[section.key] === opt}
                  disabled={counts[section.key][opt] === 0}
                  onClick={() => toggle(section.key, opt)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 500, color: accent || "#FFFFFF" }}>{value}</span>
    </div>
  );
}

// Antes era só texto corrido ("Mão 1/20 · 3/5 acertos (60%)"), quase
// ilegível perto da mesa. Pedido explícito: "ter mais visibilidade, com
// chips ou algo mais bonito" — viraram 2 pills reais, com ícone, no
// mesmo padrão visual das badges do resto da tela (fundo translúcido +
// borda). O chip de acertos ganha um tom verde quando há acerto — sinal
// rápido, sem precisar ler o número.
function SessionInline({ handIdx, handsTotal, hits, total, sessionPct }: { handIdx: number; handsTotal: number; hits: number; total: number; sessionPct: number }) {
  const chipBase: React.CSSProperties = {
    fontFamily: F,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 13px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
  const hasHits = hits > 0;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ ...chipBase, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
        <Layers size={12} strokeWidth={2} color="rgba(255,255,255,0.4)" />
        <span style={{ ...num }}>{handIdx}<span style={{ opacity: 0.45, fontWeight: 500 }}>/{handsTotal}</span></span>
      </div>
      {total > 0 && (
        <div
          style={{
            ...chipBase,
            background: hasHits ? `${T.ok}1F` : "rgba(255,255,255,0.05)",
            border: `1px solid ${hasHits ? `${T.ok}55` : "rgba(255,255,255,0.10)"}`,
            color: hasHits ? T.ok : "rgba(255,255,255,0.75)",
          }}
        >
          <Target size={12} strokeWidth={2} color={hasHits ? T.ok : "rgba(255,255,255,0.4)"} />
          <span style={{ ...num }}>
            {hits}/{total} <span style={{ opacity: 0.7, fontWeight: 500 }}>({sessionPct}%)</span>
          </span>
        </div>
      )}
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}
    >
      Próxima <SkipForward size={14} />
    </button>
  );
}

// Breakpoint mobile: 768px. Abaixo disso a mesa vira full-screen (padrão
// PokerStars/replayer mobile) — filtros e resultado do drill saem do
// grid de 3 colunas e viram overlays (drawer lateral / bottom sheet),
// pra mesa e barra de apostas ocuparem o espaço todo. Regras isoladas
// num <style> unico, no topo do componente, do mesmo jeito que o
// PokerTable ja injeta suas @keyframes.
function TreinoResponsiveStyles() {
  return (
    <style>{`
      .ps-tr-filters-toggle { display: none; }

      @media (max-width: 768px) {
        .ps-treino-page { padding: 0 !important; }
        .ps-treino-card {
          padding: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          height: 100vh !important;
        }
        .ps-treino-tabs {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 25;
          background: rgba(10,10,10,.85);
          backdrop-filter: blur(6px);
        }
        .ps-tr-header { padding: 8px 10px 0 !important; }
        .ps-tr-body {
          grid-template-columns: 1fr !important;
          padding: 0 10px 10px !important;
        }
        .ps-tr-filters-toggle { display: flex !important; }
        .ps-tr-filters {
          position: fixed;
          inset: 0;
          z-index: 40;
          width: 82%;
          max-width: 320px;
          background: #050505;
          padding: 16px;
          overflow-y: auto;
          transform: translateX(-100%);
          transition: transform 220ms ease;
        }
        .ps-tr-filters--open { transform: translateX(0); }
        .ps-tr-feedback-idle { display: none !important; }
        .ps-tr-feedback-sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 30;
          max-height: 62vh;
          overflow-y: auto;
          border-radius: 18px 18px 0 0 !important;
          box-shadow: 0 -20px 50px rgba(0,0,0,.6);
          padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important;
        }
        .ps-tr-table-col { gap: 6px !important; }
        .ps-tr-table-wrap { max-width: none !important; max-height: none !important; }
      }
    `}</style>
  );
}

function TreinoPageInner() {
  const searchParams = useSearchParams();
  const suggestionId = searchParams.get("suggestionId");
  const presetPos = searchParams.get("pos");
  const presetAction = searchParams.get("action");
  const presetStreet = searchParams.get("street");

  const { filters, set: setFilter, activeCount, isComplete } = useDrillFilters();
  const [facets, setFacets] = useState<DrillFacet[]>([]);
  const [hands, setHands] = useState<DrillHand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<DrillAction | null>(null);
  const [stats, setStats] = useState({ hits: 0, total: 0 });
  // Drawer de filtros — só existe visualmente no breakpoint mobile (o
  // botão que abre fica escondido via CSS no desktop), mas o estado
  // fica aqui pra fechar automaticamente assim que uma mão carrega.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canLoad = isComplete || !!suggestionId;

  const reload = useCallback(() => {
    if (!canLoad) {
      setHands([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const request = suggestionId ? fetchDrillBatchBySuggestion(suggestionId, 20) : fetchDrillBatch(20, filters);
    request
      .then(setHands)
      .catch((e) => setError(e instanceof Error ? e : new Error("Erro ao carregar mãos.")))
      .finally(() => setLoading(false));
  }, [canLoad, suggestionId, filters]);

  useEffect(() => {
    fetchDrillFacets().then(setFacets).catch(() => setFacets([]));
  }, []);

  useEffect(() => {
    if (suggestionId) return;
    if (presetPos) setFilter("position", presetPos);
    if (presetAction) setFilter("action", presetAction);
    if (presetStreet) setFilter("street", presetStreet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
    setIdx(0);
    setChosen(null);
    setFiltersOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.position, filters.action, filters.street, suggestionId]);

  const hand = hands[idx] || null;

  const board = useMemo(() => (hand ? parseBoard(hand.board) : []), [hand]);
  const heroCardsParsed = useMemo(() => (hand?.heroCards ? parseHeroCombo(hand.heroCards) : [null, null]), [hand]);

  const actions = useMemo(() => (hand ? actionsFromGtoNodes(hand.gtoNodes.actions) : []), [hand]);

  const result = useMemo(() => {
    if (!hand || !chosen) return null;
    return matchUserActionToGtoNode({ action: chosen.type, sizing: chosen.sizing }, hand.gtoNodes, hand.heroCards);
  }, [hand, chosen]);

  const tableHand: TableHand | null = useMemo(() => {
    if (!hand) return null;
    const spr = hand.pot > 0 && hand.effectiveStack != null ? Math.round((hand.effectiveStack / hand.pot) * 10) / 10 : null;
    const villainPosition = parseVillainPosition(hand.drillId);

    const seats: TableHand["seats"] = {};
    buildSeatInvolvement(hand.position, villainPosition).forEach(({ pos, hero: isHero, inHand }) => {
      if (isHero) {
        seats[pos] = { status: chosen ? "live" : "acting", stack: hand.effectiveStack, cards: heroCardsParsed, ...(chosen ? { action: { type: chosen.type, size: chosen.sizing } } : {}) };
      } else if (inHand) {
        seats[pos] = { status: "live", stack: hand.effectiveStack };
      } else {
        seats[pos] = { status: "empty" };
      }
    });

    return { pot: hand.pot, spr, board, history: [], seats };
  }, [hand, board, heroCardsParsed, chosen]);

  const { seatLayout, layoutError } = useMemo((): { seatLayout: SeatLayoutSlot[] | null; layoutError: Error | null } => {
    if (!hand) return { seatLayout: null, layoutError: null };
    try {
      return { seatLayout: computeStylizedSeatLayout(hand.position), layoutError: null };
    } catch (e) {
      return { seatLayout: null, layoutError: e instanceof Error ? e : new Error("Posição de hero inválida.") };
    }
  }, [hand]);

  const onAct = useCallback((action: DrillAction) => setChosen(action), []);

  const nextHand = useCallback(() => {
    setChosen(null);
    if (idx + 1 < hands.length) setIdx((i) => i + 1);
    else { reload(); setIdx(0); }
  }, [idx, hands.length, reload]);

  useEffect(() => {
    if (!chosen || !result) return;
    setStats((prev) => ({ hits: prev.hits + (result.verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); if (chosen) nextHand(); return; }
      const hit = actions.find((a) => a.key === e.key.toUpperCase());
      if (hit && !chosen) onAct(hit);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, chosen, onAct, nextHand]);

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;

  const emptyMessage = suggestionId
    ? "Nenhuma mão encontrada para essa sugestão do Revisor de Mãos."
    : isComplete
      ? "Nenhuma mão encontrada para esses filtros."
      : "Selecione posição, situação e rua nos filtros ao lado pra começar.";

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, height: "100%", minHeight: 0, position: "relative" }}>
      <TreinoResponsiveStyles />

      <div className="ps-tr-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Botão só existe (e só aparece) no breakpoint mobile — abre o
            drawer de filtros por cima da mesa. */}
        <button
          className="ps-tr-filters-toggle"
          onClick={() => setFiltersOpen(true)}
          style={{ alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0 }}
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} />
        </button>

        {suggestionId && (
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(168,85,247,0.9)" }}>Sugestão do Revisor de Mãos</span>
        )}
        {!suggestionId && (presetPos || presetAction || presetStreet) && (
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(196,181,253,0.9)" }}>Spot do Revisor de Mãos</span>
        )}

        <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 18, alignItems: "center" }}>
          {hand && <SessionInline handIdx={idx + 1} handsTotal={hands.length} hits={stats.hits} total={stats.total} sessionPct={sessionPct} />}
        </div>
      </div>

      <div className="ps-tr-body" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", gap: 12, minHeight: 0 }}>
        {/* Filtros — no desktop e' coluna normal do grid. No mobile vira
            um drawer fixo (CSS cuida da posição/transform); o botão de
            filtro no header e o X aqui dentro so existem visualmente
            abaixo de 768px. */}
        <div className={`ps-tr-filters${filtersOpen ? " ps-tr-filters--open" : ""}`} style={{ position: "relative", minHeight: 0 }}>
          {filtersOpen && (
            <button
              onClick={() => setFiltersOpen(false)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}
            >
              <X size={15} />
            </button>
          )}
          <FilterSidebar
            filters={filters}
            onSet={setFilter}
            facets={facets}
            activeCount={activeCount}
            disabled={!!suggestionId}
            disabledReason={suggestionId ? "Sugestão do Revisor de Mãos ativa — filtros manuais desabilitados." : undefined}
          />
        </div>

        {filtersOpen && (
          <div onClick={() => setFiltersOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 39 }} />
        )}

        {/* Coluna do meio empilha mesa + barra de apostas — no mobile
            (pedido explícito: "a mesa deverá ocupar a tela toda... como
            o PokerStars faz") essa coluna vira a tela inteira, já que
            filtros e resultado saem do grid e viram overlays. */}
        <div className="ps-tr-table-col" style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 0 }}>
            {hand && tableHand && seatLayout ? (
              {/* Limite de tamanho — sem isso a mesa esticava muito além
                  das cartas/chips (que têm px fixo), ficando
                  desproporcional em telas largas. Ainda bem maior que o
                  limite antigo (820x460), só que contido. */}
              <div className="ps-tr-table-wrap" style={{ width: "100%", height: "100%", maxWidth: 1100, maxHeight: 640, margin: "auto" }}>
                <PokerTable hand={tableHand} seats={seatLayout} variant="treino" />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                {loading ? (
                  <>
                    <Loader2 size={32} color="rgba(255,255,255,0.5)" />
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Carregando mãos...</p>
                  </>
                ) : error ? (
                  <>
                    <AlertTriangle size={32} color={T.bad} />
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Erro ao carregar mãos.</p>
                    <button onClick={reload} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: 13 }}>Tentar novamente</button>
                  </>
                ) : hand && layoutError ? (
                  <>
                    <AlertTriangle size={32} color={T.bad} />
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
                      Essa mão veio com posição inconsistente no banco ({layoutError.message}). Pula pra próxima em vez de exibir errado.
                    </p>
                    <button onClick={nextHand} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: 13 }}>Próxima mão</button>
                  </>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{emptyMessage}</p>
                )}
              </div>
            )}
          </div>

          {/* Largura/centro alinhados com o wrapper da mesa (mesmo
              maxWidth:1100) — sem isso a linha de ação ocupava a coluna
              toda (mais larga que a mesa) e o ActionBar, sem flex:1
              próprio, encolhia pro tamanho do conteúdo e ficava
              "flutuando" fora de contexto no canto. */}
          <div style={{ minHeight: 64, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, width: "100%", maxWidth: 1100, margin: "0 auto" }}>
            {hand && !chosen && seatLayout && (
              <div style={{ flex: 1 }}>
                <ActionBar actions={actions} onAct={onAct} />
              </div>
            )}
            {hand && chosen && (
              <>
                <div style={{ fontFamily: F, flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                  Ação registrada — leia o feedback abaixo e siga pra próxima mão.
                </div>
                {/* "Próxima" saiu do header (longe da mesa) e ficou aqui,
                    colada na própria linha de ação, embaixo da mesa —
                    pedido explícito: "próximo à mesa e não fora". */}
                <NextButton onClick={nextHand} />
              </>
            )}
          </div>
        </div>

        {/* Resultado do drill — no desktop segue como coluna à direita.
            No mobile (sem espaço pra 3ª coluna com a mesa em tela cheia)
            vira um bottom sheet: some por completo enquanto não há
            escolha (a mesa + barra de apostas já comunicam isso sozinhas)
            e sobe de baixo, com scroll próprio, assim que o jogador age. */}
        {chosen && hand && result ? (
          <div className="ps-tr-feedback ps-tr-feedback-sheet" style={{ overflowY: "auto", background: "#0A0A0A" }}>
            <GtoFeedback pot={hand.pot} stack={hand.effectiveStack} spr={tableHand?.spr ?? null} heroLabel={heroCardsParsed.filter(Boolean).join(" ")} gtoNodes={hand.gtoNodes} heroCards={hand.heroCards} chosenRawAction={result.chosenAction} result={result} chosenLabel={chosen.label} />
          </div>
        ) : (
          <div className="ps-tr-feedback ps-tr-feedback-idle" style={{ overflowY: "auto" }}>
            <div style={{ fontFamily: F, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              {hand ? "Escolha uma ação na barra abaixo — o feedback GTO aparece aqui." : emptyMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = "gto" | "ranges";

function TreinoTabs() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "ranges" ? "ranges" : "gto";
  const initialRangeId = searchParams.get("rangeId");
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="ps-treino-page" style={{ fontFamily: F, minHeight: "100vh", background: "#050505", padding: 16, boxSizing: "border-box" }}>
      {/* Container principal — antes limitado a maxWidth 1280 e com o
          título "Modo Treino" fixo no header. Agora ocupa a tela quase
          inteira (pedido explicito) e as abas GTO/Ranges entram no
          próprio header do card, no lugar do título. No mobile (CSS em
          TreinoResponsiveStyles) o card perde moldura/padding e vira
          full-bleed — a mesa por dentro ocupa a tela toda, como um app
          de poker mobile. */}
      <div
        className="ps-treino-card"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 32px)",
          margin: "0 auto",
          background: "#050505",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 14,
          boxSizing: "border-box",
        }}
      >
        <div className="ps-treino-tabs" style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 10, background: "#111111", border: "1px solid rgba(255,255,255,0.08)", alignSelf: "flex-start" }}>
          {(["gto", "ranges"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: tab === t ? "#FFFFFF" : "transparent",
                color: tab === t ? "#111111" : "rgba(255,255,255,0.55)",
              }}
            >
              {t === "gto" ? "GTO" : "Ranges"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {tab === "gto" ? (
            <TreinoPageInner />
          ) : (
            <div className="h-full overflow-y-auto text-ink">
              <RangeDrill initialRangeId={initialRangeId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TreinoPage() {
  return (
    <Suspense fallback={null}>
      <TreinoTabs />
    </Suspense>
  );
}
