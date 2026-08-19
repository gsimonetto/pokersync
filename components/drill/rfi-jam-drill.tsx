"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import { TreinoResponsiveStyles } from "@/components/drill/treino-responsive-styles";
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

function formatMatchup(matchup: string): string {
  return matchup
    .split("_vs_")
    .map((p) => p.toUpperCase())
    .join(" vs ");
}

const MARGINAL_GAP_THRESHOLD = 0.5;

interface Round {
  label: string;
  freq: number;
  ev: number;
  gap: number;
}

// Mesmo visual do FilterChip da aba Pós-flop (componente local, não
// exportado de lá) — replicado aqui pra não acoplar os dois arquivos,
// mantendo pixel a pixel a mesma aparência.
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: F,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        border: active ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "#FFFFFF" : "rgba(255,255,255,0.02)",
        color: active ? "#111111" : "rgba(255,255,255,0.55)",
        transition: "all 160ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
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

// Mesmo shell visual da aba GTO Pós-flop (header + grid de 3 colunas,
// mesmas classes CSS ps-tr-*) -- só troca o conteúdo de cada coluna.
// Isso garante que os dois modos (Pós-flop/Pré-flop) fiquem dentro do
// MESMO layout, não dois componentes com cara diferente.
export function RfiJamDrill({ tabs }: RfiJamDrillProps) {
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [matchup, setMatchup] = useState<string>("");
  const [stackBb, setStackBb] = useState<number | null>(null);
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
          setMatchup(rows[0].matchup);
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

  const matchups = useMemo(() => Array.from(new Set(spots.map((s) => s.matchup))), [spots]);
  const stacksForMatchup = useMemo(
    () =>
      Array.from(new Set(spots.filter((s) => s.matchup === matchup).map((s) => s.stackBb))).sort((a, b) => a - b),
    [spots, matchup]
  );

  useEffect(() => {
    if (stacksForMatchup.length > 0 && !stacksForMatchup.includes(stackBb ?? -1)) {
      setStackBb(stacksForMatchup[0]);
    }
  }, [stacksForMatchup, stackBb]);

  const spotId = useMemo(() => {
    const found = spots.find((s) => s.matchup === matchup && s.stackBb === stackBb);
    return found?.spotId ?? "";
  }, [spots, matchup, stackBb]);

  useEffect(() => {
    if (!spotId) return;
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
  const emptyMessage = spots.length === 0 ? "Nenhum spot RFI/Jam encontrado no Supabase ainda." : "";

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

      <div className="ps-tr-body" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr) 280px", gap: 12, minHeight: 0 }}>
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
              Filtros RFI/Jam
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FilterSection label="Matchup">
                {matchups.map((m) => (
                  <FilterChip key={m} label={formatMatchup(m)} active={m === matchup} onClick={() => { setStats({ hits: 0, total: 0 }); setMatchup(m); }} />
                ))}
              </FilterSection>

              <FilterSection label="Stack">
                {stacksForMatchup.map((s) => (
                  <FilterChip key={s} label={`${s}bb`} active={s === stackBb} onClick={() => { setStats({ hits: 0, total: 0 }); setStackBb(s); }} />
                ))}
              </FilterSection>

              <FilterSection label="Situação">
                {PHASES.map((p) => (
                  <FilterChip key={p.key} label={p.label} active={p.key === phaseKey} onClick={() => { setStats({ hits: 0, total: 0 }); setPhaseKey(p.key); }} />
                ))}
              </FilterSection>
            </div>
          </aside>
        </div>

        {filtersOpen && (
          <div onClick={() => setFiltersOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 39 }} />
        )}

        <div className="ps-tr-table-col" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="ps-tr-table-inner" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 0, paddingTop: 6 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <Loader2 size={32} color="rgba(255,255,255,0.5)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Carregando…</p>
              </div>
            ) : error || emptyMessage ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>{error || emptyMessage}</p>
            ) : round && currentPhase ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                <p style={{ fontFamily: F, fontSize: 56, fontWeight: 600, letterSpacing: 2, color: "#FFFFFF" }}>{round.label}</p>

                {!chosen && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setChosen("fold")}
                      style={{ fontFamily: F, minWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "12px 20px", fontSize: 14, fontWeight: 500, color: "#FFFFFF", cursor: "pointer" }}
                    >
                      Fold
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Q</span>
                    </button>
                    <button
                      onClick={() => setChosen("action")}
                      style={{ fontFamily: F, minWidth: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "12px 20px", fontSize: 14, fontWeight: 500, color: "#FFFFFF", cursor: "pointer" }}
                    >
                      {actionLabel}
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>W</span>
                    </button>
                  </div>
                )}

                {chosen && verdict && (
                  <button
                    onClick={() => nextRound(currentPhase)}
                    style={{ fontFamily: F, background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: 13 }}
                  >
                    Próxima mão <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>(espaço)</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {chosen && round && currentPhase && verdict ? (
          <div className="ps-tr-feedback ps-tr-feedback-sheet" style={{ overflowY: "auto", background: "#0A0A0A", position: "relative", fontFamily: F, padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
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
        ) : (
          <div className="ps-tr-feedback ps-tr-feedback-idle" style={{ overflowY: "auto" }}>
            <div style={{ fontFamily: F, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              {round ? "Escolha uma ação abaixo — o feedback aparece aqui." : emptyMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
