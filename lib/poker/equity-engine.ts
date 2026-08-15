import {
  activeCombosForRange,
  cardToString,
  type Card,
} from "@/lib/poker/range-board-analyzer";
import type { RangeHands } from "@/components/ranges/range-grid";
import { scoreHand } from "@/lib/poker/hand-evaluator";

export type EquitySource =
  | { kind: "hand"; cards: [string, string] }
  | { kind: "range"; hands: RangeHands; comboOverrides?: RangeHands };

export interface EquityParticipantInput {
  label: string;
  source: EquitySource;
}

export interface EquityResult {
  label: string;
  equityPct: number;
  winPct: number;
  tiePct: number;
}

export interface EquityRunResult {
  results: EquityResult[];
  trialsCompleted: number;
}

const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUE: Record<string, number> = {};
RANK_CHARS.forEach((c, i) => (RANK_VALUE[c] = i + 2));
const SUITS = ["c", "d", "h", "s"] as const;

function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANK_CHARS.map((c) => RANK_VALUE[c])) deck.push({ rank: r, suit: s });
  return deck;
}

interface Pool {
  label: string;
  combos: { a: Card; b: Card; key: string }[];
}

// Resolve cada participante numa "pool" de combos candidatos: mao fixa
// vira uma pool de 1 so' combo, range vira todos os combos com
// call/raise > 0. Erros de configuracao (carta invalida, range sem
// nenhuma mao ativa) sao pegos aqui, antes de gastar tempo simulando.
function resolvePools(participants: EquityParticipantInput[]): { pools: Pool[] } | { error: string } {
  const pools: Pool[] = [];
  for (const p of participants) {
    if (p.source.kind === "hand") {
      const [c1, c2] = p.source.cards;
      const parse = (s: string): Card | null => {
        const rc = s[0]?.toUpperCase();
        const sc = s[1]?.toLowerCase();
        if (!rc || !(rc in RANK_VALUE)) return null;
        if (!sc || !SUITS.includes(sc as (typeof SUITS)[number])) return null;
        return { rank: RANK_VALUE[rc], suit: sc as Card["suit"] };
      };
      const a = parse(c1);
      const b = parse(c2);
      if (!a || !b) return { error: `Mão inválida em "${p.label}" — use o formato "AsKd".` };
      if (a.rank === b.rank && a.suit === b.suit) return { error: `"${p.label}" tem a mesma carta repetida.` };
      pools.push({ label: p.label, combos: [{ a, b, key: `${cardToString(a)}${cardToString(b)}` }] });
    } else {
      const combos = activeCombosForRange(p.source.hands, p.source.comboOverrides ?? {});
      if (combos.length === 0) return { error: `O range de "${p.label}" não tem nenhuma mão com call/raise.` };
      pools.push({ label: p.label, combos });
    }
  }
  return { pools };
}

// Ate quantas vezes tenta sortear um combo sem conflito de carta antes
// de desistir daquela rodada inteira — evita loop infinito quando as
// pools se sobrepoem muito (ex: dois ranges quase identicos disputando
// as mesmas cartas).
const MAX_DEAL_ATTEMPTS = 60;

export function runEquityMonteCarlo(
  participants: EquityParticipantInput[],
  board: Card[],
  trials: number
): EquityRunResult | { error: string } {
  if (participants.length < 2) return { error: "Precisa de pelo menos 2 participantes." };
  if (board.length > 5) return { error: "Board não pode ter mais de 5 cartas." };

  const resolved = resolvePools(participants);
  if ("error" in resolved) return resolved;
  const { pools } = resolved;

  const boardKeys = new Set(board.map(cardToString));
  // Cartas fixas dos participantes tipo "mao" que colidem com o board
  // ou entre si sao erro de configuracao, nao "raro nessa rodada" — se
  // acontecer pra TODA tentativa de uma pool de 1 unico combo, o erro
  // e' sempre o mesmo, entao vale checar antes de rodar.
  for (const pool of pools) {
    if (pool.combos.length === 1) {
      const { a, b } = pool.combos[0];
      if (boardKeys.has(cardToString(a)) || boardKeys.has(cardToString(b))) {
        return { error: `A mão de "${pool.label}" usa uma carta que já está no board.` };
      }
    }
  }

  const equitySum = new Array(participants.length).fill(0);
  const winSum = new Array(participants.length).fill(0);
  const tieSum = new Array(participants.length).fill(0);
  let trialsCompleted = 0;

  const deck = fullDeck();

  for (let t = 0; t < trials; t++) {
    const usedKeys = new Set(boardKeys);
    const holeCards: [Card, Card][] = [];
    let dealFailed = false;

    for (const pool of pools) {
      let picked: { a: Card; b: Card } | null = null;
      for (let attempt = 0; attempt < MAX_DEAL_ATTEMPTS; attempt++) {
        const candidate = pool.combos[Math.floor(Math.random() * pool.combos.length)];
        const aKey = cardToString(candidate.a);
        const bKey = cardToString(candidate.b);
        if (usedKeys.has(aKey) || usedKeys.has(bKey)) continue;
        picked = candidate;
        usedKeys.add(aKey);
        usedKeys.add(bKey);
        break;
      }
      if (!picked) {
        dealFailed = true;
        break;
      }
      holeCards.push([picked.a, picked.b]);
    }

    if (dealFailed) continue; // essa rodada nao conta, tenta a proxima

    // Completa o board ate 5 cartas com o restante do baralho.
    const remainingDeck = deck.filter((c) => !usedKeys.has(cardToString(c)));
    const runningBoard = [...board];
    while (runningBoard.length < 5) {
      const idx = Math.floor(Math.random() * remainingDeck.length);
      const card = remainingDeck.splice(idx, 1)[0];
      runningBoard.push(card);
    }

    const scores = holeCards.map(([a, b]) => scoreHand([a, b, ...runningBoard]));
    const maxScore = Math.max(...scores);
    const winners = scores.reduce<number[]>((acc, s, i) => (s === maxScore ? [...acc, i] : acc), []);

    for (const i of winners) {
      equitySum[i] += 1 / winners.length;
      if (winners.length === 1) winSum[i] += 1;
      else tieSum[i] += 1;
    }
    trialsCompleted += 1;
  }

  if (trialsCompleted === 0) {
    return { error: "Não consegui completar nenhuma simulação — os ranges informados parecem conflitar demais entre si." };
  }

  const results: EquityResult[] = pools.map((pool, i) => ({
    label: pool.label,
    equityPct: Math.round((equitySum[i] / trialsCompleted) * 1000) / 10,
    winPct: Math.round((winSum[i] / trialsCompleted) * 1000) / 10,
    tiePct: Math.round((tieSum[i] / trialsCompleted) * 1000) / 10,
  }));

  return { results, trialsCompleted };
}
