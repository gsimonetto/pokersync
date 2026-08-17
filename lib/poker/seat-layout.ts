// Layout de seats compartilhado entre Modo Treino e Replay. A ideia
// central: um anel de coordenadas fixas na tela (o desenho visual nao
// muda), mas o ROTULO de cada cadeira e calculado a partir da posicao
// real do hero — que fica sempre ancorado embaixo-centro, convencao
// padrao de qualquer replayer de poker (ICMizer, PokerTracker, Hand2Note).
//
// Antes, o Modo Treino tinha "BTN" fixo na cadeira de baixo, nao importa
// qual posicao o filtro selecionasse. Isso rotulava a mesa errado sempre
// que o hero nao fosse BTN.

import type { ParsedSeat } from "./hand-parser";

export type CardSide = "left" | "right" | "above" | "below";

export type SeatLayoutSlot = {
  posLabel: string;
  x: number;
  y: number;
  cardSide: CardSide;
  isHero: boolean;
  // Presente so no modo replay (mesa real) — o modo estilizado do Treino
  // nao tem jogador de verdade associado ao slot, so o rotulo.
  playerName?: string;
};

// FIX (2026-08): os assentos da metade de baixo estavam colados demais na
// borda inferior do oval (hero em y=92). Como o bloco do assento e'
// posicionado com translate(-50%,-50%) e o do hero e' o mais alto da mesa
// (cartas + chip de posicao + chip nome/stack + area de badge), metade
// dele caia fora do container, que tem overflow:hidden — era o "hero
// cortado" reportado, tanto no Treino quanto no Replayer. Os tres slots
// de baixo subiram (92→82 no hero, 84→76 nos vizinhos) e os de cima
// desceram um pouco (12→16), redistribuindo a folga sem achatar o anel.
const RING_COORDS: { x: number; y: number; cardSide: CardSide }[] = [
  { x: 13, y: 32, cardSide: "right" },
  { x: 34, y: 16, cardSide: "below" },
  { x: 66, y: 16, cardSide: "below" },
  { x: 87, y: 32, cardSide: "left" },
  { x: 92, y: 60, cardSide: "left" },
  { x: 74, y: 76, cardSide: "above" },
  { x: 50, y: 82, cardSide: "above" }, // slot do hero — sempre embaixo, centralizado
  { x: 26, y: 76, cardSide: "above" },
];

// FIX (2026-08): a ordem anterior era ["UTG","UTG+1","MP","HJ","CO","BB",
// "BTN","SB"], que colocava BB antes do BTN e o SB depois — invertendo os
// blinds na mesa (bug reportado: "a posicao do BB esta errada, precisa ser
// depois do SB"). A ordem correta, em sentido horario a partir do botao,
// e' a mesma ja usada por POSITION_LABELS_BY_COUNT[8] no modo replay:
// BTN → SB → BB → UTG → UTG+1 → MP → HJ → CO. Alinhada indice a indice com
// RING_COORDS acima (que tambem percorre o anel em sentido horario).
const RING_ORDER_8MAX = ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"];

const HERO_SLOT_INDEX = 6;

export class UnknownHeroPositionError extends Error {
  constructor(position: string) {
    super(`Posição de hero desconhecida: "${position}". Esperado uma de: ${RING_ORDER_8MAX.join(", ")}.`);
    this.name = "UnknownHeroPositionError";
  }
}

// Modo Treino: nao ha dado de mesa real (maxSeats/button), so a posicao
// real do hero (vinda da coluna drills.position). Reaproveita o anel
// visual de 8 cadeiras, rotacionado pra que o hero sempre caia no slot
// de baixo com o ROTULO CORRETO.
export function computeStylizedSeatLayout(heroPosition: string): SeatLayoutSlot[] {
  const heroIndex = RING_ORDER_8MAX.indexOf(heroPosition);
  if (heroIndex === -1) {
    throw new UnknownHeroPositionError(heroPosition);
  }

  return RING_COORDS.map((coord, i) => {
    const offset = i - HERO_SLOT_INDEX;
    const labelIndex = (heroIndex + offset + RING_ORDER_8MAX.length * 2) % RING_ORDER_8MAX.length;
    return {
      posLabel: RING_ORDER_8MAX[labelIndex],
      x: coord.x,
      y: coord.y,
      cardSide: coord.cardSide,
      isHero: i === HERO_SLOT_INDEX,
    };
  });
}

// NOTA: computeRealSeatLayout (abaixo) e' a versao pro Replay — mesma
// logica de rotacao do computeStylizedSeatLayout acima, so que com anel
// de tamanho variavel (heads-up, 3-max, 6-max, 9-max) em vez do anel
// fixo de 8 usado no Treino.
// Rotulos de posicao por CONTAGEM DE ASSENTOS OCUPADOS — nao pelo
// maxSeats nominal da mesa. Isso importa porque o PokerStars aplica
// regra de heads-up (BTN tambem posta SB) sempre que so sobram 2
// jogadores, mesmo numa mesa nominalmente maior (ex: 3-max com 1 fora).
const POSITION_LABELS_BY_COUNT: Record<number, string[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "UTG"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "MP", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "LJ", "HJ", "CO"],
};

export class UnsupportedTableSizeError extends Error {
  constructor(count: number) {
    super(`Mesa com ${count} jogadores não é suportada (aceito: 2 a 9).`);
    this.name = "UnsupportedTableSizeError";
  }
}

// Ordena os assentos fisicamente ocupados em sentido horario A PARTIR
// DO BOTAO. Essa ordem bate, index a index, com POSITION_LABELS_BY_COUNT
// (ordered[0] é sempre o botão, ordered[1] o próximo sentido horário,
// etc.) — é por isso que rotular depois é trivial, sem rotação extra.
function clockwiseOccupiedSeats(seats: ParsedSeat[], buttonSeatNumber: number, maxSeats: number): ParsedSeat[] {
  const bySeatNumber = new Map(seats.map((s) => [s.seatNumber, s]));
  const ordered: ParsedSeat[] = [];
  for (let offset = 0; offset < maxSeats; offset++) {
    const seatNum = ((buttonSeatNumber - 1 + offset) % maxSeats) + 1;
    const seat = bySeatNumber.get(seatNum);
    if (seat) ordered.push(seat);
  }
  return ordered;
}

// Gera coordenadas ao redor de uma elipse, com o slot 0 sempre embaixo-
// centro (é nele que o hero vai cair, depois do rotate por indice).
// Primeira versao algoritmica — o anel estilizado do Treino foi ajustado
// a mao visualmente; esse aqui deve passar pelo mesmo tipo de ajuste
// fino depois de testado no navegador com mesas de tamanhos diferentes.
function ellipseSeatCoords(n: number): { x: number; y: number; cardSide: CardSide }[] {
  const centerX = 50;
  // FIX (2026-08): centro subiu de 50 para 46 e radiusY caiu de 36 para
  // 32 — com os valores antigos o slot do hero caia em y=86 e o bloco
  // dele (o mais alto da mesa) era cortado pela borda inferior do
  // container, mesmo bug do anel estilizado acima. Agora o hero cai em
  // y=78, com folga suficiente para cartas + chips.
  const centerY = 46;
  const radiusX = 42;
  // radiusY menor que radiusX: com 42 nos dois eixos, a cadeira oposta
  // ao hero (topo da mesa, em mesas com n par) quase saia do feltro —
  // confirmado visualmente num render de teste antes de mudar isso.
  const radiusY = 32;
  const coords: { x: number; y: number; cardSide: CardSide }[] = [];

  for (let i = 0; i < n; i++) {
    const angleDeg = 90 + (360 / n) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const x = centerX + radiusX * cos;
    const y = centerY + radiusY * sin;

    let cardSide: CardSide;
    if (Math.abs(cos) < 0.35) {
      cardSide = sin > 0 ? "above" : "below";
    } else {
      cardSide = cos > 0 ? "left" : "right";
    }

    coords.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, cardSide });
  }
  return coords;
}

// Modo Replay: usa a mesa real (assentos ocupados + botao) do hand
// history parseado. Mesma logica de rotacao do computeStylizedSeatLayout
// (hero sempre embaixo, rotulo real) — so que com contagem de assentos
// variavel (2 a 9) em vez do anel fixo de 8 do Treino.
export function computeRealSeatLayout(
  seats: ParsedSeat[],
  buttonSeatNumber: number,
  maxSeats: number
): SeatLayoutSlot[] {
  const n = seats.length;
  const labels = POSITION_LABELS_BY_COUNT[n];
  if (!labels) {
    throw new UnsupportedTableSizeError(n);
  }

  const ordered = clockwiseOccupiedSeats(seats, buttonSeatNumber, maxSeats);
  if (ordered.length !== n) {
    throw new Error(
      "Inconsistência entre assentos ocupados e a contagem esperada — verifique o hand history."
    );
  }

  const heroIndexInOrder = ordered.findIndex((s) => s.isHero);
  if (heroIndexInOrder === -1) {
    throw new Error("Não foi possível localizar o hero entre os assentos ocupados.");
  }

  const coords = ellipseSeatCoords(n);

  // coords[0] e' sempre o slot de baixo. Rotaciona os assentos pra que
  // o hero caia ali, mantendo a ordem horaria pros demais.
  return coords.map((coord, k) => {
    const orderedIndex = (heroIndexInOrder + k) % n;
    const seat = ordered[orderedIndex];
    return {
      posLabel: labels[orderedIndex],
      x: coord.x,
      y: coord.y,
      cardSide: coord.cardSide,
      isHero: seat.isHero,
      playerName: seat.playerName,
    };
  });
}
