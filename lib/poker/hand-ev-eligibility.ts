import type { ParsedHand } from "./hand-parser";

// Detecta se uma mão é elegível pro cálculo de cEV/ICM via
// pokersync-solver — hoje cobre all-in no preflop com 2 OU MAIS jogadores
// (heads-up via POST /hands/compute_cev, 3+ via POST
// /hands/compute_cev_multiway, ver pokersync-solver/engine/hand_cev.py e
// hand_cev_multiway.py), desde que TODAS as mãos envolvidas tenham sido
// mostradas no showdown. Mão sem all-in preflop, ou onde algum
// participante não mostrou, não é elegível — não tenta estimar com range
// assumido (mesmo princípio do resto do produto: sem dado real, sem
// número).
export interface HandEvConfrontation {
  // Cartas de CADA jogador envolvido no all-in, na MESMA ordem de
  // stacksBefore -- heroIdx aponta pra posição do herói dentro desses
  // arrays. Com 2 elementos, o confronto é heads-up (endpoint singular);
  // com 3+, é multiway.
  combos: string[];
  stacksBefore: number[];
  heroIdx: number;
  otherStacks: number[];
}

export function findEligibleAllInConfrontation(hand: ParsedHand): HandEvConfrontation | null {
  if (!hand.heroName || !hand.heroCards || hand.heroCards.length !== 2) return null;

  const preflop = hand.streets.find((s) => s.name === "preflop");
  if (!preflop) return null;

  const heroWentAllIn = preflop.actions.some((a) => a.player === hand.heroName && a.isAllIn);
  if (!heroWentAllIn) return null;
  if (hand.showdown.length < 2) return null;

  // Só entram no confronto jogadores do showdown que TAMBÉM foram all-in
  // no próprio preflop e mostraram as 2 cartas -- alguém que chegou ao
  // showdown sem ter ido all-in (ex: pagou o resto da mão depois, ou é
  // de um pote lateral não relacionado) não faz parte desse all-in
  // específico, e entrar ele na conta inventaria um confronto que não
  // aconteceu de verdade.
  const participants = hand.showdown.filter(
    (s) => s.cards.length === 2 && preflop.actions.some((a) => a.player === s.player && a.isAllIn)
  );
  if (participants.length < 2) return null;
  if (!participants.some((p) => p.player === hand.heroName)) return null;

  const seats = participants.map((p) => hand.seats.find((s) => s.playerName === p.player));
  if (seats.some((s) => !s)) return null;

  const heroIdx = participants.findIndex((p) => p.player === hand.heroName);
  const participantNames = new Set(participants.map((p) => p.player));
  const otherStacks = hand.seats
    .filter((s) => !participantNames.has(s.playerName))
    .map((s) => s.startingChips);

  return {
    combos: participants.map((p) => p.cards.join("")),
    stacksBefore: seats.map((s) => s!.startingChips),
    heroIdx,
    otherStacks,
  };
}
