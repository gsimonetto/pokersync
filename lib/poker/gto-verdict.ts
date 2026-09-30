// Veredito por frequencia: o gto_nodes gravado pelo TexasSolver nao tem EV
// (dump_result nao exporta por-acao), entao a frequencia com que o GTO
// joga a acao escolhida e' a base de todo o sistema de veredito.

export type Verdict = "OTIMA" | "ACEITAVEL" | "ERRO_LEVE" | "ERRO_GRAVE" | "UNKNOWN";

const FREQ_OTIMA = 0.4;
const FREQ_ACEITAVEL = 0.15;
const FREQ_ERRO_LEVE = 0.05;

export function classifyFrequency(freq: number): Verdict {
  if (freq >= FREQ_OTIMA) return "OTIMA";
  if (freq >= FREQ_ACEITAVEL) return "ACEITAVEL";
  if (freq >= FREQ_ERRO_LEVE) return "ERRO_LEVE";
  return "ERRO_GRAVE";
}

/** Cor por veredito — substitui o evColor() que dependia de EV inexistente. */
export function verdictColor(v: Verdict): string {
  if (v === "OTIMA") return "#22C55E";
  if (v === "ACEITAVEL") return "#EAB308";
  if (v === "ERRO_LEVE") return "#EAB308";
  if (v === "ERRO_GRAVE") return "#EF4444";
  return "#8A94A3";
}
