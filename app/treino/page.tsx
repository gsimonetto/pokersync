"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, SkipForward } from "lucide-react";
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
import { T, F } from "@/lib/poker/drill-theme";

// Arquitetura revertida (2026-08): colar hand history + mesa persistente
// saiu daqui e virou tela propria do Revisor de Mãos (RevisorHandTable).
// O Treino volta a ser SO os filtros GTO — decisao confirmada: "quero
// colar a mão dentro do revisor... se eu quiser treinar aquele spot, ai
// sim vou para o modo treino com os filtros já pré-definidos".
//
// Essa tela agora aceita filtros pre-selecionados via querystring, vindos
// do botao "Treinar esse spot" do Revisor: ?pos=BTN&action=vs%20Open&street=Flop
// Alem do caminho ja existente ?suggestionId=<id> (Revisor > leak > drill).

const ALL_POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BB", "BTN", "SB"];
const DECORATIVE_VILLAIN_POSITIONS = ["SB", "CO", "BB", "MP"];

function buildSeatInvolvement(heroPosition: string) {
  return ALL_POSITIONS.map((pos) => ({
    pos,
    hero: pos === heroPosition,
    inHand: pos !== heroPosition && DECORATIVE_VILLAIN_POSITIONS.includes(pos),
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

function SessionInline({ handIdx, handsTotal, hits, total, sessionPct }: { handIdx: number; handsTotal: number; hits: number; total: number; sessionPct: number }) {
  const dim = "rgba(255,255,255,0.4)";
  const soft = "rgba(255,255,255,0.65)";
  return (
    <div style={{ fontFamily: F, fontSize: 12, color: dim, display: "flex", gap: 10, alignItems: "baseline" }}>
      <span>Mão <span style={{ color: soft, fontWeight: 500 }}>{handIdx}/{handsTotal}</span></span>
      {total > 0 && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span><span style={{ color: hits > 0 ? T.ok : soft, fontWeight: 500 }}>{hits}/{total}</span> acertos ({sessionPct}%)</span>
        </>
      )}
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 500, fontSize: 13, flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
    >
      Próxima <SkipForward size={14} />
    </button>
  );
}

function TreinoPageInner() {
  const searchParams = useSearchParams();
  const suggestionId = searchParams.get("suggestionId");
  // Filtros pre-selecionados vindos do botao "Treinar esse spot" do
  // Revisor. So aplicados uma vez, no mount — se o usuario mudar os
  // filtros manualmente depois, a URL nao "puxa de volta".
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

  // Aplica os filtros vindos da URL uma unica vez no mount. Nao usa
  // suggestionId nesse caso — sao caminhos mutuamente exclusivos (leak
  // sugerido usa suggestionId; "treinar esse spot" da mao colada usa
  // pos/action/street direto, porque a mao colada nao tem uma linha em
  // hand_review_drill_suggestions).
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

    const seats: TableHand["seats"] = {};
    buildSeatInvolvement(hand.position).forEach(({ pos, hero: isHero, inHand }) => {
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
    <div style={{ fontFamily: F, minHeight: "100vh", background: "#050505", padding: 16, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", background: "#050505", borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/modulos" title="Voltar" style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)" }}>
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: "#FFFFFF", margin: 0 }}>Modo Treino</h1>
            {suggestionId && (
              <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(168,85,247,0.9)" }}>Sugestão do Revisor de Mãos</span>
            )}
            {!suggestionId && (presetPos || presetAction || presetStreet) && (
              <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(196,181,253,0.9)" }}>Spot do Revisor de Mãos</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {hand && <SessionInline handIdx={idx + 1} handsTotal={hands.length} hits={stats.hits} total={stats.total} sessionPct={sessionPct} />}
          </div>
          {chosen && hand && <NextButton onClick={nextHand} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", gap: 12, minHeight: 420 }}>
          <FilterSidebar
            filters={filters}
            onSet={setFilter}
            facets={facets}
            activeCount={activeCount}
            disabled={!!suggestionId}
            disabledReason={suggestionId ? "Sugestão do Revisor de Mãos ativa — filtros manuais desabilitados." : undefined}
          />

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 0 }}>
            {hand && tableHand && seatLayout ? (
              <div style={{ width: "100%", height: "100%", maxWidth: 820, maxHeight: 460, margin: "auto" }}>
                <PokerTable hand={tableHand} seats={seatLayout} />
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

          <div style={{ overflowY: "auto" }}>
            {chosen && hand && result ? (
              <GtoFeedback pot={hand.pot} stack={hand.effectiveStack} spr={tableHand?.spr ?? null} heroLabel={heroCardsParsed.filter(Boolean).join(" ")} gtoNodes={hand.gtoNodes} heroCards={hand.heroCards} chosenRawAction={result.chosenAction} result={result} chosenLabel={chosen.label} />
            ) : (
              <aside style={{ fontFamily: F, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Sessão</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <StatRow label="Acertos GTO" value={stats.total > 0 ? `${stats.hits}/${stats.total}` : "—"} accent={stats.hits > 0 ? T.ok : null} />
                  <StatRow label="Aproveitamento" value={stats.total > 0 ? `${sessionPct}%` : "—"} />
                </div>
                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  {hand ? "Escolha uma ação na barra abaixo — o feedback GTO aparece aqui." : emptyMessage}
                </div>
              </aside>
            )}
          </div>
        </div>

        <div style={{ minHeight: 72, display: "flex", alignItems: "center", padding: "0 4px" }}>
          {hand && !chosen && seatLayout && <ActionBar actions={actions} onAct={onAct} />}
          {hand && chosen && (
            <div style={{ fontFamily: F, width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              Ação registrada — leia o feedback à direita e siga pra próxima mão.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Tab = "gto" | "ranges";

// Duas praticas de treino distintas de proposito (Decisao 009: o
// construtor de ranges e' 100% offline, o Modo Treino continua sendo
// o unico lugar de "exercicio" do produto — por isso o drill de ranges
// entra aqui como aba, e nao como tela propria em /ranges). O TreinoPageInner
// (drill GTO com solver) fica intocado — a aba Ranges e' um componente
// isolado do lado, sem compartilhar estado nenhum.
//
// Aceita ?tab=ranges&rangeId=<uuid> na querystring — e' o link que a
// Aderencia a Range (Revisor de Maos) usa pra mandar o jogador direto
// pro drill do range que teve divergencia, ja selecionado (Decisao 002:
// integracao entre modulos).
function TreinoTabs() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "ranges" ? "ranges" : "gto";
  const initialRangeId = searchParams.get("rangeId");
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div style={{ minHeight: "100vh", background: "#050505" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 16px 0" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 10, background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
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
      </div>

      {tab === "gto" ? (
        <TreinoPageInner />
      ) : (
        <div className="mx-auto max-w-6xl px-6 py-6 text-ink">
          <RangeDrill initialRangeId={initialRangeId} />
        </div>
      )}
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
