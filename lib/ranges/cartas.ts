// Cartas, mãos e combos do Construtor de Ranges.
//
// - carta: "Kh" (valor maiúsculo + naipe minúsculo; T = 10);
// - mão (célula da grade): "AA", "AKs" (mesmo naipe), "AKo" (naipes diferentes);
// - combo: as duas cartas coladas, a maior primeiro -- "AhKh", "KsKd".
//   Par vem com os naipes na ordem de NAIPES ("KsKh", nunca "KhKs"), então
//   cada combo tem um jeito só de ser escrito.

export const VALORES = "23456789TJQKA"; // índice = força (0 = 2 ... 12 = A)
export const NAIPES = ["s", "h", "d", "c"] as const;
export type Naipe = (typeof NAIPES)[number];

/** Ordem das linhas/colunas da grade 13x13 (A no canto de cima). */
export const GRADE = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export interface Carta {
  /** 0 (2) a 12 (A). */
  v: number;
  n: Naipe;
}

export function lerCarta(s: string): Carta | null {
  const v = VALORES.indexOf((s[0] ?? "").toUpperCase());
  const n = (s[1] ?? "").toLowerCase() as Naipe;
  if (v < 0 || !NAIPES.includes(n)) return null;
  return { v, n };
}

export const cartaTexto = (c: Carta) => VALORES[c.v] + c.n;

/** Carta pra leitura: "K♥", "10♠". */
export function nomeCarta(s: string): string {
  const simbolo: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
  return `${s[0] === "T" ? "10" : s[0]}${simbolo[s[1]] ?? ""}`;
}

/** Mão da célula (linha, coluna) da grade: diagonal = par, acima = suited. */
export function maoDaCelula(linha: number, coluna: number): string {
  if (linha === coluna) return GRADE[linha] + GRADE[coluna];
  return linha < coluna ? GRADE[linha] + GRADE[coluna] + "s" : GRADE[coluna] + GRADE[linha] + "o";
}

/** As 169 mãos, na ordem da grade (linha por linha). */
export const TODAS_AS_MAOS: string[] = GRADE.flatMap((_, i) => GRADE.map((__, j) => maoDaCelula(i, j)));

export function combosPorMao(mao: string): number {
  if (mao.length === 2) return 6;
  return mao[2] === "s" ? 4 : 12;
}

export function comboTexto(a: Carta, b: Carta): string {
  const [alta, baixa] =
    a.v > b.v || (a.v === b.v && NAIPES.indexOf(a.n) < NAIPES.indexOf(b.n)) ? [a, b] : [b, a];
  return cartaTexto(alta) + cartaTexto(baixa);
}

const cacheCombos = new Map<string, string[]>();
/** Combos de uma mão ("AKs" -> ["AsKs", "AhKh", "AdKd", "AcKc"]). */
export function combosDaMao(mao: string): string[] {
  const salvo = cacheCombos.get(mao);
  if (salvo) return salvo;
  const a = VALORES.indexOf(mao[0]);
  const b = VALORES.indexOf(mao[1]);
  const res: string[] = [];
  if (mao.length === 2) {
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) res.push(comboTexto({ v: a, n: NAIPES[i] }, { v: a, n: NAIPES[j] }));
  } else if (mao[2] === "s") {
    for (const n of NAIPES) res.push(comboTexto({ v: a, n }, { v: b, n }));
  } else {
    for (const n1 of NAIPES) for (const n2 of NAIPES) if (n1 !== n2) res.push(comboTexto({ v: a, n: n1 }, { v: b, n: n2 }));
  }
  cacheCombos.set(mao, res);
  return res;
}

export function cartasDoCombo(combo: string): [Carta, Carta] {
  return [lerCarta(combo.slice(0, 2))!, lerCarta(combo.slice(2, 4))!];
}

/** "AhKh" -> "AKs"; "KsKd" -> "KK". */
export function maoDoCombo(combo: string): string {
  const [a, b] = cartasDoCombo(combo);
  if (a.v === b.v) return VALORES[a.v] + VALORES[b.v];
  return VALORES[a.v] + VALORES[b.v] + (a.n === b.n ? "s" : "o");
}

/** Baralho inteiro, "As" ... "2c". */
export const BARALHO: string[] = NAIPES.flatMap((n) => [...VALORES].reverse().map((v) => v + n));
