"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle, SkipForward } from "lucide-react";
import { PokerTable, type TableHand } from "@/components/drill/poker-table";
import { ActionBar, type DrillAction } from "@/components/drill/action-bar";
import { GtoFeedback } from "@/components/drill/gto-feedback";
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
import { T, F } from "@/lib/poker/drill-theme";

const SEAT_INVOLVEMENT = [
  { pos: "BTN", hero: true },
  { pos: "SB", inHand: true },
  { pos: "CO", inHand: true },
  { pos: "UTG", inHand: false },
  { pos: "UTG+1", inHand: false },
  { pos: "HJ", inHand: false },
  { pos: "BB", inHand: true },
  { pos: "MP", inHand: true },
];

const SIDEBAR_SECTIONS: { key: DrillFilterKey; label: string; options: string[] }[] = [
  { key: "position", label: "Posição", options: ["BB", "BTN", "SB"] },
  { key: "action", label: "Situação", options: ["vs Open", "3-Bet"] },
  { key: "street", label: "Rua", options: ["Flop", "Turn", "River"] },
];

// Acoes possiveis dado o array cru do gto_nodes — no maximo Check + 2 Bets,
// que e o que o solver sempre produz nesse dataset.
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
        fontWeight: 700,
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
  filters,
  onSet,
  facets,
  activeCount,
  disabled,
}: {
  filters: Record<DrillFilterKey, string | null>;
  onSet: (key: DrillFilterKey, value: string | null) => void;
  facets: DrillFacet[];
  activeCount: number;
  disabled: boolean;
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
    <aside
      style={{
        fontFamily: F,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "16px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflowY: "auto",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          Cenário
        </span>
        {activeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {disabled && (
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
          Sugestão do Revisor de Mãos ativa — filtros manuais desabilitados.
        </div>
      )}

      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.key} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
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
    </aside>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: accent || "#FFFFFF" }}>{value}</span>
    </div>
  );
}

function SessionInline({ handIdx, handsTotal, hits, total, sessionPct }: { handIdx: number; handsTotal: number; hits: number; total: number; sessionPct: number }) {
  const dim = "rgba(255,255,255,0.4)";
  const soft = "rgba(255,255,255,0.65)";
  return (
    <div style={{ fontFamily: F, fontSize: 12, color: dim, display: "flex", gap: 10, alignItems: "baseline" }}>
      <span>
        Mão <span style={{ color: soft, fontWeight: 700 }}>{handIdx}/{handsTotal}</span>
      </span>
      {total > 0 && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>
            <span style={{ color: hits > 0 ? T.ok : soft, fontWeight: 700 }}>{hits}/{total}</span> acertos ({sessionPct}%)
          </span>
        </>
      )}
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "#FFFFFF",
        color: "#111111",
        border: 0,
        borderRadius: 10,
        padding: "8px 16px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      Próxima <SkipForward size={14} />
    </button>
  );
}

function TreinoPageInner() {
  const searchParams = useSearchParams();
  const suggestionId = searchParams.get("suggestionId");

  const { filters, set: setFilter, activeCount, isComplete } = useDrillFilters();
  const [facets, setFacets] = useState<DrillFacet[]>([]);
  const [hands, setHands] = useState<DrillHand[]>([]);
  // loading comeca false: so vira true quando ha criterio valido e uma
  // busca de fato foi disparada. Isso evita o spinner enganoso na tela
  // vazia inicial (sem filtro, sem sugestao).
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<DrillAction | null>(null);
  const [stats, setStats] = useState({ hits: 0, total: 0 });

  // Unico criterio valido para buscar mao: filtros manuais completos
  // (posicao + situacao + rua) OU uma sugestao do Revisor na URL.
  // Sem isso, a tela nunca chama o Supabase — regra de negocio central.
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
    fetchDrillFacets()
      .then(setFacets)
      .catch(() => setFacets([]));
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
    SEAT_INVOLVEMENT.forEach(({ pos, hero: isHero, inHand }) => {
      if (isHero) {
        seats[pos] = {
          status: chosen ? "live" : "acting",
          stack: hand.effectiveStack,
          cards: heroCardsParsed,
          ...(chosen ? { action: { type: chosen.type, size: chosen.sizing } } : {}),
        };
      } else if (inHand) {
        seats[pos] = { status: "live", stack: hand.effectiveStack };
      } else {
        seats[pos] = { status: "empty" };
      }
    });

    return { pot: hand.pot, spr, board, history: [], seats };
  }, [hand, board, heroCardsParsed, chosen]);

  const onAct = useCallback((action: DrillAction) => setChosen(action), []);

  const nextHand = useCallback(() => {
    setChosen(null);
    if (idx + 1 < hands.length) {
      setIdx((i) => i + 1);
    } else {
      reload();
      setIdx(0);
    }
  }, [idx, hands.length, reload]);

  useEffect(() => {
    if (!chosen || !result) return;
    setStats((prev) => ({
      hits: prev.hits + (result.verdict === "OTIMA" ? 1 : 0),
      total: prev.total + 1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  // Atalhos: Q/W/E para as acoes na ordem da ActionBar, ESPACO para avancar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (chosen) nextHand();
        return;
      }
      const hit = actions.find((a) => a.key === e.key.toUpperCase());
      if (hit && !chosen) onAct(hit);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, chosen, onAct, nextHand]);

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;

  // Mensagem do estado vazio: distingue "ainda selecionando", "sugestao
  // sem resultado" e "filtro completo sem resultado" — evita mensagem
  // generica que mascare o motivo real de nao haver mao na tela.
  const emptyMessage = suggestionId
    ? "Nenhuma mão encontrada para essa sugestão do Revisor de Mãos."
    : isComplete
      ? "Nenhuma mão encontrada para esses filtros."
      : "Selecione posição, situação e rua nos filtros ao lado pra começar.";

  return (
    <div style={{ fontFamily: F, minHeight: "100vh", background: "#050505", padding: 16, boxSizing: "border-box" }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          background: "#050505",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 12,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/modulos"
            title="Voltar"
            style={{
              display: "grid",
              placeItems: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#1A1A1A",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Modo Treino</h1>
            {suggestionId && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(168,85,247,0.9)" }}>
                Sugestão do Revisor de Mãos
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {hand && <SessionInline handIdx={idx + 1} handsTotal={hands.length} hits={stats.hits} total={stats.total} sessionPct={sessionPct} />}
          </div>
          {chosen && hand && <NextButton onClick={nextHand} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", gap: 12, minHeight: 420 }}>
          <FilterSidebar filters={filters} onSet={setFilter} facets={facets} activeCount={activeCount} disabled={!!suggestionId} />

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 0 }}>
            {hand && tableHand ? (
              <div style={{ width: "100%", height: "100%", maxWidth: 820, maxHeight: 460, margin: "auto" }}>
                <PokerTable hand={tableHand} />
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
                    <button onClick={reload} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                      Tentar novamente
                    </button>
                  </>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
                    {emptyMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowY: "auto" }}>
            {chosen && hand && result ? (
              <GtoFeedback
                pot={hand.pot}
                stack={hand.effectiveStack}
                spr={tableHand?.spr ?? null}
                heroLabel={heroCardsParsed.filter(Boolean).join(" ")}
                gtoNodes={hand.gtoNodes}
                heroCards={hand.heroCards}
                chosenRawAction={result.chosenAction}
                result={result}
                chosenLabel={chosen.label}
              />
            ) : (
              <aside
                style={{
                  fontFamily: F,
                  padding: "16px 14px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                  Sessão
                </span>
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
          {hand && !chosen && <ActionBar actions={actions} onAct={onAct} />}
          {hand && chosen && (
            <div
              style={{
                fontFamily: F,
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                textAlign: "center",
              }}
            >
              Ação registrada — leia o feedback à direita e siga pra próxima mão.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// useSearchParams exige um limite de Suspense em volta no App Router —
// sem isso o build acusa erro. A pagina em si so renderiza no client
// (ja depende de fetch client-side), entao o fallback praticamente
// nunca aparece de fato.
export default function TreinoPage() {
  return (
    <Suspense fallback={null}>
      <TreinoPageInner />
    </Suspense>
  );
}
