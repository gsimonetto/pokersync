import type { ParsedHand } from "./hand-parser";

// Detecta se uma mão é elegível pro cálculo de cEV/ICM via
// pokersync-solver (POST /hands/compute_cev) — escopo da primeira versão
// do endpoint: all-in HEADS-UP no preflop, com as duas mãos mostradas no
// showdown. Mão com 3+ jogadores no showdown, sem all-in preflop, ou onde
// o vilão não mostrou, não é elegível — não tenta estimar com range
// assumido (mesmo princípio do resto do produto: sem dado real, sem
// número).
export interface HandEvInput {
  heroCombo: string; // ex "AhKd"
  villainCombo: string;
  heroStackBefore: number;
  villainStackBefore: number;
  otherStacks: number[];
}

export function findEligibleAllInConfrontation(hand: ParsedHand): HandEvInput | null {
  if (!hand.heroName || !hand.heroCards || hand.heroCards.length !== 2) return null;

  const preflop = hand.streets.find((s) => s.name === "preflop");
  if (!preflop) return null;

  const heroWentAllIn = preflop.actions.some((a) => a.player === hand.heroName && a.isAllIn);
  if (!heroWentAllIn) return null;

  // Showdown com exatamente 2 jogadores (hero + 1 vilão) — mais que isso
  // e' confronto multiway, que o endpoint ainda não cobre (ver escopo
  // documentado em pokersync-solver/engine/hand_cev.py).
  if (hand.showdown.length !== 2) return null;
  const heroShow = hand.showdown.find((s) => s.player === hand.heroName);
  const villainShow = hand.showdown.find((s) => s.player !== hand.heroName);
  if (!heroShow || !villainShow || villainShow.cards.length !== 2) return null;

  const villainWentAllIn = preflop.actions.some((a) => a.player === villainShow.player && a.isAllIn);
  if (!villainWentAllIn) return null;

  const heroSeat = hand.seats.find((s) => s.playerName === hand.heroName);
  const villainSeat = hand.seats.find((s) => s.playerName === villainShow.player);
  if (!heroSeat || !villainSeat) return null;

  const otherStacks = hand.seats
    .filter((s) => s.playerName !== hand.heroName && s.playerName !== villainShow.player)
    .map((s) => s.startingChips);

  return {
    heroCombo: hand.heroCards.join(""),
    villainCombo: villainShow.cards.join(""),
    heroStackBefore: heroSeat.startingChips,
    villainStackBefore: villainSeat.startingChips,
    otherStacks,
  };
}
