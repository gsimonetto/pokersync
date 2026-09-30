// EV do Treino em bb.
//
// O motor (pokersync-solver, ev_mode "icm") grava o valor de cada jogada
// em EQUITY DE PREMIAÇÃO do torneio -- uma escala própria de cada spot
// (ex.: foldar o SB com 15 bb vale 88,04; com 40 bb vale 169,70). Esse
// número sozinho não diz nada pro jogador, e uma perda de "2,6" com
// 15 bb não é a mesma coisa que "2,6" com 100 bb.
//
// Pra falar em bb: o próprio spot mostra quanto vale 1 bb de stack ali.
// Quando o herói folda, fica com o stack menos o blind dele; quando o BB
// folda, fica com o stack menos 1 bb. A diferença entre esses dois
// valores, dividida pela diferença de fichas, é o valor de 1 bb perto do
// stack da mão:
//
//   SB vs BB, 15 bb:  (88,044 − 85,226) ÷ 0,5 bb = 5,64 por bb
//   BTN vs BB, 15 bb: (90,848 − 84,971) ÷ 1 bb   = 5,88 por bb
//
// É o "bb equivalente": perder 0,5 bb aqui custa o mesmo, na premiação,
// que perder meio big blind do seu stack. Aproximação -- o valor de cada
// ficha muda um pouco conforme o stack cresce ou encolhe -- mas é a mesma
// régua pra todas as mãos, o que permite somar tudo em bb/100.
//
// A mesma conta existe no banco (public.icm_por_bb, que preenche
// training_sessions.ev_loss_bb): mudou aqui, muda lá.

export interface FaseComEv {
  ev_fold: number;
}

export interface SpotComEv {
  /** "sb_vs_bb", "btn_vs_bb"... -- o primeiro é quem abre o pote. */
  matchup: string;
  sbOpen: FaseComEv;
  bbJam: FaseComEv;
}

/** Quanto vale 1 bb, na escala do motor, perto do stack do spot. null = não dá pra calcular. */
export function valorDoBb(spot: SpotComEv): number | null {
  const blindDoHeroi = spot.matchup.startsWith("sb_") ? 0.5 : 0;
  const fichas = 1 - blindDoHeroi;
  const valor = (spot.sbOpen.ev_fold - spot.bbJam.ev_fold) / fichas;
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** Converte um valor na escala do motor pra bb. */
export function emBb(valorMotor: number, valorBb: number | null): number | null {
  if (valorBb == null) return null;
  return valorMotor / valorBb;
}

/** Perda média a cada 100 mãos. */
export function bbPor100(perdaBb: number, maos: number): number | null {
  return maos > 0 ? (perdaBb / maos) * 100 : null;
}

/** "0,42 bb" · "2,3 bb" · "12 bb" -- casas conforme o tamanho. */
export function fmtBbEv(v: number): string {
  const a = Math.abs(v);
  const casas = a === 0 ? 0 : a < 1 ? 2 : a < 10 ? 1 : 0;
  return `${a.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} bb`;
}
