// Parser do arquivo de "Tournament Summary" (buy-in, colocação e
// premiação) — arquivo SEPARADO da hand history, exportado pelo cliente
// de poker numa pasta própria (ver `tournament_summary_subfolder_names`
// em pokersync-radar/crates/scanner/src/room.rs). Não é o parser de mãos
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

interface ParsedTournamentSummary {
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

// ACR / Winning Poker Network (RADAR-009, validado contra arquivo REAL de
// 03/10/2026): o resumo é um JSON (.ots), não texto. Traz o número do
// torneio, o garantido, o total de entradas e a lista de colocações de
// TODO mundo -- mas não diz qual nome é o do herói nem o buy-in (esse vem
// do nome do arquivo, ver buyinDoArquivoResumoAcr em acr-arquivos.ts).
// Cuidados vistos no arquivo real:
//   - o mesmo nome aparece várias vezes (cada reentrada é uma linha);
//   - o arquivo é gravado quando o herói cai, com o torneio ainda rolando:
//     as posições do 1º até a do herói - 1 são de quem ainda estava vivo
//     (prêmio 0), não a colocação final deles.
export interface ResumoAcr {
  tournamentIdPs: string;
  totalEntrants: number | null;
  prizePool: number | null;
  /** ISO (UTC): quando o herói começou a jogar essa entrada. */
  inicio: string | null;
  colocacoes: { jogador: string; posicao: number; premio: number }[];
}

export function parseResumoAcr(text: string): ResumoAcr | null {
  const t = text.trim().replace(/^\uFEFF/, "");
  if (!t.startsWith("{")) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(t);
  } catch {
    return null;
  }
  const rede = `${j.network_name ?? ""} ${j.site_name ?? ""}`;
  if (!/winning\s*poker\s*network|americas\s*cardroom|\bacr\b/i.test(rede)) return null;
  const id = String(j.tournament_number ?? "").match(/\d+/)?.[0];
  if (!id) return null;
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const inicio = typeof j.start_date_utc === "string" && !Number.isNaN(Date.parse(j.start_date_utc)) ? new Date(j.start_date_utc).toISOString() : null;
  const lista = Array.isArray(j.tournament_finishes_and_winnings) ? j.tournament_finishes_and_winnings : [];
  const colocacoes = lista.flatMap((c: Record<string, unknown>) => {
    const posicao = numero(c?.finish_position);
    if (typeof c?.player_name !== "string" || posicao == null) return [];
    return [{ jogador: c.player_name, posicao, premio: (numero(c.prize) ?? 0) + (numero(c.ticket_value) ?? 0) }];
  });
  return { tournamentIdPs: id, totalEntrants: numero(j.player_count), prizePool: numero(j.prize_pool), inicio, colocacoes };
}

// Colocação do herói no resumo da ACR. Com reentradas o nome aparece mais de
// uma vez; a melhor posição (menor número) é a da entrada mais recente --
// quem cai depois sempre fica com um número menor -- e é dela que o arquivo
// fala (ele é gravado quando essa entrada cai).
export function colocacaoNoResumoAcr(resumo: ResumoAcr, heroName: string): { posicao: number; premio: number } | null {
  const minhas = resumo.colocacoes.filter((c) => c.jogador === heroName);
  if (minhas.length === 0) return null;
  const melhor = minhas.reduce((a, b) => (b.posicao < a.posicao ? b : a));
  return { posicao: melhor.posicao, premio: melhor.premio };
}

// Quando o torneio começou, pelo primeiro "AAAA/MM/DD HH:MM:SS" do resumo
// (na PokerStars, a linha "Tournament started ..."/"Torneio iniciado ...").
// Usado só pro corte do "só a partir de agora" do Radar
// (profiles.radar_import_scope_since) — mesma leitura sem fuso de
// handDateToISO, por isso o corte tem folga (ver jogadoAntesDoCorte em
// lib/supabase/agent-import-scope.ts). Sem data no texto = null.
export function parseTournamentStartDate(text: string): string | null {
  const m = text.match(/(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
