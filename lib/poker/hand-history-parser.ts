// Parser de hand history — hoje so suporta PokerStars (formato validado
// contra exemplo real do usuario, incluindo o caso de all-in no preflop
// sem nenhuma acao registrada em flop/turn/river).
//
// GGPoker ainda NAO e suportado: o formato de header, blinds e showdown
// da GGPoker e bem diferente do PokerStars, e nao ha exemplo real pra
// validar contra. detectSite() lanca UnsupportedHandHistoryFormatError
// pra qualquer coisa que nao seja PokerStars — de proposito, pra nao
// arriscar um parse errado silencioso.

export type Street = "preflop" | "flop" | "turn" | "river";

export type ParsedSeat = {
  seatNumber: number;
  playerName: string;
  startingChips: number;
  isButton: boolean;
  isHero: boolean;
};

export type ActionType =
  | "post_small_blind"
  | "post_big_blind"
  | "post_ante"
  | "fold"
  | "check"
  | "bet"
  | "call"
  | "raise"
  | "uncalled_return"
  | "shows"
  | "collected";

export type ParsedAction = {
  street: Street;
  player: string;
  type: ActionType;
  amount?: number;
  raiseTo?: number;
  isAllIn?: boolean;
  cards?: string[]; // presente em "shows"
  handDescription?: string; // presente em "shows", ex: "a pair of Jacks"
};

export type ParsedHand = {
  site: "pokerstars";
  handId: string;
  tournamentId?: string;
  buyIn?: string;
  gameType: string;
  level?: string;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
  buttonSeat: number;
  rawTimestamp: string;
  seats: ParsedSeat[];
  heroName: string | null;
  heroCards: string[] | null;
  actions: ParsedAction[]; // ordem cronologica, todas as ruas
  boardByStreet: Partial<Record<Exclude<Street, "preflop">, string[]>>; // cumulativo
  finalBoard: string[];
  totalPot: number;
  rake: number;
  raw: string;
};

export class UnsupportedHandHistoryFormatError extends Error {
  constructor(
    message = "Formato de hand history não reconhecido. Hoje só suportamos PokerStars."
  ) {
    super(message);
    this.name = "UnsupportedHandHistoryFormatError";
  }
}

export class HandHistoryParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandHistoryParseError";
  }
}

function detectSite(raw: string): "pokerstars" {
  if (/^PokerStars Hand #/m.test(raw.trim())) return "pokerstars";
  throw new UnsupportedHandHistoryFormatError();
}

export function parseHandHistory(raw: string): ParsedHand {
  const site = detectSite(raw);
  if (site === "pokerstars") return parsePokerStarsHandHistory(raw);
  // Guard extra — detectSite ja cobre isso, mas mantem o switch exaustivo
  // caso um novo site seja adicionado no futuro sem atualizar aqui.
  throw new UnsupportedHandHistoryFormatError();
}

function parsePokerStarsHandHistory(raw: string): ParsedHand {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headerLine = lines.find((l) => l.startsWith("PokerStars Hand #"));
  if (!headerLine) {
    throw new HandHistoryParseError("Cabeçalho da PokerStars não encontrado.");
  }

  const headerMatch = headerLine.match(
    /^PokerStars Hand #(\d+): Tournament #(\d+), (\S+) USD Hold'em No Limit - Level (\S+) \((\d+)\/(\d+)\) - (.+)$/
  );
  if (!headerMatch) {
    throw new HandHistoryParseError(
      "Não foi possível interpretar o cabeçalho da mão. Confira se o texto está completo e sem edições."
    );
  }
  const [, handId, tournamentId, buyIn, level, sbStr, bbStr, rawTimestamp] = headerMatch;

  const tableLine = lines.find((l) => l.startsWith("Table '"));
  const tableMatch = tableLine?.match(/^Table '([^']+)' (\d+)-max Seat #(\d+) is the button$/);
  if (!tableMatch) {
    throw new HandHistoryParseError("Não foi possível interpretar a linha da mesa (Table).");
  }
  const [, , maxSeatsStr, buttonSeatStr] = tableMatch;

  const seats: ParsedSeat[] = [];
  for (const line of lines) {
    const seatMatch = line.match(/^Seat (\d+): (.+?) \((\d+) in chips\)$/);
    if (seatMatch) {
      const [, seatNumStr, playerName, chipsStr] = seatMatch;
      seats.push({
        seatNumber: Number(seatNumStr),
        playerName,
        startingChips: Number(chipsStr),
        isButton: Number(seatNumStr) === Number(buttonSeatStr),
        isHero: false, // resolvido abaixo, via "Dealt to"
      });
    }
  }
  if (seats.length === 0) {
    throw new HandHistoryParseError("Nenhum jogador encontrado na mão (linhas 'Seat').");
  }

  let heroName: string | null = null;
  let heroCards: string[] | null = null;
  const heroLine = lines.find((l) => l.startsWith("Dealt to "));
  const heroMatch = heroLine?.match(/^Dealt to (.+?) \[([^\]]+)\]$/);
  if (heroMatch) {
    heroName = heroMatch[1];
    heroCards = heroMatch[2].split(" ");
    const heroSeat = seats.find((s) => s.playerName === heroName);
    if (heroSeat) heroSeat.isHero = true;
  }

  // Marca os limites de cada secao pelas linhas "*** ... ***".
  const sectionMarkers: { index: number; label: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*/);
    if (m) sectionMarkers.push({ index: i, label: m[1] });
  });

  function linesBetween(startLabel: string, endLabels: string[]): string[] {
    const start = sectionMarkers.find((m) => m.label === startLabel);
    if (!start) return [];
    const nextIndexes = sectionMarkers
      .filter((m) => endLabels.includes(m.label) && m.index > start.index)
      .map((m) => m.index);
    const end = nextIndexes.length ? Math.min(...nextIndexes) : lines.length;
    return lines.slice(start.index + 1, end);
  }

  const preflopLines = linesBetween("HOLE CARDS", ["FLOP", "TURN", "RIVER", "SHOW DOWN", "SUMMARY"]);
  const flopLines = linesBetween("FLOP", ["TURN", "RIVER", "SHOW DOWN", "SUMMARY"]);
  const turnLines = linesBetween("TURN", ["RIVER", "SHOW DOWN", "SUMMARY"]);
  const riverLines = linesBetween("RIVER", ["SHOW DOWN", "SUMMARY"]);
  const showdownLines = linesBetween("SHOW DOWN", ["SUMMARY"]);

  // Blinds/antes ficam ANTES de "*** HOLE CARDS ***".
  const preambleEnd = sectionMarkers.find((m) => m.label === "HOLE CARDS")?.index ?? lines.length;
  const preambleLines = lines.slice(0, preambleEnd);

  function parseActionLine(line: string, street: Street): ParsedAction | null {
    let m = line.match(/^(.+?): posts (small blind|big blind|ante) (\d+)$/);
    if (m) {
      const [, player, kind, amountStr] = m;
      return {
        street,
        player,
        type: kind === "small blind" ? "post_small_blind" : kind === "big blind" ? "post_big_blind" : "post_ante",
        amount: Number(amountStr),
      };
    }

    m = line.match(/^(.+?): folds$/);
    if (m) return { street, player: m[1], type: "fold" };

    m = line.match(/^(.+?): checks$/);
    if (m) return { street, player: m[1], type: "check" };

    m = line.match(/^(.+?): bets (\d+)( and is all-in)?$/);
    if (m) return { street, player: m[1], type: "bet", amount: Number(m[2]), isAllIn: !!m[3] };

    m = line.match(/^(.+?): calls (\d+)( and is all-in)?$/);
    if (m) return { street, player: m[1], type: "call", amount: Number(m[2]), isAllIn: !!m[3] };

    m = line.match(/^(.+?): raises (\d+) to (\d+)( and is all-in)?$/);
    if (m)
      return {
        street,
        player: m[1],
        type: "raise",
        amount: Number(m[2]),
        raiseTo: Number(m[3]),
        isAllIn: !!m[4],
      };

    m = line.match(/^Uncalled bet \((\d+)\) returned to (.+)$/);
    if (m) return { street, player: m[2], type: "uncalled_return", amount: Number(m[1]) };

    m = line.match(/^(.+?): shows \[([^\]]+)\] \((.+)\)$/);
    if (m) return { street, player: m[1], type: "shows", cards: m[2].split(" "), handDescription: m[3] };

    m = line.match(/^(.+?) collected (\d+) from pot$/);
    if (m) return { street, player: m[1], type: "collected", amount: Number(m[2]) };

    // Linhas que nao batem com nenhum padrao (ex: "X finished the
    // tournament in 2nd place") sao metadado de torneio, nao acao de
    // mao — ignoradas de proposito, sem lancar erro.
    return null;
  }

  const actions: ParsedAction[] = [];
  const pushAll = (streetLines: string[], street: Street) => {
    for (const line of streetLines) {
      const parsed = parseActionLine(line, street);
      if (parsed) actions.push(parsed);
    }
  };

  pushAll(preambleLines, "preflop");
  pushAll(preflopLines, "preflop");
  pushAll(flopLines, "flop");
  pushAll(turnLines, "turn");
  pushAll(riverLines, "river");
  pushAll(showdownLines, "river");

  const flopBoardLine = lines.find((l) => l.startsWith("*** FLOP ***"));
  const turnBoardLine = lines.find((l) => l.startsWith("*** TURN ***"));
  const riverBoardLine = lines.find((l) => l.startsWith("*** RIVER ***"));

  const boardByStreet: ParsedHand["boardByStreet"] = {};

  const flopMatch = flopBoardLine?.match(/^\*\*\* FLOP \*\*\* \[([^\]]+)\]$/);
  if (flopMatch) boardByStreet.flop = flopMatch[1].split(" ");

  const turnMatch = turnBoardLine?.match(/^\*\*\* TURN \*\*\* \[[^\]]+\] \[([^\]]+)\]$/);
  if (turnMatch && boardByStreet.flop) boardByStreet.turn = [...boardByStreet.flop, turnMatch[1]];

  const riverMatch = riverBoardLine?.match(/^\*\*\* RIVER \*\*\* \[[^\]]+\] \[([^\]]+)\]$/);
  if (riverMatch && boardByStreet.turn) boardByStreet.river = [...boardByStreet.turn, riverMatch[1]];

  const summaryStart = sectionMarkers.find((m) => m.label === "SUMMARY")?.index;
  const summaryLines = summaryStart !== undefined ? lines.slice(summaryStart + 1) : [];

  const potLine = summaryLines.find((l) => l.startsWith("Total pot"));
  const potMatch = potLine?.match(/^Total pot (\d+)(?: \| Rake (\d+))?/);
  const totalPot = potMatch ? Number(potMatch[1]) : 0;
  const rake = potMatch?.[2] ? Number(potMatch[2]) : 0;

  const boardLine = summaryLines.find((l) => l.startsWith("Board ["));
  const boardMatch = boardLine?.match(/^Board \[([^\]]+)\]$/);
  // Board final vem prioritariamente do SUMMARY (fonte mais confiavel);
  // cai pro board acumulado por rua so se o SUMMARY nao tiver a linha.
  const finalBoard = boardMatch
    ? boardMatch[1].split(" ")
    : boardByStreet.river ?? boardByStreet.turn ?? boardByStreet.flop ?? [];

  return {
    site: "pokerstars",
    handId,
    tournamentId,
    buyIn,
    gameType: "Hold'em No Limit",
    level,
    smallBlind: Number(sbStr),
    bigBlind: Number(bbStr),
    maxSeats: Number(maxSeatsStr),
    buttonSeat: Number(buttonSeatStr),
    rawTimestamp,
    seats,
    heroName,
    heroCards,
    actions,
    boardByStreet,
    finalBoard,
    totalPot,
    rake,
    raw,
  };
}
