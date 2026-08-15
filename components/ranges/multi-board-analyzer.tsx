"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Dices } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import {
  analyzeRangeAcrossRandomBoards,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type Category,
  type MultiBoardAnalysis,
} from "@/lib/poker/range-board-analyzer";

const STRONG: Category[] = ["STRAIGHT_FLUSH", "QUADS", "FULL_HOUSE", "FLUSH", "STRAIGHT", "TRIPS", "TWO_PAIR", "OVERPAIR", "TOP_PAIR"];
const MEDIUM: Category[] = ["SECOND_PAIR", "THIRD_PAIR_OR_WORSE", "POCKET_PAIR_BELOW_BOARD", "FLUSH_DRAW", "STRAIGHT_DRAW"];

function categoryColor(cat: Category): string {
  if (STRONG.includes(cat)) return "#22c55e";
  if (MEDIUM.includes(cat)) return "#eab308";
  return "#c4c7c8";
}

const SAMPLE_SIZES = [100, 300, 500, 1000];

export function MultiBoardAnalyzer({
  hands,
  comboOverrides = {},
  startOpen = false,
}: {
  hands: RangeHands;
  comboOverrides?: RangeHands;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [sampleSize, setSampleSize] = useState(300);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MultiBoardAnalysis | null>(null);

  function handleRun() {
    setRunning(true);
    setResult(null);
    // setTimeout solta a thread principal antes de rodar o calculo
    // sincrono, entao o spinner de "Calculando..." tem chance de
    // pintar na tela antes do trabalho pesado comecar.
    setTimeout(() => {
      setResult(analyzeRangeAcrossRandomBoards(hands, sampleSize, comboOverrides));
      setRunning(false);
    }, 30);
  }

  return (
    <div className="mt-6 rounded-xl border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium">Como esse range se comporta na média de vários boards</span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-4">
          <p className="mb-3 text-xs text-muted">
            Sorteia boards aleatórios e mostra a distribuição média de força de mão do range contra eles — uma
            estimativa por amostragem, não uma enumeração exata dos 22.100 flops possíveis.
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Amostra:</span>
            {SAMPLE_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => setSampleSize(n)}
                className={`rounded-lg border px-3 py-1 text-xs ${
                  sampleSize === n ? "border-ink bg-ink text-void" : "border-hairline bg-elevated text-muted"
                }`}
              >
                {n} boards
              </button>
            ))}
            <button
              onClick={handleRun}
              disabled={running}
              className="ml-2 flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-void disabled:opacity-50"
            >
              <Dices size={14} />
              {running ? "Calculando…" : "Rodar análise"}
            </button>
          </div>

          {result && (
            <div>
              <p className="mb-3 text-sm text-muted">
                {result.totalCombos.toLocaleString("pt-BR")} combos avaliados em {result.boardsSampled} boards
              </p>
              <div className="space-y-1.5">
                {CATEGORY_ORDER.filter((cat) => result.byCategory[cat] > 0).map((cat) => {
                  const count = result.byCategory[cat];
                  const pct = Math.round((count / result.totalCombos) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 text-xs text-muted">{CATEGORY_LABEL[cat]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: categoryColor(cat) }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                        {count.toLocaleString("pt-BR")} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
