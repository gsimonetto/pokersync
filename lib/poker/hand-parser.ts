// Parser de hand history — agora BILINGUE (ingles + portugues do cliente
// PokerStars). Motivo (2026-08): mao real de usuario em PT-BR quebrava a
// deteccao de torneio ("Torneio #" vs "Tournament #") e, mais grave, o
// parser inteiro (assentos, acoes, blinds) nao reconhecia nada do formato
// PT-BR — a mesa simplesmente nao montava.
//
// Vocabulario PT-BR observado num hand history real (PokerStars client em
// portugues) vs EN:
//   "Seat X:" / "Lugar X:"           "posts small blind" / "paga o small blind"
//   "raises X to Y" / "aumenta X para Y"    "folds" / "desiste"
//   "checks" / "passa"               "calls" / "iguala"      "bets" / "aposta"
//   "Dealt to X [..]" / "X recebe [..]" (nome+cartas na MESMA linha em PT)
//   "*** HOLE CARDS ***" / "*** CARTAS DA MÃO ***"
//   "*** SUMMARY ***" / "*** SUMÁRIO ***"
//   "collected" / "recebeu"          "Table" / "Mesa"        "button" / "botão"
// Marcadores de rua (FLOP/TURN/RIVER/SHOW DOWN) permanecem em ingles mesmo
// no client PT-BR — confirmado em hand history real, nao sao traduzidos.
//
// Estrategia: cada regex de extracao vira uma alternancia (?:ingles|portugues)
// e, quando o token capturado precisa virar um valor CANONICO usado no resto
// do sistema (ex: ParsedAction.action so aceita "folds"|"checks"|"calls"|
// "bets"|"raises"|"posts"|"uncalled_return" — hand-replay-projector.ts faz
// switch nesses literais em ingles), o token e' normalizado via lookup table
// logo apos o match. Downstream nunca ve portugues.

export type PokerSite = "pokerstars" | "ggpoker" | "desconhecido";

export interface ParsedAction {
  player: string;
  action: string; // sempre um dos literais canonicos em ingles, independente do idioma de origem
  amount?: number;
  raiseTo?: number;
  isAllIn?: boolean;
}

export interface ParsedStreet {
  name: "preflop" | "flop" | "turn" | "river";
  board?: string[];
  actions: ParsedAction[];
}

export interface ParsedSeat {
  seatNumber: number;
  playerName: string;
  startingChips: number;
  isButton: boolean;
  isHero: boolean;
  // Presente so em torneios PKO/Mystery Bounty, quando o hand history lista
  // o bounty de cada jogador junto do stack ("... em fichas, Bounty de $ 50").
  // Usado pra ler o bounty do heroi automaticamente em vez de pedir manual.
  bountyValue?: number;
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
  format: string | null;
  stakes: string | null;
  heroName: string | null;
  heroCards: string[] | null;
  heroPosition: string | null;
  board: string[];
  pot: number | null;
  winner: string | null;
  streets: ParsedStreet[];
  rawText: string;
  seats: ParsedSeat[];
  buttonSeat: number | null;
  maxSeats: number | null;
  smallBlind: number | null;
  bigBlind: number | null;
  showdown: ParsedShowdown[];
}

export class HandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandParseError";
  }
}

function detectSite(text: string): PokerSite {
  if (/PokerStars Hand #|Mão PokerStars #/i.test(text)) return "pokerstars";
  if (/Poker Hand #|GGPoker Hand/i.test(text)) return "ggpoker";
  return "desconhecido";
}

// Divide um texto de sessao em blocos de maos individuais. Bilingue: aceita
// o inicio de mao tanto em ingles ("PokerStars Hand #") quanto em portugues
// ("Mão PokerStars #").
export function splitHands(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/(?=(?:PokerStars|GGPoker|Poker) Hand #|(?:Mão) (?:PokerStars|GGPoker|Poker) #)/gi)
    .map((p) => p.trim());
  return parts.filter(Boolean);
}

function parseCards(segment: string): string[] {
  const matches = segment.match(/[2-9TJQKA][cdhs]/g);
  return matches ?? [];
}

// Normaliza a palavra de acao (EN ou PT) pro literal canonico usado no
// resto do sistema. hand-replay-projector.ts e outros consumidores fazem
// switch/comparacao direta com esses literais em ingles.
const ACTION_WORD_MAP: Record<string, string> = {
  folds: "folds",
  desiste: "folds",
  checks: "checks",
  passa: "checks",
  calls: "calls",
  iguala: "calls",
  bets: "bets",
  aposta: "bets",
  allin: "allin",
  "all-in": "allin",
};

function extractHeroName(text: string): string | null {
  const en = text.match(/Dealt to (\S+)/i);
  if (en) return en[1];
  // PT-BR: nome e cartas vem na MESMA linha ("simoNetto11 recebe [4c 2h]"),
  // nao ha linha "Dealt to" separada. Ancorado no inicio de linha pra nao
  // confundir com outras ocorrencias da palavra "recebe" (ex: "recebeu" no
  // sumario usa palavra diferente, mas por seguranca a ancora de linha evita
  // falso-positivo em qualquer texto livre).
  const pt = text.match(/^(\S+) recebe \[/m);
  return pt ? pt[1] : null;
}

function extractHeroCards(text: string, heroName: string | null): string[] | null {
  if (!heroName) return null;
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const en = text.match(new RegExp(`Dealt to ${escaped} \\[([^\\]]+)\\]`, "i"));
  if (en) return parseCards(en[1]);
  const pt = text.match(new RegExp(`^${escaped} recebe \\[([^\\]]+)\\]`, "m"));
  if (pt) return parseCards(pt[1]);
  return null;
}

function extractBoardByStreet(text: string) {
  // Marcadores de rua permanecem em ingles mesmo no client PT-BR.
  const flopM = text.match(/\*\*\* FLOP \*\*\*\s*\[([^\]]+)\]/i);
  const turnM = text.match(/\*\*\* TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
  const riverM = text.match(/\*\*\* RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
  const flop = flopM ? parseCards(flopM[1]) : [];
  const turn = turnM ? parseCards(turnM[1]) : [];
  const river = riverM ? parseCards(riverM[1]) : [];
  return { flop, turn, river, board: [...flop, ...turn, ...river] };
}

// Bilingue: reconhece "posts"/"paga o"/"coloca", "raises...to"/"aumenta...
// para", "folds/checks/calls/bets"/"desiste/passa/iguala/aposta", e o
// "Uncalled bet...returned"/"Aposta não-igualada...voltou". Cada palavra de
// acao e' normalizada via ACTION_WORD_MAP antes de virar ParsedAction.
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
  const lines = block.split("\n").slice(1);
  for (const rawLine of lines) {
    const l = rawLine.trim();
    if (!l) continue;

    const uncalledM = l.match(
      /^(?:Uncalled bet|Aposta não-igualada) \(\$?([\d.,]+)\) (?:returned to|voltou para) (.+)$/i
    );
    if (uncalledM) {
      actions.push({
        player: uncalledM[2],
        action: "uncalled_return",
        amount: Number(uncalledM[1].replace(",", "")),
      });
      continue;
    }

    const raiseM = l.match(/^(\S+):\s+(?:raises|aumenta)\s+\$?([\d.,]+)\s+(?:to|para)\s+\$?([\d.,]+)/i);
    if (raiseM) {
      actions.push({
        player: raiseM[1],
        action: "raises",
        amount: Number(raiseM[2].replace(",", "")),
        raiseTo: Number(raiseM[3].replace(",", "")),
        isAllIn: /and is all-in|e está all-in/i.test(l),
      });
      continue;
    }

    // PT-BR usa verbo diferente pra ante ("coloca ante X") vs blind ("paga
    // o small/big blind X") — alternancia cobre os dois em um so regex.
    const postM = l.match(/^(\S+):\s+(?:posts|paga o|coloca)\s+(small blind|big blind|ante)\s+\$?([\d.,]+)/i);
    if (postM) {
      actions.push({
        player: postM[1],
        action: "posts",
        amount: Number(postM[3].replace(",", "")),
      });
      continue;
    }

    const genericM = l.match(
      /^(\S+):\s+(folds|checks|calls|bets|allin|all-in|desiste|passa|iguala|aposta)\s*(?:\$?([\d.,]+))?/i
    );
    if (genericM) {
      const canonical = ACTION_WORD_MAP[genericM[2].toLowerCase()] ?? genericM[2].toLowerCase();
      actions.push({
        player: genericM[1],
        action: canonical,
        amount: genericM[3] ? Number(genericM[3].replace(",", "")) : undefined,
        isAllIn: /and is all-in|e está all-in/i.test(l),
      });
      continue;
    }
  }
  return { name: streetName, actions };
}

function extractPot(text: string): number | null {
  const m = text.match(/Total (?:pot|pote) \$?([\d.,]+)/i);
  return m ? Number(m[1].replace(",", "")) : null;
}

function extractWinner(text: string): string | null {
  const m = text.match(/(\S+) (?:collected|recebeu) \$?[\d.,]+/i);
  return m ? m[1] : null;
}

function extractStakes(text: string): string | null {
  const m = text.match(/\(\$?([\d.,]+\/\$?[\d.,]+)\)/);
  return m ? m[1] : null;
}

function extractBlinds(text: string): { smallBlind: number | null; bigBlind: number | null } {
  const m = text.match(/\(\$?([\d.,]+)\/\$?([\d.,]+)\)/);
  if (!m) return { smallBlind: null, bigBlind: null };
  return { smallBlind: Number(m[1].replace(",", "")), bigBlind: Number(m[2].replace(",", "")) };
}

function extractFormat(text: string): string | null {
  if (/Tournament|Torneio/i.test(text)) return "MTT";
  if (/Zoom|Hold'em No Limit/i.test(text) && !/Tournament|Torneio/i.test(text)) return "Cash";
  return null;
}

function extractShowdown(text: string): ParsedShowdown[] {
  const startIdx = text.search(/\*\*\* SHOW ?DOWN \*\*\*/i);
  if (startIdx === -1) return [];
  const summaryIdx = text.search(/\*\*\* (?:SUMMARY|SUM[AÁ]RIO) \*\*\*/i);
  const block = summaryIdx === -1 ? text.slice(startIdx) : text.slice(startIdx, summaryIdx);

  const results: ParsedShowdown[] = [];
  for (const rawLine of block.split("\n")) {
    const l = rawLine.trim();
    const m = l.match(/^(\S+):\s+(?:shows|mostra)\s+\[([^\]]+)\]\s+\(([^)]+)\)/i);
    if (m) {
      results.push({ player: m[1], cards: parseCards(m[2]), handDescription: m[3] });
    }
  }
  return results;
}

// "#123456:" aparece logo apos o site em ambos os idiomas ("PokerStars Hand
// #X:" / "Mão PokerStars #X:") — ancorar no "#...:" e' mais robusto que
// tentar casar a palavra "Hand"/"Mão" isoladamente. So a Tournament/Torneio
// line usa "#X," (virgula, nao dois-pontos), entao nao ha colisao.
function extractHandId(text: string): string | null {
  const m = text.match(/#(\w+):/);
  return m ? m[1] : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(\d{4}\/\d{2}\/\d{2}[^\n]*)/);
  return m ? m[1].trim() : null;
}

function extractHeroPosition(text: string, heroName: string | null): string | null {
  if (!heroName) return null;
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "(button)" so e' traduzido pra "(Botão)" no client PT-BR — small/big
  // blind permanecem em ingles mesmo la, confirmado em hand history real.
  if (new RegExp(`${escaped}.*\\((?:button|Botão)\\)`, "i").test(text)) return "BTN";
  if (new RegExp(`${escaped}.*\\(small blind\\)`, "i").test(text)) return "SB";
  if (new RegExp(`${escaped}.*\\(big blind\\)`, "i").test(text)) return "BB";
  return null;
}

// Seat/Lugar + em torneios PKO/Mystery Bounty PT-BR, sufixo ", Bounty de $ X"
// junto do stack — capturado no grupo 4 (opcional) pra alimentar o bounty
// automatico do heroi sem precisar digitar manual.
function extractSeats(
  text: string,
  heroName: string | null
): { seats: ParsedSeat[]; buttonSeat: number | null; maxSeats: number | null } {
  const tableM = text.match(/(?:Table|Mesa) '[^']+' (\d+)-max (?:Seat|Lugar) #(\d+) (?:is the button|é o botão)/i);
  const maxSeats = tableM ? Number(tableM[1]) : null;
  const buttonSeat = tableM ? Number(tableM[2]) : null;

  const seats: ParsedSeat[] = [];
  const seatRegex =
    /^(?:Seat|Lugar) (\d+): (.+?) \(\$?([\d.,]+) (?:in chips|em fichas)(?:,\s*Bounty (?:of|de) \$ ?([\d.,]+))?\)/gim;
  let m: RegExpExecArray | null;
  while ((m = seatRegex.exec(text)) !== null) {
    const seatNumber = Number(m[1]);
    seats.push({
      seatNumber,
      playerName: m[2],
      startingChips: Number(m[3].replace(",", "")),
      isButton: buttonSeat === seatNumber,
      isHero: heroName ? m[2] === heroName : false,
      bountyValue: m[4] ? Number(m[4].replace(",", "")) : undefined,
    });
  }

  return { seats, buttonSeat, maxSeats };
}

// Posts de blind/ante ANTES de "*** HOLE CARDS ***"/"*** CARTAS DA MÃO ***"
// — mesma logica bilingue de extractStreetActions, mas so pro trecho antes
// do marcador (esses posts nunca sao alcancados pelo scan de preflop normal).
function extractPreambleBlindActions(text: string): ParsedAction[] {
  const holeCardsIdx = text.search(/\*\*\* (?:HOLE CARDS|CARTAS DA MÃO) \*\*\*/i);
  const preamble = holeCardsIdx === -1 ? text : text.slice(0, holeCardsIdx);
  const actions: ParsedAction[] = [];
  for (const rawLine of preamble.split("\n")) {
    const l = rawLine.trim();
    const postM = l.match(/^(\S+):\s+(?:posts|paga o|coloca)\s+(small blind|big blind|ante)\s+\$?([\d.,]+)/i);
    if (postM) {
      actions.push({ player: postM[1], action: "posts", amount: Number(postM[3].replace(",", "")) });
    }
  }
  return actions;
}

export function parseHand(rawText: string): ParsedHand {
  const site = detectSite(rawText);
  const heroName = extractHeroName(rawText);
  const { flop, turn, river, board } = extractBoardByStreet(rawText);
  const { seats, buttonSeat, maxSeats } = extractSeats(rawText, heroName);
  const { smallBlind, bigBlind } = extractBlinds(rawText);

  const holeCardsMarker = /\*\*\* (?:HOLE CARDS|CARTAS DA MÃO) \*\*\*/i;
  const flopMarker = /\*\*\* FLOP \*\*\*/i;
  const turnMarker = /\*\*\* TURN \*\*\*/i;
  const riverMarker = /\*\*\* RIVER \*\*\*/i;
  const showdownMarker = /\*\*\* SHOW ?DOWN \*\*\*/i;

  const streets: ParsedStreet[] = [];
  const blindActions = extractPreambleBlindActions(rawText);
  const preflop = extractStreetActions(rawText, "preflop", holeCardsMarker, flopMarker);
  if (preflop) {
    streets.push({ ...preflop, board: [], actions: [...blindActions, ...preflop.actions] });
  } else if (blindActions.length) {
    streets.push({ name: "preflop", board: [], actions: blindActions });
  }
  const flopSt = extractStreetActions(rawText, "flop", flopMarker, turnMarker);
  if (flopSt) streets.push({ ...flopSt, board: flop });
  const turnSt = extractStreetActions(rawText, "turn", turnMarker, riverMarker);
  if (turnSt) streets.push({ ...turnSt, board: [...flop, ...turn] });
  const riverSt = extractStreetActions(rawText, "river", riverMarker, showdownMarker);
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

export function parseSession(rawText: string): ParsedHand[] {
  const blocks = splitHands(rawText);
  if (blocks.length === 0) return [];
  return blocks.map(parseHand);
}

export function validateParsedHand(hand: ParsedHand): void {
  if (hand.site === "ggpoker") {
    throw new HandParseError(
      "Hand history do GGPoker detectado, mas o parser ainda não foi validado contra um exemplo real desse formato — os campos podem sair errados. Hoje só garantimos PokerStars."
    );
  }
  if (hand.seats.length === 0) {
    throw new HandParseError("Não foi possível identificar os jogadores da mesa (linhas 'Seat'/'Lugar').");
  }
  if (hand.buttonSeat === null || hand.maxSeats === null) {
    throw new HandParseError("Não foi possível identificar a mesa (linha 'Table'/'Mesa' ... é o botão).");
  }
  if (hand.heroName && !hand.heroCards) {
    throw new HandParseError("Hero identificado, mas as cartas não foram reconhecidas.");
  }
  if (/\*\*\* FLOP \*\*\*/i.test(hand.rawText) && hand.board.length === 0) {
    throw new HandParseError("A mão tem um Flop no texto, mas o board não foi reconhecido.");
  }
}
