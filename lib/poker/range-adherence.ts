import type { ParsedHand } from "@/lib/poker/hand-parser";
import { getDecision, type RangeHands } from "@/components/ranges/range-grid";
import { parseCard, getHandLabelFromCards } from "@/lib/poker/range-board-analyzer";
import { classifyFrequency, type Verdict } from "@/lib/poker/gto-verdict";

export type HeroPreflopAction = "fold" | "call" | "raise";

export interface AdherenceRow {
  handId: string | null;
  position: string;
  label: string;
  heroAction: HeroPreflopAction;
  decision: { fold: number; call: number; raise: number };
  verdict: Verdict;
  flagged: boolean;
}

export interface AdherenceResult {
  totalHands: number;
  comparable: number;
  skipped: number;
  flagged: number;
  rows: AdherenceRow[];
}

// So compara spots de RFI (hero e' o primeiro a ter oportunidade de
// levantar aposta no preflop — sem raise nenhum antes do turno dele).
// Facing 3-bet, blind defense, squeeze etc. usam um range diferente
// (a "range de defesa", nao a de abertura) e ficam de fora por
// enquanto — comparar contra o range errado seria pior que nao comparar.
function extractHeroRfiAction(hand: ParsedHand): HeroPreflopAction | null {
  const heroName = hand.heroName;
  if (!heroName) return null;
  const preflop = hand.streets.find((s) => s.name === "preflop");
  if (!preflop) return null;

  const heroFirstIdx = preflop.actions.findIndex((a) => a.player === heroName && a.action !== "posts");
  if (heroFirstIdx === -1) return null; // hero nunca teve decisao de verdade (ex: walk sem sobra de acao)

  const raisesBeforeHero = preflop.actions.slice(0, heroFirstIdx).filter((a) => a.action === "raises").length;
  if (raisesBeforeHero > 0) return null; // nao e' RFI, fora de escopo

  const heroAction = preflop.actions[heroFirstIdx].action;
  if (heroAction === "folds") return "fold";
  if (heroAction === "raises") return "raise";
  if (heroAction === "calls" || heroAction === "checks") return "call"; // limp ou opcao de BB sem raise = "ver o flop", equivalente a call pro range
  return null; // acao nao mapeavel (ex: bets preflop, formato incomum) — melhor nao comparar do que comparar errado
}

export function analyzeSessionAdherence(hands: ParsedHand[], rangeHands: RangeHands, heroPosition: string): AdherenceResult {
  const rows: AdherenceRow[] = [];
  let skipped = 0;

  for (const hand of hands) {
    if (!hand.heroCards || hand.heroCards.length !== 2 || hand.heroPosition !== heroPosition) {
      skipped += 1;
      continue;
    }
    const heroAction = extractHeroRfiAction(hand);
    if (!heroAction) {
      skipped += 1;
      continue;
    }
    const c1 = parseCard(hand.heroCards[0]);
    const c2 = parseCard(hand.heroCards[1]);
    if (!c1 || !c2) {
      skipped += 1;
      continue;
    }
    const label = getHandLabelFromCards(c1, c2);
    const decision = getDecision(rangeHands, label);
    const verdict = classifyFrequency(decision[heroAction] / 100);
    const flagged = verdict === "ERRO_LEVE" || verdict === "ERRO_GRAVE";

    rows.push({ handId: hand.handId, position: hand.heroPosition ?? "", label, heroAction, decision, verdict, flagged });
  }

  return {
    totalHands: hands.length,
    comparable: rows.length,
    skipped,
    flagged: rows.filter((r) => r.flagged).length,
    rows,
  };
}
