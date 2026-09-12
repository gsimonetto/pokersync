// Parser do arquivo de "Tournament Summary" (buy-in, colocação e
// premiação) — arquivo SEPARADO da hand history, exportado pelo cliente
// de poker numa pasta própria (ver `tournament_summary_subfolder_names`
// em pokersync-agent/crates/scanner/src/room.rs). Não é o parser de mãos
// (hand-parser.ts): não há mão nenhuma aqui, só o resumo final do
// torneio.
//
// IMPORTANTE — ao contrário de hand-parser.ts (validado contra hand
// history real, PokerStars/GGPoker confirmados), este parser é
// best-effort: baseado no formato documentado do Tournament Summary da
// PokerStars, sem uma amostra real capturada ainda pra validar contra.
// Mesmo status que o README do agente já dá pra PartyPoker/888poker/ACR —
// aqui vale pra qualquer sala, PokerStars incluída. Campos que o regex
// não reconhece ficam `null` — nunca inventamos número.

export interface ParsedTournamentSummary {
  tournamentIdPs: string | null;
  totalEntrants: number | null;
  prizePool: number | null;
  heroFinishPlace: number | null;
  heroPayoutAmount: number | null;
  /** Nome do herói, se identificável no arquivo — usado só pra achar a
   * linha da colocação dele na lista de pagamentos, quando presente. */
  heroName: string | null;
}

// FIX (2026-09, amostra real GGPoker capturada): valores em USD nesses
// arquivos (PokerStars e GGPoker) sempre usam notacao americana --
// virgula separando milhar, ponto separando decimal ("$31,255.51") --
// NUNCA a europeia/BR ("$31.255,51") que essa funcao assumia antes. Com
// a logica antiga, "$32040.00" virava 3204000 e "$1.50" virava 150 --
// qualquer valor com ponto decimal saia 100x maior. Agora so' remove a
// virgula de milhar e mantem o ponto como decimal.
function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Mesmo regex de `extractTournamentInfo` em hand-session-service.ts —
// reaproveitado de propósito (mesmo texto de cabeçalho "Tournament #N" /
// "Torneio #N" que a hand history do mesmo torneio já usa), pra ligar o
// resumo de premiação à sessão certa em `hand_sessions.tournament_id_ps`.
function parseTournamentId(text: string): string | null {
  return text.match(/(?:Tournament|Torneio)\s+#(\d+)/i)?.[1] ?? null;
}

function parseTotalEntrants(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:players|jogadores)\b/i);
  return m ? toNumber(m[1]) : null;
}

function parsePrizePool(text: string): number | null {
  const m = text.match(/Total\s+(?:Prize\s+Pool|do\s+Pr[eê]mio)\s*:?\s*\$?\s?([\d.,]+)/i);
  return m ? toNumber(m[1]) : null;
}

// "You finished the tournament in 3rd place" / "Você terminou o torneio
// na 3ª posição" — aceita os dois idiomas, mesmo padrão bilingue do resto
// do parser de mãos (hand-parser.ts).
function parseHeroFinishPlace(text: string): number | null {
  const en = text.match(/finished\s+(?:the\s+tournament\s+)?in\s+(\d+)\w{0,2}\s+place/i);
  if (en) return toNumber(en[1]);
  const pt = text.match(/terminou\s+o\s+torneio\s+na\s+(\d+)\s*[ªº°]?\s*posi[cç][aã]o/i);
  return pt ? toNumber(pt[1]) : null;
}

// FIX (2026-09, amostra real capturada): em torneios de campo grande a
// PokerStars às vezes fecha só com "You finished the tournament
// (eliminated at hand #...)." — SEM o ordinal ("in Nth place") — mesmo
// quando a colocação exata já é conhecida. A colocação continua presente
// na lista numerada de eliminados mais acima no arquivo ("  1268: <nome>
// (<país>),"), só não é repetida na frase de fechamento. Esse fallback
// acha a linha do próprio herói nessa lista (dado o nome dele, resolvido
// à parte — ver lookupHeroNameForTournament em
// agent-tournament-sync-service.ts) e lê a colocação de lá.
export function parseHeroFinishPlaceFromList(text: string, heroName: string): number | null {
  const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*(\\d+):\\s*${escaped}\\s*(?:\\[\\d+\\])?\\s*\\(`, "m");
  const m = text.match(re);
  return m ? toNumber(m[1]) : null;
}

// "A $150.00 USD award has been credited..." / "...recebeu $150.00" —
// várias formulações conhecidas do texto de premiação; pega o primeiro
// valor em dólar plausível perto de um verbo de recebimento.
// "You received a total of $150." (GGPoker, amostra real capturada) --
// mesmo verbo "received" do padrão de PokerStars logo abaixo, mas com
// "a total of" no meio, que o padrão antigo não pulava.
function parseHeroPayoutAmount(text: string): number | null {
  const patterns = [
    /\$\s?([\d.,]+)\s*(?:USD)?\s+award\s+has\s+been\s+credited/i,
    /received\s+a\s+total\s+of\s+\$\s?([\d.,]+)/i,
    /received\s+\$\s?([\d.,]+)/i,
    /recebeu\s+\$\s?([\d.,]+)/i,
    /premiado\s+(?:em|com)\s+\$\s?([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return toNumber(m[1]);
  }
  return null;
}

export function parseTournamentSummary(text: string): ParsedTournamentSummary {
  return {
    tournamentIdPs: parseTournamentId(text),
    totalEntrants: parseTotalEntrants(text),
    prizePool: parsePrizePool(text),
    heroFinishPlace: parseHeroFinishPlace(text),
    heroPayoutAmount: parseHeroPayoutAmount(text),
    heroName: null,
  };
}
