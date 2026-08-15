"use client";

import { useMemo } from "react";
import { RotateCcw, X } from "lucide-react";
import { combosForLabel } from "@/lib/poker/range-board-analyzer";
import type { RangeHands, HandDecision } from "@/components/ranges/range-grid";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const SUIT_COLOR: Record<string, string> = { c: "#22c55e", d: "#3b82f6", h: "#e0555a", s: "#c4c7c8" };

function CardBadge({ pair }: { pair: string }) {
  const RANKS_DESC = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const c1 = pair.slice(0, 2);
  const c2 = pair.slice(2, 4);
  // A chave do combo vem na ordem que o motor gerou (nem sempre carta
  // alta primeiro) — aqui so' reordena pra exibicao, convencao padrao
  // de poker (carta mais alta primeiro).
  const [first, second] = RANKS_DESC.indexOf(c1[0]) <= RANKS_DESC.indexOf(c2[0]) ? [c1, c2] : [c2, c1];
  const rank1 = first[0];
  const suit1 = first[1];
  const rank2 = second[0];
  const suit2 = second[1];
  return (
    <span>
      {rank1}
      <span style={{ color: SUIT_COLOR[suit1] }}>{SUIT_SYMBOL[suit1]}</span>
      {rank2}
      <span style={{ color: SUIT_COLOR[suit2] }}>{SUIT_SYMBOL[suit2]}</span>
    </span>
  );
}

export function ComboEditorModal({
  label,
  handDecision,
  overrides,
  onChange,
  onClose,
}: {
  label: string;
  handDecision: HandDecision;
  overrides: RangeHands;
  onChange: (next: RangeHands) => void;
  onClose: () => void;
}) {
  const combos = useMemo(() => combosForLabel(label), [label]);

  function comboDecision(key: string): HandDecision {
    return overrides[key] ?? handDecision;
  }

  function setCombo(key: string, patch: Partial<HandDecision>) {
    const current = comboDecision(key);
    onChange({ ...overrides, [key]: { ...current, ...patch } });
  }

  function resetCombo(key: string) {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Combos de {label}</h3>
          <button onClick={onClose} className="text-muted">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Por padrão todo combo segue a mesma decisão da mão (Fold {handDecision.fold}% / Call {handDecision.call}% /
          Raise {handDecision.raise}%). Ajuste um combo específico só se tiver um motivo — normalmente isso importa
          em spots avançados de remoção de carta (ICM, multiway).
        </p>

        <div className="space-y-2">
          {combos.map(({ key }) => {
            const d = comboDecision(key);
            const isOverridden = key in overrides;
            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isOverridden ? "border-evolution" : "border-hairline"
                }`}
              >
                <span className="w-16 shrink-0 text-sm font-medium">
                  <CardBadge pair={key} />
                </span>
                {(["fold", "call", "raise"] as const).map((action) => (
                  <label key={action} className="flex items-center gap-1 text-xs text-muted">
                    {action[0].toUpperCase()}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={d[action]}
                      onChange={(e) => setCombo(key, { [action]: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      className="w-14 rounded border border-hairline bg-elevated px-1 py-0.5 text-xs text-ink outline-none"
                    />
                  </label>
                ))}
                {isOverridden && (
                  <button onClick={() => resetCombo(key)} className="ml-auto text-muted hover:text-ink" title="Voltar ao padrão da mão">
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          Os 3 números de cada combo não precisam somar 100 automaticamente aqui — confira antes de fechar.
        </p>
      </div>
    </div>
  );
}
