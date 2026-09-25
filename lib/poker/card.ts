// Carta no formato do avaliador de mãos (hand-evaluator): valor 2-14
// (A = 14) e naipe.

export type Suit = "c" | "d" | "h" | "s";

export interface Card {
  rank: number; // 2-14 (A=14)
  suit: Suit;
}

const RANK_CHARS = "23456789TJQKA";
const SUITS: Suit[] = ["c", "d", "h", "s"];

/** "Kh" -> { rank: 13, suit: "h" }; null se não for uma carta. */
export function parseCard(s: string): Card | null {
  const i = RANK_CHARS.indexOf(s[0]?.toUpperCase() ?? "");
  const suit = s[1]?.toLowerCase() as Suit;
  if (i < 0 || !SUITS.includes(suit)) return null;
  return { rank: i + 2, suit };
}
