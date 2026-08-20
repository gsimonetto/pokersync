// Formatadores compartilhados entre modulos (Time, Revisor, Banca) —
// evita recriar o mesmo Intl.NumberFormat em cada arquivo.

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const BRL_CURTO = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function formatBRL(valor: number): string {
  return BRL.format(valor);
}

// Variacao percentual entre periodo atual e anterior, usada nos KPIs de
// tendencia (Visao Geral do time e ficha individual do jogador).
export function variacao(atual?: number | null, anterior?: number | null): number | null {
  if (atual === undefined || atual === null || anterior === undefined || anterior === null) return null;
  if (anterior === 0) return atual > 0 ? 100 : null;
  return Math.round(((atual - anterior) / anterior) * 100);
}
