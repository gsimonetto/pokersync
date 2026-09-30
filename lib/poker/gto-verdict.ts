// Veredito de cada mão do Treino, no modelo do GTO Wizard (pedido
// explícito): olha a FREQUÊNCIA com que o GTO joga a ação escolhida E
// quanto ela custa em bb (lib/poker/ev-em-bb.ts).
//
//   Melhor jogada   (OTIMA)      a jogada que o GTO mais faz (≥ 50%)
//   Jogada correta  (ACEITAVEL)  o GTO também faz, em parte das vezes (≥ 3,5%)
//   Imprecisão      (ERRO_LEVE)  fora do GTO, mas custa menos de 0,1 bb
//   Erro            (ERRO_GRAVE) fora do GTO, custa de 0,1 a 1 bb
//   Erro grave      (ERRO_GRAVE) fora do GTO, custa 1 bb ou mais
//
// Acerto = Melhor + Correta: jogar a parte menor de uma estratégia mista
// não é erro. Erro e Erro grave dividem o mesmo veredito no banco
// (BLUNDER, quebra o combo); a diferença é só o nome e a cor na tela.

export type Verdict = "OTIMA" | "ACEITAVEL" | "ERRO_LEVE" | "ERRO_GRAVE" | "UNKNOWN";

const FREQ_MELHOR = 0.5;
export const FREQ_CORRETA = 0.035;
export const BB_IMPRECISAO = 0.1;
export const BB_ERRO_GRAVE = 1;

/**
 * @param freq  quantas vezes o GTO joga a ação escolhida (0 a 1)
 * @param perdaBb  diferença em bb entre as jogadas do GTO no spot (null =
 *   spot sem régua de bb; aí todo lance fora do GTO conta como erro)
 */
export function classificarJogada(freq: number, perdaBb: number | null): Verdict {
  if (freq >= FREQ_MELHOR) return "OTIMA";
  if (freq >= FREQ_CORRETA) return "ACEITAVEL";
  if (perdaBb != null && perdaBb < BB_IMPRECISAO) return "ERRO_LEVE";
  return "ERRO_GRAVE";
}

/** Acertou = jogou algo que o GTO usa. */
export function ehAcerto(v: Verdict | null | undefined): boolean {
  return v === "OTIMA" || v === "ACEITAVEL";
}

/** Nome na tela. "Erro" vira "Erro grave" quando custou 1 bb ou mais. */
export function nomeDoVeredito(v: Verdict, perdaBb: number | null): string {
  if (v === "OTIMA") return "Melhor jogada";
  if (v === "ACEITAVEL") return "Jogada correta";
  if (v === "ERRO_LEVE") return "Imprecisão";
  if (v === "ERRO_GRAVE") return perdaBb != null && perdaBb < BB_ERRO_GRAVE ? "Erro" : "Erro grave";
  return "Sem dados do solver";
}

/** Cor por veredito: dois verdes pros acertos, âmbar, laranja e vermelho pros erros. */
export function verdictColor(v: Verdict, perdaBb: number | null = null): string {
  if (v === "OTIMA") return "#22C55E";
  if (v === "ACEITAVEL") return "#4ADE80";
  if (v === "ERRO_LEVE") return "#EAB308";
  if (v === "ERRO_GRAVE") return perdaBb != null && perdaBb < BB_ERRO_GRAVE ? "#F97316" : "#EF4444";
  return "#8A94A3";
}
