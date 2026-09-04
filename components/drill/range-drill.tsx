"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDecision, type HandDecision, type RangeHands } from "@/components/ranges/range-grid";
import { getRange, listRanges, type RangeListItem } from "@/lib/services/range-service";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import { logDrillAnswer, fetchRangeDrillAccuracy } from "@/lib/services/range-journal-service";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
type PaintAction = "fold" | "call" | "raise";
const ACTIONS: { type: PaintAction; label: string; key: string }[] = [
  { type: "fold", label: "Fold", key: "Q" },
  { type: "call", label: "Call", key: "W" },
  { type: "raise", label: "Raise", key: "E" },
];

function allLabels(): string[] {
  const out: string[] = [];
  for (let row = 0; row < RANKS.length; row++) {
    for (let col = 0; col < RANKS.length; col++) {
      const rHigh = RANKS[row];
      const rLow = RANKS[col];
      if (row === col) out.push(`${rHigh}${rLow}`);
      else if (row < col) out.push(`${rHigh}${rLow}s`);
      else out.push(`${rLow}${rHigh}o`);
    }
  }
  return out;
}
const ALL_LABELS = allLabels();

function comboCount(label: string): number {
  if (label.length === 2) return 6;
  return label.endsWith("s") ? 4 : 12;
}

// Sorteio ponderado por combos reais (par=6, suited=4, offsuit=12) — sem
// isso, AA (6 combos) e AKo (12 combos) apareceriam com a mesma
// frequencia, o que nao reflete a chance real de receber cada mao.
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

interface Round {
  label: string;
  decision: HandDecision;
}

export function RangeDrill({ initialRangeId = null }: { initialRangeId?: string | null }) {
  const [ranges, setRanges] = useState<RangeListItem[]>([]);
  const [rangeId, setRangeId] = useState<string>("");
  const [hands, setHands] = useState<RangeHands | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [round, setRound] = useState<Round | null>(null);
  const [chosen, setChosen] = useState<PaintAction | null>(null);
  // Placar ACUMULADO de todo o historico do jogador (nao e' por sessao/
  // range escolhido) -- comeca em 0/0 so' ate a busca no banco responder,
  // depois nunca mais reinicia sozinho (mesmo padrao do Modo Treino, ver
  // fetchTrainingAccuracy em lib/services/drill-service.ts).
  const [stats, setStats] = useState({ hits: 0, total: 0 });

  useEffect(() => {
    let alive = true;
    fetchRangeDrillAccuracy()
      .then((acc) => {
        if (alive) setStats(acc);
      })
      .catch(() => {
        // sem sessao/erro de rede -- fica em 0/0 e segue contando dali
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    listRanges()
      .then((rows) => {
        const trainable = rows.filter((r) => r.hand_count > 0);
        setRanges(trainable);
        // Se veio de um link com range especifico (ex: "Treinar esse leak"
        // vindo da Aderencia a Range) e esse range ainda e' treinavel,
        // prioriza ele — senao cai no primeiro da lista como antes.
        const preselected = initialRangeId && trainable.some((r) => r.id === initialRangeId) ? initialRangeId : null;
        if (preselected) setRangeId(preselected);
        else if (trainable.length > 0) setRangeId(trainable[0].id);
        else setLoading(false);
      })
      .catch(() => setError("Erro ao carregar seus ranges."))
      .finally(() => {
        if (ranges.length === 0) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextRound = useCallback((h: RangeHands) => {
    const label = dealWeightedHand();
    setRound({ label, decision: getDecision(h, label) });
    setChosen(null);
  }, []);

  useEffect(() => {
    if (!rangeId) return;
    setLoading(true);
    setError("");
    getRange(rangeId)
      .then((r) => {
        setHands(r.hands);
        nextRound(r.hands);
      })
      .catch(() => setError("Erro ao carregar o range selecionado."))
      .finally(() => setLoading(false));
  }, [rangeId, nextRound]);

  const verdict: Verdict | null = useMemo(() => {
    if (!round || !chosen) return null;
    const weight = round.decision[chosen] / 100;
    return classifyFrequency(weight);
  }, [round, chosen]);

  useEffect(() => {
    if (!chosen || !verdict || !round) return;
    setStats((prev) => ({ hits: prev.hits + (verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    const rangeName = ranges.find((r) => r.id === rangeId)?.name ?? "Range";
    logDrillAnswer({
      rangeId: rangeId || null,
      rangeName,
      handLabel: round.label,
      combos: comboCount(round.label),
      verdict,
      hit: verdict === "OTIMA",
    }).catch(() => {
      // melhor esforco: se o log falhar, o drill continua normalmente
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (chosen && hands) nextRound(hands);
        return;
      }
      const hit = ACTIONS.find((a) => a.key === e.key.toUpperCase());
      if (hit && !chosen) setChosen(hit.type);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, hands, nextRound]);

  if (loading && ranges.length === 0) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (!loading && ranges.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
        <p className="text-sm text-muted">
          Nenhum range treinável ainda. Crie um range com pelo menos uma mão dentro no Construtor de Ranges.
        </p>
      </div>
    );
  }

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <select
          value={rangeId}
          onChange={(e) => setRangeId(e.target.value)}
          className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
        >
          {ranges.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
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
          Carregando mão…
        </div>
      )}

      {!loading && round && (
        <div className="flex flex-col items-center gap-6 rounded-xl border border-hairline bg-surface py-16">
          <p className="text-5xl font-semibold tracking-wide">{round.label}</p>

          {!chosen && (
            <div className="flex gap-3">
              {ACTIONS.map((a) => (
                <button
                  key={a.type}
                  onClick={() => setChosen(a.type)}
                  className="flex min-w-[96px] flex-col items-center gap-1 rounded-lg border border-hairline bg-elevated px-5 py-3 text-sm font-medium hover:bg-void"
                >
                  {a.label}
                  <span className="text-[10px] text-muted">{a.key}</span>
                </button>
              ))}
            </div>
          )}

          {chosen && verdict && (
            <div className="w-full max-w-sm text-center">
              <p className="mb-3 text-lg font-semibold" style={{ color: verdictColor(verdict) }}>
                {verdict.replace("_", " ")}
              </p>
              <div className="mb-4 flex justify-center gap-4 text-xs text-muted">
                <span>Fold {round.decision.fold}%</span>
                <span>Call {round.decision.call}%</span>
                <span>Raise {round.decision.raise}%</span>
              </div>
              <button
                onClick={() => hands && nextRound(hands)}
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
