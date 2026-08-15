"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { Card } from "@/components/drill/card";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["s", "h", "d", "c"] as const;

export function CardPickerModal({
  title,
  maxCards,
  minCards = 0,
  initialCards = [],
  excludeCards = [],
  onConfirm,
  onClose,
}: {
  title: string;
  maxCards: number;
  minCards?: number;
  initialCards?: string[];
  excludeCards?: string[];
  onConfirm: (cards: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialCards);

  function toggle(card: string) {
    if (excludeCards.includes(card)) return;
    setSelected((prev) => {
      if (prev.includes(card)) return prev.filter((c) => c !== card);
      if (prev.length >= maxCards) return prev;
      return [...prev, card];
    });
  }

  const canConfirm = selected.length >= minCards;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex min-h-[52px] items-center gap-2 rounded-lg border border-hairline bg-elevated p-2">
          {selected.length === 0 ? (
            <span className="px-1 text-xs text-muted">
              {minCards > 0 ? `Selecione ${minCards === maxCards ? minCards : `${minCards} a ${maxCards}`} carta(s)…` : "Nenhuma carta selecionada"}
            </span>
          ) : (
            selected.map((c) => <Card key={c} card={c} size="mini" hideCornerSuitGlyph />)
          )}
        </div>

        <div className="mb-4 space-y-1">
          {SUITS.map((suit) => (
            <div key={suit} className="flex gap-1">
              {RANKS.map((rank) => {
                const card = `${rank}${suit}`;
                const isSelected = selected.includes(card);
                const isExcluded = excludeCards.includes(card);
                const order = isSelected ? selected.indexOf(card) + 1 : null;
                return (
                  <button
                    key={card}
                    type="button"
                    onClick={() => toggle(card)}
                    disabled={isExcluded}
                    className={`relative shrink-0 rounded-md transition-all ${
                      isSelected ? "-translate-y-1 ring-2 ring-ink" : "hover:-translate-y-0.5"
                    } ${isExcluded ? "cursor-not-allowed opacity-20" : "cursor-pointer"}`}
                  >
                    <Card card={card} size="mini" hideCornerSuitGlyph />
                    {order && (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[9px] font-bold text-void">
                        {order}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setSelected([])} className="text-xs text-muted hover:text-ink">
            Limpar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={!canConfirm}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-40"
          >
            <Check size={16} />
            Confirmar ({selected.length}{maxCards !== minCards ? `/${maxCards}` : ""})
          </button>
        </div>
      </div>
    </div>
  );
}
