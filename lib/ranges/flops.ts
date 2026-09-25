// "Todos os flops": o range analisado nos 184 flops que representam os
// 1.755 flops possíveis (tabela flop_subsets, cada um com o peso de
// quantos flops ele representa), com filtro por tipo de flop.

import { type Analise, FORTES, analisar } from "./acertos";
import { lerCarta, type Carta } from "./cartas";

export type NaipesFlop = "rainbow" | "twotone" | "monotone";
export type ParFlop = "unpaired" | "paired" | "trips";
export type AltaFlop = "A_K_high" | "Q_J_high" | "T_9_high" | "mid_high" | "low_high";
export type ConexaoFlop = "connected" | "onegap" | "disconnected" | "na";

export interface FlopRepresentativo {
  flop: string; // "Kh9d4s"
  peso: number;
  naipes: NaipesFlop;
  par: ParFlop;
  alta: AltaFlop;
  conexao: ConexaoFlop;
}

export interface FiltroFlops {
  naipes: NaipesFlop | "todos";
  alta: "todas" | "AK" | "QJ" | "T9" | "baixa";
  par: "todos" | "sem" | "com";
  conexao: "todas" | "conectado";
}
export const FILTRO_INICIAL: FiltroFlops = { naipes: "todos", alta: "todas", par: "todos", conexao: "todas" };

export const ALTAS: { k: AltaFlop; nome: string }[] = [
  { k: "A_K_high", nome: "A ou K alto" },
  { k: "Q_J_high", nome: "Q ou J alto" },
  { k: "T_9_high", nome: "10 ou 9 alto" },
  { k: "mid_high", nome: "8 a 6 alto" },
  { k: "low_high", nome: "5 ou menos" },
];
export const NAIPES_FLOP: { k: NaipesFlop; nome: string }[] = [
  { k: "rainbow", nome: "Arco-íris" },
  { k: "twotone", nome: "Dois naipes" },
  { k: "monotone", nome: "Monotone" },
];

export function passaNoFiltro(f: FlopRepresentativo, filtro: FiltroFlops): boolean {
  if (filtro.naipes !== "todos" && f.naipes !== filtro.naipes) return false;
  if (filtro.par === "sem" && f.par !== "unpaired") return false;
  if (filtro.par === "com" && f.par === "unpaired") return false;
  if (filtro.conexao === "conectado" && !(f.conexao === "connected" || f.conexao === "onegap")) return false;
  if (filtro.alta === "AK" && f.alta !== "A_K_high") return false;
  if (filtro.alta === "QJ" && f.alta !== "Q_J_high") return false;
  if (filtro.alta === "T9" && f.alta !== "T_9_high") return false;
  if (filtro.alta === "baixa" && !(f.alta === "mid_high" || f.alta === "low_high")) return false;
  return true;
}

export interface ResumoFlop {
  flop: FlopRepresentativo;
  cartas: Carta[];
  parOuMelhor: number;
  topoOuMelhor: number;
  projetoForte: number;
  nada: number;
}

function resumir(f: FlopRepresentativo, a: Analise): ResumoFlop {
  const t = a.total || 1;
  let parMais = 0;
  let topoMais = 0;
  let projeto = 0;
  let nada = 0;
  for (const c of a.combos) {
    const temPar = c.feita !== "asalto" && c.feita !== "nada";
    const forte = c.projetos.includes("fd") || c.projetos.includes("oesd");
    if (temPar) parMais += c.peso;
    if (FORTES.includes(c.feita)) topoMais += c.peso;
    if (!temPar && forte) projeto += c.peso;
    if (!temPar && !forte && !c.projetos.includes("gut")) nada += c.peso;
  }
  return {
    flop: f,
    cartas: cartasDoFlop(f.flop),
    parOuMelhor: parMais / t,
    topoOuMelhor: topoMais / t,
    projetoForte: projeto / t,
    nada: nada / t,
  };
}

export function cartasDoFlop(flop: string): Carta[] {
  return [flop.slice(0, 2), flop.slice(2, 4), flop.slice(4, 6)].map((c) => lerCarta(c)!);
}

/**
 * Tipo do flop calculado pelas próprias cartas (as colunas da tabela
 * flop_subsets usam outra divisão de carta alta: lá um flop Q alto conta
 * como "A_K_high").
 */
export function tipoDoFlop(flop: string): Pick<FlopRepresentativo, "naipes" | "par" | "alta" | "conexao"> {
  const cartas = cartasDoFlop(flop);
  const qNaipes = new Set(cartas.map((c) => c.n)).size;
  const valores = [...new Set(cartas.map((c) => c.v))].sort((a, b) => a - b);
  const alta = valores[valores.length - 1];
  let conexao: ConexaoFlop = "na";
  if (valores.length === 3) {
    const vao = (vs: number[]) => vs[vs.length - 1] - vs[0];
    // Ás também vale como 1 (A-2-3 é conectado)
    const comAsBaixo = valores.includes(12) ? [-1, ...valores.filter((x) => x !== 12)] : null;
    const menor = Math.min(vao(valores), comAsBaixo ? vao(comAsBaixo) : 99);
    conexao = menor <= 2 ? "connected" : menor <= 4 ? "onegap" : "disconnected";
  }
  return {
    naipes: qNaipes === 3 ? "rainbow" : qNaipes === 2 ? "twotone" : "monotone",
    par: valores.length === 3 ? "unpaired" : valores.length === 2 ? "paired" : "trips",
    // índices: 12 = A, 11 = K, 10 = Q, 9 = J, 8 = T, 7 = 9, 6 = 8, 4 = 6, 3 = 5
    alta: alta >= 11 ? "A_K_high" : alta >= 9 ? "Q_J_high" : alta >= 7 ? "T_9_high" : alta >= 4 ? "mid_high" : "low_high",
    conexao,
  };
}

/** Analisa o range em todos os flops (uma vez); o filtro é aplicado depois, sem recalcular. */
export function analisarFlops(combos: Map<string, number>, flops: FlopRepresentativo[]): ResumoFlop[] {
  return flops.map((f) => resumir(f, analisar(combos, cartasDoFlop(f.flop))));
}

export interface Medias {
  parOuMelhor: number;
  topoOuMelhor: number;
  projetoForte: number;
  nada: number;
  quantos: number;
}

export function medias(resumos: ResumoFlop[]): Medias {
  const pesoTotal = resumos.reduce((s, r) => s + r.flop.peso, 0) || 1;
  const media = (k: "parOuMelhor" | "topoOuMelhor" | "projetoForte" | "nada") =>
    resumos.reduce((s, r) => s + r[k] * r.flop.peso, 0) / pesoTotal;
  return {
    parOuMelhor: media("parOuMelhor"),
    topoOuMelhor: media("topoOuMelhor"),
    projetoForte: media("projetoForte"),
    nada: media("nada"),
    quantos: resumos.length,
  };
}

/** Matriz carta alta x naipes com a média de "par no topo ou melhor". */
export function matriz(resumos: ResumoFlop[]): ({ valor: number; quantos: number } | null)[][] {
  return ALTAS.map((a) =>
    NAIPES_FLOP.map((n) => {
      const sel = resumos.filter((r) => r.flop.alta === a.k && r.flop.naipes === n.k);
      if (!sel.length) return null;
      return { valor: medias(sel).topoOuMelhor, quantos: sel.length };
    }),
  );
}
