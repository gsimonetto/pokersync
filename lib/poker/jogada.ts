import { parseCard, type Card } from "./card";
import { scoreHand, tierFromScore } from "./hand-evaluator";

// Nome da jogada e chance de vitória -- o que as salas mostram na mesa
// no showdown ("Par de Reis") e na hora do all-in ("81%" x "19%").

const PLURAL: Record<number, string> = {
  14: "Ases", 13: "Reis", 12: "Damas", 11: "Valetes", 10: "Dez", 9: "Noves", 8: "Oitos",
  7: "Setes", 6: "Seis", 5: "Cincos", 4: "Quatros", 3: "Treses", 2: "Dois",
};
const SINGULAR: Record<number, string> = {
  14: "Ás", 13: "Rei", 12: "Dama", 11: "Valete", 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "3", 2: "2",
};

function cartas(strs: string[]): Card[] | null {
  const out: Card[] = [];
  for (const s of strs) {
    const c = parseCard(s);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

// O score do avaliador guarda, em base 15, a categoria e as cartas que
// decidem (ex.: par de Reis -> [1, 13, ...]) -- dá pra montar o nome
// sem avaliar de novo.
function digitos(score: number): number[] {
  const d: number[] = [];
  let s = score;
  for (let i = 0; i < 6; i++) {
    d.unshift(s % 15);
    s = Math.floor(s / 15);
  }
  return d; // [categoria, k1, k2, k3, k4, k5]
}

/** "Par de Reis", "Dois pares: Reis e Setes", "Sequência até o 9"... */
export function nomeDaJogada(mao: string[], board: string[]): string | null {
  const cs = cartas([...mao, ...board]);
  if (!cs || cs.length < 5) return null;
  const score = scoreHand(cs);
  const tier = tierFromScore(score);
  const [, k1, k2] = digitos(score);
  switch (tier) {
    case "HIGH_CARD": return `Carta alta: ${SINGULAR[k1]}`;
    case "PAIR": return `Par de ${PLURAL[k1]}`;
    case "TWO_PAIR": return `Dois pares: ${PLURAL[k1]} e ${PLURAL[k2]}`;
    case "TRIPS": return `Trinca de ${PLURAL[k1]}`;
    case "STRAIGHT": return `Sequência até o ${SINGULAR[k1]}`;
    case "FLUSH": return `Flush, ${SINGULAR[k1]} alto`;
    case "FULL_HOUSE": return `Full house: ${PLURAL[k1]} com ${PLURAL[k2]}`;
    case "QUADS": return `Quadra de ${PLURAL[k1]}`;
    case "STRAIGHT_FLUSH": return k1 === 14 ? "Royal flush" : `Straight flush até o ${SINGULAR[k1]}`;
  }
}

/**
 * Chance de cada mão levar o pote com o board atual (empate divide).
 * Com flop/turn na mesa conta TODAS as cartas que faltam (exato); no
 * pré-flop sorteia boards (6 mil: ~0,1 s e fica a ±1%).
 */
export function equidade(maos: string[][], board: string[], sorteios = 6000): number[] | null {
  const hs = maos.map(cartas);
  const bd = cartas(board);
  if (hs.some((h) => !h || h.length !== 2) || !bd || maos.length < 2) return null;
  const usadas = new Set([...maos.flat(), ...board].map((s) => s.toUpperCase()));
  const baralho: Card[] = [];
  for (const r of "23456789TJQKA") for (const n of "cdhs") if (!usadas.has(`${r}${n}`.toUpperCase())) baralho.push(parseCard(`${r}${n}`)!);
  const faltam = 5 - bd.length;
  const soma = new Array(maos.length).fill(0);
  let total = 0;

  const avaliar = (resto: Card[]) => {
    const full = [...bd, ...resto];
    const scores = hs.map((h) => scoreHand([...h!, ...full]));
    const melhor = Math.max(...scores);
    const ganhadores = scores.filter((x) => x === melhor).length;
    scores.forEach((x, i) => {
      if (x === melhor) soma[i] += 1 / ganhadores;
    });
    total++;
  };

  if (faltam === 0) avaliar([]);
  else if (faltam <= 2) {
    // exato: todas as combinações das cartas que faltam
    const n = baralho.length;
    if (faltam === 1) for (let i = 0; i < n; i++) avaliar([baralho[i]]);
    else for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) avaliar([baralho[i], baralho[j]]);
  } else {
    for (let t = 0; t < sorteios; t++) {
      // embaralha parcial (Fisher-Yates) só as primeiras `faltam` cartas
      const b = baralho.slice();
      for (let i = 0; i < faltam; i++) {
        const j = i + Math.floor(Math.random() * (b.length - i));
        [b[i], b[j]] = [b[j], b[i]];
      }
      avaliar(b.slice(0, faltam));
    }
  }
  return total > 0 ? soma.map((x) => (x / total) * 100) : null;
}
