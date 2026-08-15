"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Dices } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import {
  analyzeRangeAcrossRandomBoards,
  chooseAdaptiveSampleSize,
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
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MultiBoardAnalysis | null>(null);

  // Sem escolha manual de tamanho de amostra — calcula sozinho o maior
  // numero de boards que da pra rodar sem travar, baseado em quantos
  // combos o range tem ativos agora.
  function handleRun() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const sampleSize = chooseAdaptiveSampleSize(hands, comboOverrides);
      setResult(analyzeRangeAcrossRandomBoards(hands, sampleSize, comboOverrides));
      setRunning(false);
    }, 30);
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-medium">Média contra vários boards</span>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="mb-3 flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-void disabled:opacity-50"
          >
            <Dices size={13} />
            {running ? "Calculando…" : "Rodar análise"}
          </button>

          {result && (
            <div>
              <p className="mb-2 text-[11px] text-muted">
                {result.totalCombos.toLocaleString("pt-BR")} combos em {result.boardsSampled} boards — amostra
                ajustada automaticamente pro tamanho do range.
              </p>
              <div className="space-y-1">
                {CATEGORY_ORDER.filter((cat) => result.byCategory[cat] > 0).map((cat) => {
                  const count = result.byCategory[cat];
                  const pct = Math.round((count / result.totalCombos) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[11px] text-muted">{CATEGORY_LABEL[cat]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: categoryColor(cat) }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted">{pct}%</span>
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
