import type { EscopoRanking, JogadorRanking } from "@/lib/services/ranking-service";
import type { Season } from "@/lib/services/xp-service";

// Regras puras do ranking do Hub (sem React, sem banco): movimento na
// semana, a "corrida" do usuário (quem está logo à frente / logo atrás)
// e o relógio da temporada. Ficam aqui pra tela só desenhar.

export type Movimento =
  | { tipo: "subiu" | "caiu"; casas: number }
  | { tipo: "igual" }
  | { tipo: "novo" }
  | null;

/** Comparação da posição de hoje com a de 7 dias atrás. */
export function movimento(j: JogadorRanking): Movimento {
  if (j.posicao == null) return null;
  if (j.posicao7d == null) return j.xp7d == null ? null : { tipo: "novo" };
  const d = j.posicao7d - j.posicao;
  if (d > 0) return { tipo: "subiu", casas: d };
  if (d < 0) return { tipo: "caiu", casas: -d };
  return { tipo: "igual" };
}

export interface Corrida {
  eu: JogadorRanking | null;
  /** Quem está imediatamente à frente (null se você lidera). */
  alvo: JogadorRanking | null;
  /** XP que falta pra passar o alvo (empate não passa: +1). */
  faltam: number;
  /** Quem vem logo atrás (null se você é o último). */
  perseguidor: JogadorRanking | null;
  /** Sua vantagem sobre o perseguidor. */
  vantagem: number;
  /** 0-100: quão perto você está do alvo (100 = colado). */
  proximidadePct: number;
}

export function corrida(jogadores: JogadorRanking[]): Corrida {
  const eu = jogadores.find((j) => j.souEu) ?? null;
  const vazio: Corrida = { eu, alvo: null, faltam: 0, perseguidor: null, vantagem: 0, proximidadePct: 0 };
  if (!eu || eu.posicao == null) return vazio;
  const alvo = jogadores.find((j) => j.posicao === eu.posicao! - 1) ?? null;
  const perseguidor = jogadores.find((j) => j.posicao === eu.posicao! + 1) ?? null;
  const faltam = alvo ? Math.max(1, alvo.xp - eu.xp + 1) : 0;
  const vantagem = perseguidor ? Math.max(0, eu.xp - perseguidor.xp) : 0;
  const proximidadePct = alvo && alvo.xp > 0 ? Math.max(4, Math.min(100, (eu.xp / alvo.xp) * 100)) : 0;
  return { eu, alvo, faltam, perseguidor, vantagem, proximidadePct };
}

export interface RelogioTemporada {
  dia: number;
  totalDias: number;
  pct: number;
  restantes: number;
}

export function relogioTemporada(s: Season, hoje = new Date()): RelogioTemporada {
  const ini = new Date(s.startsAt + "T00:00:00");
  const fim = new Date(s.endsAt + "T00:00:00");
  const DIA = 86_400_000;
  const totalDias = Math.max(1, Math.round((fim.getTime() - ini.getTime()) / DIA) + 1);
  const dia = Math.min(totalDias, Math.max(1, Math.floor((hoje.getTime() - ini.getTime()) / DIA) + 1));
  return { dia, totalDias, pct: (dia / totalDias) * 100, restantes: s.daysRemaining };
}

/**
 * XP por dia que você precisa, daqui até o fim, pra alcançar o alvo --
 * transforma "faltam 540 XP" numa meta diária palpável.
 */
export function ritmoNecessario(faltam: number, diasRestantes: number) {
  return Math.ceil(faltam / Math.max(1, diasRestantes));
}

// --- Última visita --------------------------------------------------------
// Guarda a posição que o usuário viu da última vez (por temporada e
// recorte) pra tela comemorar "você subiu 2 posições desde a última
// visita". Só conveniência local: sem storage, simplesmente não comemora.

const CHAVE = "pokersync:hub-ranking-visto";

export function posicaoVistaAntes(temporadaId: string, escopo: EscopoRanking): number | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const v = JSON.parse(bruto)?.[`${temporadaId}:${escopo}`];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export function lembrarPosicao(temporadaId: string, escopo: EscopoRanking, posicao: number) {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const atual = bruto ? JSON.parse(bruto) : {};
    atual[`${temporadaId}:${escopo}`] = posicao;
    window.localStorage.setItem(CHAVE, JSON.stringify(atual));
  } catch {
    // sem storage: segue sem lembrar
  }
}

export const MEDALHA = { 1: "#F5D48C", 2: "#C9D1D9", 3: "#D08A4E" } as Record<number, string>;

export const fmtXP = (n: number) => Math.round(n).toLocaleString("pt-BR");
