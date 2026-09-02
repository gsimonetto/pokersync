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

// "Nice numbers" (algoritmo clássico de Paul Heckbert) — gera as marcas do
// eixo Y em números redondos (ex: 100, 250, 500) em vez de dividir
// min/max em fatias iguais, que sempre dá valor quebrado (ex: R$417,24).
// Usado pelos gráficos de evolução (Banca, Time/Player Evolution).
function niceNum(range: number, round: boolean): number {
  if (range === 0) return 0;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

export function niceTicks(min: number, max: number, targetCount = 4): number[] {
  if (min === max) return [min];
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, targetCount), true) || 1;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}
