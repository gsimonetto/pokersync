// Grade 13x13 dos ranges do solver (Modo Treino): cada mão com a
// frequência de fold/call/raise. Separada do Construtor de Ranges, que
// trabalha com peso por mão (lib/ranges).

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

type RaiseType = "raise" | "threebet" | "allin";

interface RaiseMixEntry {
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

/** Cores das ações em toda grade 13x13 do PokerSync (Treino, Construtor,
 *  biblioteca, Performance) -- pedido explícito: call verde, fold azul,
 *  raise vermelho, all-in laranja, 3-bet e 4-bet vermelho mais escuro e
 *  cinza pra mão fora do range. */
export const COR_ACAO = {
  fold: "#3b82f6",
  call: "#22c55e",
  raise: "#e0555a",
  threebet: "#9b1c2c",
  allin: "#f59e0b",
  fora: "#c4c7c8",
} as const;

const RAISE_TYPE_COLOR: Record<RaiseType, string> = { raise: COR_ACAO.raise, threebet: COR_ACAO.threebet, allin: COR_ACAO.allin };
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

// Gradiente empilhado de baixo pra cima: fold (azul) -> call (verde) ->
// raise (vermelho, vermelho escuro no 3-bet, laranja no all-in).
export function cellBackground(d: HandDecision): string {
  const foldC = COR_ACAO.fold,
    callC = COR_ACAO.call;
  const foldEnd = d.fold;
  const callEnd = d.fold + d.call;
  const stops = [`${foldC} 0%`, `${foldC} ${foldEnd}%`, `${callC} ${foldEnd}%`, `${callC} ${callEnd}%`];
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
