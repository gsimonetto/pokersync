"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import {
  analyzeRangeVsBoard,
  parseBoardInput,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type Category,
} from "@/lib/poker/range-board-analyzer";

// Cor por faixa de forca — mesma logica de "verde = bom, amarelo =
// mediano, vermelho/cinza = fraco" usada no resto do produto (ex:
// verdictColor do drill GTO), so que aqui e' sobre a forca da mao, nao
// sobre acerto/erro do jogador.
const STRONG: Category[] = ["STRAIGHT_FLUSH", "QUADS", "FULL_HOUSE", "FLUSH", "STRAIGHT", "TRIPS", "TWO_PAIR", "OVERPAIR", "TOP_PAIR"];
const MEDIUM: Category[] = ["SECOND_PAIR", "THIRD_PAIR_OR_WORSE", "POCKET_PAIR_BELOW_BOARD", "FLUSH_DRAW", "STRAIGHT_DRAW"];

function categoryColor(cat: Category): string {
  if (STRONG.includes(cat)) return "#22c55e";
  if (MEDIUM.includes(cat)) return "#eab308";
  return "#c4c7c8";
}

export function BoardAnalyzer({
  hands,
  comboOverrides = {},
  startOpen = false,
}: {
  hands: RangeHands;
  comboOverrides?: RangeHands;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [boardInput, setBoardInput] = useState("");

  const parsed = useMemo(() => parseBoardInput(boardInput), [boardInput]);

  const analysis = useMemo(() => {
    if (parsed.error || parsed.cards.length === 0) return null;
    return analyzeRangeVsBoard(hands, parsed.cards, comboOverrides);
  }, [hands, comboOverrides, parsed]);

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-medium">Analisar contra um board</span>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-3">
          <input
            value={boardInput}
            onChange={(e) => setBoardInput(e.target.value)}
            placeholder="Board: Kc8h2d"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-sm outline-none"
          />

          {parsed.error && <p className="mt-2 text-xs text-negative">{parsed.error}</p>}

          {analysis && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] text-muted">
                {analysis.totalCombos} combos restantes
                {analysis.totalCombos === 0 && " — nenhuma mão sobrevive a esse board."}
              </p>

              {analysis.totalCombos > 0 && (
                <div className="space-y-1">
                  {CATEGORY_ORDER.filter((cat) => analysis.byCategory[cat] > 0).map((cat) => {
                    const count = analysis.byCategory[cat];
                    const pct = Math.round((count / analysis.totalCombos) * 100);
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-[11px] text-muted">{CATEGORY_LABEL[cat]}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: categoryColor(cat) }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
