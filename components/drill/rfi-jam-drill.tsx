"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import {
  getRfiJamSpot,
  listRfiJamSpots,
  type RfiJamListItem,
  type RfiJamPhaseRaw,
  type RfiJamSpot,
} from "@/lib/services/rfi-jam-service";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

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
  { key: "sbOpen", label: "SB decide abrir" },
  { key: "bbJam", label: "BB responde à abertura" },
  { key: "sbCallJam", label: "SB responde ao jam" },
];

const ACTION_LABEL: Record<RfiJamPhaseRaw["action"], string> = {
  open: "Abrir (raise)",
  jam: "Jam (all-in)",
  call: "Pagar (call)",
};

// "sb_vs_bb" -> "SB vs BB" -- os valores crus do banco (snake_case,
// pensados pra filtro/query) não são o que o jogador deve ver na tela.
function formatMatchup(matchup: string): string {
  return matchup
    .split("_vs_")
    .map((p) => p.toUpperCase())
    .join(" vs ");
}

// Gap abaixo desse valor = as duas opções têm EV praticamente igual
// (mesmo limiar usado no motor pra marcar "marginal" nos dados
// gravados). Nesse caso não faz sentido dizer "OTIMA" ou "ERRO" com a
// mesma força de uma decisão onde uma opção é claramente melhor —
// isso ignorava o gap que a gente calcula especificamente pra isso.
const MARGINAL_GAP_THRESHOLD = 0.5;

interface Round {
  label: string;
  freq: number;
  ev: number;
  gap: number;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        border: active ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "#FFFFFF" : "rgba(255,255,255,0.02)",
        color: active ? "#111111" : "rgba(255,255,255,0.55)",
      }}
    >
      {label}
    </button>
  );
}

export function RfiJamDrill() {
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [matchup, setMatchup] = useState<string>("");
  const [stackBb, setStackBb] = useState<number | null>(null);
  const [spot, setSpot] = useState<RfiJamSpot | null>(null);
  const [phaseKey, setPhaseKey] = useState<(typeof PHASES)[number]["key"]>("sbOpen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      Array.from(new Set(spots.filter((s) => s.matchup === matchup).map((s) => s.stackBb))).sort(
        (a, b) => a - b
      ),
    [spots, matchup]
  );

  // Se o stack selecionado não existir mais pro matchup escolhido
  // (ex: trocou de BTN vs BB pra SB vs BB e só tem 15/25/40bb lá),
  // cai pro primeiro disponível em vez de mostrar spot vazio.
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

  // Rótulo mostrado na tela: se a decisão é marginal (gap baixo — as
  // duas opções valem quase o mesmo EV), não faz sentido bater
  // "OTIMA"/"ERRO" com a mesma força de uma decisão clara. As
  // estatísticas de acerto continuam usando o veredito real (mesma
  // regra do resto do produto) — só a etiqueta visual muda.
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

  if (spots.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
        <p className="text-sm text-muted">Nenhum spot RFI/Jam encontrado no Supabase ainda.</p>
      </div>
    );
  }

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;
  const actionLabel = currentPhase ? ACTION_LABEL[currentPhase.action] : "";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-muted">Matchup</span>
          {matchups.map((m) => (
            <Chip
              key={m}
              label={formatMatchup(m)}
              active={m === matchup}
              onClick={() => {
                setStats({ hits: 0, total: 0 });
                setMatchup(m);
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-muted">Stack</span>
          {stacksForMatchup.map((s) => (
            <Chip
              key={s}
              label={`${s}bb`}
              active={s === stackBb}
              onClick={() => {
                setStats({ hits: 0, total: 0 });
                setStackBb(s);
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-muted">Decisão</span>
          {PHASES.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              active={p.key === phaseKey}
              onClick={() => {
                setStats({ hits: 0, total: 0 });
                setPhaseKey(p.key);
              }}
            />
          ))}
        </div>

        {stats.total > 0 && (
          <p className="text-sm text-muted">
            {stats.hits}/{stats.total} ótimas · {sessionPct}%
          </p>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted">
          <Loader2 size={18} className="animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && round && currentPhase && (
        <div className="flex flex-col items-center gap-6 rounded-xl border border-hairline bg-surface py-16">
          <p className="text-5xl font-semibold tracking-wide">{round.label}</p>

          {!chosen && (
            <div className="flex gap-3">
              <button
                onClick={() => setChosen("fold")}
                className="flex min-w-[110px] flex-col items-center gap-1 rounded-lg border border-hairline bg-elevated px-5 py-3 text-sm font-medium hover:bg-void"
              >
                Fold
                <span className="text-[10px] text-muted">Q</span>
              </button>
              <button
                onClick={() => setChosen("action")}
                className="flex min-w-[110px] flex-col items-center gap-1 rounded-lg border border-hairline bg-elevated px-5 py-3 text-sm font-medium hover:bg-void"
              >
                {actionLabel}
                <span className="text-[10px] text-muted">W</span>
              </button>
            </div>
          )}

          {chosen && verdict && (
            <div className="w-full max-w-sm text-center">
              <p className="mb-3 text-lg font-semibold" style={{ color: displayColor }}>
                {displayLabel}
              </p>
              <div className="mb-1 flex justify-center gap-4 text-xs text-muted">
                <span>Fold {Math.round((1 - round.freq) * 100)}%</span>
                <span>
                  {actionLabel} {Math.round(round.freq * 100)}%
                </span>
              </div>
              <p className="mb-4 text-[11px] text-muted">
                EV fold {currentPhase.ev_fold.toFixed(1)} · EV {actionLabel.toLowerCase()} {round.ev.toFixed(1)} · gap {round.gap.toFixed(2)}
                {isMarginal && <span className="ml-1" style={{ color: "#f5a524" }}>(decisão marginal — as duas opções valem quase o mesmo)</span>}
              </p>
              <button
                onClick={() => nextRound(currentPhase)}
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-void"
              >
                Próxima mão <span className="ml-1 text-xs text-muted">(espaço)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
