"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  ImagePlus,
  CheckCircle2,
} from "lucide-react";
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
import { computeStylizedSeatLayout, type SeatLayoutSlot } from "@/lib/poker/seat-layout";
import { projectHandAtStreet, HandReplayError, type ReplayState } from "@/lib/poker/hand-replay-projector";
import {
  parseHand,
  validateParsedHand,
  HandParseError,
  type ParsedHand,
} from "@/lib/poker/hand-parser";
import { createReview } from "@/lib/services/hand-review-service";
import { createClient } from "@/lib/supabase/client";
import { T, F } from "@/lib/poker/drill-theme";

// As mesmas 8 posicoes de antes, mas agora o hero e' calculado a partir
// da posicao REAL da mao (hand.position) — nao mais fixo em "BTN".
// Villoes "decorativos" (so pra mesa nao ficar vazia) continuam os
// mesmos 4 de antes, exceto quando coincidem com a posicao do hero.
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
  disabledReason,
  onStartPaste,
}: {
  filters: Record<DrillFilterKey, string | null>;
  onSet: (key: DrillFilterKey, value: string | null) => void;
  facets: DrillFacet[];
  activeCount: number;
  disabled: boolean;
  disabledReason?: string;
  onStartPaste: () => void;
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
        gap: 14,
        padding: "16px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflowY: "auto",
      }}
    >
      <button
        onClick={onStartPaste}
        style={{
          all: "unset",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          cursor: "pointer",
          padding: "9px 10px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <ClipboardPaste size={13} strokeWidth={2} />
        Colar novo hand history
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          Filtros GTO (opcional)
        </span>
        {activeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
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
      </div>
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

// Tela principal ao entrar no Modo Treino: colar hand history (texto)
// ou anexar print. O anexo de print ainda nao esta ligado a biblioteca
// de imagens (hand_review_images) — botao fica visivelmente desabilitado
// em vez de fingir que funciona.
function PasteHandBox({
  value,
  onChange,
  onSubmit,
  error,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  loading: boolean;
}) {
  return (
    <div style={{ width: "100%", maxWidth: 620, display: "flex", flexDirection: "column", gap: 14, fontFamily: F }}>
      <div>
        <h2 style={{ color: "#FFFFFF", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Revisar uma mão</h2>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
          Cole o hand history da mão (PokerStars, por enquanto) — a mesa monta sozinha e a mão já entra na fila do Revisor de Mãos.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cole aqui o texto do hand history..."
        rows={8}
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          padding: 12,
          borderRadius: 12,
          background: "#0A0A0A",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.85)",
          resize: "vertical",
          outline: "none",
        }}
      />

      {error && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#FCA5A5",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: !value.trim() || loading ? "rgba(255,255,255,0.15)" : "#FFFFFF",
            color: !value.trim() || loading ? "rgba(255,255,255,0.4)" : "#111111",
            border: 0,
            borderRadius: 10,
            padding: "11px 20px",
            cursor: !value.trim() || loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : null}
          Analisar mão
        </button>

        <button
          disabled
          title="Em breve — biblioteca de prints ainda não conectada"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10,
            padding: "11px 16px",
            cursor: "not-allowed",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <ImagePlus size={14} />
          Anexar print
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TreinoPageInner() {
  const searchParams = useSearchParams();
  const suggestionId = searchParams.get("suggestionId");

  const { filters, set: setFilter, reset: resetFilters, activeCount, isComplete } = useDrillFilters();
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

  // --- Estado do fluxo de colar hand history / replay ---
  const [pasteText, setPasteText] = useState("");
  const [parsedHand, setParsedHand] = useState<ParsedHand | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [replayStreetIndex, setReplayStreetIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Unico criterio valido para buscar mao de drill: filtros manuais
  // completos (posicao + situacao + rua) OU uma sugestao do Revisor na
  // URL. Sem isso, a tela nunca chama o Supabase — regra de negocio central.
  const canLoad = isComplete || !!suggestionId;

  // A tela tem 3 modos possiveis, mutuamente exclusivos:
  // "paste" (landing, tela principal) → "drill" (filtros GTO ativos) →
  // "replay" (uma mao colada com sucesso). parsedHand tem prioridade —
  // colar uma mao nova sempre limpa os filtros de drill (ver effect abaixo).
  const viewMode: "paste" | "drill" | "replay" = parsedHand ? "replay" : canLoad ? "drill" : "paste";

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

  // Selecionar um filtro GTO enquanto uma mao colada esta na tela sai do
  // replay — os dois modos nao coexistem, pra nao ambiguar qual mesa
  // esta ativa.
  useEffect(() => {
    if (isComplete && parsedHand) {
      setParsedHand(null);
      setPasteText("");
      setParseError(null);
      setSaveState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  const handleParsePaste = useCallback(() => {
    setParseError(null);
    try {
      const parsed = parseHand(pasteText);
      validateParsedHand(parsed);
      setParsedHand(parsed);
      setReplayStreetIndex(0);
      resetFilters();

      setSaveState("saving");
      const title = `${parsed.site === "pokerstars" ? "PokerStars" : parsed.site} #${parsed.handId ?? "?"}`;
      const supabase = createClient();
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (!user) throw new Error("Usuário não autenticado.");
          return createReview(user.id, {
            title,
            handHistory: pasteText,
            parsedData: parsed,
            source: "manual",
          });
        })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    } catch (e) {
      if (e instanceof HandParseError) {
        setParseError(e.message);
      } else {
        setParseError("Não foi possível interpretar esse hand history. Confira se o texto foi colado completo.");
      }
      setParsedHand(null);
    }
  }, [pasteText, resetFilters]);

  const startPaste = useCallback(() => {
    setParsedHand(null);
    setPasteText("");
    setParseError(null);
    setSaveState("idle");
    resetFilters();
  }, [resetFilters]);

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

  // Layout de cadeiras rotacionado pela posicao real do hero. So calcula
  // quando ha mao — sem mao, nao ha posicao pra rotacionar em torno.
  // Se a posicao vinda do banco nao for reconhecida (dado inconsistente),
  // cai pro estado de erro em vez de desenhar uma mesa errada. Pura —
  // sem setState dentro do useMemo, pra nao gerar efeito colateral em render.
  const { seatLayout, layoutError } = useMemo((): { seatLayout: SeatLayoutSlot[] | null; layoutError: Error | null } => {
    if (!hand) return { seatLayout: null, layoutError: null };
    try {
      return { seatLayout: computeStylizedSeatLayout(hand.position), layoutError: null };
    } catch (e) {
      return { seatLayout: null, layoutError: e instanceof Error ? e : new Error("Posição de hero inválida.") };
    }
  }, [hand]);

  // Projecao do replay pra rua atual — pura, recalcula do zero a cada
  // chamada a partir da mao inteira (mesmo principio do veredito GTO:
  // uma unica fonte de verdade).
  const { replayState, replayError } = useMemo((): { replayState: ReplayState | null; replayError: string | null } => {
    if (!parsedHand) return { replayState: null, replayError: null };
    try {
      return { replayState: projectHandAtStreet(parsedHand, replayStreetIndex), replayError: null };
    } catch (e) {
      if (e instanceof HandReplayError) return { replayState: null, replayError: e.message };
      return { replayState: null, replayError: e instanceof Error ? e.message : "Erro ao montar a mesa dessa mão." };
    }
  }, [parsedHand, replayStreetIndex]);

  const goToStreet = useCallback((i: number) => setReplayStreetIndex(i), []);
  const nextStreet = useCallback(() => {
    if (replayState && replayStreetIndex < replayState.streetCount - 1) setReplayStreetIndex((i) => i + 1);
  }, [replayState, replayStreetIndex]);
  const prevStreet = useCallback(() => setReplayStreetIndex((i) => Math.max(0, i - 1)), []);

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
  // So ativos no modo drill — no replay, setas do teclado navegam rua.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;

      if (viewMode === "replay") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nextStreet();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prevStreet();
        }
        return;
      }

      if (viewMode !== "drill") return;
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
  }, [viewMode, actions, chosen, onAct, nextHand, nextStreet, prevStreet]);

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
            {viewMode === "drill" && suggestionId && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(168,85,247,0.9)" }}>
                Sugestão do Revisor de Mãos
              </span>
            )}
            {viewMode === "replay" && parsedHand && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(52,211,153,0.9)" }}>
                Revisão · {parsedHand.site === "pokerstars" ? "PokerStars" : parsedHand.site} #{parsedHand.handId}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === "drill" && hand && (
              <SessionInline handIdx={idx + 1} handsTotal={hands.length} hits={stats.hits} total={stats.total} sessionPct={sessionPct} />
            )}
          </div>
          {viewMode === "drill" && chosen && hand && <NextButton onClick={nextHand} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", gap: 12, minHeight: 420 }}>
          <FilterSidebar
            filters={filters}
            onSet={setFilter}
            facets={facets}
            activeCount={activeCount}
            disabled={!!suggestionId || viewMode === "replay"}
            disabledReason={
              suggestionId
                ? "Sugestão do Revisor de Mãos ativa — filtros manuais desabilitados."
                : viewMode === "replay"
                  ? "Uma mão colada está ativa — clique em \"Colar novo hand history\" ou selecione um filtro pra sair do replay."
                  : undefined
            }
            onStartPaste={startPaste}
          />

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 0 }}>
            {viewMode === "paste" && (
              <PasteHandBox value={pasteText} onChange={setPasteText} onSubmit={handleParsePaste} error={parseError} loading={false} />
            )}

            {viewMode === "drill" &&
              (hand && tableHand && seatLayout ? (
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
                      <button onClick={reload} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Tentar novamente
                      </button>
                    </>
                  ) : hand && layoutError ? (
                    <>
                      <AlertTriangle size={32} color={T.bad} />
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
                        Essa mão veio com posição inconsistente no banco ({layoutError.message}). Pula pra próxima em vez de exibir errado.
                      </p>
                      <button onClick={nextHand} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        Próxima mão
                      </button>
                    </>
                  ) : (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{emptyMessage}</p>
                  )}
                </div>
              ))}

            {viewMode === "replay" &&
              (replayState ? (
                <div style={{ width: "100%", height: "100%", maxWidth: 820, maxHeight: 460, margin: "auto" }}>
                  <PokerTable hand={replayState.tableHand} seats={replayState.seatLayout} onStreetClick={goToStreet} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, maxWidth: 360, textAlign: "center" }}>
                  <AlertTriangle size={32} color={T.bad} />
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>{replayError}</p>
                  <button onClick={startPaste} style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    Colar outra mão
                  </button>
                </div>
              ))}
          </div>

          <div style={{ overflowY: "auto" }}>
            {viewMode === "drill" &&
              (chosen && hand && result ? (
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
              ))}

            {viewMode === "paste" && (
              <aside
                style={{
                  fontFamily: F,
                  padding: "16px 14px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.6,
                }}
              >
                Hoje só reconhecemos hand history do PokerStars. Cole o texto completo, sem edições — o parser precisa do cabeçalho e do SUMMARY inteiros pra montar a mesa certa.
              </aside>
            )}

            {viewMode === "replay" && parsedHand && (
              <aside
                style={{
                  fontFamily: F,
                  padding: "16px 14px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                  Detalhes da mão
                </span>
                <StatRow label="Blinds" value={`${parsedHand.smallBlind}/${parsedHand.bigBlind}`} />
                <StatRow label="Mesa" value={`${parsedHand.seats.length}-max`} />
                {replayState && <StatRow label="Rua" value={`${replayState.streetIndex + 1}/${replayState.streetCount}`} />}

                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  {saveState === "saving" && (
                    <>
                      <Loader2 size={12} color="rgba(255,255,255,0.5)" />
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>Salvando no Revisor de Mãos...</span>
                    </>
                  )}
                  {saveState === "saved" && (
                    <>
                      <CheckCircle2 size={12} color={T.ok} />
                      <span style={{ color: T.ok }}>Salvo no Revisor de Mãos</span>
                    </>
                  )}
                  {saveState === "error" && (
                    <>
                      <AlertTriangle size={12} color={T.bad} />
                      <span style={{ color: T.bad }}>Não salvou no Revisor — pode revisar aqui mesmo assim</span>
                    </>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>

        <div style={{ minHeight: 72, display: "flex", alignItems: "center", padding: "0 4px" }}>
          {viewMode === "drill" && hand && !chosen && seatLayout && <ActionBar actions={actions} onAct={onAct} />}
          {viewMode === "drill" && hand && chosen && (
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

          {viewMode === "replay" && replayState && (
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button
                onClick={prevStreet}
                disabled={replayState.streetIndex === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: replayState.streetIndex === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)",
                  borderRadius: 10,
                  padding: "9px 14px",
                  cursor: replayState.streetIndex === 0 ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                <ChevronLeft size={14} /> Rua anterior
              </button>

              <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", minWidth: 90, textAlign: "center" }}>
                {replayState.tableHand.history[replayState.streetIndex]?.street} ({replayState.streetIndex + 1}/{replayState.streetCount})
              </span>

              <button
                onClick={nextStreet}
                disabled={replayState.streetIndex >= replayState.streetCount - 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: replayState.streetIndex >= replayState.streetCount - 1 ? "transparent" : "#FFFFFF",
                  border: replayState.streetIndex >= replayState.streetCount - 1 ? "1px solid rgba(255,255,255,0.14)" : "0",
                  color: replayState.streetIndex >= replayState.streetCount - 1 ? "rgba(255,255,255,0.25)" : "#111111",
                  borderRadius: 10,
                  padding: "9px 14px",
                  cursor: replayState.streetIndex >= replayState.streetCount - 1 ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                Próxima rua <ChevronRight size={14} />
              </button>
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
