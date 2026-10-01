// Link do Revisor pro Construtor de Ranges: abre o range do spot da mão
// (posição, stack efetivo em BB, o que o herói fez no pré-flop e contra o quê) já
// com o board dela. O Construtor escolhe o range salvo da pessoa pra esse
// spot, o pronto do PokerSync (GTO) da MESMA situação ou o range de verdade
// dela -- nunca um range de outra situação (pedido explícito: um aumento
// normal pago no BB abria "BB paga all-in vs SB").

import type { ParsedHand } from "@/lib/poker/hand-parser";

/** O que o herói enfrentou antes de agir no pré-flop:
 *  nada     ninguém entrou no pote (ele abre, completa ou foge)
 *  limp     alguém só pagou o blind
 *  aumento  um aumento normal, sem mais ninguém no pote
 *  allin    um all-in, sem mais ninguém no pote
 *  varios   mais de um aumento, ou aumento e mais gente pagando
 *           (nenhum range pronto cobre esses potes) */
export type ContraOQue = "nada" | "limp" | "aumento" | "allin" | "varios";

export interface SpotDaMao {
  acao: string | null;
  contra: ContraOQue;
  vs: string | null;
  /** Stack efetivo em BB: o menor entre o herói e quem aumentou (sem
   *  aumento, o maior stack de quem ainda não tinha foldado). É o stack
   *  dos ranges prontos ("50bb" = os dois com 50bb). */
  stack: number | null;
}

/** Dois stacks (em BB) "parecidos" pra usar o mesmo range: o maior até 10%
 *  acima do menor (50bb aceita de 46 a 55bb; 20bb, de 19 a 22bb). Pedido
 *  explícito: "mais apertado pra 10%" -- entre ranges prontos mais longe
 *  que isso (45bb fica entre 40 e 50), nenhum pronto vale. */
export const FOLGA_STACK = 1.1;
export function stackParecido(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.max(a, b) / Math.min(a, b) <= FOLGA_STACK;
}

export function spotDaMao(m: ParsedHand): SpotDaMao {
  const acoes = m.streets.find((s) => s.name === "preflop")?.actions ?? [];
  let aumentos = 0;
  let pagos = 0;
  let ultimoAllin = false;
  let quemAumentou: string | null = null;
  let acao: string | null = null;
  let tipoHeroi: string | null = null;
  const foldaram = new Set<string>();
  for (const a of acoes) {
    if (a.action === "posts" || a.action === "uncalled_return") continue;
    if (a.action === "folds") foldaram.add(a.player);
    if (a.player === m.heroName) {
      tipoHeroi = a.action;
      if (a.action === "raises" || a.action === "bets") acao = a.isAllIn ? "allin" : aumentos === 0 && pagos === 0 ? "abrir" : aumentos === 0 ? "aumentar" : "3bet";
      else if (a.action === "calls") acao = aumentos > 0 ? "pagar" : "completar";
      break;
    }
    if (a.action === "raises" || a.action === "bets") {
      aumentos++;
      pagos = 0;
      ultimoAllin = !!a.isAllIn;
      quemAumentou = a.player;
    } else if (a.action === "calls") {
      pagos++;
    }
  }
  const contra: ContraOQue =
    aumentos === 0 ? (pagos > 0 ? "limp" : "nada") : aumentos > 1 || pagos > 0 ? "varios" : ultimoAllin ? "allin" : "aumento";
  // Foldou: o range que importa é o da decisão -- abrir (ninguém entrou)
  // ou pagar (contra um aumento ou all-in).
  if (tipoHeroi === "folds" && !acao) acao = contra === "nada" ? "abrir" : contra === "aumento" || contra === "allin" ? "pagar" : null;
  const vs = contra === "aumento" || contra === "allin" ? (m.seats.find((s) => s.playerName === quemAumentou)?.position?.toUpperCase() ?? null) : null;

  const heroi = m.seats.find((s) => s.isHero);
  let stack: number | null = null;
  if (heroi && m.bigBlind) {
    const rival = quemAumentou
      ? (m.seats.find((s) => s.playerName === quemAumentou)?.startingChips ?? 0)
      : Math.max(0, ...m.seats.filter((s) => !s.isHero && !foldaram.has(s.playerName)).map((s) => s.startingChips));
    const efetivo = rival > 0 ? Math.min(heroi.startingChips, rival) : heroi.startingChips;
    stack = Math.max(1, Math.round(efetivo / m.bigBlind));
  }
  return { acao, contra, vs, stack };
}

export function linkConstrutorDaMao(m: ParsedHand): string | null {
  const pos = m.heroPosition?.toUpperCase();
  if (!pos) return null;
  const q = new URLSearchParams({ pos });
  const spot = spotDaMao(m);
  if (spot.stack) q.set("stack", String(spot.stack));
  if (spot.acao) q.set("acao", spot.acao);
  q.set("contra", spot.contra);
  if (spot.vs) q.set("vs", spot.vs);

  const board = (m.board ?? []).filter(Boolean);
  if (board.length >= 3) q.set("board", board.slice(0, 5).join(""));
  return `/ranges?${q.toString()}`;
}
