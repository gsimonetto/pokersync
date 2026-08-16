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

// Um evento discreto no replay — cada um vira um "step" navegavel.
// Substitui a projecao "por rua" (que fechava a rua inteira de uma vez)
// pela projecao "por evento" que replayers tradicionais usam
// (Hand2Note/ICMizer/GTO Wizard) — o usuario pode acompanhar acao a acao
// e o pote atualiza no ritmo real da mesa.
export type StepEvent =
  | {
      kind: "action";
      player: string;
      posLabel: string; // rotulo real da posicao (BB/CO/BTN...) apos rotacao
      label: string; // "raise to 3bb", "call 8bb", "fold" — texto pra history bar (ja em BB)
      chipsAdded: number; // dinheiro que ENTROU no pote nesse step (0 pra fold/check) — RAW, nao bb
      isFold: boolean; // afeta status do seat pro proximo step em diante
    }
  | { kind: "deal"; street: Exclude<StreetName, "preflop">; newCards: string[] }
  | {
      kind: "showdown";
      player: string;
      posLabel: string;
      cards: string[];
      description: string;
    }
  | {
      kind: "award";
      player: string;
      posLabel: string;
      amount: number;
    };

export type ReplayState = {
  tableHand: TableHand;
  seatLayout: SeatLayoutSlot[];
  stepIndex: number;
  stepCount: number;
  currentStreetLabel: string; // "PREFLOP" | "FLOP" | "TURN" | "RIVER"
  // Evento QUE acabou de acontecer nesse step (usado pela UI pra animar
  // fichas partindo do posLabel ate o pote, ou revelar cartas do board).
  // No step 0 e' null: estado inicial, blinds postados, ninguem agiu ainda.
  currentEvent: StepEvent | null;
  // Steps totais consumidos ate o step ANTERIOR ao atual. Usado pela UI
  // quando quer disparar animacao so no evento novo (evita re-animar tudo
  // quando o usuario clica "anterior"/"proxima" varias vezes seguidas).
  isAdvancing: boolean;
  // Quanto cada jogador (por posLabel) tem investido NA RUA ATUAL, ate o
  // step em exibicao. Reseta a cada "deal" (nova rua). Usado pela UI pra
  // desenhar uma pilha de fichas PARADA em frente ao seat — diferente da
  // animacao de chipAnimation, que e' so o "voo" momentaneo. Sem isso o
  // jogador via a ficha voar e sumir sem nunca "pousar" na mesa.
  streetCommitments: Record<string, number>;
  // Fichas grandes (X blind) usadas pra converter fichas cruas pra BB fora
  // desse arquivo — ex: chipAnimation na UI, que usa currentEvent.chipsAdded
  // (raw) e precisa do mesmo fator de conversao pra mostrar o valor certo.
  bbUnit: number;
};

export class HandReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandReplayError";
  }
}

// Extrai as cartas novas de uma rua — flop revela 3, turn/river revelam 1.
// Necessario porque ParsedStreet.board carrega TODAS as cartas visiveis
// naquela rua (acumulativo), nao so as novas. Pro evento "deal" a UI
// precisa saber quais cartas destacar/animar.
function getNewCardsForStreet(hand: ParsedHand, street: Exclude<StreetName, "preflop">): string[] {
  const streetData = hand.streets.find((s) => s.name === street);
  if (!streetData?.board) return [];
  const board = streetData.board;
  if (street === "flop") return board.slice(0, 3);
  if (street === "turn") return board.slice(3, 4);
  if (street === "river") return board.slice(4, 5);
  return [];
}

// Converte fichas cruas pra BB, arredondado em 1 casa — mesmo criterio
// usado no resto do replay (stack, pote, streetCommitments).
function toBBAmount(raw: number, bbUnit: number): number {
  return Math.round((raw / bbUnit) * 10) / 10;
}

// Timeline em BB (pedido explicito: "o historico na linha do tempo
// precisa ser as apostas em bb" — antes mostrava o valor cru do hand
// history, ex: "call 300"; agora "call 6bb"). Recebe bbUnit pra nao
// depender de estado global — cada mao pode ter blind diferente.
function actionLabel(a: ParsedAction, bbUnit: number): string {
  const bb = (raw: number | undefined) => toBBAmount(raw ?? 0, bbUnit);
  switch (a.action) {
    case "posts":
      return `posts ${bb(a.amount)}bb`;
    case "folds":
      return "fold";
    case "checks":
      return "check";
    case "bets":
      return `bet ${bb(a.amount)}bb`;
    case "calls":
      return `call ${bb(a.amount)}bb`;
    case "raises":
      return `raise to ${bb(a.raiseTo)}bb`;
    default:
      return a.action;
  }
}

// Calcula quanto entra no pote pra uma acao especifica DENTRO de uma rua.
// Precisa do total ja comprometido pelo jogador NESSA rua (nao no total
// da mao) porque "raises X to Y" usa Y como total-da-rua, nao incremento.
// Retorna delta (>= 0). Para uncalled_return, retorna o negativo (pote
// diminui) — mas nesse caso o chamador trata separado, aqui so acoes+.
function computeChipsAddedInStreet(
  a: ParsedAction,
  committedByPlayerThisStreet: Map<string, number>
): number {
  switch (a.action) {
    case "posts":
    case "bets":
    case "calls":
      return a.amount ?? 0;
    case "raises": {
      const total = a.raiseTo ?? 0;
      const already = committedByPlayerThisStreet.get(a.player) ?? 0;
      return Math.max(0, total - already);
    }
    default:
      return 0;
  }
}

// Constroi a lista linear de eventos que a UI vai navegar. Os posts de
// blinds NAO viram events — eles entram automaticamente no estado do
// step 0 (mesa "pronta pra jogar"). Steps sao so eventos que o jogador
// tomaria manualmente ou visuais (deal/showdown/award).
// bbUnit e' repassado pro actionLabel converter os valores exibidos na
// history bar pra BB — chipsAdded continua RAW de proposito (contabilidade
// interna do pote usa fichas cruas ate o ultimo instante, ver comentario
// mais abaixo em projectHandAtStep).
function buildEventList(hand: ParsedHand, layout: SeatLayoutSlot[], bbUnit: number): StepEvent[] {
  const events: StepEvent[] = [];
  const posByName = new Map(layout.filter((s) => s.playerName).map((s) => [s.playerName as string, s.posLabel]));
  const streetOrder: StreetName[] = ["preflop", "flop", "turn", "river"];

  for (const streetName of streetOrder) {
    const street = hand.streets.find((s) => s.name === streetName);
    if (!street) continue;

    if (streetName !== "preflop") {
      events.push({
        kind: "deal",
        street: streetName,
        newCards: getNewCardsForStreet(hand, streetName),
      });
    }

    // Committed por jogador NESTA rua — reset a cada rua nova, porque
    // "raises X to Y" e' relativo ao total-da-rua daquele jogador.
    const committed = new Map<string, number>();

    for (const a of street.actions) {
      if (a.action === "posts") {
        // CORRECAO (2026-08, bug real): so BLIND (SB/BB) entra nessa
        // contabilidade de "quanto o jogador ja apostou nessa rua",
        // usada no calculo do delta de "raises X para Y". Ante NAO
        // conta — "raises para Y" e' relativo as apostas da rodada
        // (blinds + raises), nunca ao ante, que e' forcado e separado
        // antes de qualquer decisao. Bug encontrado numa mao real: MTT
        // com ante, jogador que so tinha pago ante dava o primeiro
        // raise da mao — o codigo subtraia o ante do valor do raise
        // (raiseTo - ante), subestimando o pote reconstruido em relacao
        // ao total do resumo da mao (sanity check acusava divergencia).
        // Nao ha campo explicito de "tipo de post" disponivel aqui pra
        // diferenciar de outro jeito — identifica blind comparando o
        // valor do post com hand.smallBlind/hand.bigBlind.
        const isBlindPost = a.amount === hand.smallBlind || a.amount === hand.bigBlind;
        if (isBlindPost) {
          committed.set(a.player, (committed.get(a.player) ?? 0) + (a.amount ?? 0));
        }
        continue;
      }

      if (a.action === "uncalled_return") {
        // CORRECAO (2026-08, bug real): aposta nao-igualada volta pro
        // jogador ("Aposta nao-igualada (X) voltou pra Y" no resumo),
        // mas o pote reconstruido nunca descontava esse valor de volta
        // — contava a aposta inteira como se tivesse ficado no pote.
        // Continua NAO virando um step navegavel (mantido como pedido
        // originalmente: "aplicado automaticamente, invisivel pro
        // replayer") — em vez disso, desconta o valor devolvido do
        // ULTIMO evento de acao desse mesmo jogador NESSA MESMA rua (o
        // bet/raise que gerou a sobra), corrigindo o total sem alterar
        // a navegacao existente. Se a aposta foi TOTALMENTE nao-
        // igualada (ninguem pagou nada dela), o evento correspondente
        // fica com chipsAdded=0 — a ficha nao anima nem aparece parada
        // em frente ao assento nesse step (o pote nunca recebeu esse
        // dinheiro de verdade), mas o texto na history bar continua
        // mostrando o valor apostado originalmente (actionLabel usa o
        // valor bruto do parser, nao afetado por essa correcao).
        const returned = a.amount ?? 0;
        for (let i = events.length - 1; i >= 0; i--) {
          const ev = events[i];
          if (ev.kind === "deal") break; // nao cruza pra uma rua anterior
          if (ev.kind === "action" && ev.player === a.player && ev.chipsAdded > 0) {
            ev.chipsAdded = Math.max(0, ev.chipsAdded - returned);
            break;
          }
        }
        continue;
      }

      const posLabel = posByName.get(a.player) ?? a.player;
      const chipsAdded = computeChipsAddedInStreet(a, committed);
      if (chipsAdded > 0) {
        committed.set(a.player, (committed.get(a.player) ?? 0) + chipsAdded);
      }

      events.push({
        kind: "action",
        player: a.player,
        posLabel,
        label: actionLabel(a, bbUnit),
        chipsAdded,
        isFold: a.action === "folds",
      });
    }
  }

  // Showdown — cada revelacao de cartas vira um step separado. Assim o
  // usuario ve uma revelacao por vez, especialmente em pote multiway.
  for (const s of hand.showdown) {
    const posLabel = posByName.get(s.player) ?? s.player;
    events.push({
      kind: "showdown",
      player: s.player,
      posLabel,
      cards: s.cards,
      description: s.handDescription,
    });
  }

  if (hand.winner && hand.pot != null && hand.pot > 0) {
    const posLabel = posByName.get(hand.winner) ?? hand.winner;
    events.push({
      kind: "award",
      player: hand.winner,
      posLabel,
      amount: hand.pot,
    });
  }

  return events;
}

// Calcula o estado inicial (step 0) — depois dos posts de blinds/ante e
// antes de qualquer decisao voluntaria. Nao usa nenhum event ainda; le
// so os posts direto do preflop.
function buildInitialState(hand: ParsedHand): {
  pot: number;
  foldedPlayers: Set<string>;
  revealedCards: Map<string, string[]>;
  boardShown: string[];
} {
  let pot = 0;
  const preflop = hand.streets.find((s) => s.name === "preflop");
  if (preflop) {
    for (const a of preflop.actions) {
      if (a.action === "posts") pot += a.amount ?? 0;
    }
  }
  return {
    pot,
    foldedPlayers: new Set<string>(),
    revealedCards: new Map<string, string[]>(),
    boardShown: [],
  };
}

// Determina a rua atual dado o indice do step — util pra label no topo.
// A rua atual e' a ultima cujo "deal" ja foi processado; ate o primeiro
// deal ser processado, estamos em preflop.
function computeCurrentStreet(events: StepEvent[], throughStep: number): StreetName {
  let street: StreetName = "preflop";
  for (let i = 0; i < throughStep && i < events.length; i++) {
    const e = events[i];
    if (e.kind === "deal") street = e.street;
  }
  return street;
}

export function projectHandAtStep(hand: ParsedHand, stepIndex: number, previousStepIndex?: number): ReplayState {
  const seatLayout = computeRealSeatLayout(hand.seats, hand.buttonSeat ?? 0, hand.maxSeats ?? hand.seats.length);
  // bbUnit calculado ANTES de montar a lista de eventos — precisa estar
  // disponivel pra actionLabel converter os valores da history bar pra BB
  // no momento em que cada evento e' criado.
  const bbUnit = hand.bigBlind && hand.bigBlind > 0 ? hand.bigBlind : 1;
  const events = buildEventList(hand, seatLayout, bbUnit);
  const stepCount = events.length + 1; // +1 pro step 0 (estado inicial)

  if (stepCount === 1) {
    // Mao sem eventos apos os posts — improvavel em pratica, mas defende
    // contra hand history truncado.
    throw new HandReplayError("Essa mão não tem ações reconhecidas — não é possível montar o replay.");
  }

  const clampedIndex = Math.max(0, Math.min(stepIndex, stepCount - 1));
  const isAdvancing = previousStepIndex == null ? true : clampedIndex > previousStepIndex;

  // Processa events do 1 ate clampedIndex (step 0 = estado inicial puro).
  const initial = buildInitialState(hand);
  let pot = initial.pot;
  const folded = new Set<string>(initial.foldedPlayers);
  const revealed = new Map<string, string[]>(initial.revealedCards);
  let boardShown: string[] = [...initial.boardShown];
  let currentEvent: StepEvent | null = null;

  // Committed-na-rua-atual por posLabel (nao por nome — a UI so conhece
  // posLabel). Reseta toda vez que cruza um "deal" (nova rua comeca).
  // Blinds do preflop contam desde o step 0 (SB/BB ja "tem ficha na
  // mesa" antes de qualquer acao voluntaria).
  let streetCommitted = new Map<string, number>();
  {
    const posByName = new Map(seatLayout.filter((s) => s.playerName).map((s) => [s.playerName as string, s.posLabel]));
    const preflop = hand.streets.find((st) => st.name === "preflop");
    if (preflop) {
      for (const a of preflop.actions) {
        if (a.action === "posts") {
          const pos = posByName.get(a.player);
          if (pos) streetCommitted.set(pos, (streetCommitted.get(pos) ?? 0) + (a.amount ?? 0));
        }
      }
    }
  }

  for (let i = 0; i < clampedIndex; i++) {
    const e = events[i];
    switch (e.kind) {
      case "action":
        pot += e.chipsAdded;
        if (e.isFold) folded.add(e.player);
        if (e.chipsAdded > 0) {
          streetCommitted.set(e.posLabel, (streetCommitted.get(e.posLabel) ?? 0) + e.chipsAdded);
        }
        break;
      case "deal":
        boardShown = [...boardShown, ...e.newCards];
        // Rua nova comeca — pilhas de fichas da rua anterior "vao pro
        // pote" (ja estao contadas em `pot`) e o chao fica limpo de novo.
        streetCommitted = new Map();
        break;
      case "showdown":
        revealed.set(e.player, e.cards);
        break;
      case "award":
        break;
    }
    if (i === clampedIndex - 1) currentEvent = e;
  }

  // Checagem de sanidade so no ultimo step (a mao inteira processada):
  // se o pote reconstruido nao bate com o do SUMMARY, algo esta errado —
  // melhor sinalizar do que exibir numero silenciosamente incorreto. A UI
  // (RevisorHandTable) trata esse erro avancando pra proxima mao da fila
  // em vez de bloquear a tela.
  if (clampedIndex === stepCount - 1 && hand.pot != null && hand.pot > 0) {
    const diff = Math.abs(pot - hand.pot);
    if (diff > 0.01) {
      throw new HandReplayError(
        `Pote calculado (${pot}) não bate com o total da mão (${hand.pot}). Não exibindo — pode haver side pot ou ação não reconhecida pelo parser.`
      );
    }
  }

  // Monta seats. Stack vem em FICHAS CRUAS do parser (hand.seats[].
  // startingChips) — precisa converter pra BB antes de exibir, senao a UI
  // mostra "77472 bb" (bug reportado: "esta puxando por valor de ficha").
  // bbUnit=1 quando bigBlind nao foi identificado (fallback: mostra fichas
  // cruas mesmo, melhor que dividir por zero/undefined).
  const toBB = (chips: number) => toBBAmount(chips, bbUnit);

  const seats: Record<string, SeatState> = {};
  const actingPlayer = getActingPlayer(events, clampedIndex, folded);
  for (const slot of seatLayout) {
    if (!slot.playerName) continue;
    const seatData = hand.seats.find((s) => s.playerName === slot.playerName);
    if (!seatData) continue;

    const isFolded = folded.has(slot.playerName);
    const revealedForVillain = revealed.get(slot.playerName);
    const isActing = actingPlayer === slot.playerName;

    seats[slot.posLabel] = {
      status: isFolded ? "folded" : isActing ? "acting" : "live",
      stack: toBB(seatData.startingChips),
      cards: slot.isHero ? hand.heroCards ?? undefined : revealedForVillain,
    };
  }

  // History bar: mostra rua atual + acoes JA executadas. Acoes futuras
  // ficam ocultas (opcao escolhida: "acoes ja executadas ate o step").
  const currentStreet = computeCurrentStreet(events, clampedIndex);
  const history = buildHistoryUpToStep(events, clampedIndex, currentStreet);

  const tableHand: TableHand = {
    // pot ate aqui e' RAW (fichas cruas) — usado na checagem de sanidade
    // acima contra hand.pot (tambem raw). So converte pra BB no ultimo
    // instante, na hora de montar o objeto exibido.
    pot: toBB(pot),
    // SPR por rua exigiria simular stacks remanescentes por rua — nao
    // implementado ainda; melhor omitir do que calcular errado.
    spr: null,
    board: boardShown,
    history,
    seats,
  };

  // streetCommitted tambem esta em fichas cruas (acumulado no loop acima)
  // — converte pra BB no mesmo padrao de stack/pot.
  const streetCommitmentsBB: Record<string, number> = {};
  for (const [pos, chips] of streetCommitted.entries()) {
    streetCommitmentsBB[pos] = toBB(chips);
  }

  return {
    tableHand,
    seatLayout,
    stepIndex: clampedIndex,
    stepCount,
    currentStreetLabel: STREET_LABELS[currentStreet],
    currentEvent,
    isAdvancing,
    streetCommitments: streetCommitmentsBB,
    // Exposto pra quem consome o replay converter valores AVULSOS que nao
    // passam por aqui — ex: o valor exibido na ficha voando (chipAnimation),
    // derivado de currentEvent.chipsAdded, que fica em fichas cruas de proposito
    // (mantem a logica interna de contabilidade intacta).
    bbUnit,
  };
}

// Descobre quem esta "na acao" no step atual — o proximo jogador nao-fold
// a agir na sequencia do HH. Usa o proximo event do tipo "action" cujo
// player ainda nao foldou. Se nao ha proximo action, ninguem esta na
// acao (mao terminada).
function getActingPlayer(events: StepEvent[], nextStepIndex: number, folded: Set<string>): string | null {
  for (let i = nextStepIndex; i < events.length; i++) {
    const e = events[i];
    if (e.kind !== "action") {
      // Se o proximo evento e' um deal/showdown/award, o "acting" e do
      // proximo action apos ele — mas visualmente, na hora que o deal
      // aparece, ninguem esta "acting" ainda (o dealer age). Retorna null.
      if (e.kind === "deal") return null;
      continue;
    }
    if (folded.has(e.player)) continue;
    return e.player;
  }
  return null;
}

// Reconstroi a history bar so com o que ja aconteceu ate o step atual,
// agrupado por rua. Ruas futuras nao aparecem; a rua atual e' destacada.
function buildHistoryUpToStep(events: StepEvent[], throughStep: number, currentStreet: StreetName): HistoryStep[] {
  const byStreet = new Map<StreetName, { pos: string; label: string }[]>();
  byStreet.set("preflop", []);
  let street: StreetName = "preflop";

  for (let i = 0; i < throughStep && i < events.length; i++) {
    const e = events[i];
    if (e.kind === "deal") {
      street = e.street;
      if (!byStreet.has(street)) byStreet.set(street, []);
      continue;
    }
    if (e.kind === "action") {
      const arr = byStreet.get(street) ?? [];
      arr.push({ pos: e.posLabel, label: e.label });
      byStreet.set(street, arr);
    }
  }

  const order: StreetName[] = ["preflop", "flop", "turn", "river"];
  const result: HistoryStep[] = [];
  for (const s of order) {
    if (!byStreet.has(s)) continue;
    result.push({
      street: STREET_LABELS[s],
      current: s === currentStreet,
      actions: byStreet.get(s) ?? [],
    });
  }
  return result;
}

// Compat: mantido pra outros consumidores que ainda navegam por rua
// (nenhum hoje, mas preservado pra transicao gradual — se ninguem usar
// depois de 1-2 releases, remover). O novo caminho e' projectHandAtStep.
export function projectHandAtStreet(hand: ParsedHand, streetIndex: number): ReplayState {
  const seatLayout = computeRealSeatLayout(hand.seats, hand.buttonSeat ?? 0, hand.maxSeats ?? hand.seats.length);
  const bbUnit = hand.bigBlind && hand.bigBlind > 0 ? hand.bigBlind : 1;
  const events = buildEventList(hand, seatLayout, bbUnit);
  const targetStreetName = (["preflop", "flop", "turn", "river"] as StreetName[])[streetIndex] ?? "preflop";

  let stepAtEndOfStreet = 0;
  let sawTarget = targetStreetName === "preflop";
  let currentStreet: StreetName = "preflop";

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "deal") {
      if (currentStreet === targetStreetName && sawTarget) break;
      currentStreet = e.street;
      if (currentStreet === targetStreetName) sawTarget = true;
    }
    stepAtEndOfStreet = i + 1;
    if (sawTarget && (i + 1 >= events.length || events[i + 1]?.kind === "deal") && currentStreet === targetStreetName) {
      break;
    }
  }

  return projectHandAtStep(hand, stepAtEndOfStreet);
}
