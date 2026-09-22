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

export type PokerSite = "pokerstars" | "ggpoker" | "partypoker" | "888poker" | "desconhecido";

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
  // Quantos bounties o heroi ganhou NESSA mao (0 na imensa maioria --
  // só torneios PKO/Mystery Bounty tem essa linha, e mesmo lá só quando
  // o heroi eliminou alguem). Quase sempre 0 ou 1, mas um all-in do
  // heroi pode eliminar mais de um oponente na mesma mao (side pots),
  // entao e' contagem, nao boolean. Somado entre todas as maos pra virar
  // "Bounties conquistados" no Performance (ver StatisticsTab.tsx).
  heroBountiesWon: number;
  // Valor em dolar dos bounties da linha acima, somado (0 quando
  // heroBountiesWon e' 0). Mesma fonte (linha "wins $Y for eliminating"/
  // "ganha $ Y por eliminar"), so' que somando o valor em vez de contar.
  heroBountyCashWon: number;
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

// RADAR-004 (2026-09-14): PartyPoker e 888poker adicionados a partir de
// UMA amostra de cada, fornecida pelo dono do produto como exemplo/gerada
// (nao capturada de uma mao real jogada) -- mesma cautela ja aplicada ao
// GGPoker antes de ter amostra real: melhor-tentativa, precisa validar
// contra hand history real de cada sala assim que aparecer uma.
function detectSite(text: string): PokerSite {
  if (/PokerStars Hand #|Mão PokerStars #/i.test(text)) return "pokerstars";
  if (/Poker Hand #|GGPoker Hand/i.test(text)) return "ggpoker";
  if (/Game hand #\d+\s*-\s*Tournament #/i.test(text)) return "partypoker";
  if (/888poker Hand History/i.test(text)) return "888poker";
  return "desconhecido";
}

// Divide um texto de sessao em blocos de maos individuais. Bilingue: aceita
// o inicio de mao tanto em ingles ("PokerStars Hand #") quanto em portugues
// ("Mão PokerStars #"), alem dos marcadores proprios de PartyPoker
// ("Game hand #") e 888poker ("***** 888poker Hand History for Game").
// Sem flag global (so' usado com .test() abaixo) -- o split em si continua
// usando a versao "gi" embutida no lookahead, como sempre foi.
const HAND_START =
  /(?:PokerStars|GGPoker|Poker) Hand #|(?:Mão) (?:PokerStars|GGPoker|Poker) #|Game hand #\d+\s*-\s*Tournament #|\*{5} 888poker Hand History for Game/i;

export function splitHands(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(new RegExp(`(?=${HAND_START.source})`, "gi"))
    .map((p) => p.trim())
    .filter(Boolean);

  // Bug reportado (2026-09): exportadores tipo PokerTracker/HM3 inserem
  // um separador ANTES de cada mao ("*********** # 1 **************"),
  // fora do padrao PokerStars/GGPoker. O split() so' corta no INICIO de
  // cada mao real, entao esse separador que vem antes da PRIMEIRA mao
  // do lote sobra como um pedaco fantasma no indice 0 -- sem "Mão
  // PokerStars #"/"PokerStars Hand #" nenhum, vira uma "mao" vazia (sem
  // heroName, sem streets, sem showdown) salva no banco sem servir pra
  // nada. Os separadores ENTRE as maos nao tem esse problema -- ficam
  // grudados no FIM do pedaco anterior, que ja tem conteudo de verdade.
  if (parts.length > 0 && !HAND_START.test(parts[0])) {
    parts.shift();
  }

  return parts;
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

// FIX (2026-09, amostra real GGPoker capturada): hand history com
// oponentes anonimizados (GGPoker sempre, PokerStars em algumas salas)
// lista uma linha "Dealt to X" pra CADA jogador da mao, nao so pro heroi
// -- so a linha do heroi de fato tem as cartas visiveis entre colchetes
// ("Dealt to Hero [Jd Ac]"); as dos oponentes ficam sem colchete nenhum
// ("Dealt to 3325fcef "). Sem exigir o colchete aqui, o regex antigo
// (so' "Dealt to (\S+)", sem global) pegava sempre a PRIMEIRA linha
// "Dealt to" do texto -- ou seja, o jogador do assento 1, nao o heroi de
// verdade -- e todo o resto (cartas, posicao, resultado) saia errado a
// partir dai.
function extractHeroName(text: string): string | null {
  // (.+?) e nao \S+: o nome do heroi tambem pode ter espaco. O colchete
  // das cartas ancora o fim do nome, e "." nao atravessa quebra de linha.
  const en = text.match(/Dealt to (.+?) \[/i);
  if (en) return en[1];
  // PT-BR: nome e cartas vem na MESMA linha ("simoNetto11 recebe [4c 2h]"),
  // nao ha linha "Dealt to" separada. Ancorado no inicio de linha pra nao
  // confundir com outras ocorrencias da palavra "recebe" (ex: "recebeu" no
  // sumario usa palavra diferente, mas por seguranca a ancora de linha evita
  // falso-positivo em qualquer texto livre).
  const pt = text.match(/^(.+?) recebe \[/m);
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
  // 888poker (RADAR-004, melhor-tentativa): "** Dealing flop ** [ Kc 7s 2h ]"
  // em vez de "*** FLOP *** [...]" -- so' confirmado pro flop na amostra
  // fornecida (a mao terminou ali); turn/river em "** Dealing turn/river **"
  // com so' a carta nova entre colchetes e' uma extrapolacao por simetria
  // com o padrao "Dealing X", NAO confirmada contra exemplo real.
  const flopM =
    text.match(/\*\*\* FLOP \*\*\*\s*\[([^\]]+)\]/i) ?? text.match(/\*\* Dealing flop \*\*\s*\[([^\]]+)\]/i);
  const turnM =
    text.match(/\*\*\* TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i) ?? text.match(/\*\* Dealing turn \*\*\s*\[([^\]]+)\]/i);
  const riverM =
    text.match(/\*\*\* RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i) ?? text.match(/\*\* Dealing river \*\*\s*\[([^\]]+)\]/i);
  const flop = flopM ? parseCards(flopM[1]) : [];
  const turn = turnM ? parseCards(turnM[1]) : [];
  const river = riverM ? parseCards(riverM[1]) : [];
  return { flop, turn, river, board: [...flop, ...turn, ...river] };
}

// Bilingue: reconhece "posts"/"paga o"/"coloca", "raises...to"/"aumenta...
// para", "folds/checks/calls/bets"/"desiste/passa/iguala/aposta", e o
// "Uncalled bet...returned"/"Aposta não-igualada...voltou". Cada palavra de
// acao e' normalizada via ACTION_WORD_MAP antes de virar ParsedAction.
// FIX (2026-09, mão real reportada: MTT $33, all-in de 3 jogadores com um
// deles chamado "eliandro tab"): nome de jogador PODE ter espaço -- o
// PokerStars aceita ("eliandro tab", "Glow of Mind"). Os regexes de ação
// capturavam o nome com \S+, que para no primeiro espaço: a linha
// "eliandro tab: raises 800 to 1600" não casava com nada e era DESCARTADA
// inteira. O replayer mostrava a mão como heads-up (o terceiro jogador
// nunca apostava), o pote saía menor e o vencedor virava "tab".
//
// Em vez de tentar adivinhar onde o nome termina, casa contra os nomes
// REAIS dos assentos, que já foram lidos antes das ações (do mais longo
// pro mais curto, pra "Ana Paula" ganhar de "Ana" quando os dois sentam
// na mesma mesa). Sem assentos identificados, cai no \S+ antigo -- mesmo
// comportamento de antes, nada piora.
function playerNamePattern(seats: ParsedSeat[]): string {
  const names = [...new Set(seats.map((s) => s.playerName).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (names.length === 0) return "\\S+";
  return names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function extractStreetActions(
  text: string,
  streetName: ParsedStreet["name"],
  marker: RegExp,
  nextMarker: RegExp | null,
  playerPattern: string = "\\S+"
): { name: ParsedStreet["name"]; actions: ParsedAction[] } | null {
  const P = playerPattern;
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

    const raiseM = l.match(new RegExp(`^(${P}):\\s+(?:raises|aumenta)\\s+\\$?([\\d.,]+)\\s+(?:to|para)\\s+\\$?([\\d.,]+)`, "i"));
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

    // 888poker (2026-09, RADAR-004): sem ":" depois do nome, e so' UM valor
    // entre colchetes pro raise ("Hero raises [160]") -- deduzido a partir
    // da amostra fornecida que esse valor e' o total pro qual a aposta
    // subiu (raise-to), nao o incremento: numa mesma mao, "Player6 raises
    // [50]" seguido de "Hero raises [160]" e depois "Player6 calls [110]"
    // so fecha matematicamente (160-50=110) se [160] for o total, igual o
    // "to Y" do PokerStars. So' temos o total, entao `amount` (o incremento)
    // fica undefined de proposito -- nao temos como calcular com seguranca
    // sem rastrear o pote inteiro, e' melhor faltar o dado do que inventar.
    const raiseNoColonM = l.match(new RegExp(`^(${P})\\s+raises\\s+\\[\\$?([\\d.,]+)\\]`, "i"));
    if (raiseNoColonM) {
      actions.push({
        player: raiseNoColonM[1],
        action: "raises",
        raiseTo: Number(raiseNoColonM[2].replace(",", "")),
      });
      continue;
    }

    // PT-BR usa verbo diferente pra ante ("coloca ante X") vs blind ("paga
    // o small/big blind X") — alternancia cobre os dois em um so regex.
    // "posts the ante" (PokerStars/GGPoker em inglês) além de "posts ante":
    // sem o "the" opcional nenhum ante dessas salas era lido, e o pote
    // reconstruído saía menor que o real.
    const postM = l.match(new RegExp(`^(${P}):\\s+(?:posts|paga o|coloca)\\s+(?:the\\s+)?(small blind|big blind|ante)\\s+\\$?([\\d.,]+)`, "i"));
    if (postM) {
      actions.push({
        player: postM[1],
        action: "posts",
        amount: Number(postM[3].replace(",", "")),
      });
      continue;
    }

    // 888poker: mesmo post de blind, mas sem ":" e valor entre colchetes
    // ("Player8 posts small blind [10]") em vez de solto no fim da linha.
    const postNoColonM = l.match(new RegExp(`^(${P})\\s+posts\\s+(small blind|big blind|ante)\\s+\\[\\$?([\\d.,]+)\\]`, "i"));
    if (postNoColonM) {
      actions.push({
        player: postNoColonM[1],
        action: "posts",
        amount: Number(postNoColonM[3].replace(",", "")),
      });
      continue;
    }

    const genericM = l.match(
      new RegExp(`^(${P}):\\s+(folds|checks|calls|bets|allin|all-in|desiste|passa|iguala|aposta)\\s*(?:\\$?([\\d.,]+))?`, "i")
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

    // 888poker: mesmas acoes genericas (fold/check/call/bet), sem ":" e
    // valor entre colchetes em vez de solto ("Player6 calls [110]",
    // "Hero bets [100]", "Player6 folds" sem valor nenhum).
    const genericNoColonM = l.match(new RegExp(`^(${P})\\s+(folds|checks|calls|bets|allin|all-in)\\s*(?:\\[\\$?([\\d.,]+)\\])?`, "i"));
    if (genericNoColonM) {
      const canonical = ACTION_WORD_MAP[genericNoColonM[2].toLowerCase()] ?? genericNoColonM[2].toLowerCase();
      actions.push({
        player: genericNoColonM[1],
        action: canonical,
        amount: genericNoColonM[3] ? Number(genericNoColonM[3].replace(",", "")) : undefined,
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

function extractWinner(text: string, playerPattern: string = "\\S+"): string | null {
  // Nome completo do vencedor (ver playerNamePattern): com \S+ o
  // "eliandro tab collected 28840" virava vencedor "tab".
  const P = playerPattern;
  const m = text.match(new RegExp(`(${P}) (?:collected|recebeu) \\$?[\\d.,]+`, "i"));
  if (m) return m[1];
  // 888poker (RADAR-004): valor entre colchetes em vez de solto
  // ("Hero collected [ 350 ]") -- a amostra fornecida nao tem linha
  // "Total pot" nenhuma, entao extractPot fica null nesse formato (so'
  // temos o valor coletado pelo vencedor, nao o pote total antes do rake).
  const bracketM = text.match(new RegExp(`(${P}) collected \\[\\s*\\$?([\\d.,]+)\\s*\\]`, "i"));
  return bracketM ? bracketM[1] : null;
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
  // Ancorado no nome EXATO do heroi (que pode ter espaco) em vez de \S+:
  // antes, heroi com espaco no nome nunca tinha a colocacao lida.
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(?:^|\\n)${escaped} (?:finished the tournament in|terminou o torneio em) (\\d+)(?:st|nd|rd|th|[ºª°])? (?:place|lugar)`,
    "i"
  );
  const m = text.match(re);
  if (!m) return null;
  const place = Number(m[1]);
  return Number.isFinite(place) ? place : null;
}

// Conta quantas vezes o heroi aparece na linha de premio de bounty
// ("X wins $Y for eliminating Z and their own bounty increases..." /
// "X ganha $ Y por eliminar Z e seu proprio 'bounty' aumenta..."). So'
// existe em torneio PKO/Mystery Bounty. Ancora no heroName exato (em vez
// do \S+ generico usado em extractHeroFinishPlace) porque nome de
// jogador pode ter espaco (ex: "Glow of Mind") -- \S+ ia cortar no meio.
function extractHeroBountiesWon(text: string, heroName: string | null): { count: number; cashWon: number } {
  if (!heroName) return { count: 0, cashWon: 0 };
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Grupo 1 captura o valor do bounty (mesmo em ambos idiomas) -- usado
  // pra somar o total em dolar, nao so contar quantas vezes aconteceu.
  const re = new RegExp(`^${escaped} (?:wins \\$([\\d.,]+) for eliminating |ganha \\$ ?([\\d.,]+) por eliminar )`, "gim");
  let count = 0;
  let cashWon = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    count++;
    cashWon += Number((m[1] ?? m[2]).replace(",", ""));
  }
  return { count, cashWon: Math.round(cashWon * 100) / 100 };
}

function extractStakes(text: string): string | null {
  // (?:\([\d.,]+\))? no fim -- torneios com ante no cabecalho de nivel
  // ("Level7(200/400(60))", visto em amostra real GGPoker) tem um
  // PARENTESE ANINHADO com o valor do ante logo antes do fechamento; sem
  // aceitar esse grupo opcional o "(" extra quebrava o casamento e
  // stakes/blinds saiam null em qualquer mao de torneio com ante.
  const m = text.match(/\(\$?([\d.,]+\/\$?[\d.,]+)(?:\([\d.,]+\))?\)/);
  if (m) return m[1];
  // 888poker (RADAR-004): blinds ficam SOLTOS no cabecalho ("... Blinds
  // 10/20 - Tournament #..."), nao dentro de parenteses.
  const blindsM = text.match(/Blinds (\d+\/\d+)/i);
  return blindsM ? blindsM[1] : null;
}

// FIX (2026-09, amostra real GGPoker capturada): "Level7(200/400(60))" --
// o ante fica num parentese ANINHADO logo apos o big blind. Sem aceitar
// esse grupo opcional (mesmo ajuste de extractStakes acima), o "(" extra
// impedia o regex de casar e smallBlind/bigBlind saiam null em qualquer
// mao de torneio com ante (a maioria).
function extractBlinds(text: string): { smallBlind: number | null; bigBlind: number | null } {
  const m = text.match(/\(\$?([\d.,]+)\/\$?([\d.,]+)(?:\([\d.,]+\))?\)/);
  if (m) return { smallBlind: Number(m[1].replace(",", "")), bigBlind: Number(m[2].replace(",", "")) };
  // 888poker: ver comentario equivalente em extractStakes.
  const blindsM = text.match(/Blinds (\d+)\/(\d+)/i);
  if (blindsM) return { smallBlind: Number(blindsM[1]), bigBlind: Number(blindsM[2]) };
  return { smallBlind: null, bigBlind: null };
}

function extractFormat(text: string): string | null {
  if (/Tournament|Torneio/i.test(text)) return "MTT";
  if (/Zoom|Hold'em No Limit/i.test(text) && !/Tournament|Torneio/i.test(text)) return "Cash";
  return null;
}

function extractShowdown(text: string, playerPattern: string = "\\S+"): ParsedShowdown[] {
  const P = playerPattern;
  const startIdx = text.search(/\*\*\* SHOW ?DOWN \*\*\*/i);
  if (startIdx === -1) return [];
  const summaryIdx = text.search(/\*\*\* (?:SUMMARY|SUM[AÁ]RIO) \*\*\*/i);
  const block = summaryIdx === -1 ? text.slice(startIdx) : text.slice(startIdx, summaryIdx);

  const results: ParsedShowdown[] = [];
  for (const rawLine of block.split("\n")) {
    const l = rawLine.trim();
    const m = l.match(new RegExp(`^(${P}):\\s+(?:shows|mostra)\\s+\\[([^\\]]+)\\]\\s+\\(([^)]+)\\)`, "i"));
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
  if (m) return m[1];
  // PartyPoker: "Game hand #1054329871 - Tournament #3482019, ..." -- sem
  // ":" depois do numero da mao (usa " - " em vez disso).
  const partyM = text.match(/Game hand #(\w+)/i);
  if (partyM) return partyM[1];
  // 888poker: "***** 888poker Hand History for Game 981230491 *****".
  const eightM = text.match(/888poker Hand History for Game (\w+)/i);
  return eightM ? eightM[1] : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(\d{4}\/\d{2}\/\d{2}[^\n]*)/);
  return m ? m[1].trim() : null;
}

// Converte o "date" cru da hand history ("2024/09/12 21:15:30 ET") pra ISO,
// usado pra marcar hand_reviews.created_at com o dia em que a mão foi JOGADA
// em vez do dia em que foi importada (pedido explicito) -- sem isso, uma
// hand history importada semanas depois aparecia com a data de hoje na
// listagem do revisor, e nao a data real do torneio.
export function handDateToISO(date: string | null): string | null {
  if (!date) return null;
  const m = date.match(/(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  let maxSeats = tableM ? Number(tableM[1]) : null;
  let buttonSeat = tableM ? Number(tableM[2]) : null;

  // 888poker (RADAR-004): nao tem a linha combinada "Table 'X' N-max Seat
  // #Y is the button" -- o tamanho da mesa vem do cabecalho ("Table 1
  // 9-max") e o botao numa linha propria ("Seat 5 is the button").
  if (buttonSeat === null) {
    const maxM = text.match(/(\d+)-max/i);
    if (maxM) maxSeats = Number(maxM[1]);
    const btnM = text.match(/^Seat (\d+) is the button/im);
    if (btnM) buttonSeat = Number(btnM[1]);
  }

  // FIX (2026-09-14, RADAR-004): "in chips"/"em fichas" virou opcional
  // logo abaixo pra aceitar PartyPoker/888poker (stack solto entre
  // parenteses, sem sufixo) -- mas isso faz o mesmo regex tambem casar com
  // as linhas "Seat X: Nome (button) folded..."/"Seat X: Nome (big blind)
  // collected (540)" da secao de RESUMO no fim da mao (mesmo formato
  // "Seat N: Nome (...)", sem "in chips", só que com outro conteúdo
  // dentro do parenteses). Por isso a busca fica restrita ao trecho ANTES
  // de "*** HOLE CARDS ***"/"** Dealing down cards **" -- e' onde a
  // listagem de assentos de verdade sempre vive, e o resumo nunca aparece
  // antes disso.
  const holeCardsIdx = text.search(/\*\*\* (?:HOLE CARDS|CARTAS DA MÃO) \*\*\*|\*\* Dealing down cards \*\*/i);
  const seatingSection = holeCardsIdx === -1 ? text : text.slice(0, holeCardsIdx);

  const seats: ParsedSeat[] = [];
  // "in chips"/"em fichas" agora OPCIONAL -- PartyPoker ("Seat 1: Player1
  // (1,500)") e 888poker ("Seat 1: Player1 ( 1,500 )") listam o stack sem
  // esse sufixo, so' entre parenteses (com ou sem espaco interno).
  //
  // FIX (2026-09-20, RADAR-011): o sufixo de bounty tem DUAS ordens
  // diferentes no PokerStars real -- "Bounty of/de $X" (torneio PKO/Mystery
  // Bounty PT-BR, formato original que este regex cobria) e "$X bounty"
  // (formato padrao do client em ingles, minusculo, valor ANTES da
  // palavra). Antes so' o primeiro casava -- toda mao de torneio bounty no
  // formato "$X bounty" ficava com a linha "Seat" inteira sem match (o
  // trecho ", $X bounty)" sobrava depois de "in chips" sem nada pra
  // consumi-lo), entao a mao inteira perdia TODOS os assentos (nao so' o
  // bounty), zerando heroPosition/VPIP/PFR pra ela. Ver 189/342 maos
  // afetadas num sync real auditado em 2026-09-20.
  const seatRegex =
    /^(?:Seat|Lugar) (\d+): (.+?) \(\s*\$?([\d.,]+)\s*(?:in chips|em fichas)?(?:,\s*(?:Bounty (?:of|de) \$\s?|\$)([\d.,]+)(?:\s*bounty)?)?\s*\)/gim;
  let m: RegExpExecArray | null;
  while ((m = seatRegex.exec(seatingSection)) !== null) {
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
function extractPreambleBlindActions(text: string, playerPattern: string = "\\S+"): ParsedAction[] {
  const P = playerPattern;
  const holeCardsIdx = text.search(/\*\*\* (?:HOLE CARDS|CARTAS DA MÃO) \*\*\*/i);
  const preamble = holeCardsIdx === -1 ? text : text.slice(0, holeCardsIdx);
  const actions: ParsedAction[] = [];
  for (const rawLine of preamble.split("\n")) {
    const l = rawLine.trim();
    // Nome com espaço e "posts the ante": ver playerNamePattern e o
    // comentário equivalente em extractStreetActions.
    const postM = l.match(new RegExp(`^(${P}):\\s+(?:posts|paga o|coloca)\\s+(?:the\\s+)?(small blind|big blind|ante)\\s+\\$?([\\d.,]+)`, "i"));
    if (postM) {
      actions.push({ player: postM[1], action: "posts", amount: Number(postM[3].replace(",", "")) });
      continue;
    }
    // 888poker (RADAR-004): mesmo post, sem ":" e valor entre colchetes --
    // ver comentario equivalente em extractStreetActions.
    const postNoColonM = l.match(new RegExp(`^(${P})\\s+posts\\s+(small blind|big blind|ante)\\s+\\[\\$?([\\d.,]+)\\]`, "i"));
    if (postNoColonM) {
      actions.push({ player: postNoColonM[1], action: "posts", amount: Number(postNoColonM[3].replace(",", "")) });
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

  // 888poker (RADAR-004, melhor-tentativa): marcadores de rua com 2
  // asteriscos e verbo "Dealing" em vez de 3 asteriscos ("** Dealing down
  // cards **"/"** Dealing flop **" vs "*** HOLE CARDS ***"/"*** FLOP ***").
  // So' "hole cards" e "flop" confirmados contra a amostra fornecida;
  // turn/river/showdown sao extrapolados por simetria, nao confirmados.
  const holeCardsMarker = /\*\*\* (?:HOLE CARDS|CARTAS DA MÃO) \*\*\*|\*\* Dealing down cards \*\*/i;
  const flopMarker = /\*\*\* FLOP \*\*\*|\*\* Dealing flop \*\*/i;
  const turnMarker = /\*\*\* TURN \*\*\*|\*\* Dealing turn \*\*/i;
  const riverMarker = /\*\*\* RIVER \*\*\*|\*\* Dealing river \*\*/i;
  const showdownMarker = /\*\*\* SHOW ?DOWN \*\*\*|\*\* Dealing showdown \*\*/i;

  // Nomes reais da mesa (podem ter espaço) -- ver playerNamePattern.
  const P = playerNamePattern(seats);

  const streets: ParsedStreet[] = [];
  const blindActions = extractPreambleBlindActions(rawText, P);
  const preflop = extractStreetActions(rawText, "preflop", holeCardsMarker, flopMarker, P);
  if (preflop) {
    streets.push({ ...preflop, board: [], actions: [...blindActions, ...preflop.actions] });
  } else if (blindActions.length) {
    streets.push({ name: "preflop", board: [], actions: blindActions });
  }
  const flopSt = extractStreetActions(rawText, "flop", flopMarker, turnMarker, P);
  if (flopSt) streets.push({ ...flopSt, board: flop });
  const turnSt = extractStreetActions(rawText, "turn", turnMarker, riverMarker, P);
  if (turnSt) streets.push({ ...turnSt, board: [...flop, ...turn] });
  const riverSt = extractStreetActions(rawText, "river", riverMarker, showdownMarker, P);
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

  // Pedido explicito: "mesas com 3 jogadores sao de sit and go" -- mesa
  // declarada 3-max desde a primeira mao (maxSeats, ja extraido acima) e'
  // o sinal de Sit & Go/Spin & Go, nao de MTT normal (MTT so chega a
  // 3-handed na mesa final, nunca comeca declarada 3-max). extractFormat
  // sozinho so distingue "Tournament"/"Torneio" de cash, nunca SNG.
  const rawFormat = extractFormat(rawText);
  const format = rawFormat === "MTT" && maxSeats !== null && maxSeats <= 3 ? "SNG" : rawFormat;

  const heroBounties = extractHeroBountiesWon(rawText, heroName);

  return {
    site,
    handId: extractHandId(rawText),
    date: extractDate(rawText),
    format,
    stakes: extractStakes(rawText),
    heroName,
    heroCards: extractHeroCards(rawText, heroName),
    heroPosition,
    board,
    pot: extractPot(rawText),
    winner: extractWinner(rawText, P),
    wonTournament: extractWonTournament(rawText),
    heroFinishPlace: extractHeroFinishPlace(rawText, heroName),
    heroBountiesWon: heroBounties.count,
    heroBountyCashWon: heroBounties.cashWon,
    streets,
    rawText,
    seats,
    buttonSeat,
    maxSeats,
    smallBlind,
    bigBlind,
    showdown: extractShowdown(rawText, P),
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
