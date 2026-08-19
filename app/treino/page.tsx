"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, SkipForward, SlidersHorizontal, X, Layers, Target, CheckCircle2, XCircle, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PokerTable, type TableHand } from "@/components/drill/poker-table";
import { ActionBar, type DrillAction } from "@/components/drill/action-bar";
import { GtoFeedback } from "@/components/drill/gto-feedback";
import { RangeDrill } from "@/components/drill/range-drill";
import { RfiJamDrill } from "@/components/drill/rfi-jam-drill";
import {
  fetchDrillBatch,
  fetchDrillBatchBySuggestion,
  fetchDrillFacets,
  type DrillHand,
  type DrillFacet,
} from "@/lib/services/drill-service";
import { useDrillFilters, type DrillFilterKey } from "@/lib/poker/use-drill-filters";
import { matchUserActionToGtoNode, describeAction, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
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
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 14.5,
    fontWeight: 700,
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

// Traduz o veredito local (OTIMA/ACEITAVEL/ERRO_LEVE/ERRO_GRAVE/UNKNOWN,
// de gto-verdict.ts) pro vocabulário que register_training() espera
// ('PERFECT'/'OK'/'BLUNDER' — literais que o RPC checa por igualdade
// exata pra decidir XP base e reset de combo). Só remapeia os 2 tiers
// que têm efeito especial no RPC:
//   OTIMA      -> PERFECT  (25 XP base, incrementa combo)
//   ERRO_GRAVE -> BLUNDER  (10 XP base, ZERA o combo)
// ACEITAVEL vira 'OK' (15 XP, combo neutro) — é o único outro literal
// que o RPC reconhece. ERRO_LEVE passa como está: cai no "else" do RPC
// (10 XP, sem mexer no combo) — não é um blunder de verdade, não deveria
// quebrar o streak, mas também não merece o XP de uma jogada aceitável.
// UNKNOWN retorna null — sem combo válido no solver pra essa mão, não
// registra nada (evita sujar training_sessions/xp_events com dado
// inventado).
function toRegisterTrainingVerdict(v: Verdict): string | null {
  if (v === "UNKNOWN") return null;
  if (v === "OTIMA") return "PERFECT";
  if (v === "ACEITAVEL") return "OK";
  if (v === "ERRO_GRAVE") return "BLUNDER";
  return v; // ERRO_LEVE
}

const VERDICT_LABEL: Record<Verdict, string> = {
  OTIMA: "Jogada Ótima",
  ACEITAVEL: "Aceitável",
  ERRO_LEVE: "Erro Leve",
  ERRO_GRAVE: "Erro Grave",
  UNKNOWN: "Sem dados do solver",
};

// Veredito na PRÓPRIA mesa — antes o único feedback imediato vivia no
// painel lateral/bottom sheet, fora do centro de atenção do jogador
// (que está olhando pra mesa, não pro painel). Isso não substitui o
// GtoFeedback (que continua com o detalhe técnico: frequência, EV,
// range) — é só o "acertei/errei" instantâneo, no lugar onde o olho já
// está.
function VerdictFlash({ verdict, chosenFreq }: { verdict: Verdict; chosenFreq: number }) {
  const color = verdictColor(verdict);
  const isGood = verdict === "OTIMA" || verdict === "ACEITAVEL";
  const Icon = isGood ? CheckCircle2 : XCircle;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10%", pointerEvents: "none", zIndex: 50 }}>
      <div
        style={{
          fontFamily: F,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 18px",
          borderRadius: 999,
          background: "rgba(5,5,5,0.9)",
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 28px ${color}55, 0 6px 16px rgba(0,0,0,.6)`,
          animation: "fadeInUp 220ms ease-out both",
        }}
      >
        <Icon size={17} color={color} strokeWidth={2.2} />
        <span style={{ color, fontWeight: 700, fontSize: 14 }}>{VERDICT_LABEL[verdict]}</span>
        {verdict !== "UNKNOWN" && (
          <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11.5, fontWeight: 600, ...num }}>{Math.round(chosenFreq * 100)}%</span>
        )}
      </div>
    </div>
  );
}

// Chip de XP ganho — conecta a sessão de treino ao resto do produto
// (Hub de Evolução). Antes o drill era uma ilha: respondia, via
// certo/errado local, e nada disso batia no banco. Some sozinho quando
// a próxima mão carrega (nextHand limpa o estado).
function XpFlash({ xp, levelUp, newLevel }: { xp: number; levelUp: boolean; newLevel: number | null }) {
  return (
    <div
      style={{
        fontFamily: F,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 999,
        background: "rgba(234,179,8,0.12)",
        border: "1px solid rgba(234,179,8,0.4)",
        color: "#EAB308",
        fontSize: 14.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        animation: "fadeInUp 220ms ease-out both",
      }}
    >
      <Zap size={12} strokeWidth={2.4} />
      <span style={{ ...num }}>+{xp} XP</span>
      {levelUp && <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 600 }}>· Nível {newLevel}!</span>}
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
        /* Tela travada em 100dvh com overflow hidden: o jogador não
           deve precisar rolar pra achar os botões de aposta (bug
           reportado). dvh em vez de vh porque a barra de endereço do
           navegador mobile encolhe a viewport e o vh não reage. */
        html, body { overflow: hidden; }
        .ps-treino-page {
          padding: 0 !important;
          height: 100dvh !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .ps-treino-card {
          padding: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          height: 100dvh !important;
          gap: 0 !important;
          overflow: hidden !important;
        }
        /* Tabs agora vivem dentro da própria linha do header (não são
           mais absolutas): basta não deixá-las esticar. */
        .ps-treino-tabs { transform: scale(.88); transform-origin: center right; }
        .ps-tr-header {
          padding: 6px 8px 0 !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          flex-shrink: 0;
        }
        /* Botão de filtros à esquerda — as tabs ocupam a direita. */
        .ps-tr-filters-toggle { display: flex !important; order: 0; }
        .ps-tr-session { flex: 1 1 auto !important; order: 1; }
        .ps-tr-body {
          grid-template-columns: 1fr !important;
          padding: 0 8px 8px !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
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
          max-height: 62dvh;
          overflow-y: auto;
          border-radius: 18px 18px 0 0 !important;
          box-shadow: 0 -20px 50px rgba(0,0,0,.6);
          padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important;
        }
        .ps-tr-table-col { gap: 6px !important; min-height: 0 !important; }
        .ps-tr-table-inner { padding-top: 0 !important; }
        .ps-tr-table-wrap { max-width: none !important; max-height: none !important; }
        .ps-tr-sheet-close { display: flex !important; }
        /* Barra de apostas compacta: botões menores e sempre visíveis
           dentro da tela, sem scroll (bug reportado). */
        .ps-tr-actions {
          min-height: 0 !important;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .ps-tr-actions button {
          padding: 8px 10px !important;
          border-radius: 10px !important;
        }
        .ps-tr-actions button span { font-size: 12px !important; }
      }
    `}</style>
  );
}

function TreinoPageInner({ tabs }: { tabs?: React.ReactNode }) {
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
  // XP ganho na última mão respondida — conecta a sessão ao Hub de
  // Evolução (award_xp/register_training). null enquanto não há
  // resposta, ou se a mão não tinha combo válido pra registrar.
  const [xpFlash, setXpFlash] = useState<{ xp: number; levelUp: boolean; newLevel: number | null } | null>(null);
  // Metadados do leak que originou esse treino (só existe no caminho
  // "Treinar esse leak" do Revisor de Mãos, via suggestionId).
  const [suggestionMeta, setSuggestionMeta] = useState<{ title: string; tagLabel: string | null } | null>(null);
  // Bottom sheet do resultado, no mobile — antes só sumia trocando de
  // mão (bug reportado: "após fazer um drill a tela não fecha da
  // resposta"). Agora tem um X próprio pra recolher sem precisar
  // avançar pra próxima mão; reabre sozinho a cada nova resposta.
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

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

  // Conecta o header ao leak real que originou o treino (drill_title /
  // tag_label de hand_review_drill_suggestions), em vez do texto
  // genérico fixo "Sugestão do Revisor de Mãos" que não dizia qual leak
  // era. Só roda no caminho "Treinar esse leak" (suggestionId presente).
  useEffect(() => {
    if (!suggestionId) {
      setSuggestionMeta(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("hand_review_drill_suggestions")
      .select("drill_title, tag_label")
      .eq("id", suggestionId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setSuggestionMeta({ title: data.drill_title, tagLabel: data.tag_label });
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

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
    // NÃO fecha o drawer aqui: fechar a cada filtro escolhido obrigava
    // o jogador a reabrir pra selecionar os outros dois eixos (bug
    // reportado). O drawer só fecha por ação explícita (X ou toque no
    // fundo escuro).
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
    setXpFlash(null);
    setSheetCollapsed(false);
    if (idx + 1 < hands.length) setIdx((i) => i + 1);
    else { reload(); setIdx(0); }
  }, [idx, hands.length, reload]);

  useEffect(() => {
    if (!chosen || !result || !hand) return;
    setStats((prev) => ({ hits: prev.hits + (result.verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    setSheetCollapsed(false);

    // Registra o drill no banco (award_xp + missões + combo) — antes a
    // sessão só vivia em estado local (`stats`), nada ia pro Hub de
    // Evolução. UNKNOWN não registra (sem combo válido no solver pra
    // essa mão, não dá pra afirmar acerto/erro).
    const rpcVerdict = toRegisterTrainingVerdict(result.verdict);
    if (!rpcVerdict) return;
    const supabase = createClient();
    supabase
      .rpc("register_training", {
        p_spot_id: hand.drillId,
        p_verdict: rpcVerdict,
        p_ev_loss: null,
        p_user_action: chosen.type,
        p_user_sizing: chosen.sizing ?? null,
      })
      .then(({ data, error }) => {
        if (error || !data || !data[0]) return;
        const row = data[0];
        setXpFlash({ xp: row.xp_final, levelUp: row.level_up, newLevel: row.new_level ?? null });
      });
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

      <div className="ps-tr-header" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, minHeight: 40 }}>
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
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(168,85,247,0.9)" }}>
            {suggestionMeta ? suggestionMeta.title : "Sugestão do Revisor de Mãos"}
          </span>
        )}
        {!suggestionId && (presetPos || presetAction || presetStreet) && (
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(196,181,253,0.9)" }}>Spot do Revisor de Mãos</span>
        )}

        <div className="ps-tr-session" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          {hand && <SessionInline handIdx={idx + 1} handsTotal={hands.length} hits={stats.hits} total={stats.total} sessionPct={sessionPct} />}
          {xpFlash && <XpFlash xp={xpFlash.xp} levelUp={xpFlash.levelUp} newLevel={xpFlash.newLevel} />}
        </div>

        {/* Tabs GTO/Ranges renderizadas AQUI, na mesma linha do header —
            antes viviam numa linha própria acima, o que criava duas
            faixas quase vazias empilhadas (tabs sozinhas numa, chips
            sozinhos na outra). Uma linha só resolve o desperdício
            vertical e mantém as tabs à direita. */}
        {tabs}
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
        <div className="ps-tr-table-col" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Alinhamento no topo (não mais "center") — centralizar
              verticalmente dentro de uma coluna com altura sobrando
              empurrava mesa + botões pra baixo, cortando os botões da
              tela (bug reportado: "muita tela preta em cima, tudo
              voando" / "botões fora da tela"). */}
          <div className="ps-tr-table-inner" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", flex: 1, minHeight: 0, paddingTop: 6 }}>
            {hand && tableHand && seatLayout ? (
              // Mesa reduzida (1100x640 → 900x560) e a barra de apostas
              // agora mora DENTRO deste mesmo wrapper, como filho direto
              // logo abaixo da mesa — antes era um elemento irmão fora
              // desse container, o que a fazia parecer "flutuando" sem
              // relação com a mesa (pedido explícito: "trazer os botões
              // pra dentro do layout da mesa").
              <div className="ps-tr-table-wrap" style={{ width: "100%", height: "100%", maxWidth: 900, maxHeight: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  <PokerTable hand={tableHand} seats={seatLayout} variant="treino" />
                  {/* Veredito imediato NA mesa — antes o "acertei/errei" só
                      aparecia no painel lateral, longe de onde o olho do
                      jogador está fixo (a mesa). O detalhe técnico
                      continua no GtoFeedback ao lado/embaixo. */}
                  {chosen && result && <VerdictFlash verdict={result.verdict} chosenFreq={result.chosenFreq} />}
                </div>

                {/* Altura reservada e fixa (não `minHeight`): a barra de
                    apostas nunca cede espaço pra mesa. Antes ela era o
                    último elemento do fluxo e, quando a mesa crescia,
                    era ela que saía da tela. Agora a mesa é quem encolhe
                    (flex:1 + minHeight:0 acima). */}
                <div className="ps-tr-actions" style={{ height: 62, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {hand && !chosen && seatLayout && (
                    <div style={{ flex: 1 }}>
                      <ActionBar actions={actions} onAct={onAct} />
                    </div>
                  )}
                  {hand && chosen && (
                    <>
                      <div style={{ fontFamily: F, flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                        Você jogou <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{chosen.label}</span> — detalhe completo no painel.
                      </div>
                      {/* "Próxima" saiu do header (longe da mesa) e ficou
                          aqui, colada na própria linha de ação, embaixo
                          da mesa — pedido explícito: "próximo à mesa e
                          não fora". */}
                      <NextButton onClick={nextHand} />
                    </>
                  )}
                </div>
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
        </div>

        {/* Resultado do drill — no desktop segue como coluna à direita.
            No mobile (sem espaço pra 3ª coluna com a mesa em tela cheia)
            vira um bottom sheet: some por completo enquanto não há
            escolha (a mesa + barra de apostas já comunicam isso sozinhas)
            e sobe de baixo, com scroll próprio, assim que o jogador age.
            Tem um X pra recolher sem precisar avançar de mão (bug
            reportado: sheet não fechava depois da resposta). */}
        {chosen && hand && result && !sheetCollapsed ? (
          <div className="ps-tr-feedback ps-tr-feedback-sheet" style={{ overflowY: "auto", background: "#0A0A0A", position: "relative" }}>
            <button
              onClick={() => setSheetCollapsed(true)}
              className="ps-tr-sheet-close"
              style={{ position: "absolute", top: 10, right: 10, zIndex: 2, display: "none", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}
              aria-label="Fechar resultado"
            >
              <X size={15} />
            </button>
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
type GtoMode = "postflop" | "preflop";

function TreinoTabs() {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "ranges" ? "ranges" : "gto";
  const initialRangeId = searchParams.get("rangeId");
  const [tab, setTab] = useState<Tab>(initialTab);
  // Sub-modo só existe dentro da aba GTO: Pós-flop é o drill que já
  // existia (PokerTable/ActionBar), Pré-flop é o RFI/Jam novo. Não é
  // uma aba própria de propósito — o pedido foi manter só uma tela
  // "GTO" no nível principal.
  const [gtoMode, setGtoMode] = useState<GtoMode>("postflop");

  // Altura disponível medida, não chutada. Antes o card usava
  // `calc(100vh - 32px)`, ignorando o header global do app que fica
  // acima desta página — o card ficava mais alto que o espaço real e o
  // rodapé (barra de apostas) caía fora da tela (bug reportado: "cadê o
  // botão de aposta? sumiu"). Medindo o offset real do topo do
  // container, isso funciona com qualquer header, sem hardcode.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setAvailableHeight(Math.max(320, window.innerHeight - top));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const tabsNode = (
    <div className="ps-treino-tabs" style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 10, background: "#111111", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
      {(["gto", "ranges"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
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
  );

  // Sub-toggle Pós-flop/Pré-flop, só visível dentro da aba GTO — visual
  // mais discreto que as tabs principais, pra deixar claro que é um
  // sub-modo, não uma aba de mesmo nível.
  const gtoModeToggle =
    tab === "gto" ? (
      <div style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 10, background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {(["postflop", "preflop"] as GtoMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setGtoMode(m)}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: gtoMode === m ? "rgba(255,255,255,0.9)" : "transparent",
              color: gtoMode === m ? "#111111" : "rgba(255,255,255,0.45)",
            }}
          >
            {m === "postflop" ? "Pós-flop" : "Pré-flop"}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      ref={pageRef}
      className="ps-treino-page"
      style={{
        fontFamily: F,
        height: availableHeight ? `${availableHeight}px` : "100vh",
        background: "#050505",
        padding: 16,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
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
          height: "100%",
          margin: "0 auto",
          background: "#050505",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Bloco de tabs — não é mais renderizado como linha própria do
            card. Vai como prop pro header do drill, entrando na mesma
            linha dos chips de sessão (fim do desperdício de duas faixas
            empilhadas). Na aba Ranges, que não tem header próprio, ele
            volta a ser renderizado direto. */}
        {tab === "gto" ? (
          gtoMode === "preflop" ? (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
                {gtoModeToggle}
                {tabsNode}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <div className="h-full overflow-y-auto text-ink">
                  <RfiJamDrill />
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <TreinoPageInner
                tabs={
                  <div style={{ display: "flex", gap: 8 }}>
                    {gtoModeToggle}
                    {tabsNode}
                  </div>
                }
              />
            </div>
          )
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>{tabsNode}</div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <div className="h-full overflow-y-auto text-ink">
                <RangeDrill initialRangeId={initialRangeId} />
              </div>
            </div>
          </>
        )}
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
