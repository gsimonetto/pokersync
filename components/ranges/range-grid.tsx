"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const WEIGHT_PRESETS = [100, 75, 50, 25];

// Uma mao pode ser dividida entre as 3 acoes (estrategia mista, igual ao
// que o solver ja retorna no Modo Treino). Mao ausente do mapa = fold
// 100% implicito, mesma convencao do V1 (nao precisa gravar toda mao
// fora do range so pra dizer "fold 100").
export interface HandDecision {
  fold: number;
  call: number;
  raise: number;
}

export type RangeHands = Record<string, HandDecision>;

export type PaintAction = "fold" | "call" | "raise";
const ACTIONS: PaintAction[] = ["fold", "call", "raise"];

const ACTION_META: Record<PaintAction, { label: string; color: string }> = {
  fold: { label: "Fold", color: "#c4c7c8" },
  call: { label: "Call", color: "#3b82f6" },
  raise: { label: "Raise", color: "#22c55e" },
};

const EMPTY_DECISION: HandDecision = { fold: 100, call: 0, raise: 0 };

export function getDecision(hands: RangeHands, label: string): HandDecision {
  return hands[label] ?? EMPTY_DECISION;
}

// Pinta uma acao com um peso e redistribui as outras duas pra manter a
// soma em 100. Se ja havia uma proporcao entre as outras duas, ela e'
// preservada (escalada pro espaco restante); se nao havia nenhuma
// referencia, o restante e' dividido igualmente entre elas. Isso permite
// tanto pintura simples (100% Raise) quanto estrategias mistas (pintar
// Raise 60%, depois Call, que ocupa o espaco que sobrou).
function applyAction(current: HandDecision, action: PaintAction, value: number): HandDecision {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const others = ACTIONS.filter((a) => a !== action);
  const othersSum = others.reduce((s, a) => s + current[a], 0);
  const remaining = 100 - clamped;

  const result = { fold: 0, call: 0, raise: 0 } as HandDecision;
  result[action] = clamped;

  if (remaining <= 0) {
    others.forEach((a) => (result[a] = 0));
  } else if (othersSum <= 0) {
    const each = remaining / others.length;
    others.forEach((a) => (result[a] = Math.round(each)));
  } else {
    others.forEach((a) => {
      result[a] = Math.round((current[a] / othersSum) * remaining);
    });
  }

  // Corrige erro de arredondamento (o Math.round de cada parte pode
  // deixar a soma em 99 ou 101) jogando a diferenca na maior das outras
  // duas acoes — nunca na que acabou de ser pintada, pra respeitar
  // exatamente o valor que o usuario escolheu.
  const sum = ACTIONS.reduce((s, a) => s + result[a], 0);
  if (sum !== 100) {
    const diff = 100 - sum;
    const biggest = others.reduce((best, a) => (result[a] > result[best] ? a : best), others[0]);
    result[biggest] += diff;
  }

  return result;
}

function getHandLabel(rowIdx: number, colIdx: number): string {
  const rHigh = RANKS[rowIdx];
  const rLow = RANKS[colIdx];
  if (rowIdx === colIdx) return `${rHigh}${rLow}`;
  if (rowIdx < colIdx) return `${rHigh}${rLow}s`;
  return `${rLow}${rHigh}o`;
}

function comboCount(label: string): number {
  if (label.length === 2) return 6; // par
  return label.endsWith("s") ? 4 : 12; // suited : offsuit
}

// Gradiente empilhado de baixo pra cima: fold (cinza) -> call (azul) ->
// raise (verde). Fold com peso 100 fica praticamente invisivel de
// proposito (funde com o fundo da celula) — so o que tem acao chama
// atencao visual.
function cellBackground(d: HandDecision): string {
  const foldEnd = d.fold;
  const callEnd = d.fold + d.call;
  return `linear-gradient(to top, ${ACTION_META.fold.color}22 0%, ${ACTION_META.fold.color}22 ${foldEnd}%, ${ACTION_META.call.color} ${foldEnd}%, ${ACTION_META.call.color} ${callEnd}%, ${ACTION_META.raise.color} ${callEnd}%, ${ACTION_META.raise.color} 100%)`;
}

export interface RangeGridProps {
  value: RangeHands;
  onChange: (hands: RangeHands) => void;
  readOnly?: boolean;
  labelsWithOverrides?: Set<string>;
  onOpenComboEditor?: (label: string) => void;
}

export function RangeGrid({
  value,
  onChange,
  readOnly = false,
  labelsWithOverrides,
  onOpenComboEditor,
}: RangeGridProps) {
  const [tool, setTool] = useState<PaintAction>("raise");
  const [weight, setWeight] = useState(100);
  const isDragging = useRef(false);
  // Decidido uma vez no inicio de cada arrastada (nao a cada celula) —
  // se a primeira celula clicada ja tinha exatamente essa ferramenta+
  // peso, a arrastada inteira vira "apagar" (volta pro fold 100%
  // padrao); senao, a arrastada inteira pinta. Mesmo padrao de toggle
  // que existia antes do modelo de 3 acoes, so' generalizado.
  const dragMode = useRef<"paint" | "erase">("paint");

  const applyToCell = useCallback(
    (label: string) => {
      if (readOnly) return;
      const current = getDecision(value, label);
      const next = dragMode.current === "erase" ? EMPTY_DECISION : applyAction(current, tool, weight);
      onChange({ ...value, [label]: next });
    },
    [value, onChange, readOnly, tool, weight]
  );

  const startPaint = (label: string) => {
    if (readOnly) return;
    isDragging.current = true;
    const current = getDecision(value, label);
    dragMode.current = current[tool] === weight ? "erase" : "paint";
    applyToCell(label);
  };
  const continuePaint = (label: string) => {
    if (!isDragging.current || readOnly) return;
    applyToCell(label);
  };
  const stopPaint = () => {
    isDragging.current = false;
  };

  const summary = useMemo(() => {
    let combos = { fold: 0, call: 0, raise: 0 };
    let activeHands = 0;
    for (let row = 0; row < RANKS.length; row++) {
      for (let col = 0; col < RANKS.length; col++) {
        const label = getHandLabel(row, col);
        const d = getDecision(value, label);
        const c = comboCount(label);
        combos.fold += c * (d.fold / 100);
        combos.call += c * (d.call / 100);
        combos.raise += c * (d.raise / 100);
        if (d.call > 0 || d.raise > 0) activeHands += 1;
      }
    }
    return {
      activeHands,
      call: Math.round(combos.call),
      raise: Math.round(combos.raise),
    };
  }, [value]);

  return (
    <div className="w-full select-none">
      <div className="mx-auto max-w-[580px]">
        {!readOnly && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-elevated p-1">
              {ACTIONS.map((a) => {
                const active = tool === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setTool(a)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      active ? "shadow-sm" : "text-muted hover:text-ink"
                    }`}
                    style={active ? { backgroundColor: `${ACTION_META[a].color}26`, color: ACTION_META[a].color } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full transition-transform"
                      style={{ backgroundColor: ACTION_META[a].color, transform: active ? "scale(1.15)" : "scale(1)" }}
                    />
                    {ACTION_META[a].label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-hairline bg-elevated p-1">
              {WEIGHT_PRESETS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeight(w)}
                  className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    weight === w ? "bg-ink text-void" : "text-muted hover:text-ink"
                  }`}
                >
                  {w}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px] rounded-xl border border-hairline bg-surface p-1.5"
          onPointerUp={stopPaint}
          onPointerLeave={stopPaint}
        >
          {RANKS.map((_, rowIdx) =>
            RANKS.map((__, colIdx) => {
              const label = getHandLabel(rowIdx, colIdx);
              const d = getDecision(value, label);
              const hasOverride = labelsWithOverrides?.has(label) ?? false;
              const title = `${label} — Fold ${d.fold}% / Call ${d.call}% / Raise ${d.raise}%${hasOverride ? " (tem combo customizado)" : ""}`;
              return (
                <div
                  key={label}
                  onPointerDown={() => startPaint(label)}
                  onPointerEnter={() => continuePaint(label)}
                  title={title}
                  className={`relative flex aspect-square items-center justify-center rounded-[3px] text-[9px] font-medium text-ink transition-transform hover:z-10 hover:scale-[1.12] hover:shadow-md ${
                    readOnly ? "cursor-default" : "cursor-pointer"
                  }`}
                  style={{ background: cellBackground(d) }}
                >
                  {label}
                  {hasOverride && (
                    <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-evolution" />
                  )}
                  {onOpenComboEditor && !readOnly && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenComboEditor(label);
                      }}
                      className="absolute bottom-0 left-0 h-2 w-2 rounded-tr bg-black/0 text-[5px] leading-none text-transparent hover:bg-black/50 hover:text-ink"
                      title="Editar combos individuais desta mão"
                    >
                      ⋯
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted">
          {summary.activeHands} mãos · {summary.raise} raise · {summary.call} call
        </p>
      </div>
    </div>
  );
}
