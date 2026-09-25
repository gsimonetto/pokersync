// Ranges prontos do PokerSync: os ranges pré-flop resolvidos pelo solver
// (tabela preflop_ranges, os mesmos spots do Modo Treino), traduzidos pra
// leitura -- "BTN_RFI" no spot "mtt_40bb_btn_vs_bb_srp" vira "BTN abre ·
// 40bb", com posição, contra quem e a ação.

import { lerTextoRange, type Pesos } from "./notacao";

export interface LinhaPreflop {
  spot_id: string;
  stack_bb: number;
  action_label: string;
  range_string: string;
  structure?: string | null;
}

export type Acao = "abrir" | "pagar" | "3bet" | "allin" | "completar" | "check" | "aumentar" | "outra";

export interface RangePronto {
  id: string; // "spot_id:action_label"
  titulo: string;
  posicao: string;
  vsPosicao: string | null;
  stack: number;
  acao: Acao;
  spotId: string;
  pesos: Pesos;
}

const VERBOS: { chave: string; texto: string; acao: Acao; vs: boolean }[] = [
  { chave: "RFI", texto: "abre", acao: "abrir", vs: false },
  { chave: "COMPLETE_OR_SHOVE", texto: "completa ou vai de all-in", acao: "completar", vs: false },
  { chave: "COMPLETE", texto: "completa", acao: "completar", vs: false },
  { chave: "CALL_VS_MINRAISE", texto: "paga min-raise", acao: "pagar", vs: true },
  { chave: "CALL_VS_SHOVE", texto: "paga all-in", acao: "pagar", vs: true },
  { chave: "FLAT_CALL", texto: "paga", acao: "pagar", vs: true },
  { chave: "CALL", texto: "paga", acao: "pagar", vs: true },
  { chave: "3BET_SHOVE", texto: "3-bet all-in", acao: "allin", vs: true },
  { chave: "3BET_NON_JAM", texto: "3-bet (sem all-in)", acao: "3bet", vs: true },
  { chave: "3BET", texto: "3-bet", acao: "3bet", vs: true },
  { chave: "CHECK_BEHIND", texto: "dá check", acao: "check", vs: true },
  { chave: "RAISE_VS_LIMP", texto: "aumenta o limp", acao: "aumentar", vs: true },
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
  check: "Check",
  aumentar: "Aumentar",
  outra: "Outra",
};
