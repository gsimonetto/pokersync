// Grade 13x13 dos ranges do solver (Modo Treino): cada mão com a
// frequência de fold/call/raise. Separada do Construtor de Ranges, que
// trabalha com peso por mão (lib/ranges).

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export type RaiseType = "raise" | "threebet" | "allin";

export interface RaiseMixEntry {
  type: RaiseType;
  weight: number;
}

export interface HandDecision {
  fold: number;
  call: number;
  raise: number;
  /** Qual "sabor" de raise (raise simples, 3-bet ou all-in), só pra cor. */
  raiseType?: RaiseType;
  /** Fatia de raise dividida entre dois sabores; os pesos somam `raise`. */
  raiseMix?: RaiseMixEntry[];
}

/** Mão ausente do mapa = fold 100%. */
export type RangeHands = Record<string, HandDecision>;

const RAISE_TYPE_COLOR: Record<RaiseType, string> = { raise: "#22c55e", threebet: "#f59e0b", allin: "#e0555a" };
const EMPTY_DECISION: HandDecision = { fold: 100, call: 0, raise: 0 };

export function getDecision(hands: RangeHands, label: string): HandDecision {
  return hands[label] ?? EMPTY_DECISION;
}

export function getHandLabel(rowIdx: number, colIdx: number): string {
  const rHigh = RANKS[rowIdx];
  const rLow = RANKS[colIdx];
  if (rowIdx === colIdx) return `${rHigh}${rLow}`;
  if (rowIdx < colIdx) return `${rHigh}${rLow}s`;
  return `${rLow}${rHigh}o`;
}

// Gradiente empilhado de baixo pra cima: fold (cinza) -> call (azul) ->
// raise (verde, laranja no 3-bet, vermelho no all-in). Fold 100% fica
// quase invisível de propósito -- só o que tem ação chama atenção.
export function cellBackground(d: HandDecision): string {
  const foldC = "#c4c7c8",
    callC = "#3b82f6";
  const foldEnd = d.fold;
  const callEnd = d.fold + d.call;
  const stops = [`${foldC}22 0%`, `${foldC}22 ${foldEnd}%`, `${callC} ${foldEnd}%`, `${callC} ${callEnd}%`];
  if (d.raise > 0) {
    const mix = d.raiseMix && d.raiseMix.length > 1 ? d.raiseMix : [{ type: d.raiseType ?? "raise", weight: d.raise }];
    let cursor = callEnd;
    for (const seg of mix) {
      const segEnd = cursor + seg.weight;
      const color = RAISE_TYPE_COLOR[seg.type];
      stops.push(`${color} ${cursor}%`, `${color} ${segEnd}%`);
      cursor = segEnd;
    }
  }
  return `linear-gradient(to top, ${stops.join(", ")})`;
}
