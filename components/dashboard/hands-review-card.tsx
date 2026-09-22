"use client";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";

interface Hand {
  id: string;
  description: string;
  situation: string;
  checked: boolean;
}

const HANDS: Hand[] = [
  {
    id: "1",
    description: "Linha agresta: AK small blind",
    situation: "SB vs Button",
    checked: true,
  },
  {
    id: "2",
    description: "All-in call 2.5x raise",
    situation: "BB vs CO",
    checked: false,
  },
  {
    id: "3",
    description: "Check-raise turn com draw",
    situation: "BB vs MP",
    checked: false,
  },
  {
    id: "4",
    description: "3-bet coldcall spot",
    situation: "UTG+1",
    checked: false,
  },
];

export function HandsReviewCard() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-elevated via-surface to-elevated p-6 backdrop-blur-xl transition-all duration-300 hover:border-positive/40">
      {/* Glow ambient */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-positive/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Mãos para Revisão
          </h3>
          <span className="text-xs bg-review/20 text-review px-2 py-1 rounded-full border border-review/30">
            {HANDS.filter((h) => !h.checked).length} pendente
          </span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {HANDS.map((hand) => (
            <div
              key={hand.id}
              className="group/item flex items-start gap-3 rounded-lg border border-hairline bg-surface/40 p-3 transition-all hover:border-muted/30 hover:bg-surface/60"
            >
              <button className="mt-0.5 flex-shrink-0 text-muted transition-colors hover:text-ink">
                {hand.checked ? (
                  <CheckCircle2 size={18} className="text-positive" />
                ) : (
                  <Circle size={18} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium transition-colors ${
                    hand.checked ? "text-muted/60 line-through" : "text-ink"
                  }`}
                >
                  {hand.description}
                </p>
                <p className="text-xs text-muted/60 mt-0.5">{hand.situation}</p>
              </div>

              <button className="flex-shrink-0 opacity-0 transition-all group-hover/item:opacity-100 text-muted hover:text-negative">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
