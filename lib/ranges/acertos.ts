// "Como o range acerta o board" -- o coração do Flopzilla.
//
// Cada combo do range ganha UMA mão feita (a melhor, usando pelo menos uma
// carta da mão -- par que está só no board não conta) e ZERO ou MAIS
// projetos (projeto de flush, de sequência, overcards...). As mãos feitas
// somam 100% do range; os projetos são contados à parte, como no Flopzilla.
// Tudo contado com peso: AKs a 50% entra como 2 combos, não 4.

import { NAIPES, type Carta, cartaTexto, cartasDoCombo, lerCarta, maoDoCombo, VALORES } from "./cartas";

export type Feita =
  | "sf"
  | "quadra"
  | "full"
  | "flush"
  | "seq"
  | "trinca"
  | "doispares"
  | "overpair"
  | "topo"
  | "meio"
  | "fraco"
  | "asalto"
  | "nada";
export type Projeto = "fd" | "oesd" | "gut" | "bdfd" | "over";

export const FEITAS: { k: Feita; nome: string; dica: string }[] = [
  { k: "sf", nome: "Straight flush", dica: "Sequência toda do mesmo naipe." },
  { k: "quadra", nome: "Quadra", dica: "Quatro cartas do mesmo valor." },
  { k: "full", nome: "Full house", dica: "Trinca mais um par." },
  { k: "flush", nome: "Flush", dica: "Cinco cartas do mesmo naipe." },
  { k: "seq", nome: "Sequência", dica: "Cinco cartas em sequência." },
  { k: "trinca", nome: "Trinca", dica: "Três cartas do mesmo valor (set ou trinca)." },
  { k: "doispares", nome: "Dois pares", dica: "Dois pares usando as suas cartas." },
  { k: "overpair", nome: "Overpair", dica: "Par na mão maior que todas as cartas do board." },
  { k: "topo", nome: "Par no topo", dica: "Uma carta sua pareia a maior carta do board." },
  { k: "meio", nome: "Par do meio", dica: "Pareia a carta do meio, ou par na mão entre as duas maiores do board." },
  { k: "fraco", nome: "Par fraco", dica: "Pareia a menor carta, ou par na mão abaixo do board." },
  { k: "asalto", nome: "Ás alto", dica: "Sem par, mas com um Ás." },
  { k: "nada", nome: "Nada", dica: "Sem par e sem Ás." },
];
export const PROJETOS: { k: Projeto; nome: string; dica: string }[] = [
  { k: "fd", nome: "Projeto de flush", dica: "Quatro cartas do mesmo naipe: falta uma." },
  { k: "oesd", nome: "Sequência aberta", dica: "Oito outs pra sequência (pontas abertas ou dupla barriga)." },
  { k: "gut", nome: "Gutshot", dica: "Quatro outs pra sequência (falta a carta do meio)." },
  { k: "bdfd", nome: "Backdoor de flush", dica: "Três do mesmo naipe no flop: precisa de turn e river." },
  { k: "over", nome: "Duas overcards", dica: "Sem par, as duas cartas maiores que o board." },
];

/** "Par no topo ou melhor" -- a medida usada na próxima carta e nos flops. */
export const FORTES: Feita[] = ["sf", "quadra", "full", "flush", "seq", "trinca", "doispares", "overpair", "topo"];
const PRONTAS: Feita[] = ["sf", "quadra", "full", "flush", "seq"];

function temSequencia(valores: Set<number>): boolean {
  const tem = (x: number) => (x === -1 ? valores.has(12) : valores.has(x));
  for (let ini = -1; ini <= 8; ini++) {
    let ok = true;
    for (let k = 0; k < 5; k++)
      if (!tem(ini + k)) {
        ok = false;
        break;
      }
    if (ok) return true;
  }
  return false;
}

export function classificar(mao: [Carta, Carta], board: Carta[]): { feita: Feita; projetos: Projeto[] } {
  const todas = [...mao, ...board];
  const cont = new Map<number, number>();
  const naipes = new Map<string, number>();
  for (const c of todas) {
    cont.set(c.v, (cont.get(c.v) ?? 0) + 1);
    naipes.set(c.n, (naipes.get(c.n) ?? 0) + 1);
  }
  const usa = (v: number) => mao[0].v === v || mao[1].v === v;
  const todosV = new Set(todas.map((c) => c.v));
  const boardV = new Set(board.map((c) => c.v));
  let naipeFlush: string | null = null;
  for (const [n, q] of naipes) if (q >= 5 && (mao[0].n === n || mao[1].n === n)) naipeFlush = n;
  const trincas = [...cont].filter(([, q]) => q >= 3).map(([x]) => x);
  const pares = [...cont].filter(([, q]) => q >= 2).map(([x]) => x);
  const proprios = [...cont]
    .filter(([x, q]) => q >= 2 && usa(x))
    .map(([x]) => x)
    .sort((a, b) => b - a);

  let feita: Feita;
  if (naipeFlush && temSequencia(new Set(todas.filter((c) => c.n === naipeFlush).map((c) => c.v)))) feita = "sf";
  else if ([...cont].some(([x, q]) => q === 4 && usa(x))) feita = "quadra";
  else if (trincas.length >= 1 && pares.length >= 2 && (usa(trincas[0]) || pares.some((x) => x !== trincas[0] && usa(x)))) feita = "full";
  else if (naipeFlush) feita = "flush";
  else if (temSequencia(todosV) && !temSequencia(boardV)) feita = "seq";
  else if (trincas.some((x) => usa(x))) feita = "trinca";
  else if (proprios.length >= 2) feita = "doispares";
  else if (proprios.length === 1) {
    const p = proprios[0];
    const desc = [...boardV].sort((a, b) => b - a);
    if (mao[0].v === mao[1].v) feita = p > desc[0] ? "overpair" : p > (desc[1] ?? -1) ? "meio" : "fraco";
    else {
      const i = desc.indexOf(p);
      feita = i === 0 ? "topo" : i === 1 ? "meio" : "fraco";
    }
  } else feita = mao[0].v === 12 || mao[1].v === 12 ? "asalto" : "nada";

  const projetos: Projeto[] = [];
  if (board.length >= 3 && board.length < 5 && !PRONTAS.includes(feita)) {
    let fd = false;
    for (const [n, q] of naipes) if (q === 4 && (mao[0].n === n || mao[1].n === n)) fd = true;
    if (fd) projetos.push("fd");
    let outs = 0;
    for (let x = 0; x < 13; x++) {
      if (todosV.has(x)) continue;
      const com = new Set(todosV);
      com.add(x);
      const soBoard = new Set(boardV);
      soBoard.add(x);
      if (temSequencia(com) && !temSequencia(soBoard)) outs++;
    }
    if (outs >= 2) projetos.push("oesd");
    else if (outs === 1) projetos.push("gut");
    if (board.length === 3 && !fd) for (const [n, q] of naipes) if (q === 3 && mao[0].n === n && mao[1].n === n) projetos.push("bdfd");
    if ((feita === "asalto" || feita === "nada") && Math.min(mao[0].v, mao[1].v) > Math.max(...board.map((c) => c.v))) projetos.push("over");
  }
  return { feita, projetos };
}

export interface ComboAnalisado {
  combo: string;
  peso: number; // 0..1
  feita: Feita;
  projetos: Projeto[];
}
export interface Analise {
  /** Combos (com peso) que sobram depois de tirar os que usam carta do board. */
  total: number;
  feitas: Record<Feita, number>;
  projetos: Record<Projeto, number>;
  combos: ComboAnalisado[];
}

export function analisar(combos: Map<string, number>, board: Carta[]): Analise {
  const usadas = new Set(board.map(cartaTexto));
  const feitas = Object.fromEntries(FEITAS.map((f) => [f.k, 0])) as Record<Feita, number>;
  const projetos = Object.fromEntries(PROJETOS.map((p) => [p.k, 0])) as Record<Projeto, number>;
  const lista: ComboAnalisado[] = [];
  let total = 0;
  for (const [combo, peso] of combos) {
    if (usadas.has(combo.slice(0, 2)) || usadas.has(combo.slice(2, 4))) continue;
    const k = classificar(cartasDoCombo(combo), board);
    total += peso;
    feitas[k.feita] += peso;
    for (const p of k.projetos) projetos[p] += peso;
    lista.push({ combo, peso, ...k });
  }
  return { total, feitas, projetos, combos: lista };
}

/** Quanto de cada mão da grade (0..1) está no filtro -- pra pintar a grade. */
export function fracaoPorMao(analise: Analise, filtro: (c: ComboAnalisado) => boolean): Record<string, number> {
  const tot = new Map<string, number>();
  const sel = new Map<string, number>();
  for (const c of analise.combos) {
    const mao = maoDoCombo(c.combo);
    tot.set(mao, (tot.get(mao) ?? 0) + c.peso);
    if (filtro(c)) sel.set(mao, (sel.get(mao) ?? 0) + c.peso);
  }
  const out: Record<string, number> = {};
  for (const [mao, t] of tot) out[mao] = t > 0 ? (sel.get(mao) ?? 0) / t : 0;
  return out;
}

/** O que continua pra próxima rua: combos das mãos feitas e projetos marcados. */
export function continuar(analise: Analise, feitas: Set<Feita>, projetos: Set<Projeto>): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of analise.combos) if (feitas.has(c.feita) || c.projetos.some((p) => projetos.has(p))) out.set(c.combo, c.peso);
  return out;
}

/** Atalhos do "continua com". */
export const ATALHOS: { nome: string; feitas: Feita[]; projetos: Projeto[] }[] = [
  { nome: "Só valor", feitas: FORTES, projetos: [] },
  { nome: "Valor + projetos", feitas: FORTES, projetos: ["fd", "oesd"] },
  { nome: "Qualquer par + projetos", feitas: [...FORTES, "meio", "fraco"], projetos: ["fd", "oesd", "gut"] },
];

/** Próxima carta: pra cada carta que pode sair, quanto do range fica com par no topo ou melhor. */
export function proximaCarta(combos: Map<string, number>, board: Carta[]): { carta: string; forte: number }[] {
  const usadas = new Set(board.map(cartaTexto));
  const res: { carta: string; forte: number }[] = [];
  for (const n of NAIPES)
    for (let v = 12; v >= 0; v--) {
      const carta = VALORES[v] + n;
      if (usadas.has(carta)) continue;
      const nova = [...board, { v, n }];
      let tot = 0;
      let bons = 0;
      for (const [combo, peso] of combos) {
        if (combo.includes(carta) || usadas.has(combo.slice(0, 2)) || usadas.has(combo.slice(2, 4))) continue;
        tot += peso;
        if (FORTES.includes(classificar(cartasDoCombo(combo), nova).feita)) bons += peso;
      }
      res.push({ carta, forte: tot ? bons / tot : 0 });
    }
  return res;
}

export function forcaDoRange(analise: Analise): number {
  if (!analise.total) return 0;
  return FORTES.reduce((s, f) => s + analise.feitas[f], 0) / analise.total;
}

/** Textura do board, em palavras. */
export function texturaDoBoard(board: Carta[]): string[] {
  if (board.length < 3) return [];
  const flop = board.slice(0, 3);
  const out: string[] = [];
  const naipes = new Set(flop.map((c) => c.n)).size;
  out.push(naipes === 3 ? "Arco-íris" : naipes === 2 ? "Dois naipes" : "Monotone");
  const alta = Math.max(...flop.map((c) => c.v));
  out.push(`${VALORES[alta] === "T" ? "10" : VALORES[alta]} alto`);
  const valores = new Set(flop.map((c) => c.v)).size;
  out.push(valores === 3 ? "Sem par" : valores === 2 ? "Pareado" : "Trinca no board");
  const ord = [...new Set(flop.map((c) => c.v))].sort((a, b) => a - b);
  if (valores === 3) {
    const vao = ord[2] - ord[0];
    const comAs = ord.includes(12) ? Math.max(...ord.filter((x) => x !== 12)) + 1 : 99; // A-2-3
    out.push(vao <= 2 || comAs <= 2 ? "Conectado" : vao <= 4 ? "Um buraco" : "Desconectado");
  }
  if (board.length >= 4) {
    const naipesTodos = new Map<string, number>();
    for (const c of board) naipesTodos.set(c.n, (naipesTodos.get(c.n) ?? 0) + 1);
    if ([...naipesTodos.values()].some((q) => q >= 3)) out.push("Flush possível");
  }
  return out;
}

export function lerBoard(cartas: string[]): Carta[] {
  return cartas.map((c) => lerCarta(c)).filter((c): c is Carta => c != null);
}
