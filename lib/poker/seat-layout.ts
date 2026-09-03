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

// Expoente da superelipse usada tanto pro anel estilizado (RING_COORDS)
// quanto pro anel real (ellipseSeatCoords, mais abaixo) — precisa estar
// inicializado AQUI EM CIMA porque RING_COORDS chama ellipseSeatCoords
// no carregamento do modulo, antes de qualquer `const` mais abaixo no
// arquivo existir (erro de TDZ do JS se ficasse perto da funcao).
const SUPERELLIPSE_EXPONENT = 4;

// FIX (2026-09): as coordenadas do anel eram "chutadas" a mao (valores
// fixos por assento), sem seguir uma elipse de verdade — cada uma podia
// ficar mais perto ou mais longe da borda do feltro de forma inconsistente.
// Bug reportado: "desalinhamento dos seats na borda das mesas" — o assento
// de CO (direita), por exemplo, tinha as cartas ultrapassando o feltro,
// enquanto o espelho dele (UTG+1, esquerda) tinha folga de sobra. Agora as
// 8 posicoes vem da MESMA formula parametrica de elipse usada no Replay
// (ellipseSeatCoords, mais abaixo neste arquivo) — ja validada visualmente
// ali sem nenhum assento vazando pra fora do feltro. Isso tambem elimina a
// duplicacao de "duas fontes de posicionamento" pro mesmo desenho de mesa.
const RING_COORDS: { x: number; y: number; cardSide: CardSide }[] = ellipseSeatCoords(8);

// FIX (2026-08): a ordem anterior era ["UTG","UTG+1","MP","HJ","CO","BB",
// "BTN","SB"], que colocava BB antes do BTN e o SB depois — invertendo os
// blinds na mesa (bug reportado: "a posicao do BB esta errada, precisa ser
// depois do SB"). A ordem correta, em sentido horario a partir do botao,
// e' a mesma ja usada por POSITION_LABELS_BY_COUNT[8] no modo replay:
// BTN → SB → BB → UTG → UTG+1 → MP → HJ → CO. Alinhada indice a indice com
// RING_COORDS acima (que tambem percorre o anel em sentido horario).
const RING_ORDER_8MAX = ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"];

// RING_COORDS[0] e' sempre o slot de baixo-centro (ver ellipseSeatCoords) —
// e' nele que o hero cai, mesma convencao do modo Replay.
const HERO_SLOT_INDEX = 0;

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
// `ringConfig` (opcional): so' quem desenha o anel numa proporcao MUITO
// diferente do retangulo deitado padrao precisa passar isso -- hoje, so'
// o modo mesa-cheia do Treino no celular (retangulo EM PE). Sem ele,
// reusa o RING_COORDS ja calculado uma vez no carregamento do modulo
// (mesmo comportamento de sempre, zero mudanca pros demais usos).
export function computeStylizedSeatLayout(heroPosition: string, ringConfig?: RingConfig): SeatLayoutSlot[] {
  const heroIndex = RING_ORDER_8MAX.indexOf(heroPosition);
  if (heroIndex === -1) {
    throw new UnknownHeroPositionError(heroPosition);
  }

  const ring = ringConfig ? ellipseSeatCoords(8, ringConfig) : RING_COORDS;

  return ring.map((coord, i) => {
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
//
// FIX (2026-09): mesa trocou de oval pra retangular com cantos
// arredondados (pedido explicito: "mesa mais retangular com as bordas
// redondas, como o gtowizard faz"). Uma elipse comum (expoente 2 na
// equacao |x/a|^p + |y/b|^p = 1) nao serve mais pra distribuir os
// assentos — colocaria gente flutuando longe da borda reta dos lados
// compridos. Com expoente mais alto (SUPERELLIPSE_EXPONENT, definido no
// topo do arquivo) a curva "estica" pros lados retos e so' arredonda
// perto dos cantos — a mesma familia de curva (superelipse/squircle)
// usada pra desenhar o proprio contorno da mesa logo abaixo em
// PokerTable, entao os assentos acompanham a borda de verdade em vez de
// "flutuar" pra dentro ou pra fora dela.
// Raios em % da caixa da mesa -- calibrados originalmente pro retangulo
// DEITADO (8/5) usado em toda mesa "normal". Um retangulo EM PE (o modo
// mesa-cheia do Treino no celular, aspectRatio "3/5") tem uma relacao
// largura:altura bem diferente, entao os mesmos % de raio vertical
// deixam os assentos de cima/baixo com folga desproporcional -- e' por
// isso que RingConfig existe: quem desenha um anel numa proporcao muito
// diferente da 8/5 padrao passa os proprios raios em vez de aceitar o
// default.
type RingConfig = { centerY?: number; radiusX?: number; radiusY?: number; radiusYTop?: number; exponent?: number };

function ellipseSeatCoords(n: number, config: RingConfig = {}): { x: number; y: number; cardSide: CardSide }[] {
  const centerX = 50;
  // FIX (2026-08): centro subiu de 50 para 46 e radiusY caiu de 36 para
  // 32 — com os valores antigos o slot do hero caia em y=86 e o bloco
  // dele (o mais alto da mesa) era cortado pela borda inferior do
  // container, mesmo bug do anel estilizado acima. Agora o hero cai em
  // y=78, com folga suficiente para cartas + chips.
  const centerY = config.centerY ?? 46;
  const radiusX = config.radiusX ?? 42;
  // radiusY menor que radiusX: com 42 nos dois eixos, a cadeira oposta
  // ao hero (topo da mesa, em mesas com n par) quase saia do feltro —
  // confirmado visualmente num render de teste antes de mudar isso.
  //
  // FIX (2026-09): pedido explicito ("quero os seats mais proximos da
  // borda da mesa, estao quase no centro") -- 32/26 deixava a fileira
  // vertical (topo/base) muito mais perto do centro, em proporcao, do
  // que a fileira horizontal (radiusX=42), ficando mais evidente em
  // mesas heads-up/3-max (so' sobra o eixo vertical). Subiu pro maior
  // valor confirmado sem cortar carta/badge em nenhuma altura de tela
  // testada (validado com render real do navegador do menor retangulo
  // 8/5 ate' o mais achatado tipo notebook) -- acima disso, o bloco de
  // nome+stack do assento de baixo (ou as cartas do assento de cima)
  // comecam a vazar por cima da borda arredondada nas telas mais baixas.
  const radiusY = config.radiusY ?? 38;
  // Os assentos de BAIXO nao tem esse problema (cartas "em cima do nome"
  // pra eles apontam pro CENTRO da mesa, lado oposto da borda), entao so' a
  // metade de cima ganha um raio vertical menor (mais afastado da borda) --
  // mesmo motivo acima pro valor: maior confirmado sem cortar carta nas
  // telas mais baixas testadas.
  const radiusYTop = config.radiusYTop ?? 30;
  const coords: { x: number; y: number; cardSide: CardSide }[] = [];

  for (let i = 0; i < n; i++) {
    const angleDeg = 90 + (360 / n) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    // Parametrizacao de superelipse: em vez de x=cos, y=sin (elipse
    // normal), eleva cada um a 2/expoente mantendo o sinal — quanto
    // maior o expoente, mais a curva "achata" nos lados e concentra a
    // curvatura nos cantos (formato de retangulo arredondado).
    // FIX (pedido explicito: "os seats ao lado do hero ainda estão
    // desalinhados... os seats que estao proximos a silhueta da mesa
    // (quando faz a curva) nao estao na borda, estao mais pro centro") --
    // no modo mesa-cheia (retangulo bem mais alto que largo), o expoente
    // padrao (4) deixava os assentos diagonais (vizinhos do heroi) longe
    // demais da borda real, porque a curva parametrica so' se aproxima
    // do canto verdadeiro aos poucos com o expoente -- valores maiores
    // "achatam" mais a curva pros cantos, aproximando o assento
    // diagonal da borda sem mexer nos assentos que ja caem exatamente
    // nos eixos (topo/base/laterais, onde cos ou sin já valem 0 ou ±1
    // independente do expoente). `exponent` no RingConfig deixa quem
    // desenha um anel de proporcao muito diferente (mesa-cheia) usar um
    // valor maior so' ali, sem mudar o anel padrao das mesas deitadas.
    const p = 2 / (config.exponent ?? SUPERELLIPSE_EXPONENT);
    const cosP = Math.sign(cos) * Math.abs(cos) ** p;
    const sinP = Math.sign(sin) * Math.abs(sin) ** p;
    const x = centerX + radiusX * cosP;
    const y = centerY + (sin < 0 ? radiusYTop : radiusY) * sinP;

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
