import type { ParsedHand } from "./hand-parser";
import { projectHandAtStep } from "./hand-replay-projector";

// Resumo de uma mão pra listas do Revisor (resultado do herói em bb,
// all-in, showdown) -- usa o MESMO cálculo de fichas do replayer
// (projectHandAtStep no último passo), então o número da lista sempre
// bate com o stack que a mesa mostra no fim da mão.

export interface ResumoMao {
  /** Lucro (+) ou prejuízo (−) do herói na mão, em big blinds. null = não deu pra calcular. */
  resultadoBb: number | null;
  allIn: boolean;
  showdown: boolean;
}

export function resumoDaMao(hand: ParsedHand): ResumoMao {
  const hero = hand.heroName;
  const allIn = Boolean(hero) && (hand.streets ?? []).some((st) => st.actions.some((a) => a.player === hero && a.isAllIn));
  const showdown = Array.isArray(hand.showdown) && hand.showdown.length > 0;
  let resultadoBb: number | null = null;
  if (hero) {
    try {
      const st = projectHandAtStep(hand, Number.MAX_SAFE_INTEGER);
      const slot = st.seatLayout.find((s) => s.playerName === hero);
      const seat = hand.seats.find((s) => s.playerName === hero);
      const final = slot ? st.tableHand.seats[slot.posLabel]?.stack : undefined;
      if (final != null && seat) resultadoBb = Math.round((final - seat.startingChips / st.bbUnit) * 10) / 10;
    } catch {
      // replay não montou (side pot, ação não reconhecida) -- fica sem número
    }
  }
  return { resultadoBb, allIn, showdown };
}

/** "+52,4 bb" / "−3,8 bb" / "0 bb" */
export function formatarBb(v: number): string {
  const txt = Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${txt} bb`;
}
