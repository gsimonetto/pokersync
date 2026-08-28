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
  // Posicao de TODOS os assentos (nao so do heroi), calculada por
  // assignSeatPositions a partir do buttonSeat + quantidade de jogadores
  // ativos na mao. Null quando o motor nao suporta aquele numero de
  // assentos (fora de 2-9) ou o buttonSeat nao foi identificado.
  position: string | null;
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
  // Detectado direto do texto da mao (PokerStars escreve essa frase na
  // ultima mao do torneio, quando so sobra 1 jogador com fichas). Usado
  // pra disparar a animacao de campeao no Revisor — nao e' um calculo
  // nosso de stacks remanescentes (nao confiavel sem o historico
  // completo de eliminacoes do torneio), e' o proprio site confirmando.
  wonTournament: boolean;
  // Posicao final do heroi no torneio, quando a mao em questao e' a mao
  // em que ele foi eliminado ("PlayerX finished the tournament in Nth
  // place"). Null quando a mao nao e' uma eliminacao do heroi (imensa
  // maioria das maos) ou quando ele venceu (nesse caso o sinal e'
  // wonTournament, nao essa frase). Usado pra badge de 2o/3o lugar e "FT"
  // na lista de torneios.
  heroFinishPlace: number | null;
  // Matchup de posicao — SO preenchido quando exatamente 2 jogadores
  // chegam vivos ao flop (heroi + 1 villain). Com 3+ jogadores no flop
  // nao existe um "IP/OOP" unico valido, entao fica null de proposito
  // em vez de arriscar um numero errado.
  villainPosition: string | null;
  heroInPosition: boolean | null;
  postflopTags: PostflopTags;
  preflopTags: PreflopTags;
}

// ------------------------------------------------------------
// Tags pre-flop do Spot Analyzer. Definicoes (mesmo padrao de
// mercado usado por trackers):
//   - RFI (raise first in) = 1o raise da mao, ninguem tinha entrado
//     com call antes (so folds/blinds).
//   - Steal attempt = RFI vindo de CO/BTN/SB (posicoes classicas de
//     roubo de blind).
//   - Steal success = steal attempt em que ninguem deu call/raise
//     depois — ganhou os blinds sem disputa.
//   - Fold/call/4-bet vs 3-bet = heroi deu o RFI, alguem 3-betou
//     (2o raise), o que o heroi fez em seguida.
//   - Defesa de blind = heroi em SB/BB, enfrentando exatamente 1
//     raise (o open) quando chega a vez dele — calls ou raises conta
//     como defendeu, fold conta como nao defendeu.
//   - Re-steal = heroi da o 2o raise (3-bet) direto em cima de um
//     steal attempt do oponente, sem ninguem dar call no meio.
//   - Squeeze = heroi da um raise que NAO e' o 1o, com pelo menos um
//     call de outro jogador entre o raise anterior e o do heroi.
// ------------------------------------------------------------
export interface PreflopTags {
  heroOpenRaise: boolean;
  stealAttempt: boolean;
  stealSuccess: boolean;
  heroFacedThreeBet: boolean;
  heroFoldToThreeBet: boolean;
  heroCallThreeBet: boolean;
  heroMade4Bet: boolean;
  heroFaced4Bet: boolean;
  heroFoldTo4Bet: boolean;
  blindDefenseOpportunity: boolean;
  blindDefended: boolean;
  reSteal: boolean;
  squeeze: boolean;
}

// ------------------------------------------------------------
// Tags pos-flop do Spot Analyzer. Definicoes (padrao de mercado, mesmo
// usado por trackers como PokerTracker/Hold'em Manager):
//   - PFA (preflop aggressor) = quem deu o ultimo raise no preflop.
//     Mao sem raise nenhum (limped pot) nao tem PFA.
//   - cbet = PFA aposta primeiro na rua seguinte (accao 'bets' so
//     acontece quando ninguem apostou antes na mesma rua — nao precisa
//     ser literalmente a 1a acao da rua, checks antes nao desqualificam).
//   - donk bet = NAO-PFA aposta primeiro numa rua onde existe PFA.
//   - check-raise = heroi checa e depois, na MESMA rua, da um raise.
//   - fold pra cbet = heroi nao e' PFA, o PFA da cbet no flop, heroi
//     desiste no flop depois disso.
// "Float" e "probe bet" ficaram de fora — as definicoes de mercado pra
// esses dois exigem inferir INTENCAO (blefar pra depois roubar, ou
// testar fraqueza), nao so a sequencia de acoes, e qualquer proxy que
// a gente escolhesse ia arriscar rotular errado. Preferimos nao ter a
// tag a ter uma tag que mente.
// ------------------------------------------------------------
export interface PostflopTags {
  isPreflopAggressor: boolean;
  cbetFlop: boolean;
  cbetTurn: boolean;
  doubleBarrel: boolean;
  tripleBarrel: boolean;
  donkBetFlop: boolean;
  checkRaise: boolean;
  foldToCbetFlop: boolean;
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
    // Blinds mortos (jogador voltou de ausencia e deve blind atrasada)
    // aparecem como "posts dead blind X" (linha separada, ex: GGPoker) ou
    // combinados numa linha so, "posts small & big blind X" (PokerStars,
    // quando o jogador deve as duas). Sem esses dois padroes no regex, a
    // linha inteira era ignorada — o pote reconstruido ficava menor que o
    // total real da mao (falta o valor da blind morta) e a checagem de
    // sanidade no fim do replay (projectHandAtStep) lancava erro, impedindo
    // o evento de "award" de aparecer (pote nunca chegava a nenhum jogador).
    const postM = l.match(
      /^(\S+):\s+(?:posts|paga o|coloca)\s+(small blind|big blind|small & big blind|dead blind|ante)\s+\$?([\d.,]+)/i
    );
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

// PokerStars escreve essa linha SO na ultima mao de um torneio, quando
// um unico jogador fica com todas as fichas ("PlayerX wins the
// tournament"). Nao calculamos isso a partir de stacks — nao da pra
// confiar sem o historico completo de eliminacoes do torneio (mao
// avulsa nao mostra quem ja tinha sido eliminado antes). O client PT-BR
// nao teve essa frase especifica confirmada ainda contra um hand
// history real (mesma cautela ja aplicada ao parser do GGPoker) — a
// variante em portugues abaixo e' uma melhor-tentativa e deve ser
// validada assim que aparecer um exemplo real.
function extractWonTournament(text: string): boolean {
  return /wins the tournament|ganhou o torneio/i.test(text);
}

// Extrai a posicao final do HEROI quando a mao em questao e' a mao da
// eliminacao dele ("PlayerX finished the tournament in 4th place").
// MESMA CAUTELA do wonTournament acima: a variante em portugues e' uma
// melhor-tentativa (nao validada contra hand history real em PT-BR) —
// confirmar assim que aparecer um exemplo real, mesmo padrao ja aplicado
// ao parser do GGPoker. So retorna algo quando o nome capturado bate
// EXATAMENTE com heroName (eliminacao de outro jogador nao interessa
// aqui, ja aparece como oponente sumindo da mesa nas maos seguintes).
function extractHeroFinishPlace(text: string, heroName: string | null): number | null {
  if (!heroName) return null;
  const re = /(\S+) (?:finished the tournament in|terminou o torneio em) (\d+)(?:st|nd|rd|th|[ºª°])? (?:place|lugar)/i;
  const m = text.match(re);
  if (!m || m[1] !== heroName) return null;
  const place = Number(m[2]);
  return Number.isFinite(place) ? place : null;
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

// ------------------------------------------------------------
// Motor de posicoes por assento — cobre TODOS os jogadores da mao,
// nao so heroi/BTN/SB/BB (que e' tudo que extractHeroPosition acima
// consegue via regex direto no texto).
//
// Convencao adotada (ordem SB->BTN = ordem de acao pos-flop; o indice
// nesse array TAMBEM serve pra decidir IP/OOP: indice maior = mais em
// posicao, ate o BTN que e' sempre o ultimo a agir pos-flop):
//   2: BB, BTN            6: SB, BB, UTG, MP, CO, BTN
//   3: SB, BB, BTN        7: SB, BB, UTG, MP, HJ, CO, BTN
//   4: SB, BB, CO, BTN    8: SB, BB, UTG, UTG+1, MP, HJ, CO, BTN
//   5: SB, BB, UTG, CO,   9: SB, BB, UTG, UTG+1, MP, MP+1, HJ, CO, BTN
//      BTN
// 4 e 5-handed nao tem uma convencao 100% universal no mercado — essa
// e' a mais comum entre trackers (PT4/HM3) e foi a escolha adotada aqui.
// ------------------------------------------------------------
const POSITIONS_BY_TABLE_SIZE: Record<number, string[]> = {
  2: ["BB", "BTN"],
  3: ["SB", "BB", "BTN"],
  4: ["SB", "BB", "CO", "BTN"],
  5: ["SB", "BB", "UTG", "CO", "BTN"],
  6: ["SB", "BB", "UTG", "MP", "CO", "BTN"],
  7: ["SB", "BB", "UTG", "MP", "HJ", "CO", "BTN"],
  8: ["SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO", "BTN"],
  9: ["SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN"],
};

// Roda a lista de assentos pra comecar logo apos o botao e terminar NO
// botao — essa e' a ordem de acao pos-flop (SB age primeiro, BTN por
// ultimo). Retorna null se o buttonSeat nao bate com nenhum assento
// listado (hand history incompleta/nao suportada).
function rotateStartingAfterButton(seats: ParsedSeat[], buttonSeat: number): ParsedSeat[] | null {
  const sorted = [...seats].sort((a, b) => a.seatNumber - b.seatNumber);
  const btnIdx = sorted.findIndex((s) => s.seatNumber === buttonSeat);
  if (btnIdx === -1) return null;
  return [...sorted.slice(btnIdx + 1), ...sorted.slice(0, btnIdx + 1)];
}

// Preenche seat.position em TODOS os assentos, direto no array recebido.
// Mao com numero de jogadores fora de 2-9 (praticamente nunca acontece
// em hold'em) fica com position=null em todos os assentos — nao
// inventa rotulo fora do que o motor suporta.
function assignSeatPositions(seats: ParsedSeat[], buttonSeat: number | null): void {
  if (buttonSeat === null) return;
  const n = seats.length;
  const order = POSITIONS_BY_TABLE_SIZE[n];
  if (!order) return;
  const rotated = rotateStartingAfterButton(seats, buttonSeat);
  if (!rotated) return;
  rotated.forEach((seat, i) => {
    seat.position = order[i] ?? null;
  });
}

// Matchup heads-up: so tem sentido quando exatamente 2 jogadores chegam
// vivos ao flop (heroi + 1 villain). Le os folds da rua preflop pra
// descobrir quem sobrou.
function computeHeroMatchup(
  seats: ParsedSeat[],
  preflopActions: ParsedAction[],
  heroName: string | null
): { villainPosition: string | null; heroInPosition: boolean | null } {
  if (!heroName) return { villainPosition: null, heroInPosition: null };

  const folded = new Set(preflopActions.filter((a) => a.action === "folds").map((a) => a.player));
  const active = seats.filter((s) => !folded.has(s.playerName));

  if (active.length !== 2) return { villainPosition: null, heroInPosition: null };

  const heroSeat = active.find((s) => s.playerName === heroName);
  const villainSeat = active.find((s) => s.playerName !== heroName);
  if (!heroSeat || !villainSeat || heroSeat.position === null || villainSeat.position === null) {
    return { villainPosition: null, heroInPosition: null };
  }

  const n = seats.length;
  const order = POSITIONS_BY_TABLE_SIZE[n];
  if (!order) return { villainPosition: null, heroInPosition: null };

  const heroIdx = order.indexOf(heroSeat.position);
  const villainIdx = order.indexOf(villainSeat.position);
  if (heroIdx === -1 || villainIdx === -1) return { villainPosition: null, heroInPosition: null };

  return { villainPosition: villainSeat.position, heroInPosition: heroIdx > villainIdx };
}

function streetActions(streets: ParsedStreet[], name: ParsedStreet["name"]): ParsedAction[] {
  return streets.find((s) => s.name === name)?.actions ?? [];
}

function heroOpenedBetting(actions: ParsedAction[], heroName: string): boolean {
  return actions.some((a) => a.player === heroName && (a.action === "bets" || a.action === "allin"));
}

function computePostflopTags(streets: ParsedStreet[], heroName: string | null): PostflopTags {
  const empty: PostflopTags = {
    isPreflopAggressor: false,
    cbetFlop: false,
    cbetTurn: false,
    doubleBarrel: false,
    tripleBarrel: false,
    donkBetFlop: false,
    checkRaise: false,
    foldToCbetFlop: false,
  };
  if (!heroName) return empty;

  const preflop = streetActions(streets, "preflop");
  const flop = streetActions(streets, "flop");
  const turn = streetActions(streets, "turn");
  const river = streetActions(streets, "river");

  const preflopRaises = preflop.filter((a) => a.action === "raises");
  const lastPreflopRaiser = preflopRaises.length ? preflopRaises[preflopRaises.length - 1].player : null;
  const isPreflopAggressor = lastPreflopRaiser === heroName;

  const cbetFlop = isPreflopAggressor && heroOpenedBetting(flop, heroName);
  const cbetTurn = isPreflopAggressor && heroOpenedBetting(turn, heroName);
  const doubleBarrel = cbetFlop && cbetTurn;
  const tripleBarrel = doubleBarrel && heroOpenedBetting(river, heroName);

  // Donk bet so existe se HOUVE um raise no preflop (ou seja, existe um
  // PFA de verdade) e o heroi, nao sendo o PFA, e' quem abre a aposta
  // no flop.
  const donkBetFlop = lastPreflopRaiser !== null && !isPreflopAggressor && heroOpenedBetting(flop, heroName);

  // Check-raise: olhando so as acoes do proprio heroi, em ordem, em
  // qualquer rua pos-flop — primeira acao da rua e' 'checks' e uma
  // acao posterior na MESMA rua e' 'raises'.
  const checkRaise = [flop, turn, river].some((streetActs) => {
    const heroActs = streetActs.filter((a) => a.player === heroName);
    const firstCheckIdx = heroActs.findIndex((a) => a.action === "checks");
    if (firstCheckIdx === -1) return false;
    return heroActs.slice(firstCheckIdx + 1).some((a) => a.action === "raises");
  });

  // Fold pra cbet: heroi nao e' o PFA, o PFA abriu aposta no flop, e o
  // heroi desistiu no flop depois disso.
  const foldToCbetFlop =
    lastPreflopRaiser !== null &&
    !isPreflopAggressor &&
    heroOpenedBetting(flop, lastPreflopRaiser) &&
    flop.some((a) => a.player === heroName && a.action === "folds");

  return { isPreflopAggressor, cbetFlop, cbetTurn, doubleBarrel, tripleBarrel, donkBetFlop, checkRaise, foldToCbetFlop };
}

const STEAL_POSITIONS = new Set(["CO", "BTN", "SB"]);

function computePreflopTags(preflopActions: ParsedAction[], seats: ParsedSeat[], heroName: string | null): PreflopTags {
  const empty: PreflopTags = {
    heroOpenRaise: false,
    stealAttempt: false,
    stealSuccess: false,
    heroFacedThreeBet: false,
    heroFoldToThreeBet: false,
    heroCallThreeBet: false,
    heroMade4Bet: false,
    heroFaced4Bet: false,
    heroFoldTo4Bet: false,
    blindDefenseOpportunity: false,
    blindDefended: false,
    reSteal: false,
    squeeze: false,
  };
  if (!heroName) return empty;

  const positionOf = (player: string): string | null => seats.find((s) => s.playerName === player)?.position ?? null;
  const heroPosition = positionOf(heroName);

  // Indices (na lista original de acoes do preflop) de cada raise, em
  // ordem — usados pra olhar "o que teve entre um raise e outro".
  const raiseIdx: number[] = [];
  preflopActions.forEach((a, i) => {
    if (a.action === "raises") raiseIdx.push(i);
  });

  const firstRaise = raiseIdx[0] !== undefined ? preflopActions[raiseIdx[0]] : null;
  const secondRaise = raiseIdx[1] !== undefined ? preflopActions[raiseIdx[1]] : null;
  const thirdRaise = raiseIdx[2] !== undefined ? preflopActions[raiseIdx[2]] : null;

  const heroOpenRaise = firstRaise?.player === heroName;

  // RFI limpo = ninguem deu call antes do 1o raise (so fold/post).
  const noLimpsBeforeFirstRaise = raiseIdx[0] !== undefined
    ? !preflopActions.slice(0, raiseIdx[0]).some((a) => a.action === "calls")
    : false;

  const stealAttempt = heroOpenRaise && !!heroPosition && STEAL_POSITIONS.has(heroPosition) && noLimpsBeforeFirstRaise;
  const stealSuccess =
    stealAttempt &&
    !preflopActions.slice(raiseIdx[0] + 1).some((a) => a.action === "calls" || a.action === "raises");

  const heroFacedThreeBet = heroOpenRaise && secondRaise !== null && secondRaise.player !== heroName;
  let heroFoldToThreeBet = false;
  let heroCallThreeBet = false;
  if (heroFacedThreeBet) {
    const heroResponse = preflopActions.slice(raiseIdx[1] + 1).find((a) => a.player === heroName);
    heroFoldToThreeBet = heroResponse?.action === "folds";
    heroCallThreeBet = heroResponse?.action === "calls";
  }

  const heroMade4Bet = thirdRaise !== null && thirdRaise.player === heroName;
  const heroFaced4Bet = secondRaise?.player === heroName && thirdRaise !== null && thirdRaise.player !== heroName;
  let heroFoldTo4Bet = false;
  if (heroFaced4Bet) {
    const heroResponse = preflopActions.slice(raiseIdx[2] + 1).find((a) => a.player === heroName);
    heroFoldTo4Bet = heroResponse?.action === "folds";
  }

  // Defesa de blind: heroi em SB/BB, e no momento em que ele toma a
  // PRIMEIRA DECISAO de verdade no preflop (post de blind nao conta,
  // e' automatico, nao e' escolha), so existe 1 raise na mesa (o
  // open) e nao foi ele quem deu.
  const heroFirstActionIdx = preflopActions.findIndex((a) => a.player === heroName && a.action !== "posts");
  const raisesBeforeHero = heroFirstActionIdx === -1 ? [] : raiseIdx.filter((i) => i < heroFirstActionIdx);
  const blindDefenseOpportunity =
    !!heroPosition &&
    (heroPosition === "SB" || heroPosition === "BB") &&
    raisesBeforeHero.length === 1 &&
    preflopActions[raisesBeforeHero[0]].player !== heroName;
  const blindDefended = blindDefenseOpportunity && preflopActions[heroFirstActionIdx]?.action !== "folds";

  // Re-steal: heroi da o 2o raise direto em cima de um steal attempt
  // do oponente (sem call no meio). Squeeze: heroi da um raise que
  // nao e' o 1o, com pelo menos 1 call de outro jogador entre o raise
  // anterior e o dele — mutuamente exclusivos por construcao.
  let squeeze = false;
  for (let k = 1; k < raiseIdx.length; k++) {
    const raiseAction = preflopActions[raiseIdx[k]];
    if (raiseAction.player !== heroName) continue;
    const hasCallBetween = preflopActions.slice(raiseIdx[k - 1] + 1, raiseIdx[k]).some((a) => a.action === "calls");
    if (hasCallBetween) {
      squeeze = true;
      break;
    }
  }

  const openerPosition = firstRaise ? positionOf(firstRaise.player) : null;
  const reSteal =
    !squeeze &&
    secondRaise !== null &&
    secondRaise.player === heroName &&
    firstRaise !== null &&
    !!openerPosition &&
    STEAL_POSITIONS.has(openerPosition) &&
    noLimpsBeforeFirstRaise;

  return {
    heroOpenRaise,
    stealAttempt,
    stealSuccess,
    heroFacedThreeBet,
    heroFoldToThreeBet,
    heroCallThreeBet,
    heroMade4Bet,
    heroFaced4Bet,
    heroFoldTo4Bet,
    blindDefenseOpportunity,
    blindDefended,
    reSteal,
    squeeze,
  };
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
      position: null,
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
    const postM = l.match(
      /^(\S+):\s+(?:posts|paga o|coloca)\s+(small blind|big blind|small & big blind|dead blind|ante)\s+\$?([\d.,]+)/i
    );
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

  // Motor de posicoes: preenche seat.position pra TODOS os assentos (nao
  // so o heroi). Roda depois de extractSeats mas antes do heroPosition
  // final, porque a posicao do heroi agora vem daqui, nao so do regex
  // antigo (que so pegava BTN/SB/BB explicitos no texto).
  assignSeatPositions(seats, buttonSeat);

  const heroSeatComputed = seats.find((s) => s.isHero);
  const heroPositionFromEngine = heroSeatComputed?.position ?? null;
  // Fallback pro regex antigo so quando o motor nao resolveu (ex: numero
  // de assentos fora de 2-9, ou buttonSeat nao identificado no texto).
  const heroPosition = heroPositionFromEngine ?? extractHeroPosition(rawText, heroName);

  const preflopActionsForMatchup = streets.find((s) => s.name === "preflop")?.actions ?? [];
  const { villainPosition, heroInPosition } = computeHeroMatchup(seats, preflopActionsForMatchup, heroName);
  const postflopTags = computePostflopTags(streets, heroName);
  const preflopTags = computePreflopTags(preflopActionsForMatchup, seats, heroName);

  return {
    site,
    handId: extractHandId(rawText),
    date: extractDate(rawText),
    format: extractFormat(rawText),
    stakes: extractStakes(rawText),
    heroName,
    heroCards: extractHeroCards(rawText, heroName),
    heroPosition,
    board,
    pot: extractPot(rawText),
    winner: extractWinner(rawText),
    wonTournament: extractWonTournament(rawText),
    heroFinishPlace: extractHeroFinishPlace(rawText, heroName),
    streets,
    rawText,
    seats,
    buttonSeat,
    maxSeats,
    smallBlind,
    bigBlind,
    showdown: extractShowdown(rawText),
    villainPosition,
    heroInPosition,
    postflopTags,
    preflopTags,
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
