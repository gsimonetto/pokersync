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
    <div className="mt-6 rounded-xl border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium">Analisar contra um board</span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-4">
          <label className="mb-1 block text-xs text-muted">
            Board (3 a 5 cartas — ex: Kc8h2d ou Kc 8h 2d)
          </label>
          <input
            value={boardInput}
            onChange={(e) => setBoardInput(e.target.value)}
            placeholder="Kc8h2d"
            className="w-full max-w-xs rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
          />

          {parsed.error && <p className="mt-2 text-sm text-negative">{parsed.error}</p>}

          {analysis && (
            <div className="mt-4">
              <p className="mb-3 text-sm text-muted">
                {analysis.totalCombos} combos restantes no range contra esse board
                {analysis.totalCombos === 0 && " — nenhuma mão com call/raise sobrevive a esse board."}
              </p>

              {analysis.totalCombos > 0 && (
                <div className="space-y-1.5">
                  {CATEGORY_ORDER.filter((cat) => analysis.byCategory[cat] > 0).map((cat) => {
                    const count = analysis.byCategory[cat];
                    const pct = Math.round((count / analysis.totalCombos) * 100);
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
                          {count} ({pct}%)
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
