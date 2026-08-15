import type { Card } from "@/lib/poker/range-board-analyzer";

// Escala de forca de maos, 0 (pior) a 8 (melhor) — ordem padrao de poker.
export const HAND_TIERS = [
  "HIGH_CARD",
  "PAIR",
  "TWO_PAIR",
  "TRIPS",
  "STRAIGHT",
  "FLUSH",
  "FULL_HOUSE",
  "QUADS",
  "STRAIGHT_FLUSH",
] as const;
export type HandTier = (typeof HAND_TIERS)[number];

export const HAND_TIER_LABEL: Record<HandTier, string> = {
  HIGH_CARD: "Carta alta",
  PAIR: "Par",
  TWO_PAIR: "Dois pares",
  TRIPS: "Trinca",
  STRAIGHT: "Sequência",
  FLUSH: "Flush",
  FULL_HOUSE: "Full House",
  QUADS: "Quadra",
  STRAIGHT_FLUSH: "Straight Flush",
};

// Maior topo de sequencia presente num conjunto de ranks (trata o As
// tambem como 1, pra pegar a sequencia A-2-3-4-5). Retorna o rank mais
// alto de qualquer sequencia de 5 encontrada — se houver mais de uma
// (raro, precisa de 6+ cartas), a maior vence naturalmente pois o scan
// e' em ordem crescente e o ultimo valido sobrescreve.
function bestStraightTop(ranks: number[]): number | null {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  const sorted = Array.from(set).sort((a, b) => a - b);
  let best: number | null = null;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
      if (run >= 5) best = sorted[i];
    } else if (sorted[i] !== sorted[i - 1]) {
      run = 1;
    }
  }
  return best;
}

function topKickers(cards: Card[], exclude: Set<number>, count: number): number[] {
  const ranks = Array.from(new Set(cards.map((c) => c.rank).filter((r) => !exclude.has(r)))).sort((a, b) => b - a);
  return ranks.slice(0, count);
}

// Codifica tier + ate 5 kickers num unico numero comparavel (base 15,
// cobre ranks ate 14 com folga). Quem tiver o numero maior venceu o
// showdown — nao precisa comparar tier e kickers separadamente em
// nenhum lugar que consome esse score.
function encode(tier: number, kickers: number[]): number {
  let score = tier;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (kickers[i] ?? 0);
  }
  return score;
}

// Recebe de 5 a 7 cartas (2 hole + ate 5 de board) e devolve um score
// comparavel — a melhor mao de 5 dentre as disponiveis, sem precisar
// enumerar as C(7,5)=21 combinacoes na forca bruta.
export function scoreHand(cards: Card[]): number {
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();
  for (const c of cards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }

  let flushSuit: string | null = null;
  for (const [s, count] of suitCounts) if (count >= 5) flushSuit = s;

  if (flushSuit) {
    const flushCards = cards.filter((c) => c.suit === flushSuit);
    const sfTop = bestStraightTop(flushCards.map((c) => c.rank));
    if (sfTop !== null) return encode(8, [sfTop]);
  }

  const quadRanks = [...rankCounts.entries()].filter(([, c]) => c === 4).map(([r]) => r).sort((a, b) => b - a);
  const tripRanks = [...rankCounts.entries()].filter(([, c]) => c === 3).map(([r]) => r).sort((a, b) => b - a);
  const pairRanks = [...rankCounts.entries()].filter(([, c]) => c === 2).map(([r]) => r).sort((a, b) => b - a);

  if (quadRanks.length >= 1) {
    const q = quadRanks[0];
    return encode(7, [q, ...topKickers(cards, new Set([q]), 1)]);
  }

  if (tripRanks.length >= 1 && (tripRanks.length >= 2 || pairRanks.length >= 1)) {
    const t = tripRanks[0];
    const p = tripRanks.length >= 2 ? tripRanks[1] : pairRanks[0];
    return encode(6, [t, p]);
  }

  if (flushSuit) {
    const flushRanksTop5 = cards
      .filter((c) => c.suit === flushSuit)
      .map((c) => c.rank)
      .sort((a, b) => b - a)
      .slice(0, 5);
    return encode(5, flushRanksTop5);
  }

  const straightTop = bestStraightTop(cards.map((c) => c.rank));
  if (straightTop !== null) return encode(4, [straightTop]);

  if (tripRanks.length >= 1) {
    const t = tripRanks[0];
    return encode(3, [t, ...topKickers(cards, new Set([t]), 2)]);
  }

  if (pairRanks.length >= 2) {
    const [p1, p2] = pairRanks;
    return encode(2, [p1, p2, ...topKickers(cards, new Set([p1, p2]), 1)]);
  }

  if (pairRanks.length === 1) {
    const p = pairRanks[0];
    return encode(1, [p, ...topKickers(cards, new Set([p]), 3)]);
  }

  return encode(0, topKickers(cards, new Set(), 5));
}

// Devolve o tier (categoria) de um score — util so pra exibicao (ex:
// "Fulano ganhou com Dois Pares"), a comparacao em si nunca precisa
// disso, so' compara os scores numericos direto.
export function tierFromScore(score: number): HandTier {
  let s = score;
  for (let i = 0; i < 5; i++) s = Math.floor(s / 15);
  return HAND_TIERS[s];
}
