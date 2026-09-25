// Equidade por simulação (Monte Carlo) entre dois ranges com peso: sorteia
// um combo de cada lado (proporcional ao peso -- AKs a 50% sai metade das
// vezes), completa o board com cartas que sobraram e vê quem ganha. Usa o
// mesmo scoreHand do resto do produto pra decidir o showdown.

import type { Card } from "../poker/card";
import { scoreHand } from "../poker/hand-evaluator";
import { BARALHO, type Carta, cartaTexto, cartasDoCombo, maoDoCombo } from "./cartas";

const paraCard = (c: Carta): Card => ({ rank: c.v + 2, suit: c.n });

interface Sorteio {
  combos: string[];
  acumulado: number[];
  total: number;
}

function preparar(combos: Map<string, number>, bloqueadas: Set<string>): Sorteio {
  const lista: string[] = [];
  const acumulado: number[] = [];
  let total = 0;
  for (const [combo, peso] of combos) {
    if (peso <= 0 || bloqueadas.has(combo.slice(0, 2)) || bloqueadas.has(combo.slice(2, 4))) continue;
    total += peso;
    lista.push(combo);
    acumulado.push(total);
  }
  return { combos: lista, acumulado, total };
}

function sortear(s: Sorteio): string {
  const x = Math.random() * s.total;
  let lo = 0;
  let hi = s.acumulado.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.acumulado[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return s.combos[lo];
}

export interface ResultadoEquidade {
  heroi: number; // 0..100
  vilao: number;
  empate: number;
  rodadas: number;
}

/** Equidade de um range contra outro no board (0 a 5 cartas). */
export function equidadeEntre(
  heroi: Map<string, number>,
  vilao: Map<string, number>,
  board: Carta[],
  rodadas = 8000,
): ResultadoEquidade | null {
  const boardTxt = new Set(board.map(cartaTexto));
  const h = preparar(heroi, boardTxt);
  const v = preparar(vilao, boardTxt);
  if (!h.total || !v.total) return null;
  const boardCards = board.map(paraCard);
  let ganha = 0;
  let empata = 0;
  let feitas = 0;
  for (let i = 0; i < rodadas; i++) {
    const ch = sortear(h);
    let cv = "";
    for (let t = 0; t < 30; t++) {
      const x = sortear(v);
      if (!x.includes(ch.slice(0, 2)) && !x.includes(ch.slice(2, 4))) {
        cv = x;
        break;
      }
    }
    if (!cv) continue;
    const r = rodada(ch, cv, board, boardTxt, boardCards);
    feitas++;
    if (r > 0) ganha++;
    else if (r === 0) empata++;
  }
  if (!feitas) return null;
  return {
    heroi: ((ganha + empata / 2) / feitas) * 100,
    vilao: ((feitas - ganha - empata + empata / 2) / feitas) * 100,
    empate: (empata / feitas) * 100,
    rodadas: feitas,
  };
}

// Uma mão até o river: >0 herói ganha, 0 empate, <0 perde.
function rodada(ch: string, cv: string, board: Carta[], boardTxt: Set<string>, boardCards: Card[]): number {
  const usadas = new Set([...boardTxt, ch.slice(0, 2), ch.slice(2, 4), cv.slice(0, 2), cv.slice(2, 4)]);
  const faltam = 5 - board.length;
  const extra: Card[] = [];
  while (extra.length < faltam) {
    const c = BARALHO[Math.floor(Math.random() * 52)];
    if (usadas.has(c)) continue;
    usadas.add(c);
    extra.push(paraCard({ v: "23456789TJQKA".indexOf(c[0]), n: c[1] as Carta["n"] }));
  }
  const mesa = [...boardCards, ...extra];
  const [h1, h2] = cartasDoCombo(ch);
  const [v1, v2] = cartasDoCombo(cv);
  const sh = scoreHand([paraCard(h1), paraCard(h2), ...mesa]);
  const sv = scoreHand([paraCard(v1), paraCard(v2), ...mesa]);
  return sh - sv;
}

/**
 * Equidade de cada mão da grade contra o range do vilão (pra colorir a
 * grade). Faz em pedaços e devolve o parcial a cada pedaço, pra tela não
 * travar enquanto calcula.
 */
export function equidadePorMao(
  heroi: Map<string, number>,
  vilao: Map<string, number>,
  board: Carta[],
  aoAtualizar: (parcial: Record<string, number>) => void,
  rodadasPorMao = 360,
): () => void {
  const boardTxt = new Set(board.map(cartaTexto));
  const v = preparar(vilao, boardTxt);
  const boardCards = board.map(paraCard);
  const porMao = new Map<string, string[]>();
  for (const [combo, peso] of heroi) {
    if (peso <= 0 || boardTxt.has(combo.slice(0, 2)) || boardTxt.has(combo.slice(2, 4))) continue;
    const mao = maoDoCombo(combo);
    porMao.set(mao, [...(porMao.get(mao) ?? []), combo]);
  }
  const maos = [...porMao.keys()];
  const resultado: Record<string, number> = {};
  let cancelado = false;
  let i = 0;
  function passo() {
    if (cancelado) return;
    const fim = Math.min(maos.length, i + 6);
    for (; i < fim; i++) {
      const mao = maos[i];
      const combos = porMao.get(mao)!;
      let ganha = 0;
      let empata = 0;
      let feitas = 0;
      for (let r = 0; r < rodadasPorMao; r++) {
        const ch = combos[r % combos.length];
        let cv = "";
        for (let t = 0; t < 30 && v.total; t++) {
          const x = sortear(v);
          if (!x.includes(ch.slice(0, 2)) && !x.includes(ch.slice(2, 4))) {
            cv = x;
            break;
          }
        }
        if (!cv) continue;
        const res = rodada(ch, cv, board, boardTxt, boardCards);
        feitas++;
        if (res > 0) ganha++;
        else if (res === 0) empata++;
      }
      if (feitas) resultado[mao] = ((ganha + empata / 2) / feitas) * 100;
    }
    aoAtualizar({ ...resultado });
    if (i < maos.length) setTimeout(passo, 0);
  }
  setTimeout(passo, 0);
  return () => {
    cancelado = true;
  };
}
