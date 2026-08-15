import type { RangeHands } from "@/components/ranges/range-grid";
import { getDecision } from "@/components/ranges/range-grid";

export type Suit = "c" | "d" | "h" | "s";

export interface Card {
  rank: number; // 2-14 (A=14)
  suit: Suit;
}

const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUE: Record<string, number> = {};
RANK_CHARS.forEach((c, i) => (RANK_VALUE[c] = i + 2));
const SUITS: Suit[] = ["c", "d", "h", "s"];

function rankChar(rank: number): string {
  return RANK_CHARS[rank - 2];
}

export function cardToString(c: Card): string {
  return `${rankChar(c.rank)}${c.suit}`;
}

export function parseCard(s: string): Card | null {
  const rc = s[0]?.toUpperCase();
  const sc = s[1]?.toLowerCase() as Suit;
  if (!rc || !(rc in RANK_VALUE)) return null;
  if (!SUITS.includes(sc)) return null;
  return { rank: RANK_VALUE[rc], suit: sc };
}

// Aceita "Kc8h2d", "Kc 8h 2d", "Kc, 8h, 2d" — qualquer separador, so
// exige pares [rank][naipe] colados.
export function parseBoardInput(input: string): { cards: Card[]; error: string | null } {
  const cleaned = input.replace(/[\s,]/g, "");
  if (cleaned.length === 0) return { cards: [], error: null };
  if (cleaned.length % 2 !== 0) return { cards: [], error: "Board incompleto — cada carta precisa de rank + naipe (ex: Kc)." };
  const matches = cleaned.match(/.{1,2}/g) ?? [];
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const card = parseCard(m);
    if (!card) return { cards: [], error: `Carta inválida: "${m}". Use rank (2-9,T,J,Q,K,A) + naipe (c,d,h,s).` };
    const key = cardToString(card);
    if (seen.has(key)) return { cards: [], error: `Carta repetida: "${key}".` };
    seen.add(key);
    cards.push(card);
  }
  if (cards.length > 5) return { cards: [], error: "Board não pode ter mais de 5 cartas." };
  return { cards, error: null };
}

export function getHandLabelFromCards(a: Card, b: Card): string {
  const [hi, lo] = a.rank >= b.rank ? [a, b] : [b, a];
  if (hi.rank === lo.rank) return `${rankChar(hi.rank)}${rankChar(lo.rank)}`;
  const suited = a.suit === b.suit;
  return `${rankChar(hi.rank)}${rankChar(lo.rank)}${suited ? "s" : "o"}`;
}

interface RawCombo {
  a: Card;
  b: Card;
  label: string;
}

let deckComboCache: RawCombo[] | null = null;
// Os 1326 combos de um baralho de 52 cartas — calculado uma vez so,
// reaproveitado em toda analise (nao muda entre chamadas).
function allDeckCombos(): RawCombo[] {
  if (deckComboCache) return deckComboCache;
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANK_CHARS.map((c) => RANK_VALUE[c])) deck.push({ rank: r, suit: s });

  const combos: RawCombo[] = [];
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      combos.push({ a: deck[i], b: deck[j], label: getHandLabelFromCards(deck[i], deck[j]) });
    }
  }
  deckComboCache = combos;
  return combos;
}

// Todos os combos concretos de um range que tem alguma acao alem de
// fold (call ou raise > 0), respeitando overrides por combo especifico.
// Usado pelo motor de equidade pra saber quais maos reais um range pode
// ter na mao (mesmo criterio de "continuing range" do Board Analyzer).
export function activeCombosForRange(
  hands: RangeHands,
  comboOverrides: RangeHands = {}
): { a: Card; b: Card; key: string }[] {
  const result: { a: Card; b: Card; key: string }[] = [];
  for (const raw of allDeckCombos()) {
    const aKey = cardToString(raw.a);
    const bKey = cardToString(raw.b);
    const comboKey = `${aKey}${bKey}`;
    const decision = comboOverrides[comboKey] ?? getDecision(hands, raw.label);
    if (decision.call > 0 || decision.raise > 0) {
      result.push({ a: raw.a, b: raw.b, key: comboKey });
    }
  }
  return result;
}

// Combos concretos (com naipe) de uma mao especifica — ex: "AKs" -> os
// 4 combos A?K? do mesmo naipe. Usado pelo editor de combos individuais
// pra listar o que existe dentro de uma mao (par=6, suited=4, offsuit=12).
// Deriva a mao (label) a partir de uma chave de combo tipo "AsKs" —
// usado pelo editor pra saber quais celulas da grade tem algum combo
// customizado, sem o RangeGrid precisar importar deste modulo (evitaria
// import circular, ja que este arquivo importa do range-grid).
export function labelForComboKey(key: string): string | null {
  if (key.length !== 4) return null;
  const a = parseCard(key.slice(0, 2));
  const b = parseCard(key.slice(2, 4));
  if (!a || !b) return null;
  return getHandLabelFromCards(a, b);
}

export function combosForLabel(label: string): { a: Card; b: Card; key: string }[] {
  return allDeckCombos()
    .filter((c) => c.label === label)
    .map((c) => ({ a: c.a, b: c.b, key: `${cardToString(c.a)}${cardToString(c.b)}` }));
}

export type Category =
  | "STRAIGHT_FLUSH"
  | "QUADS"
  | "FULL_HOUSE"
  | "FLUSH"
  | "STRAIGHT"
  | "TRIPS"
  | "TWO_PAIR"
  | "OVERPAIR"
  | "TOP_PAIR"
  | "SECOND_PAIR"
  | "THIRD_PAIR_OR_WORSE"
  | "POCKET_PAIR_BELOW_BOARD"
  | "FLUSH_DRAW"
  | "STRAIGHT_DRAW"
  | "OVERCARDS"
  | "AIR";

// Ordem de forca, usada tanto pra prioridade de classificacao (mao feita
// sempre vence draw) quanto pra ordenar a tabela de resultado.
export const CATEGORY_ORDER: Category[] = [
  "STRAIGHT_FLUSH",
  "QUADS",
  "FULL_HOUSE",
  "FLUSH",
  "STRAIGHT",
  "TRIPS",
  "TWO_PAIR",
  "OVERPAIR",
  "TOP_PAIR",
  "SECOND_PAIR",
  "THIRD_PAIR_OR_WORSE",
  "POCKET_PAIR_BELOW_BOARD",
  "FLUSH_DRAW",
  "STRAIGHT_DRAW",
  "OVERCARDS",
  "AIR",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  STRAIGHT_FLUSH: "Straight Flush",
  QUADS: "Quadra",
  FULL_HOUSE: "Full House",
  FLUSH: "Flush",
  STRAIGHT: "Sequência",
  TRIPS: "Trinca / Set",
  TWO_PAIR: "Dois Pares",
  OVERPAIR: "Overpair",
  TOP_PAIR: "Par no Topo",
  SECOND_PAIR: "Par Médio",
  THIRD_PAIR_OR_WORSE: "Par Baixo",
  POCKET_PAIR_BELOW_BOARD: "Par de Bolso (abaixo do board)",
  FLUSH_DRAW: "Projeto de Flush",
  STRAIGHT_DRAW: "Projeto de Sequência",
  OVERCARDS: "Overcards",
  AIR: "Sem Nada",
};

// Conjunto de ranks tem sequencia de 5? Trata o As tambem como 1 (A-2-3-4-5).
function hasStraight(ranks: number[]): boolean {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  const arr = Array.from(set).sort((x, y) => x - y);
  let run = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === arr[i - 1] + 1) {
      run++;
      if (run >= 5) return true;
    } else if (arr[i] !== arr[i - 1]) {
      run = 1;
    }
  }
  return false;
}

// Existe alguma carta (2-14) que, somada aos ranks atuais, completa uma
// sequencia de 5? Usado so quando o board ainda nao fechou (< 5 cartas) —
// e' assim que detectamos "projeto de sequencia" sem enumerar outs de
// verdade (a mao vira sequencia se QUALQUER carta faltante a completa).
function hasStraightDraw(ranks: number[]): boolean {
  for (let candidate = 2; candidate <= 14; candidate++) {
    if (ranks.includes(candidate)) continue;
    if (hasStraight([...ranks, candidate])) return true;
  }
  return false;
}

function evaluateHand(hole: [Card, Card], board: Card[]): Category {
  const all = [...hole, ...board];

  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<Suit, number>();
  for (const c of all) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }

  let flushSuit: Suit | null = null;
  for (const [s, count] of suitCounts) if (count >= 5) flushSuit = s;

  if (flushSuit) {
    const flushRanks = all.filter((c) => c.suit === flushSuit).map((c) => c.rank);
    if (hasStraight(flushRanks)) return "STRAIGHT_FLUSH";
  }

  const counts = Array.from(rankCounts.values());
  if (counts.includes(4)) return "QUADS";

  const ranksGE3 = [...rankCounts.entries()].filter(([, c]) => c >= 3).map(([r]) => r);
  const ranksGE2 = [...rankCounts.entries()].filter(([, c]) => c >= 2).map(([r]) => r);

  if (ranksGE3.length >= 1 && ranksGE2.length >= 2) return "FULL_HOUSE";
  if (flushSuit) return "FLUSH";
  if (hasStraight(all.map((c) => c.rank))) return "STRAIGHT";
  if (ranksGE3.length >= 1) return "TRIPS";
  if (ranksGE2.length >= 2) return "TWO_PAIR";

  if (ranksGE2.length === 1) {
    const pairedRank = ranksGE2[0];
    const boardRanksDesc = Array.from(new Set(board.map((c) => c.rank))).sort((a, b) => b - a);
    const isPocketPair = hole[0].rank === hole[1].rank;

    if (isPocketPair) {
      const topBoard = boardRanksDesc[0] ?? 0;
      return pairedRank > topBoard ? "OVERPAIR" : "POCKET_PAIR_BELOW_BOARD";
    }
    const idx = boardRanksDesc.indexOf(pairedRank);
    if (idx === 0) return "TOP_PAIR";
    if (idx === 1) return "SECOND_PAIR";
    return "THIRD_PAIR_OR_WORSE";
  }

  // Sem par nenhum: so faz sentido falar em "projeto" com o board ainda
  // aberto (flop ou turn) — no river a mao ja e' o que e'.
  if (board.length > 0 && board.length < 5) {
    const hasFlushDraw = Array.from(suitCounts.values()).some((c) => c === 4);
    if (hasFlushDraw) return "FLUSH_DRAW";
    if (hasStraightDraw(all.map((c) => c.rank))) return "STRAIGHT_DRAW";
  }

  if (board.length > 0) {
    const boardMax = Math.max(...board.map((c) => c.rank));
    if (hole[0].rank > boardMax && hole[1].rank > boardMax) return "OVERCARDS";
  }

  return "AIR";
}

export interface BoardComboResult {
  cards: [string, string];
  label: string;
  category: Category;
}

export interface BoardAnalysis {
  totalCombos: number;
  byCategory: Record<Category, number>;
  combos: BoardComboResult[];
}

// So considera combo "vivo" na mao do vilao se o range tem alguma acao
// nao-fold pra aquela mao (call ou raise > 0) — igual ao "continuing
// range" do Flopzilla, nao a range de abertura completa.
//
// comboOverrides e' opcional: quando um combo especifico (ex: "AsKs")
// tem uma decisao propria, ela vence a decisao geral da mao ("AKs").
// Sem overrides, todo combo de uma mao se comporta igual — e' assim que
// o produto funcionava antes desse editor existir, entao continua o
// padrao quando ninguem customizou nada.
export function analyzeRangeVsBoard(hands: RangeHands, board: Card[], comboOverrides: RangeHands = {}): BoardAnalysis {
  const byCategory = {} as Record<Category, number>;
  CATEGORY_ORDER.forEach((cat) => (byCategory[cat] = 0));
  const combos: BoardComboResult[] = [];

  const boardKeys = new Set(board.map(cardToString));

  for (const raw of allDeckCombos()) {
    const aKey = cardToString(raw.a);
    const bKey = cardToString(raw.b);
    const comboKey = `${aKey}${bKey}`;
    const decision = comboOverrides[comboKey] ?? getDecision(hands, raw.label);
    if (decision.call <= 0 && decision.raise <= 0) continue;

    if (boardKeys.has(aKey) || boardKeys.has(bKey)) continue;

    const category = evaluateHand([raw.a, raw.b], board);
    byCategory[category] += 1;
    combos.push({ cards: [aKey, bKey], label: raw.label, category });
  }

  return { totalCombos: combos.length, byCategory, combos };
}

// --- Analise agregada contra varios boards ---
// "Como esse range se comporta na media de centenas de flops" (spec do
// Flopzilla: "interacao entre ranges e milhares de boards possiveis").
// Enumerar os 22.100 flops possiveis de verdade seria pesado demais pro
// navegador rodar sincrono; usamos uma amostra aleatoria em vez de
// exaustao completa — e' uma estimativa, nao um calculo exato, e a UI
// deixa isso explicito.
function randomFlop(): Card[] {
  const ranks = RANK_CHARS.map((c) => RANK_VALUE[c]);
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of ranks) deck.push({ rank: r, suit: s });

  const picked: Card[] = [];
  const usedIdx = new Set<number>();
  while (picked.length < 3) {
    const idx = Math.floor(Math.random() * deck.length);
    if (usedIdx.has(idx)) continue;
    usedIdx.add(idx);
    picked.push(deck[idx]);
  }
  return picked;
}

export interface MultiBoardAnalysis {
  boardsSampled: number;
  totalCombos: number;
  byCategory: Record<Category, number>;
}

export function analyzeRangeAcrossRandomBoards(
  hands: RangeHands,
  sampleSize: number,
  comboOverrides: RangeHands = {}
): MultiBoardAnalysis {
  const byCategory = {} as Record<Category, number>;
  CATEGORY_ORDER.forEach((cat) => (byCategory[cat] = 0));
  let totalCombos = 0;

  for (let i = 0; i < sampleSize; i++) {
    const board = randomFlop();
    const result = analyzeRangeVsBoard(hands, board, comboOverrides);
    totalCombos += result.totalCombos;
    for (const cat of CATEGORY_ORDER) byCategory[cat] += result.byCategory[cat];
  }

  return { boardsSampled: sampleSize, totalCombos, byCategory };
}
