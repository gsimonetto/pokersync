// Link do Revisor pro Construtor de Ranges: abre o range do spot da mão
// (posição, stack em BB, o que o herói fez no pré-flop e contra o quê) já
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
}

export function spotDaMao(m: ParsedHand): SpotDaMao {
  const acoes = m.streets.find((s) => s.name === "preflop")?.actions ?? [];
  let aumentos = 0;
  let pagos = 0;
  let ultimoAllin = false;
  let quemAumentou: string | null = null;
  let acao: string | null = null;
  let tipoHeroi: string | null = null;
  for (const a of acoes) {
    if (a.action === "posts" || a.action === "uncalled_return") continue;
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
  return { acao, contra, vs };
}

export function linkConstrutorDaMao(m: ParsedHand): string | null {
  const pos = m.heroPosition?.toUpperCase();
  if (!pos) return null;
  const q = new URLSearchParams({ pos });
  const heroi = m.seats.find((s) => s.isHero);
  if (heroi && m.bigBlind) q.set("stack", String(Math.max(1, Math.round(heroi.startingChips / m.bigBlind))));

  const spot = spotDaMao(m);
  if (spot.acao) q.set("acao", spot.acao);
  q.set("contra", spot.contra);
  if (spot.vs) q.set("vs", spot.vs);

  const board = (m.board ?? []).filter(Boolean);
  if (board.length >= 3) q.set("board", board.slice(0, 5).join(""));
  return `/ranges?${q.toString()}`;
}
