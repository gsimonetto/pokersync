"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, X, CheckCircle2, XCircle } from "lucide-react";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import { TreinoResponsiveStyles } from "@/components/drill/treino-responsive-styles";
import { PokerTable, type TableHand, type SeatState } from "@/components/drill/poker-table";
import { computeStylizedSeatLayout } from "@/lib/poker/seat-layout";
import {
  getRfiJamSpot,
  listRfiJamSpots,
  type RfiJamListItem,
  type RfiJamPhaseRaw,
  type RfiJamSpot,
} from "@/lib/services/rfi-jam-service";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const F = '"Space Grotesk", sans-serif';

function allLabels(): string[] {
  const out: string[] = [];
  for (let row = 0; row < RANKS.length; row++) {
    for (let col = 0; col < RANKS.length; col++) {
      if (row === col) out.push(`${RANKS[row]}${RANKS[col]}`);
      else if (row < col) out.push(`${RANKS[row]}${RANKS[col]}s`);
      else out.push(`${RANKS[col]}${RANKS[row]}o`);
    }
  }
  return out;
}
const ALL_LABELS = allLabels();

function comboCount(label: string): number {
  if (label.length === 2) return 6;
  return label.endsWith("s") ? 4 : 12;
}

function dealWeightedHand(): string {
  const weights = ALL_LABELS.map(comboCount);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ALL_LABELS.length; i++) {
    r -= weights[i];
    if (r <= 0) return ALL_LABELS[i];
  }
  return ALL_LABELS[ALL_LABELS.length - 1];
}

// Combo concreto só pra DESENHAR na mesa (a lógica de frequência/EV
// continua sendo por classe, igual sempre foi) -- ex "AKs" -> ["Ah","Kh"],
// "76o" -> ["7h","6d"], "TT" -> ["Th","Td"]. Sem aleatoriedade de naipe
// proposital: não importa qual naipe exato, é só ilustrativo.
function classToDisplayCards(label: string): [string, string] {
  if (label.length === 2) {
    const r = label[0];
    return [`${r}h`, `${r}d`];
  }
  const r1 = label[0];
  const r2 = label[1];
  const suited = label[2] === "s";
  return suited ? [`${r1}h`, `${r2}h`] : [`${r1}h`, `${r2}d`];
}

const PHASES: { key: "sbOpen" | "bbJam" | "sbCallJam"; label: string }[] = [
  { key: "sbOpen", label: "vs Open (abrir)" },
  { key: "bbJam", label: "vs Jam (responder)" },
  { key: "sbCallJam", label: "vs All-in (pagar)" },
];

const ACTION_LABEL: Record<RfiJamPhaseRaw["action"], string> = {
  open: "Abrir (raise)",
  jam: "Jam (all-in)",
  call: "Pagar (call)",
};

// Ordem pedida explicitamente: UTG ... até BB. Token usado nos spot_ids
// gerados pelo motor (ex "btn_vs_bb") segue lib/poker/... já usada em
// app/treino/page.tsx pro lado pós-flop (VILLAIN_TOKEN_TO_POS).
const ALL_POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];
const POS_TO_TOKEN: Record<string, string> = {
  UTG: "utg",
  "UTG+1": "utg1",
  MP: "mp",
  HJ: "hj",
  CO: "co",
  BTN: "btn",
  SB: "sb",
  BB: "bb",
};
const TOKEN_TO_POS: Record<string, string> = Object.fromEntries(
  Object.entries(POS_TO_TOKEN).map(([label, token]) => [token, label])
);

function matchupKey(hero: string, villain: string): string {
  return `${POS_TO_TOKEN[hero]}_vs_${POS_TO_TOKEN[villain]}`;
}

function parseMatchup(matchup: string): { hero: string | null; villain: string | null } {
  const [heroToken, villainToken] = matchup.split("_vs_");
  return { hero: TOKEN_TO_POS[heroToken] ?? null, villain: TOKEN_TO_POS[villainToken] ?? null };
}

const STACK_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 60];

// "Tipo" de solve -- hoje só existe ICM no banco (todo job de RFI/Jam
// usa engine/rfi_jam.py, que é ICM-aware). ChipEV puro (sem considerar
// prêmio/payout) ainda não foi gerado por nenhum job -- fica riscado
// até existir, mesmo padrão pedido pras outras dimensões.
const TYPE_OPTIONS = [
  { key: "icm", label: "ICM" },
  { key: "chip_ev", label: "ChipEV" },
];

const MARGINAL_GAP_THRESHOLD = 0.5;

interface Round {
  label: string;
  freq: number;
  ev: number;
  gap: number;
}

function FilterChip({
  label, active, disabled, onClick,
}: { label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "Sem mãos geradas para essa combinação ainda" : undefined}
      style={{
        fontFamily: F,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        border: active ? "1px solid rgba(255,255,255,0.9)" : disabled ? "1px dashed rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "#FFFFFF" : "rgba(255,255,255,0.02)",
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

// Veredito flutuando NA PRÓPRIA MESA -- feedback imediato de "acertei/
// errei" no lugar onde o olho do jogador está fixo assim que ele age
// (fundamental, pedido explícito: existia antes e some com a troca de
// mão). Complementa (não substitui) o painel com os números, que fica
// acima da mesa. `isGood`/label/color já vêm resolvidos de fora pra
// respeitar o caso "MARGINAL" (que não é bem um Verdict do banco).
function VerdictFlash({ label, color, isGood, freqPct }: { label: string; color: string; isGood: boolean; freqPct: number | null }) {
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
        <span style={{ color, fontWeight: 700, fontSize: 14 }}>{label}</span>
        {freqPct != null && (
          <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{freqPct}%</span>
        )}
      </div>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

interface RfiJamDrillProps {
  tabs?: React.ReactNode;
}

// Tela única de treino (pré-flop RFI/Jam por enquanto -- é o único
// tipo de spot com dado real no banco hoje). Sem abas: filtros à
// esquerda, mesa (com o herói de verdade sentado, feltro azul) no
// meio, resultado GTO numa linha acima da mesa.
export function RfiJamDrill({ tabs }: RfiJamDrillProps) {
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [heroPos, setHeroPos] = useState<string>("SB");
  const [villainPos, setVillainPos] = useState<string>("BB");
  const [stackBb, setStackBb] = useState<number>(15);
  const [spot, setSpot] = useState<RfiJamSpot | null>(null);
  const [phaseKey, setPhaseKey] = useState<(typeof PHASES)[number]["key"]>("sbOpen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [round, setRound] = useState<Round | null>(null);
  const [chosen, setChosen] = useState<"fold" | "action" | null>(null);
  const [stats, setStats] = useState({ hits: 0, total: 0 });

  useEffect(() => {
    listRfiJamSpots()
      .then((rows) => {
        setSpots(rows);
        if (rows.length > 0) {
          const { hero, villain } = parseMatchup(rows[0].matchup);
          if (hero) setHeroPos(hero);
          if (villain) setVillainPos(villain);
          setStackBb(rows[0].stackBb);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Erro ao listar spots RFI/Jam.");
        setLoading(false);
      });
  }, []);

  // Disponibilidade de cada dimensão do filtro, dado o que já está
  // selecionado nas outras -- mesmo padrão do FilterSidebar da aba
  // Pós-flop (counts condicionados). Villão hero->villão hero->stack
  // formam uma cadeia (cada um restringe o próximo).
  const villainsForHero = useMemo(
    () => new Set(spots.filter((s) => parseMatchup(s.matchup).hero === heroPos).map((s) => parseMatchup(s.matchup).villain)),
    [spots, heroPos]
  );
  const stacksForMatchup = useMemo(
    () =>
      Array.from(new Set(spots.filter((s) => s.matchup === matchupKey(heroPos, villainPos)).map((s) => s.stackBb))).sort(
        (a, b) => a - b
      ),
    [spots, heroPos, villainPos]
  );
  const heroHasAnyData = useCallback(
    (pos: string) => spots.some((s) => parseMatchup(s.matchup).hero === pos),
    [spots]
  );

  // Auto-correção quando a seleção atual fica inválida (ex: trocou o
  // herói e o vilão selecionado não existe mais pra esse herói) --
  // sempre cai no primeiro disponível, nunca trava num estado sem dado.
  useEffect(() => {
    if (villainsForHero.size > 0 && !villainsForHero.has(villainPos)) {
      const first = spots.find((s) => parseMatchup(s.matchup).hero === heroPos);
      if (first) setVillainPos(parseMatchup(first.matchup).villain ?? villainPos);
    }
  }, [villainsForHero, villainPos, heroPos, spots]);

  useEffect(() => {
    if (stacksForMatchup.length > 0 && !stacksForMatchup.includes(stackBb)) {
      setStackBb(stacksForMatchup[0]);
    }
  }, [stacksForMatchup, stackBb]);

  const spotId = useMemo(() => {
    const key = matchupKey(heroPos, villainPos);
    const found = spots.find((s) => s.matchup === key && s.stackBb === stackBb);
    return found?.spotId ?? "";
  }, [spots, heroPos, villainPos, stackBb]);

  useEffect(() => {
    if (!spotId) {
      setSpot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getRfiJamSpot(spotId)
      .then((s) => setSpot(s))
      .catch(() => setError("Erro ao carregar esse spot."))
      .finally(() => setLoading(false));
  }, [spotId]);

  const currentPhase: RfiJamPhaseRaw | null = useMemo(() => {
    if (!spot) return null;
    if (phaseKey === "sbOpen") return spot.sbOpen;
    if (phaseKey === "bbJam") return spot.bbJam;
    return spot.sbCallJam;
  }, [spot, phaseKey]);

  const nextRound = useCallback((phase: RfiJamPhaseRaw) => {
    const label = dealWeightedHand();
    const hand = phase.hands[label] ?? [0, phase.ev_fold, 0];
    const [freq, ev, gap] = hand;
    setRound({ label, freq, ev, gap });
    setChosen(null);
    setFiltersOpen(false);
  }, []);

  useEffect(() => {
    if (currentPhase) nextRound(currentPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase]);

  const isMarginal = round ? round.gap < MARGINAL_GAP_THRESHOLD : false;

  const verdict: Verdict | null = useMemo(() => {
    if (!round || !chosen) return null;
    const chosenFreq = chosen === "fold" ? 1 - round.freq : round.freq;
    return classifyFrequency(chosenFreq);
  }, [round, chosen]);

  const displayLabel = isMarginal && verdict ? "MARGINAL" : verdict?.replace("_", " ");
  const displayColor = isMarginal ? "#f5a524" : verdict ? verdictColor(verdict) : undefined;
  const isGoodVerdict = verdict === "OTIMA" || verdict === "ACEITAVEL";
  const chosenFreqPct = round && chosen ? Math.round((chosen === "fold" ? 1 - round.freq : round.freq) * 100) : null;

  useEffect(() => {
    if (!chosen || !verdict) return;
    setStats((prev) => ({ hits: prev.hits + (verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (chosen && currentPhase) nextRound(currentPhase);
        return;
      }
      if (!chosen) {
        if (e.key.toUpperCase() === "Q") setChosen("fold");
        if (e.key.toUpperCase() === "W") setChosen("action");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, currentPhase, nextRound]);

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;
  const actionLabel = currentPhase ? ACTION_LABEL[currentPhase.action] : "";
  const emptyMessage = spots.length === 0 ? "Nenhum spot RFI/Jam encontrado no Supabase ainda." : "Sem mãos geradas pra essa combinação de filtros ainda.";

  // Quem senta como "herói" na mesa varia por situação: sbOpen/sbCallJam
  // testam a decisão de quem abre (heroPos), bbJam testa a decisão de
  // quem defende (villainPos) -- a mesa reflete isso trocando quem
  // recebe as cartas viradas, mesmo a posição ancorada embaixo
  // continuando sendo a do filtro "Posição Herói" (simplificação
  // deliberada da v1: não gira a mesa por fase, só troca quem age).
  const activeHeroSeat = phaseKey === "bbJam" ? villainPos : heroPos;
  const activeVillainSeat = phaseKey === "bbJam" ? heroPos : villainPos;

  const { seatLayout, layoutError } = useMemo(() => {
    try {
      return { seatLayout: computeStylizedSeatLayout(heroPos), layoutError: null as Error | null };
    } catch (e) {
      return { seatLayout: null, layoutError: e instanceof Error ? e : new Error("Posição inválida.") };
    }
  }, [heroPos]);

  const tableHand: TableHand | null = useMemo(() => {
    if (!spot || !round) return null;
    const heroCards = classToDisplayCards(round.label);
    const seats: Record<string, SeatState> = {};
    ALL_POSITIONS.forEach((pos) => {
      if (pos === activeHeroSeat) {
        seats[pos] = { status: chosen ? "live" : "acting", stack: spot.effectiveStack, cards: heroCards };
      } else if (pos === activeVillainSeat) {
        seats[pos] = { status: "live", stack: spot.effectiveStack };
      } else {
        seats[pos] = { status: "empty" };
      }
    });
    return { pot: spot.pot, spr: null, board: [], history: [], seats };
  }, [spot, round, chosen, activeHeroSeat, activeVillainSeat]);

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, height: "100%", minHeight: 0, position: "relative" }}>
      <TreinoResponsiveStyles />

      <div className="ps-tr-header" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, minHeight: 40 }}>
        <button
          className="ps-tr-filters-toggle"
          onClick={() => setFiltersOpen(true)}
          style={{ alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0 }}
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} />
        </button>

        <div className="ps-tr-session" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          {stats.total > 0 && (
            <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              {stats.hits}/{stats.total} ótimas · {sessionPct}%
            </span>
          )}
        </div>

        {tabs}
      </div>

      <div className="ps-tr-body" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 12, minHeight: 0 }}>
        <div className={`ps-tr-filters${filtersOpen ? " ps-tr-filters--open" : ""}`} style={{ position: "relative", minHeight: 0 }}>
          {filtersOpen && (
            <button
              onClick={() => setFiltersOpen(false)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}
            >
              <X size={15} />
            </button>
          )}

          <aside style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Filtros
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FilterSection label="Posição herói">
                {ALL_POSITIONS.map((p) => (
                  <FilterChip key={p} label={p} active={p === heroPos} disabled={!heroHasAnyData(p)} onClick={() => { setStats({ hits: 0, total: 0 }); setHeroPos(p); }} />
                ))}
              </FilterSection>

              <FilterSection label="Posição vilão">
                {ALL_POSITIONS.map((p) => (
                  <FilterChip key={p} label={p} active={p === villainPos} disabled={!villainsForHero.has(p)} onClick={() => { setStats({ hits: 0, total: 0 }); setVillainPos(p); }} />
                ))}
              </FilterSection>

              <FilterSection label="Stack">
                {STACK_OPTIONS.map((s) => (
                  <FilterChip key={s} label={`${s}bb`} active={s === stackBb} disabled={!stacksForMatchup.includes(s)} onClick={() => { setStats({ hits: 0, total: 0 }); setStackBb(s); }} />
                ))}
              </FilterSection>

              <FilterSection label="Situação">
                {PHASES.map((p) => (
                  <FilterChip key={p.key} label={p.label} active={p.key === phaseKey} disabled={!spot} onClick={() => { setStats({ hits: 0, total: 0 }); setPhaseKey(p.key); }} />
                ))}
              </FilterSection>

              <FilterSection label="Tipo">
                {TYPE_OPTIONS.map((t) => (
                  <FilterChip key={t.key} label={t.label} active={t.key === "icm"} disabled={t.key !== "icm"} onClick={() => {}} />
                ))}
              </FilterSection>
            </div>
          </aside>
        </div>

        {filtersOpen && (
          <div onClick={() => setFiltersOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 39 }} />
        )}

        <div className="ps-tr-table-col" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="ps-tr-table-inner" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", flex: 1, minHeight: 0, paddingTop: 6 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <Loader2 size={32} color="rgba(255,255,255,0.5)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Carregando…</p>
              </div>
            ) : error || !spot || layoutError ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
                {error || layoutError?.message || emptyMessage}
              </p>
            ) : round && currentPhase && tableHand && seatLayout ? (
              <div className="ps-tr-table-wrap" style={{ width: "100%", height: "100%", maxWidth: 900, maxHeight: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {chosen && verdict && (
                  <div className="ps-tr-feedback ps-tr-feedback-sheet" style={{ maxHeight: 220, overflowY: "auto", background: "#0A0A0A", position: "relative", fontFamily: F, padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                    <p style={{ marginBottom: 12, fontSize: 18, fontWeight: 600, color: displayColor }}>{displayLabel}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Fold</span>
                        <span style={{ color: "#FFFFFF" }}>{Math.round((1 - round.freq) * 100)}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{actionLabel}</span>
                        <span style={{ color: "#FFFFFF" }}>{Math.round(round.freq * 100)}%</span>
                      </div>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>EV fold</span>
                        <span style={{ color: "#FFFFFF" }}>{currentPhase.ev_fold.toFixed(1)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>EV {actionLabel.toLowerCase()}</span>
                        <span style={{ color: "#FFFFFF" }}>{round.ev.toFixed(1)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Gap</span>
                        <span style={{ color: isMarginal ? "#f5a524" : "#FFFFFF" }}>{round.gap.toFixed(2)}</span>
                      </div>
                      {isMarginal && (
                        <p style={{ marginTop: 4, fontSize: 11, color: "#f5a524", lineHeight: 1.5 }}>
                          Decisão marginal — as duas opções valem quase o mesmo EV.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  <PokerTable hand={tableHand} seats={seatLayout} variant="treino" />
                  {chosen && verdict && displayLabel && displayColor && (
                    <VerdictFlash label={displayLabel} color={displayColor} isGood={isGoodVerdict} freqPct={chosenFreqPct} />
                  )}
                </div>

                <div className="ps-tr-actions" style={{ height: 62, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {!chosen ? (
                    <div style={{ display: "flex", gap: 10, flex: 1, justifyContent: "center" }}>
                      <button
                        onClick={() => setChosen("fold")}
                        style={{ fontFamily: F, minWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        Fold
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Q</span>
                      </button>
                      <button
                        onClick={() => setChosen("action")}
                        style={{ fontFamily: F, minWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        {actionLabel}
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>W</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => nextRound(currentPhase)}
                      style={{ fontFamily: F, flex: 1, background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: 13 }}
                    >
                      Próxima mão <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>(espaço)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
