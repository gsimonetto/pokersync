// Parser de hand history — versao inicial, deliberadamente simples.
// Cobre o essencial de PokerStars e GGPoker: cartas do heroi, board,
// posicoes, acoes por street, pote e vencedor. Evolui conforme o uso real
// revelar variacoes de formato nao cobertas aqui.

export type PokerSite = "pokerstars" | "ggpoker" | "desconhecido";

export interface ParsedAction {
  player: string;
  action: string; // "fold" | "call" | "raise" | "bet" | "check" | "allin" etc.
  amount?: number;
  // Presente so em "raises X to Y" — Y e' o total da rua pro jogador,
  // nao o incremento. Necessario pra reconstruir o pote certo.
  raiseTo?: number;
  isAllIn?: boolean;
}

export interface ParsedStreet {
  name: "preflop" | "flop" | "turn" | "river";
  board?: string[]; // cartas visiveis nessa street (flop tem 3, turn adiciona 1, river adiciona 1)
  actions: ParsedAction[];
}

// Assento fisico na mesa — necessario pro layout de cadeiras do replay
// (rotacionar a mesa pra sempre mostrar o hero embaixo, com o rotulo de
// posicao real de cada jogador). Vem das linhas "Seat N: Nome (X in chips)"
// e "Seat #B is the button".
export interface ParsedSeat {
  seatNumber: number;
  playerName: string;
  startingChips: number;
  isButton: boolean;
  isHero: boolean;
}

export interface ParsedShowdown {
  player: string;
  cards: string[];
  handDescription: string;
}

export interface ParsedHand {
  site: PokerSite;
  handId: string | null;
  date: string | null;
  format: string | null; // "MTT" | "Cash" | "SNG" etc. quando detectavel
  stakes: string | null;
  heroName: string | null;
  heroCards: string[] | null;
  heroPosition: string | null;
  board: string[];
  pot: number | null;
  winner: string | null;
  streets: ParsedStreet[];
  rawText: string;
  // Adicionados para suportar o motor de replay (mesa real, nao so texto):
  seats: ParsedSeat[];
  buttonSeat: number | null;
  maxSeats: number | null;
  smallBlind: number | null;
  bigBlind: number | null;
  // Cartas reveladas no showdown (nunca ficam em nenhuma street — a
  // secao "*** SHOW DOWN ***" vem depois da ultima rua). Necessario pra
  // revelar as cartas do vilao no replay.
  showdown: ParsedShowdown[];
}

export class HandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandParseError";
  }
}

function detectSite(text: string): PokerSite {
  if (/PokerStars Hand #/i.test(text)) return "pokerstars";
  if (/Poker Hand #|GGPoker Hand/i.test(text)) return "ggpoker";
  return "desconhecido";
}

// Divide um texto de sessao em blocos de maos individuais.
// PokerStars e GGPoker sempre iniciam uma nova mao com "...Hand #<id>...".
export function splitHands(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?=(?:PokerStars|GGPoker|Poker) Hand #)/gi).map((p) => p.trim());
  return parts.filter(Boolean);
}

function parseCards(segment: string): string[] {
  const matches = segment.match(/[2-9TJQKA][cdhs]/g);
  return matches ?? [];
}

function extractHeroName(text: string): string | null {
  const m = text.match(/Dealt to (\S+)/i);
  return m ? m[1] : null;
}

function extractHeroCards(text: string, heroName: string | null): string[] | null {
  if (!heroName) return null;
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`Dealt to ${escaped} \\[([^\\]]+)\\]`, "i"));
  if (!m) return null;
  return parseCards(m[1]);
}

function extractBoardByStreet(text: string) {
  const flopM = text.match(/\*\*\* FLOP \*\*\*\s*\[([^\]]+)\]/i);
  const turnM = text.match(/\*\*\* TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
  const riverM = text.match(/\*\*\* RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
  const flop = flopM ? parseCards(flopM[1]) : [];
  const turn = turnM ? parseCards(turnM[1]) : [];
  const river = riverM ? parseCards(riverM[1]) : [];
  return { flop, turn, river, board: [...flop, ...turn, ...river] };
}

// Reescrito pra capturar o que a versao anterior deixava passar: valor
// de "posts small/big blind X" (antes o regex parava em "posts" e nao
// pulava "small blind" pra achar o numero), o total de "raises X to Y"
// (antes so pegava X, o incremento — nao dava pra reconstruir pote certo
// com isso), a flag "and is all-in", e a linha "Uncalled bet (X) returned
// to Player" (antes ignorada — pote ficava inflado sem isso).
function extractStreetActions(
  text: string,
  streetName: ParsedStreet["name"],
  marker: RegExp,
  nextMarker: RegExp | null
): { name: ParsedStreet["name"]; actions: ParsedAction[] } | null {
  const start = text.search(marker);
  if (start === -1) return null;
  const afterStart = text.slice(start);
  const end = nextMarker ? afterStart.search(nextMarker) : -1;
  const block = end === -1 ? afterStart : afterStart.slice(0, end);

  const actions: ParsedAction[] = [];
  const lines = block.split("\n").slice(1); // pula a linha do marcador
  for (const rawLine of lines) {
    const l = rawLine.trim();
    if (!l) continue;

    const uncalledM = l.match(/^Uncalled bet \(\$?([\d.,]+)\) returned to (.+)$/i);
    if (uncalledM) {
      actions.push({
        player: uncalledM[2],
        action: "uncalled_return",
        amount: Number(uncalledM[1].replace(",", "")),
      });
      continue;
    }

    const raiseM = l.match(/^(\S+):\s+raises\s+\$?([\d.,]+)\s+to\s+\$?([\d.,]+)/i);
    if (raiseM) {
      actions.push({
        player: raiseM[1],
        action: "raises",
        amount: Number(raiseM[2].replace(",", "")),
        raiseTo: Number(raiseM[3].replace(",", "")),
        isAllIn: /and is all-in/i.test(l),
      });
      continue;
    }

    const postM = l.match(/^(\S+):\s+posts\s+(small blind|big blind|ante)\s+\$?([\d.,]+)/i);
    if (postM) {
      actions.push({
        player: postM[1],
        action: "posts",
        amount: Number(postM[3].replace(",", "")),
      });
      continue;
    }

    const genericM = l.match(/^(\S+):\s+(folds|checks|calls|bets|allin|all-in)\s*(?:\$?([\d.,]+))?/i);
    if (genericM) {
      actions.push({
        player: genericM[1],
        action: genericM[2].toLowerCase(),
        amount: genericM[3] ? Number(genericM[3].replace(",", "")) : undefined,
        isAllIn: /and is all-in/i.test(l),
      });
      continue;
    }
  }
  return { name: streetName, actions };
}

function extractPot(text: string): number | null {
  const m = text.match(/Total pot \$?([\d.,]+)/i);
  return m ? Number(m[1].replace(",", "")) : null;
}

function extractWinner(text: string): string | null {
  const m = text.match(/(\S+) collected \$?[\d.,]+/i);
  return m ? m[1] : null;
}

function extractStakes(text: string): string | null {
  const m = text.match(/\(\$?([\d.,]+\/\$?[\d.,]+)\)/);
  return m ? m[1] : null;
}

// Cobre torneio ("Level V (40/80)") e cash ("($0.01/$0.02)") — o "(X/Y)"
// logo apos o nivel/formato do jogo e' sempre o par de blinds.
function extractBlinds(text: string): { smallBlind: number | null; bigBlind: number | null } {
  const m = text.match(/\(\$?([\d.,]+)\/\$?([\d.,]+)\)/);
  if (!m) return { smallBlind: null, bigBlind: null };
  return { smallBlind: Number(m[1].replace(",", "")), bigBlind: Number(m[2].replace(",", "")) };
}

function extractFormat(text: string): string | null {
  if (/Tournament/i.test(text)) return "MTT";
  if (/Zoom|Hold'em No Limit/i.test(text) && !/Tournament/i.test(text)) return "Cash";
  return null;
}

// "shows [cartas] (descricao)" fica depois de "*** SHOW DOWN ***", que
// e' depois da ultima street — extractStreetActions nunca alcanca essa
// regiao. Sem isso, o replay nao tem como saber quais cartas do vilao
// revelar.
function extractShowdown(text: string): ParsedShowdown[] {
  const startIdx = text.search(/\*\*\* SHOW ?DOWN \*\*\*/i);
  if (startIdx === -1) return [];
  const summaryIdx = text.search(/\*\*\* SUMMARY \*\*\*/i);
  const block = summaryIdx === -1 ? text.slice(startIdx) : text.slice(startIdx, summaryIdx);

  const results: ParsedShowdown[] = [];
  for (const rawLine of block.split("\n")) {
    const l = rawLine.trim();
    const m = l.match(/^(\S+):\s+shows\s+\[([^\]]+)\]\s+\(([^)]+)\)/i);
    if (m) {
      results.push({ player: m[1], cards: parseCards(m[2]), handDescription: m[3] });
    }
  }
  return results;
}

function extractHandId(text: string): string | null {
  const m = text.match(/Hand #(\w+)/i);
  return m ? m[1] : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(\d{4}\/\d{2}\/\d{2}[^\n]*)/);
  return m ? m[1].trim() : null;
}

function extractHeroPosition(text: string, heroName: string | null): string | null {
  if (!heroName) return null;
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`${escaped}.*\\(button\\)`, "i").test(text)) return "BTN";
  if (new RegExp(`${escaped}.*\\(small blind\\)`, "i").test(text)) return "SB";
  if (new RegExp(`${escaped}.*\\(big blind\\)`, "i").test(text)) return "BB";
  return null;
}

// Le "Table '...' N-max Seat #B is the button" + todas as linhas
// "Seat X: Nome (Y in chips)". Necessario pro layout de mesa do replay
// (computeRealSeatLayout) — sem isso nao da pra saber quantos jogadores
// tinham na mao nem onde cada um sentava.
function extractSeats(text: string, heroName: string | null): { seats: ParsedSeat[]; buttonSeat: number | null; maxSeats: number | null } {
  const tableM = text.match(/Table '[^']+' (\d+)-max Seat #(\d+) is the button/i);
  const maxSeats = tableM ? Number(tableM[1]) : null;
  const buttonSeat = tableM ? Number(tableM[2]) : null;

  const seats: ParsedSeat[] = [];
  const seatRegex = /^Seat (\d+): (.+?) \(\$?([\d.,]+) in chips\)$/gim;
  let m: RegExpExecArray | null;
  while ((m = seatRegex.exec(text)) !== null) {
    const seatNumber = Number(m[1]);
    seats.push({
      seatNumber,
      playerName: m[2],
      startingChips: Number(m[3].replace(",", "")),
      isButton: buttonSeat === seatNumber,
      isHero: heroName ? m[2] === heroName : false,
    });
  }

  return { seats, buttonSeat, maxSeats };
}

// Os posts de small/big blind (e ante, quando existe) ficam ANTES de
// "*** HOLE CARDS ***" no texto — extractStreetActions("preflop", ...)
// nao alcanca essa regiao. Sem isso, o pote reconstruido no replay
// ficava faltando exatamente o valor dos blinds. Extraido a parte e
// prependido as acoes de preflop dentro de parseHand.
function extractPreambleBlindActions(text: string): ParsedAction[] {
  const holeCardsIdx = text.search(/\*\*\* HOLE CARDS \*\*\*/i);
  const preamble = holeCardsIdx === -1 ? text : text.slice(0, holeCardsIdx);
  const actions: ParsedAction[] = [];
  for (const rawLine of preamble.split("\n")) {
    const l = rawLine.trim();
    const postM = l.match(/^(\S+):\s+posts\s+(small blind|big blind|ante)\s+\$?([\d.,]+)/i);
    if (postM) {
      actions.push({ player: postM[1], action: "posts", amount: Number(postM[3].replace(",", "")) });
    }
  }
  return actions;
}

// Parseia uma unica mao (assume que ja foi separada via splitHands quando aplicavel).
export function parseHand(rawText: string): ParsedHand {
  const site = detectSite(rawText);
  const heroName = extractHeroName(rawText);
  const { flop, turn, river, board } = extractBoardByStreet(rawText);
  const { seats, buttonSeat, maxSeats } = extractSeats(rawText, heroName);
  const { smallBlind, bigBlind } = extractBlinds(rawText);

  const streets: ParsedStreet[] = [];
  const blindActions = extractPreambleBlindActions(rawText);
  const preflop = extractStreetActions(rawText, "preflop", /\*\*\* HOLE CARDS \*\*\*/i, /\*\*\* FLOP \*\*\*/i);
  if (preflop) {
    streets.push({ ...preflop, board: [], actions: [...blindActions, ...preflop.actions] });
  } else if (blindActions.length) {
    streets.push({ name: "preflop", board: [], actions: blindActions });
  }
  const flopSt = extractStreetActions(rawText, "flop", /\*\*\* FLOP \*\*\*/i, /\*\*\* TURN \*\*\*/i);
  if (flopSt) streets.push({ ...flopSt, board: flop });
  const turnSt = extractStreetActions(rawText, "turn", /\*\*\* TURN \*\*\*/i, /\*\*\* RIVER \*\*\*/i);
  if (turnSt) streets.push({ ...turnSt, board: [...flop, ...turn] });
  const riverSt = extractStreetActions(rawText, "river", /\*\*\* RIVER \*\*\*/i, /\*\*\* SHOW ?DOWN \*\*\*/i);
  if (riverSt) streets.push({ ...riverSt, board: [...flop, ...turn, ...river] });

  return {
    site,
    handId: extractHandId(rawText),
    date: extractDate(rawText),
    format: extractFormat(rawText),
    stakes: extractStakes(rawText),
    heroName,
    heroCards: extractHeroCards(rawText, heroName),
    heroPosition: extractHeroPosition(rawText, heroName),
    board,
    pot: extractPot(rawText),
    winner: extractWinner(rawText),
    streets,
    rawText,
    seats,
    buttonSeat,
    maxSeats,
    smallBlind,
    bigBlind,
    showdown: extractShowdown(rawText),
  };
}

// Parseia um texto que pode conter 1 ou varias maos (sessao inteira).
export function parseSession(rawText: string): ParsedHand[] {
  const blocks = splitHands(rawText);
  if (blocks.length === 0) return [];
  return blocks.map(parseHand);
}

// Validacao pos-parse — NAO e' chamada automaticamente dentro de
// parseHand/parseSession (usados hoje no import em lote, onde e' melhor
// pular uma mao ruim e seguir com as boas do que travar o lote inteiro).
// Use explicitamente em fluxos de mao unica (ex: colar no Modo Treino)
// onde uma mao mal-parseada nao pode seguir silenciosamente.
export function validateParsedHand(hand: ParsedHand): void {
  if (hand.site === "ggpoker") {
    throw new HandParseError(
      "Hand history do GGPoker detectado, mas o parser ainda não foi validado contra um exemplo real desse formato — os campos podem sair errados. Hoje só garantimos PokerStars."
    );
  }
  if (hand.seats.length === 0) {
    throw new HandParseError("Não foi possível identificar os jogadores da mesa (linhas 'Seat').");
  }
  if (hand.buttonSeat === null || hand.maxSeats === null) {
    throw new HandParseError("Não foi possível identificar a mesa (linha 'Table ... is the button').");
  }
  if (hand.heroName && !hand.heroCards) {
    throw new HandParseError("Hero identificado, mas as cartas não foram reconhecidas.");
  }
  if (/\*\*\* FLOP \*\*\*/i.test(hand.rawText) && hand.board.length === 0) {
    throw new HandParseError("A mão tem um Flop no texto, mas o board não foi reconhecido.");
  }
}
