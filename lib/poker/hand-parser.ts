// Parser de hand history — versao inicial, deliberadamente simples.
// Cobre o essencial de PokerStars e GGPoker: cartas do heroi, board,
// posicoes, acoes por street, pote e vencedor. Evolui conforme o uso real
// revelar variacoes de formato nao cobertas aqui.

export type PokerSite = "pokerstars" | "ggpoker" | "desconhecido";

export interface ParsedAction {
  player: string;
  action: string; // "fold" | "call" | "raise" | "bet" | "check" | "allin" etc.
  amount?: number;
}

export interface ParsedStreet {
  name: "preflop" | "flop" | "turn" | "river";
  board?: string[]; // cartas visiveis nessa street (flop tem 3, turn adiciona 1, river adiciona 1)
  actions: ParsedAction[];
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

function extractStreetActions(text: string, streetName: ParsedStreet["name"], marker: RegExp, nextMarker: RegExp | null) {
  const start = text.search(marker);
  if (start === -1) return null;
  const afterStart = text.slice(start);
  const end = nextMarker ? afterStart.search(nextMarker) : -1;
  const block = end === -1 ? afterStart : afterStart.slice(0, end);

  const actions: ParsedAction[] = [];
  const lines = block.split("\n").slice(1); // pula a linha do marcador
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(
      /^(\S+):\s+(folds|checks|calls|bets|raises|posts|allin|all-in)\s*(?:\$?([\d.,]+))?/i
    );
    if (m) {
      actions.push({
        player: m[1],
        action: m[2].toLowerCase(),
        amount: m[3] ? Number(m[3].replace(",", "")) : undefined,
      });
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

function extractFormat(text: string): string | null {
  if (/Tournament/i.test(text)) return "MTT";
  if (/Zoom|Hold'em No Limit/i.test(text) && !/Tournament/i.test(text)) return "Cash";
  return null;
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

// Parseia uma unica mao (assume que ja foi separada via splitHands quando aplicavel).
export function parseHand(rawText: string): ParsedHand {
  const site = detectSite(rawText);
  const heroName = extractHeroName(rawText);
  const { flop, turn, river, board } = extractBoardByStreet(rawText);

  const streets: ParsedStreet[] = [];
  const preflop = extractStreetActions(rawText, "preflop", /\*\*\* HOLE CARDS \*\*\*/i, /\*\*\* FLOP \*\*\*/i);
  if (preflop) streets.push({ ...preflop, board: [] });
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
  };
}

// Parseia um texto que pode conter 1 ou varias maos (sessao inteira).
export function parseSession(rawText: string): ParsedHand[] {
  const blocks = splitHands(rawText);
  if (blocks.length === 0) return [];
  return blocks.map(parseHand);
}
