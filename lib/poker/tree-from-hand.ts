import type { ParsedHand } from "@/lib/poker/hand-parser";
import type { TreeNode } from "@/lib/services/strategy-tree-service";

function newNodeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ACTION_LABEL: Record<string, string> = {
  folds: "Fold",
  checks: "Check",
  calls: "Call",
  bets: "Aposta",
  raises: "Raise",
  allin: "All-in",
};

// Descreve as acoes do hero numa rua em texto curto — "Aposta 450" em
// vez de so "bets", incluindo o valor quando existe. Varias acoes do
// hero na mesma rua (ex: aposta, depois all-in facing raise) ficam
// separadas por " → ".
function describeHeroActions(street: ParsedHand["streets"][number] | undefined, heroName: string | null): string | null {
  if (!street || !heroName) return null;
  const heroActions = street.actions.filter((a) => a.player === heroName && a.action !== "posts");
  if (heroActions.length === 0) return null;
  return heroActions
    .map((a) => {
      const base = ACTION_LABEL[a.action] ?? a.action;
      const amount = a.raiseTo ?? a.amount;
      return amount ? `${base} ${amount}` : base;
    })
    .join(" → ");
}

function findStreet(hand: ParsedHand, name: "preflop" | "flop" | "turn" | "river") {
  return hand.streets.find((s) => s.name === name);
}

// Gera uma linha (sem ramificacao — e' UMA mao real que aconteceu de um
// jeito so) a partir de uma mao parseada: Preflop -> Flop -> Turn ->
// River, cada nivel com o board (quando existe) e o resumo da acao do
// hero naquela rua na nota. O jogador edita/completa/ramifica a partir
// dai — isso so' poupa o trabalho de digitar o que ja esta no historico.
export function buildTreeChainFromHand(hand: ParsedHand): TreeNode {
  const preflop = findStreet(hand, "preflop");
  const flop = findStreet(hand, "flop");
  const turn = findStreet(hand, "turn");
  const river = findStreet(hand, "river");

  const heroPos = hand.heroPosition ?? "?";
  const preflopNode: TreeNode = {
    id: newNodeId(),
    label: `Preflop — ${heroPos}`,
    rangeId: null,
    note: describeHeroActions(preflop, hand.heroName) ?? undefined,
    children: [],
  };

  let tail = preflopNode;

  if (flop?.board && flop.board.length > 0) {
    const flopNode: TreeNode = {
      id: newNodeId(),
      label: `Flop ${flop.board.join("")}`,
      rangeId: null,
      note: describeHeroActions(flop, hand.heroName) ?? undefined,
      children: [],
    };
    tail.children = [flopNode];
    tail = flopNode;
  }

  if (turn?.board && turn.board.length > 0) {
    const turnCard = turn.board[turn.board.length - 1];
    const turnNode: TreeNode = {
      id: newNodeId(),
      label: `Turn ${turnCard}`,
      rangeId: null,
      note: describeHeroActions(turn, hand.heroName) ?? undefined,
      children: [],
    };
    tail.children = [turnNode];
    tail = turnNode;
  }

  if (river?.board && river.board.length > 0) {
    const riverCard = river.board[river.board.length - 1];
    const riverNode: TreeNode = {
      id: newNodeId(),
      label: `River ${riverCard}`,
      rangeId: null,
      note: describeHeroActions(river, hand.heroName) ?? undefined,
      children: [],
    };
    tail.children = [riverNode];
    tail = riverNode;
  }

  return preflopNode;
}
