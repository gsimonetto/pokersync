"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Dices } from "lucide-react";
import { listRanges, getRange, type RangeListItem } from "@/lib/services/range-service";
import { parseBoardInput } from "@/lib/poker/range-board-analyzer";
import { runEquityMonteCarlo, type EquityResult, type EquitySource } from "@/lib/poker/equity-engine";

interface ParticipantForm {
  id: string;
  label: string;
  mode: "hand" | "range";
  handInput: string;
  rangeId: string;
}

function newParticipant(n: number): ParticipantForm {
  return { id: Math.random().toString(36).slice(2, 8), label: `Jogador ${n}`, mode: "range", handInput: "", rangeId: "" };
}

const TRIAL_OPTIONS = [1000, 3000, 5000, 10000];

export function EquityCalculator() {
  const [ranges, setRanges] = useState<RangeListItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantForm[]>([newParticipant(1), newParticipant(2)]);
  const [boardInput, setBoardInput] = useState("");
  const [trials, setTrials] = useState(3000);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ results: EquityResult[]; trialsCompleted: number } | null>(null);

  useEffect(() => {
    listRanges()
      .then((rows) => {
        const trainable = rows.filter((r) => r.hand_count > 0);
        setRanges(trainable);
        setParticipants((prev) =>
          prev.map((p) => (trainable.length > 0 && !p.rangeId ? { ...p, rangeId: trainable[0].id } : p))
        );
      })
      .catch(() => setError("Erro ao carregar seus ranges."));
  }, []);

  function addParticipant() {
    if (participants.length >= 6) return;
    setParticipants((prev) => [...prev, newParticipant(prev.length + 1)]);
  }
  function removeParticipant(id: string) {
    if (participants.length <= 2) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }
  function updateParticipant(id: string, patch: Partial<ParticipantForm>) {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleRun() {
    setError("");
    setResults(null);

    const boardParsed = parseBoardInput(boardInput);
    if (boardParsed.error) {
      setError(boardParsed.error);
      return;
    }

    setRunning(true);
    try {
      const resolved: { label: string; source: EquitySource }[] = [];
      for (const p of participants) {
        if (p.mode === "hand") {
          const clean = p.handInput.replace(/\s/g, "");
          if (clean.length !== 4) {
            setError(`Preencha a mão de "${p.label}" no formato "AsKd".`);
            setRunning(false);
            return;
          }
          resolved.push({
            label: p.label,
            source: { kind: "hand", cards: [clean.slice(0, 2), clean.slice(2, 4)] },
          });
        } else {
          if (!p.rangeId) {
            setError(`Selecione um range pra "${p.label}".`);
            setRunning(false);
            return;
          }
          const range = await getRange(p.rangeId);
          resolved.push({ label: p.label, source: { kind: "range", hands: range.hands, comboOverrides: range.comboOverrides } });
        }
      }

      setTimeout(() => {
        const outcome = runEquityMonteCarlo(resolved, boardParsed.cards, trials);
        if ("error" in outcome) {
          setError(outcome.error);
        } else {
          setResults(outcome);
        }
        setRunning(false);
      }, 30);
    } catch {
      setError("Erro ao calcular a equidade.");
      setRunning(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Calcula a equidade entre 2 ou mais mãos/ranges por amostragem (Monte Carlo) — funciona preflop, no flop ou
        no turn. Cada participante pode ser uma mão específica ou um range salvo.
      </p>

      <div className="mb-4 space-y-3">
        {participants.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-hairline bg-surface p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={p.label}
                onChange={(e) => updateParticipant(p.id, { label: e.target.value })}
                className="w-40 rounded-lg border border-hairline bg-elevated px-2 py-1 text-sm outline-none"
              />
              <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
                {(["range", "hand"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateParticipant(p.id, { mode: m })}
                    className={`rounded-md px-2 py-1 text-xs ${p.mode === m ? "bg-ink text-void" : "text-muted"}`}
                  >
                    {m === "range" ? "Range" : "Mão fixa"}
                  </button>
                ))}
              </div>
              {participants.length > 2 && (
                <button onClick={() => removeParticipant(p.id)} className="ml-auto text-negative">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {p.mode === "range" ? (
              <select
                value={p.rangeId}
                onChange={(e) => updateParticipant(p.id, { rangeId: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
              >
                {ranges.length === 0 && <option value="">Nenhum range treinável</option>}
                {ranges.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={p.handInput}
                onChange={(e) => updateParticipant(p.id, { handInput: e.target.value })}
                placeholder="Ex: AsKd"
                className="w-full max-w-[140px] rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
              />
            )}

            {results && (
              <p className="mt-2 text-sm">
                <span className="font-medium text-ink">{results.results[i]?.equityPct}%</span>{" "}
                <span className="text-muted">
                  equity ({results.results[i]?.winPct}% vitória, {results.results[i]?.tiePct}% empate)
                </span>
              </p>
            )}
          </div>
        ))}
      </div>

      {participants.length < 6 && (
        <button
          onClick={addParticipant}
          className="mb-4 flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <Plus size={16} />
          Adicionar participante
        </button>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-xs text-muted">Board (opcional — 0, 3, 4 ou 5 cartas)</label>
        <input
          value={boardInput}
          onChange={(e) => setBoardInput(e.target.value)}
          placeholder="Ex: Kc8h2d (deixe vazio pra preflop)"
          className="w-full max-w-xs rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Amostras:</span>
        {TRIAL_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setTrials(n)}
            className={`rounded-lg border px-3 py-1 text-xs ${
              trials === n ? "border-ink bg-ink text-void" : "border-hairline bg-elevated text-muted"
            }`}
          >
            {n.toLocaleString("pt-BR")}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      <button
        onClick={handleRun}
        disabled={running}
        className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
      >
        <Dices size={16} />
        {running ? "Calculando…" : "Calcular equidade"}
      </button>

      {results && (
        <p className="mt-3 text-xs text-muted">
          {results.trialsCompleted.toLocaleString("pt-BR")} simulações completadas — estimativa por amostragem, não
          um cálculo exaustivo.
        </p>
      )}
    </div>
  );
}
