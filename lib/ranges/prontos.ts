// Ranges prontos do PokerSync: os ranges pré-flop resolvidos pelo solver
// (tabela preflop_ranges, os mesmos spots do Modo Treino), traduzidos pra
// leitura -- "BTN_RFI" no spot "mtt_40bb_btn_vs_bb_srp" vira "BTN abre ·
// 40bb", com posição, contra quem e a ação.

import { COR_ACAO } from "@/lib/poker/grade-gto";
import { lerTextoRange, type Pesos } from "./notacao";
import type { ContraOQue } from "./link-da-mao";

export interface LinhaPreflop {
  spot_id: string;
  stack_bb: number;
  action_label: string;
  range_string: string;
  structure?: string | null;
}

export type Acao = "abrir" | "pagar" | "3bet" | "allin" | "completar" | "completar_allin" | "check" | "aumentar" | "outra";

export interface RangePronto {
  id: string; // "spot_id:action_label"
  titulo: string;
  posicao: string;
  vsPosicao: string | null;
  stack: number;
  acao: Acao;
  /** O que o herói enfrenta (null: ação que o PokerSync não conhece). */
  contra: ContraOQue | null;
  spotId: string;
  pesos: Pesos;
}

// contra: o que o herói enfrenta no spot (o mesmo "contra" do link do
// Revisor, lib/ranges/link-da-mao.ts) -- pra um aumento normal nunca abrir
// o range de pagar all-in, e vice-versa.
const VERBOS: { chave: string; texto: string; acao: Acao; vs: boolean; contra: ContraOQue }[] = [
  { chave: "RFI", texto: "abre", acao: "abrir", vs: false, contra: "nada" },
  { chave: "SHOVE", texto: "vai de all-in", acao: "allin", vs: false, contra: "nada" },
  // Range misto (limp + all-in na mesma grade, sem separar qual mão vai pra
  // qual) -- ação própria pra não pintar de "call" o que também é all-in.
  { chave: "COMPLETE_OR_SHOVE", texto: "completa ou vai de all-in", acao: "completar_allin", vs: false, contra: "nada" },
  { chave: "COMPLETE", texto: "completa", acao: "completar", vs: false, contra: "nada" },
  { chave: "CALL_VS_MINRAISE", texto: "paga min-raise", acao: "pagar", vs: true, contra: "aumento" },
  { chave: "CALL_VS_SHOVE", texto: "paga all-in", acao: "pagar", vs: true, contra: "allin" },
  { chave: "FLAT_CALL", texto: "paga", acao: "pagar", vs: true, contra: "aumento" },
  { chave: "CALL", texto: "paga", acao: "pagar", vs: true, contra: "aumento" },
  { chave: "3BET_SHOVE", texto: "3-bet all-in", acao: "allin", vs: true, contra: "aumento" },
  { chave: "3BET_NON_JAM", texto: "3-bet (sem all-in)", acao: "3bet", vs: true, contra: "aumento" },
  { chave: "3BET", texto: "3-bet", acao: "3bet", vs: true, contra: "aumento" },
  { chave: "CHECK_BEHIND", texto: "dá check", acao: "check", vs: true, contra: "limp" },
  { chave: "RAISE_VS_LIMP", texto: "aumenta o limp", acao: "aumentar", vs: true, contra: "limp" },
];

export function traduzirPronto(l: LinhaPreflop): RangePronto {
  const partes = l.action_label.replace(/^(IP|OOP)_/, "").split("_");
  const posicao = partes[0];
  const resto = partes.slice(1).join("_");
  const verbo = VERBOS.find((x) => x.chave === resto);
  // spot "mtt_40bb_btn_vs_bb_srp": as duas posições do spot
  const m = l.spot_id.match(/_([a-z]+)_vs_([a-z]+)/);
  const posicoes = m ? [m[1].toUpperCase(), m[2].toUpperCase()] : [];
  const vsPosicao = posicoes.find((p) => p !== posicao) ?? null;
  const titulo = verbo
    ? `${posicao} ${verbo.texto}${verbo.vs && vsPosicao ? ` vs ${vsPosicao}` : ""}`
    : `${posicao} ${resto.toLowerCase().replace(/_/g, " ")}`;
  return {
    id: `${l.spot_id}:${l.action_label}`,
    titulo,
    posicao,
    vsPosicao,
    stack: l.stack_bb,
    acao: verbo?.acao ?? "outra",
    contra: verbo?.contra ?? null,
    spotId: l.spot_id,
    pesos: lerTextoRange(l.range_string).pesos,
  };
}

export const NOME_ACAO: Record<Acao, string> = {
  abrir: "Abrir",
  pagar: "Pagar",
  "3bet": "3-bet",
  allin: "All-in",
  completar: "Completar",
  completar_allin: "Completar ou all-in",
  check: "Check",
  aumentar: "Aumentar",
  outra: "Outra",
};

/** Cor da ação de um range (a mesma paleta da grade do Treino): raise
 *  vermelho; call, limp (completar) e check verde -- as jogadas passivas;
 *  3-bet vermelho escuro; all-in laranja. Range sem ação definida ou misto
 *  (completar ou all-in, sem separar as mãos) fica no dourado do produto. */
export function corDaAcao(acao: string | null | undefined): string {
  if (acao === "abrir" || acao === "aumentar") return COR_ACAO.raise;
  if (acao === "pagar" || acao === "completar" || acao === "check") return COR_ACAO.call;
  if (acao === "3bet") return COR_ACAO.threebet;
  if (acao === "allin") return COR_ACAO.allin;
  return COR_SEM_ACAO;
}

export const COR_SEM_ACAO = "#d4af37";
