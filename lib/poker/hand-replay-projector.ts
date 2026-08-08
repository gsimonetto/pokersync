import type { ParsedHand, Street, ParsedAction } from "./hand-history-parser";
import { computeRealSeatLayout, type SeatLayoutSlot } from "./seat-layout";
import type { TableHand, SeatState, HistoryStep } from "@/components/drill/poker-table";

const STREET_LABELS: Record<Street, string> = {
  preflop: "PREFLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
};

export type ReplayState = {
  tableHand: TableHand;
  seatLayout: SeatLayoutSlot[];
  streetIndex: number;
  streetCount: number;
};

// Mão pode não ter ido até o river (ex: todo mundo foldou no flop) — só
// as ruas que de fato aconteceram entram no stepper.
function computeActiveStreets(hand: ParsedHand): Street[] {
  const streets: Street[] = ["preflop"];
  if (hand.boardByStreet.flop) streets.push("flop");
  if (hand.boardByStreet.turn) streets.push("turn");
  if (hand.boardByStreet.river) streets.push("river");
  return streets;
}

function actionLabel(a: ParsedAction): string {
  switch (a.type) {
    case "post_small_blind":
      return `posts SB ${a.amount}`;
    case "post_big_blind":
      return `posts BB ${a.amount}`;
    case "post_ante":
      return `ante ${a.amount}`;
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "bet":
      return `bet ${a.amount}`;
    case "call":
      return `call ${a.amount}`;
    case "raise":
      return `raise to ${a.raiseTo}`;
    case "shows":
      return "mostra";
    case "collected":
      return `ganha ${a.amount}`;
    default:
      return a.type;
  }
}

// Reconstroi o pote acumulado ate (e incluindo) as ruas informadas,
// rastreando quanto cada jogador ja colocou NAQUELA RUA — necessario
// porque "raises X to Y" no PokerStars usa Y como total da rua pro
// jogador, nao como incremento. Validado a mao contra o hand history
// real fornecido (bate exatamente com "Total pot 720" do SUMMARY).
function computePotAndFoldsUpToStreet(
  hand: ParsedHand,
  streets: Street[]
): { pot: number; foldedPlayers: Set<string> } {
  const foldedPlayers = new Set<string>();
  let pot = 0;

  for (const street of streets) {
    const committedThisStreet = new Map<string, number>();
    for (const action of hand.actions.filter((a) => a.street === street)) {
      switch (action.type) {
        case "fold":
          foldedPlayers.add(action.player);
          break;
        case "post_small_blind":
        case "post_big_blind":
        case "post_ante":
        case "bet":
        case "call": {
          const amt = action.amount ?? 0;
          committedThisStreet.set(action.player, (committedThisStreet.get(action.player) ?? 0) + amt);
          pot += amt;
          break;
        }
        case "raise": {
          const newTotal = action.raiseTo ?? 0;
          const already = committedThisStreet.get(action.player) ?? 0;
          const delta = newTotal - already;
          committedThisStreet.set(action.player, newTotal);
          pot += delta;
          break;
        }
        case "uncalled_return":
          pot -= action.amount ?? 0;
          break;
        default:
          break;
      }
    }
  }

  return { pot, foldedPlayers };
}

export class HandReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandReplayError";
  }
}

// Constroi o estado da mesa (board, pote, seats, historico) pra uma rua
// especifica do replay. Pura — cada chamada recalcula do zero a partir
// da mao parseada inteira, sem estado mutavel entre streets. Mesmo
// principio do veredito GTO: uma unica fonte de verdade, sem duas
// implementacoes que podem divergir.
export function projectHandAtStreet(hand: ParsedHand, streetIndex: number): ReplayState {
  const activeStreets = computeActiveStreets(hand);
  const clampedIndex = Math.max(0, Math.min(streetIndex, activeStreets.length - 1));
  const currentStreet = activeStreets[clampedIndex];
  const streetsUpToNow = activeStreets.slice(0, clampedIndex + 1);

  const seatLayout = computeRealSeatLayout(hand.seats, hand.buttonSeat, hand.maxSeats);

  const { pot, foldedPlayers } = computePotAndFoldsUpToStreet(hand, streetsUpToNow);

  // Checagem de sanidade: na ultima rua, o pote calculado deve bater com
  // o total do SUMMARY (fonte mais confiavel do proprio hand history).
  // Se nao bater, algo no parser ou nessa reconstrucao esta errado —
  // melhor sinalizar do que mostrar um numero silenciosamente incorreto.
  if (clampedIndex === activeStreets.length - 1 && hand.totalPot > 0) {
    const diff = Math.abs(pot - hand.totalPot);
    if (diff > 0.01) {
      throw new HandReplayError(
        `Pote calculado (${pot}) não bate com o total da mão (${hand.totalPot}). Não exibindo — pode haver side pot ou ação não reconhecida pelo parser.`
      );
    }
  }

  const board = currentStreet === "preflop" ? [] : hand.boardByStreet[currentStreet] ?? [];

  const seats: Record<string, SeatState> = {};
  for (const slot of seatLayout) {
    const seatData = hand.seats.find((s) => s.playerName === slot.playerName);
    if (!seatData || !slot.playerName) continue;

    const folded = foldedPlayers.has(slot.playerName);
    const showsAction = hand.actions.find((a) => a.type === "shows" && a.player === slot.playerName);

    seats[slot.posLabel] = {
      status: folded ? "folded" : "live",
      stack: seatData.startingChips,
      cards: slot.isHero ? hand.heroCards ?? undefined : showsAction?.cards,
    };
  }

  const history: HistoryStep[] = activeStreets.map((street) => ({
    street: STREET_LABELS[street],
    current: street === currentStreet,
    actions: hand.actions
      .filter((a) => a.street === street && a.type !== "uncalled_return")
      .map((a) => {
        const slot = seatLayout.find((s) => s.playerName === a.player);
        return { pos: slot?.posLabel ?? a.player, label: actionLabel(a) };
      }),
  }));

  const tableHand: TableHand = {
    pot,
    // SPR por rua exigiria simular o stack remanescente de cada jogador
    // rua a rua — nao implementado ainda. Melhor omitir do que calcular
    // errado; fica null ate essa simulacao existir.
    spr: null,
    board,
    history,
    seats,
  };

  return {
    tableHand,
    seatLayout,
    streetIndex: clampedIndex,
    streetCount: activeStreets.length,
  };
}
