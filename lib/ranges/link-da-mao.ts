// Link do Revisor pro Construtor de Ranges: abre o range do spot da mão
// (posição, stack em BB e o que o herói fez no pré-flop) já com o board
// dela. O Construtor escolhe o range salvo da pessoa pra esse spot ou, se
// não tiver, o pronto do PokerSync (GTO) mais parecido.

import type { ParsedHand } from "@/lib/poker/hand-parser";

export function linkConstrutorDaMao(m: ParsedHand): string | null {
  const pos = m.heroPosition?.toUpperCase();
  if (!pos) return null;
  const q = new URLSearchParams({ pos });
  const heroi = m.seats.find((s) => s.isHero);
  if (heroi && m.bigBlind) q.set("stack", String(Math.max(1, Math.round(heroi.startingChips / m.bigBlind))));

  // Primeira ação do herói no pré-flop: abrir (ninguém aumentou antes),
  // pagar ou 3-bet (contra um aumento), e de quem veio o aumento.
  const acoes = m.streets.find((s) => s.name === "preflop")?.actions ?? [];
  let aumentos = 0;
  let quemAumentou: string | null = null;
  for (const a of acoes) {
    if (a.action === "posts" || a.action === "uncalled_return") continue;
    if (a.player === m.heroName) {
      if (a.action === "raises" || a.action === "bets") q.set("acao", aumentos === 0 ? "abrir" : "3bet");
      else if (a.action === "calls" && aumentos > 0) q.set("acao", "pagar");
      break;
    }
    if (a.action === "raises" || a.action === "bets") {
      aumentos++;
      quemAumentou = a.player;
    }
  }
  const vs = quemAumentou ? m.seats.find((s) => s.playerName === quemAumentou)?.position : null;
  if (vs && q.get("acao") !== "abrir") q.set("vs", vs.toUpperCase());

  const board = (m.board ?? []).filter(Boolean);
  if (board.length >= 3) q.set("board", board.slice(0, 5).join(""));
  return `/ranges?${q.toString()}`;
}
