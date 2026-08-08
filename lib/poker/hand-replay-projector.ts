import type { ParsedHand, ParsedStreet, ParsedAction } from "./hand-parser";
import { computeRealSeatLayout, type SeatLayoutSlot } from "./seat-layout";
import type { TableHand, SeatState, HistoryStep } from "@/components/drill/poker-table";

type StreetName = ParsedStreet["name"];

const STREET_LABELS: Record<StreetName, string> = {
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

export class HandReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandReplayError";
  }
}

// hand.streets ja vem so com as ruas que de fato aconteceram (parseHand
// so empurra "flop"/"turn"/"river" se o marcador respectivo existir no
// texto) — nao precisa recalcular isso aqui, so usar a ordem que ja veio.
function activeStreetNames(hand: ParsedHand): StreetName[] {
  return hand.streets.map((s) => s.name);
}

function actionLabel(a: ParsedAction): string {
  switch (a.action) {
    case "posts":
      return `posts ${a.amount}`;
    case "folds":
      return "fold";
    case "checks":
      return "check";
    case "bets":
      return `bet ${a.amount}`;
    case "calls":
      return `call ${a.amount}`;
    case "raises":
      return `raise to ${a.raiseTo}`;
    default:
      return a.action;
  }
}

// Reconstroi o pote acumulado ate (e incluindo) as ruas informadas,
// rastreando quanto cada jogador ja colocou NAQUELA RUA — necessario
// porque "raises X to Y" usa Y como total da rua pro jogador, nao como
// incremento. Validado a mao contra o hand history real fornecido
// (bate exatamente com o "Total pot" do SUMMARY).
function computePotAndFolds(
  hand: ParsedHand,
  streetNames: StreetName[]
): { pot: number; foldedPlayers: Set<string> } {
  const foldedPlayers = new Set<string>();
  let pot = 0;

  for (const streetName of streetNames) {
    const street = hand.streets.find((s) => s.name === streetName);
    if (!street) continue;

    const committedThisStreet = new Map<string, number>();
    for (const action of street.actions) {
      switch (action.action) {
        case "folds":
          foldedPlayers.add(action.player);
          break;
        case "posts":
        case "bets":
        case "calls": {
          const amt = action.amount ?? 0;
          committedThisStreet.set(action.player, (committedThisStreet.get(action.player) ?? 0) + amt);
          pot += amt;
          break;
        }
        case "raises": {
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

// Constroi o estado da mesa (board, pote, seats, historico) pra uma rua
// especifica do replay. Pura — cada chamada recalcula do zero a partir
// da mao parseada inteira, sem estado mutavel entre streets. Mesmo
// principio do veredito GTO: uma unica fonte de verdade.
export function projectHandAtStreet(hand: ParsedHand, streetIndex: number): ReplayState {
  const streetNames = activeStreetNames(hand);
  if (streetNames.length === 0) {
    throw new HandReplayError("Essa mão não tem nenhuma rua reconhecida — não é possível montar o replay.");
  }
  const clampedIndex = Math.max(0, Math.min(streetIndex, streetNames.length - 1));
  const currentStreet = streetNames[clampedIndex];
  const streetsUpToNow = streetNames.slice(0, clampedIndex + 1);

  const seatLayout = computeRealSeatLayout(hand.seats, hand.buttonSeat ?? 0, hand.maxSeats ?? hand.seats.length);

  const { pot, foldedPlayers } = computePotAndFolds(hand, streetsUpToNow);

  // Checagem de sanidade: na ultima rua, o pote calculado deve bater com
  // o total do proprio hand history (extractPot, fonte independente).
  // Se nao bater, algo no parser ou nessa reconstrucao esta errado —
  // melhor sinalizar do que mostrar um numero silenciosamente incorreto.
  if (clampedIndex === streetNames.length - 1 && hand.pot != null && hand.pot > 0) {
    const diff = Math.abs(pot - hand.pot);
    if (diff > 0.01) {
      throw new HandReplayError(
        `Pote calculado (${pot}) não bate com o total da mão (${hand.pot}). Não exibindo — pode haver side pot ou ação não reconhecida pelo parser.`
      );
    }
  }

  const currentStreetData = hand.streets.find((s) => s.name === currentStreet);
  const board = currentStreet === "preflop" ? [] : currentStreetData?.board ?? [];

  const seats: Record<string, SeatState> = {};
  for (const slot of seatLayout) {
    if (!slot.playerName) continue;
    const seatData = hand.seats.find((s) => s.playerName === slot.playerName);
    if (!seatData) continue;

    const folded = foldedPlayers.has(slot.playerName);
    const showsEntry = hand.showdown.find((s) => s.player === slot.playerName);

    seats[slot.posLabel] = {
      status: folded ? "folded" : "live",
      stack: seatData.startingChips,
      cards: slot.isHero ? hand.heroCards ?? undefined : showsEntry?.cards,
    };
  }

  const lastStreet = streetNames[streetNames.length - 1];

  const history: HistoryStep[] = streetNames.map((streetName) => {
    const street = hand.streets.find((s) => s.name === streetName)!;
    const displayActions = street.actions
      .filter((a) => a.action !== "uncalled_return")
      .map((a) => {
        const slot = seatLayout.find((s) => s.playerName === a.player);
        return { pos: slot?.posLabel ?? a.player, label: actionLabel(a) };
      });

    // Showdown e resultado final so fazem sentido anexados na ultima rua
    // que de fato aconteceu — "shows"/"collected" nunca ficam dentro de
    // nenhuma street no parser (vem depois do SHOW DOWN).
    const extra =
      streetName === lastStreet
        ? [
            ...hand.showdown.map((s) => {
              const slot = seatLayout.find((sl) => sl.playerName === s.player);
              return { pos: slot?.posLabel ?? s.player, label: `mostra (${s.handDescription})` };
            }),
            ...(hand.winner
              ? [
                  {
                    pos: seatLayout.find((sl) => sl.playerName === hand.winner)?.posLabel ?? hand.winner,
                    label: hand.pot != null ? `ganha ${hand.pot}` : "ganha",
                  },
                ]
              : []),
          ]
        : [];

    return {
      street: STREET_LABELS[streetName],
      current: streetName === currentStreet,
      actions: [...displayActions, ...extra],
    };
  });

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
    streetCount: streetNames.length,
  };
}
