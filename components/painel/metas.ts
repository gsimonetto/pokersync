import type { Goal } from "@/lib/bankroll/types";
import { horas, num } from "./formato";

// Regras de meta compartilhadas pelo card de metas e pelo AI Coach -- as
// duas telas precisam dizer a MESMA coisa sobre a mesma meta.

/**
 * Quanto da semana já passou (0 a 1), contando a partir do DOMINGO, que é
 * onde goalProgress (lib/bankroll/calc.ts) começa a somar a meta semanal.
 * A regra anterior contava a partir da segunda: no domingo ela dizia que
 * 100% da semana tinha passado quando o progresso tinha acabado de zerar,
 * e o Coach avisava "meta atrás do ritmo" pra todo mundo.
 */
export function fracaoDaSemana(ref = new Date()): number {
  return (ref.getDay() + 1) / 7;
}

export type SituacaoMeta = "concluida" | "atrasada" | "em-dia" | "a-comecar";

/** Folga de 20 pontos antes de chamar de atrasada (mesma regra do Coach). */
export function situacaoMeta(pctFeito: number, ref = new Date()): SituacaoMeta {
  if (pctFeito >= 100) return "concluida";
  if (pctFeito / 100 < fracaoDaSemana(ref) - 0.2) return "atrasada";
  return pctFeito > 0 ? "em-dia" : "a-comecar";
}

export const SITUACAO_VISUAL: Record<SituacaoMeta, { texto: string; cor: string }> = {
  concluida: { texto: "Concluída", cor: "#22c55e" },
  atrasada: { texto: "Atrasada", cor: "#f59e0b" },
  "em-dia": { texto: "Em dia", cor: "#22c55e" },
  "a-comecar": { texto: "A começar", cor: "#c4c7c8" },
};

/**
 * "2 de 20 sessões" / "24 min de 5 h". Estudo sempre em horas, porque é a
 * unidade que goalProgress devolve (independente do texto salvo em
 * goal.unit), com uma casa decimal ou em minutos abaixo de 1 h.
 */
export function textoProgresso(goal: Goal, atual: number): string {
  if (goal.type === "estudo") return `${horas(atual)} de ${horas(goal.target)}`;
  return `${num(atual)} de ${num(goal.target)} ${goal.target === 1 ? "sessão" : "sessões"}`;
}
