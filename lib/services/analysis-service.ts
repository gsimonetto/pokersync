import { createClient } from "@/lib/supabase/client";
import { fetchSessions } from "@/lib/services/bankroll-service";
import type { Session as BankrollSession } from "@/lib/bankroll/types";
import type { FinancialDay } from "@/lib/services/team-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { fetchHandEvResults } from "@/lib/services/hand-ev-service";
import {
  type AnalysisFilters,
  type AnalysisHandRow,
  type GameFormat,
  type HeroPosition,
  type StackDepthBucket,
  type PotType,
  type PreflopMetrics,
  type PreflopMetricsByPosition,
  type PostflopMetrics,
  type TournamentMetrics,
  type ReferenceProfile,
  type BuyinBucket,
  HERO_POSITION_ORDER,
  PREFLOP_ACTION_TO_POT_TYPE,
} from "@/types/analysis";

// ============================================================
// Faixas de referência (heurística de população, não output do motor
// GTO) — duas mesas diferentes, dois perfis diferentes. MTT joga cheio
// (8-9 handed) até encurtar nas fases finais, então frequências
// preflop/postflop saudáveis são mais apertadas que num 6-max de cash
// (menos jogadores atrás = menos gente pra 3-bet/roubar/vs. c-bet).
//
// Revisados com base em consenso comum de material de treino/HUD
// (o mesmo tipo de "faixa saudável" que aparece em guias populares de
// VPIP/PFR/3-bet etc.) — não é o motor GTO do produto nem um dataset de
// população auditável por nós, então trate como referência de contexto,
// não resposta resolvida. Onde não achamos consenso equivalente
// (Check-Raise%, Aggression Freq.%) mantivemos a heurística anterior,
// sinalizada abaixo, em vez de inventar uma faixa nova.
// ============================================================
export type MetricRange = { min: number; max: number };

export const PREFLOP_REFERENCE: Record<
  ReferenceProfile,
  {
    vpip: MetricRange;
    pfr: MetricRange;
    threeBet: MetricRange;
    steal: MetricRange;
    foldTo3bet: MetricRange;
    // Mesmo número aplicado nos 3 recortes de matchup (SB vs BTN, BB vs
    // BTN, BB vs SB) — a referência usada não distingue por matchup, só
    // dá um "fold to steal" geral. Aproximação, não uma faixa específica
    // pra cada situação.
    foldToSteal: MetricRange;
  }
> = {
  cash6max: {
    vpip: { min: 22, max: 28 },
    pfr: { min: 18, max: 24 }, // gap saudável entre VPIP e PFR de até ~8-10pp
    threeBet: { min: 6, max: 9 },
    steal: { min: 30, max: 40 },
    foldTo3bet: { min: 50, max: 60 },
    foldToSteal: { min: 65, max: 75 },
  },
  mtt8max: {
    vpip: { min: 12, max: 18 },
    pfr: { min: 9, max: 14 },
    threeBet: { min: 3.5, max: 6.5 },
    steal: { min: 25, max: 35 },
    foldTo3bet: { min: 55, max: 65 }, // sem referência específica de mesa cheia — heurística deslocada da versão cash
    foldToSteal: { min: 70, max: 80 },
  },
};

// `cbetTurn`/`cbetRiver` e `wsd`/`wsdWon` (WTSD/W$SD) agora também têm
// referência revisada. `donkBet` não tem faixa numérica exata com
// consenso claro, só o achado qualitativo de que donk bet frequente
// correlaciona com mais perda — mantido como heurística de "quanto
// menor, melhor". `foldToCbetTurn`/`foldToCbetRiver` só têm MÉDIA de
// população como referência (não uma faixa "ideal" com consenso) — a
// faixa aqui usa essa média como centro, é menos confiável que as
// outras. Check-Raise% e `aggFreq` continuam sem referência nova —
// ficaram de fora do marcador (Check-Raise%) ou como heurística antiga
// sem revisão (aggFreq).
export const POSTFLOP_REFERENCE: Record<
  ReferenceProfile,
  {
    cbetFlop: MetricRange;
    foldToCbetFlop: MetricRange;
    cbetTurn: MetricRange;
    cbetRiver: MetricRange;
    foldToCbetTurn: MetricRange;
    foldToCbetRiver: MetricRange;
    donkBet: MetricRange;
    aggFactor: MetricRange;
    aggFreq: MetricRange;
    wsd: MetricRange;
    wsdWon: MetricRange;
  }
> = {
  cash6max: {
    cbetFlop: { min: 55, max: 75 },
    foldToCbetFlop: { min: 40, max: 55 }, // média de população em torno de 45%
    cbetTurn: { min: 45, max: 65 },
    cbetRiver: { min: 35, max: 50 },
    foldToCbetTurn: { min: 24, max: 44 }, // média de população em torno de 34%, sem faixa "ideal" com consenso — banda construída em torno da média
    foldToCbetRiver: { min: 27, max: 47 }, // média de população em torno de 37%, mesma ressalva acima
    donkBet: { min: 2, max: 8 }, // sem faixa exata com consenso — só o achado de que doncar mais correlaciona com mais perda
    aggFactor: { min: 2, max: 4 }, // ~3 é considerado o valor ótimo; abaixo de 1.5 é passivo demais
    aggFreq: { min: 35, max: 50 }, // sem referência nova — heurística anterior mantida
    wsd: { min: 25, max: 30 },
    wsdWon: { min: 49, max: 54 },
  },
  mtt8max: {
    cbetFlop: { min: 50, max: 70 }, // sem referência específica de mesa cheia — mesmo deslocamento proporcional já usado nos headliners
    foldToCbetFlop: { min: 45, max: 60 },
    cbetTurn: { min: 40, max: 60 },
    cbetRiver: { min: 30, max: 45 },
    foldToCbetTurn: { min: 24, max: 44 }, // mesma ressalva do cash — sem dado específico de mesa cheia
    foldToCbetRiver: { min: 27, max: 47 },
    donkBet: { min: 2, max: 8 },
    aggFactor: { min: 1.5, max: 3.5 },
    aggFreq: { min: 30, max: 45 },
    wsd: { min: 25, max: 30 }, // sem distinção de mesa cheia na referência usada — aplicado igual
    wsdWon: { min: 49, max: 54 },
  },
};

// Perfil de referência a partir do formato predominante nas mãos já
// filtradas — maioria "mtt" usa a faixa de torneio 8-max; qualquer
// outra maioria (cash/spin/sng) ou base sem formato dominante fica no
// perfil cash 6-max, que já era a única faixa que o produto tinha.
export function computeReferenceProfile(rows: AnalysisHandRow[]): ReferenceProfile {
  let mtt = 0;
  let other = 0;
  for (const r of rows) {
    if (r.format === "mtt") mtt++;
    else if (r.format !== null) other++;
  }
  return mtt > other ? "mtt8max" : "cash6max";
}

// ============================================================
// Fonte crua: hand_tags (uma linha por mão, já classificada pelo trigger
// sync_hand_tags) embutido com hand_reviews (data + cartas do herói).
// Tudo daqui pra baixo neste arquivo é derivado no cliente em cima dessa
// lista — sem RPC nova, sem recálculo no banco. RLS de hand_tags e
// hand_reviews já restringe a linhas do próprio usuário.
// ============================================================

function normalizeFormat(raw: string | null | undefined): GameFormat | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "mtt" || v === "torneio") return "mtt";
  if (v === "cash") return "cash";
  if (v === "sng") return "sng";
  if (v === "spin" || v === "spin & go" || v === "hyper") return "spin";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAnalysisHand(r: any): AnalysisHandRow {
  const hr = r.hand_reviews;
  const parsed = hr?.parsed_data ?? null;
  const cards = Array.isArray(parsed?.heroCards) && parsed.heroCards.length === 2 ? (parsed.heroCards as [string, string]) : null;
  return {
    handReviewId: r.hand_review_id,
    playedAt: hr?.created_at ?? r.computed_at,
    format: normalizeFormat(parsed?.format ?? null),
    stakes: parsed?.stakes ?? null,
    heroCards: cards,
    potType: (r.pot_type as PotType) ?? null,
    heroPosition: (r.hero_position as HeroPosition) ?? null,
    matchup: r.matchup ?? null,
    stackDepthBucket: (r.stack_depth_bucket as StackDepthBucket) ?? null,
    tournamentStage: null, // motor ainda não popula tournament_phase (ver POKERSYNC.md §8)
    vpip: r.vpip,
    pfr: r.pfr,
    threeBet: r.three_bet,
    inPosition: r.in_position,
    isPreflopAggressor: r.is_preflop_aggressor,
    cbetFlop: r.cbet_flop,
    cbetTurn: r.cbet_turn,
    cbetRiver: r.cbet_river,
    doubleBarrel: r.double_barrel,
    tripleBarrel: r.triple_barrel,
    donkBetFlop: r.donk_bet_flop,
    checkRaise: r.check_raise,
    checkRaiseFlop: r.check_raise_flop,
    checkRaiseTurn: r.check_raise_turn,
    checkRaiseRiver: r.check_raise_river,
    foldToCbetFlop: r.fold_to_cbet_flop,
    foldToCbetTurn: r.fold_to_cbet_turn,
    foldToCbetRiver: r.fold_to_cbet_river,
    postflopBetCount: r.postflop_bet_count,
    postflopRaiseCount: r.postflop_raise_count,
    postflopCallCount: r.postflop_call_count,
    postflopFoldCount: r.postflop_fold_count,
    wentToShowdown: r.went_to_showdown,
    wonShowdown: r.won_showdown,
    heroOpenRaise: r.hero_open_raise,
    stealOpportunity: r.steal_opportunity,
    stealAttempt: r.steal_attempt,
    stealSuccess: r.steal_success,
    facedThreeBet: r.hero_faced_3bet,
    foldToThreeBet: r.hero_fold_to_3bet,
    callThreeBet: r.hero_call_3bet,
    madeFourBet: r.hero_made_4bet,
    facedFourBet: r.hero_faced_4bet,
    foldToFourBet: r.hero_fold_to_4bet,
    blindDefenseOpportunity: r.blind_defense_opportunity,
    blindDefended: r.blind_defended,
    reSteal: r.re_steal,
    squeeze: r.squeeze,
  };
}

export async function fetchAnalysisHandRows(): Promise<AnalysisHandRow[]> {
  const supabase = createClient();
  // Sem paginação: hoje a base tem ~200 mãos por usuário. Quando o volume
  // crescer (agente desktop em produção), isto precisa virar RPC agregada
  // no Postgres — não filtrar 50k linhas no cliente.
  const { data, error } = await supabase
    .from("hand_tags")
    .select(
      "hand_review_id, pot_type, hero_position, stack_depth_bucket, matchup, vpip, pfr, three_bet, computed_at, " +
        "in_position, is_preflop_aggressor, cbet_flop, cbet_turn, cbet_river, double_barrel, triple_barrel, donk_bet_flop, " +
        "check_raise, check_raise_flop, check_raise_turn, check_raise_river, " +
        "fold_to_cbet_flop, fold_to_cbet_turn, fold_to_cbet_river, " +
        "postflop_bet_count, postflop_raise_count, postflop_call_count, postflop_fold_count, " +
        "went_to_showdown, won_showdown, " +
        "hero_open_raise, steal_opportunity, steal_attempt, steal_success, hero_faced_3bet, " +
        "hero_fold_to_3bet, hero_call_3bet, hero_made_4bet, hero_faced_4bet, hero_fold_to_4bet, " +
        "blind_defense_opportunity, blind_defended, re_steal, squeeze, " +
        "hand_reviews!inner(created_at, parsed_data)"
    )
    .order("computed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToAnalysisHand);
}

// ============================================================
// Filtros
// ============================================================
export function applyAnalysisFilters(rows: AnalysisHandRow[], filters: AnalysisFilters): AnalysisHandRow[] {
  const potTypes: PotType[] = filters.preflopActions.map((a) => PREFLOP_ACTION_TO_POT_TYPE[a]);
  return rows.filter((r) => {
    if (filters.dateRange.from && r.playedAt < filters.dateRange.from) return false;
    if (filters.dateRange.to && r.playedAt > filters.dateRange.to) return false;
    if (filters.formats.length > 0 && (!r.format || !filters.formats.includes(r.format))) return false;
    if (filters.stackDepths.length > 0 && (!r.stackDepthBucket || !filters.stackDepths.includes(r.stackDepthBucket))) return false;
    if (filters.stages.length > 0 && (!r.tournamentStage || !filters.stages.includes(r.tournamentStage))) return false;
    if (filters.positions.length > 0 && (!r.heroPosition || !filters.positions.includes(r.heroPosition))) return false;
    if (potTypes.length > 0 && (!r.potType || !potTypes.includes(r.potType))) return false;
    return true;
  });
}

// ============================================================
// Preflop
// ============================================================
function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function countIf<T>(rows: T[], pred: (r: T) => boolean | null | undefined): number {
  return rows.reduce((acc, r) => acc + (pred(r) ? 1 : 0), 0);
}

export function computePreflopMetrics(rows: AnalysisHandRow[]): PreflopMetrics {
  const hands = rows.length;
  // faced_3bet/faced_4bet/blind_defense_opportunity/steal_opportunity são
  // flags de OPORTUNIDADE — sempre true/false quando o herói foi
  // identificado na mão (null só nas ~poucas mãos sem herói reconhecido).
  // O gate certo é "=== true", não "!== null": filtrar por "!== null"
  // incluiria também as oportunidades que deram false, inflando o
  // denominador com mãos onde a situação nunca aconteceu.
  const stealOpp = rows.filter((r) => r.stealOpportunity === true);
  const stealAttempts = countIf(rows, (r) => r.stealAttempt);
  const facedThreeBet = rows.filter((r) => r.facedThreeBet === true);
  const facedFourBet = rows.filter((r) => r.facedFourBet === true);
  // matchup só vem preenchido em pots heads-up até o flop ("SB_vs_BTN"),
  // então dá pra isolar o vilão real do steal em vez de aproximar por
  // blind_defense_opportunity genérico (que não distingue quem abriu).
  const stealVsSbBtn = rows.filter((r) => r.heroPosition === "SB" && r.matchup === "SB_vs_BTN" && r.blindDefenseOpportunity === true);
  const stealVsBbBtn = rows.filter((r) => r.heroPosition === "BB" && r.matchup === "BB_vs_BTN" && r.blindDefenseOpportunity === true);
  const stealVsBbSb = rows.filter((r) => r.heroPosition === "BB" && r.matchup === "BB_vs_SB" && r.blindDefenseOpportunity === true);
  return {
    hands,
    vpip_pct: pct(countIf(rows, (r) => r.vpip), hands),
    pfr_pct: pct(countIf(rows, (r) => r.pfr), hands),
    three_bet_pct: pct(countIf(rows, (r) => r.threeBet), hands),
    fold_to_3bet_pct: pct(countIf(facedThreeBet, (r) => r.foldToThreeBet), facedThreeBet.length),
    // 4-Bet % = quantas vezes o herói 4-betou dado que enfrentou um 3-bet
    // (mesma base de fold_to_3bet/call_3bet, convenção HM3/PT4).
    four_bet_pct: pct(countIf(facedThreeBet, (r) => r.madeFourBet), facedThreeBet.length),
    fold_to_4bet_pct: pct(countIf(facedFourBet, (r) => r.foldToFourBet), facedFourBet.length),
    steal_pct: pct(stealAttempts, stealOpp.length),
    // Defesa de blind já vem separada por posição do herói em
    // blind_defense_opportunity/blind_defended — "fold to steal" é o
    // complemento (1 - defendeu) na mesma amostra.
    fold_to_steal_sb_vs_btn_pct: pct(stealVsSbBtn.length - countIf(stealVsSbBtn, (r) => r.blindDefended), stealVsSbBtn.length),
    fold_to_steal_bb_vs_btn_pct: pct(stealVsBbBtn.length - countIf(stealVsBbBtn, (r) => r.blindDefended), stealVsBbBtn.length),
    fold_to_steal_bb_vs_sb_pct: pct(stealVsBbSb.length - countIf(stealVsBbSb, (r) => r.blindDefended), stealVsBbSb.length),
    squeeze_pct: pct(countIf(rows, (r) => r.squeeze), hands),
    limp_fold_pct: null, // hand_tags não marca fold pós-limp isoladamente
    open_push_pct: null, // depende de profundidade all-in no open — não classificado no parser ainda
  };
}

export function computePreflopByPosition(rows: AnalysisHandRow[]): PreflopMetricsByPosition[] {
  return HERO_POSITION_ORDER.map((position) => {
    const subset = rows.filter((r) => r.heroPosition === position);
    return { position, ...computePreflopMetrics(subset) };
  }).filter((p) => p.hands > 0);
}

// Tendência de uma métrica ao longo do período filtrado — divide as mãos
// (já ordenadas cronologicamente por fetchAnalysisHandRows) em blocos de
// tamanho igual e recalcula a métrica em cada um, no espírito do
// "Graphing" do HM3/PT4. Bloco por volume de mãos, não por data — sessões
// desiguais no calendário não viram ruído no gráfico. Amostra mínima de
// 30 mãos pro total pra cada ponto ter uma base decente.
export function computeMetricTrend(rows: AnalysisHandRow[], metricFn: (subset: AnalysisHandRow[]) => number | null, buckets = 6): number[] {
  if (rows.length < 30) return [];
  const chunkSize = Math.ceil(rows.length / buckets);
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const value = metricFn(rows.slice(i, i + chunkSize));
    if (value !== null) out.push(value);
  }
  return out;
}

// ============================================================
// Postflop
// ============================================================
export function computePostflopMetrics(rows: AnalysisHandRow[]): PostflopMetrics {
  const pfaHands = rows.filter((r) => r.isPreflopAggressor === true);
  const nonPfaHands = rows.filter((r) => r.isPreflopAggressor === false);
  // fold_to_cbet_* já é nullable de verdade (null = não enfrentou c-bet
  // naquela rua) — "!== null" aqui é o gate certo, ao contrário dos
  // campos de oportunidade do preflop (ver computePreflopMetrics).
  const facedCbetFlop = rows.filter((r) => r.foldToCbetFlop !== null);
  const facedCbetTurn = rows.filter((r) => r.foldToCbetTurn !== null);
  const facedCbetRiver = rows.filter((r) => r.foldToCbetRiver !== null);

  const betRaise = rows.reduce((acc, r) => acc + (r.postflopBetCount ?? 0) + (r.postflopRaiseCount ?? 0), 0);
  const calls = rows.reduce((acc, r) => acc + (r.postflopCallCount ?? 0), 0);
  const folds = rows.reduce((acc, r) => acc + (r.postflopFoldCount ?? 0), 0);

  // W$SD% usa como base as mãos que REALMENTE chegaram a showdown
  // (wentToShowdown === true) — WSD% em si usa todas as mãos jogadas
  // como base, convenção padrão de mercado (não é "oportunidade", é taxa
  // sobre o volume total).
  const reachedShowdown = rows.filter((r) => r.wentToShowdown === true);

  return {
    hands: rows.length,
    cbet_flop_pct: pct(countIf(pfaHands, (r) => r.cbetFlop), pfaHands.length),
    cbet_turn_pct: pct(countIf(pfaHands, (r) => r.cbetTurn), pfaHands.length),
    cbet_river_pct: pct(countIf(pfaHands, (r) => r.cbetRiver), pfaHands.length),
    fold_to_cbet_flop_pct: pct(countIf(facedCbetFlop, (r) => r.foldToCbetFlop), facedCbetFlop.length),
    fold_to_cbet_turn_pct: pct(countIf(facedCbetTurn, (r) => r.foldToCbetTurn), facedCbetTurn.length),
    fold_to_cbet_river_pct: pct(countIf(facedCbetRiver, (r) => r.foldToCbetRiver), facedCbetRiver.length),
    check_raise_flop_pct: pct(countIf(nonPfaHands, (r) => r.checkRaiseFlop), nonPfaHands.length),
    check_raise_turn_pct: pct(countIf(nonPfaHands, (r) => r.checkRaiseTurn), nonPfaHands.length),
    check_raise_river_pct: pct(countIf(nonPfaHands, (r) => r.checkRaiseRiver), nonPfaHands.length),
    donk_bet_pct: pct(countIf(nonPfaHands, (r) => r.donkBetFlop), nonPfaHands.length),
    // AF = (bet+raise) / call. Com 0 calls o AF tradicionalmente não tem
    // teto definido — fica null em vez de Infinity/0 fabricado.
    aggression_factor: calls > 0 ? Math.round((betRaise / calls) * 100) / 100 : null,
    // AFq = (bet+raise) / (bet+raise+call+fold) — convenção HM3/PT4,
    // checks ficam fora do denominador (não são decisão de apostar).
    aggression_frequency_pct: pct(betRaise, betRaise + calls + folds),
    wsd_pct: pct(reachedShowdown.length, rows.length),
    wsd_won_pct: pct(countIf(reachedShowdown, (r) => r.wonShowdown), reachedShowdown.length),
  };
}

// ============================================================
// Torneios — só o que dá pra provar com o que está gravado hoje
// (bankroll_sessions: buy-in/reentries/cashout reais). cEV/ICM ficam
// null: motor não grava chip-equity por mão (ver POKERSYNC.md §8).
// ============================================================
function isTournamentSession(s: BankrollSession): boolean {
  const f = s.format?.trim().toLowerCase();
  return f === "mtt" || f === "torneio" || f === "sng" || f === "spin";
}

// Corte fixo em R$ (ver BuyinBucket em types/analysis.ts) — mesmo
// espírito do StackDepthBucket: faixa redonda, não um valor por torneio.
export function buyinBucketOf(buyin: number): BuyinBucket {
  if (buyin <= 10) return "0-10";
  if (buyin <= 50) return "10-50";
  if (buyin <= 200) return "50-200";
  return "200+";
}

export async function fetchTournamentMetrics(buyinBuckets: BuyinBucket[] = []): Promise<TournamentMetrics> {
  const [sessionsAll, evResults] = await Promise.all([fetchSessions(), fetchHandEvResults()]);
  const sessions = sessionsAll
    .filter(isTournamentSession)
    .filter((s) => buyinBuckets.length === 0 || buyinBuckets.includes(buyinBucketOf(s.buyIn)));
  const invested = sessions.reduce((acc, s) => acc + s.buyIn * (1 + (s.reentries || 0)), 0);
  const returned = sessions.reduce((acc, s) => acc + s.cashout, 0);
  const itmCount = sessions.filter((s) => s.cashout > 0).length;
  // "Jogando desde" / "último torneio" — datas extremas da amostra
  // filtrada, pro resumo financeiro estilo SharkScope (não é a data de
  // cadastro da conta, é desde quando há torneio registrado na Gestão de
  // Banca).
  const since = sessions.reduce<string | null>((min, s) => (min === null || s.date < min ? s.date : min), null);
  const until = sessions.reduce<string | null>((max, s) => (max === null || s.date > max ? s.date : max), null);

  // Buy-in médio por torneio — sem contar re-entries (senão um jogador que
  // faz muitas re-entries num buy-in baixo puxaria a média pra baixo do
  // que ele de fato costuma jogar). ROI médio é a média do ROI de cada
  // torneio individual, diferente do roi_pct acima (que é o ROI agregado
  // do total investido/total devolvido) — os dois contam histórias
  // diferentes: um pondera pelo tamanho do buy-in, o outro não.
  const avgBuyin = sessions.length > 0 ? sessions.reduce((acc, s) => acc + s.buyIn, 0) / sessions.length : null;
  const perGameRois = sessions
    .map((s) => s.buyIn * (1 + (s.reentries || 0)))
    .map((gameInvested, i) => (gameInvested > 0 ? ((sessions[i].cashout - gameInvested) / gameInvested) * 100 : null))
    .filter((r): r is number => r !== null);
  const avgRoiPct = perGameRois.length > 0 ? perGameRois.reduce((a, b) => a + b, 0) / perGameRois.length : null;

  // Dias ativos / jogos por dia / dia com mais torneios — agrupado pela
  // mesma `date` da sessão (YYYY-MM-DD), sem depender de horário.
  const gamesByDay = new Map<string, number>();
  const netByDay = new Map<string, number>();
  for (const s of sessions) {
    gamesByDay.set(s.date, (gamesByDay.get(s.date) ?? 0) + 1);
    const net = s.cashout - s.buyIn * (1 + (s.reentries || 0));
    netByDay.set(s.date, (netByDay.get(s.date) ?? 0) + net);
  }
  const activeDays = gamesByDay.size;
  const busiestDayCount = gamesByDay.size > 0 ? Math.max(...gamesByDay.values()) : 0;

  // Sequências de dias ganhando/perdendo — mesmo espírito do "streak" do
  // SharkScope, dia a dia (não torneio a torneio) e só sobre torneios
  // (não mistura com dias de cash), em ordem cronológica.
  const dayResults = [...netByDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, net]) => net);
  let daysWon = 0,
    daysLost = 0,
    daysFlat = 0,
    maxWinStreak = 0,
    maxLoseStreak = 0,
    curWinStreak = 0,
    curLoseStreak = 0;
  for (const net of dayResults) {
    if (net > 0) {
      daysWon++;
      curWinStreak++;
      curLoseStreak = 0;
    } else if (net < 0) {
      daysLost++;
      curLoseStreak++;
      curWinStreak = 0;
    } else {
      daysFlat++;
      curWinStreak = 0;
      curLoseStreak = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWinStreak);
    maxLoseStreak = Math.max(maxLoseStreak, curLoseStreak);
  }

  // cEV/$EV só cobre as mãos que passaram por hand_ev_results (all-in
  // heads-up preflop, ambas mostradas, com premiação cadastrada — ver
  // app/api/hand-ev/compute). Amostra pequena de propósito: é só o que
  // dá pra provar com o motor validado hoje, não uma estimativa pro
  // torneio inteiro. Não tem buy-in associado direto (hand_ev_results
  // não guarda isso), então `buyinBuckets` não filtra esses dois números
  // — só Total Games/ROI/ITM/Lucro total, que vêm de `sessions`.
  const chipEvTotal = evResults.reduce((acc, r) => acc + (r.heroExpectedChipDelta ?? 0), 0);
  const netEvProfit = evResults.reduce((acc, r) => acc + (r.heroExpectedIcmDeltaDollars ?? 0), 0);

  return {
    total_games: sessions.length,
    roi_pct: invested > 0 ? Math.round(((returned - invested) / invested) * 1000) / 10 : null,
    itm_pct: sessions.length > 0 ? pct(itmCount, sessions.length) : null,
    total_profit: sessions.length > 0 ? Math.round((returned - invested) * 100) / 100 : null,
    total_invested: sessions.length > 0 ? Math.round(invested * 100) / 100 : null,
    total_cashout: sessions.length > 0 ? Math.round(returned * 100) / 100 : null,
    since,
    until,
    avg_profit_per_game: sessions.length > 0 ? Math.round(((returned - invested) / sessions.length) * 100) / 100 : null,
    avg_buyin: avgBuyin !== null ? Math.round(avgBuyin * 100) / 100 : null,
    avg_roi_pct: avgRoiPct !== null ? Math.round(avgRoiPct * 10) / 10 : null,
    active_days: activeDays,
    games_per_day: activeDays > 0 ? Math.round((sessions.length / activeDays) * 10) / 10 : null,
    busiest_day_count: busiestDayCount,
    days_won: daysWon,
    days_lost: daysLost,
    days_flat: daysFlat,
    max_win_streak: maxWinStreak,
    max_lose_streak: maxLoseStreak,
    net_ev_profit: evResults.length > 0 ? Math.round(netEvProfit * 100) / 100 : null,
    chip_ev_total: evResults.length > 0 ? Math.round(chipEvTotal * 100) / 100 : null,
    cev_per_game: evResults.length > 0 && sessions.length > 0 ? Math.round((chipEvTotal / sessions.length) * 100) / 100 : null,
    ev_roi_pct: evResults.length > 0 && invested > 0 ? Math.round((netEvProfit / invested) * 1000) / 10 : null,
  };
}

// Sessões de torneio (hand_sessions, mesmo agrupador do Revisor) — é onde
// a estrutura de premiação se ancora (por tournament_id_ps), pra aparecer
// junto do torneio que o jogador já reconhece, não como tela separada.
export async function fetchTournamentSessions(): Promise<HandSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sessions")
    .select("*")
    .eq("kind", "tournament")
    .not("tournament_id_ps", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HandSession[];
}

// ============================================================
// Gráfico principal — Net Won acumulado por dia, no mesmo formato que
// EvolutionChart (components/time/evolution-chart.tsx) já consome, pra
// reusar o componente pronto em vez de desenhar outro SVG do zero.
// All-in EV fica de fora: motor não roda simulação de equity all-in
// ainda (ver POKERSYNC.md §8) — sem essa linha, não sem dado fake.
// ============================================================
export async function fetchFinancialDaySeries(): Promise<FinancialDay[]> {
  const sessions = await fetchSessions();
  const byDay = new Map<string, { resultado: number; sessoes: number }>();
  for (const s of sessions) {
    const net = s.cashout - s.buyIn * (1 + (s.reentries || 0));
    const agg = byDay.get(s.date) ?? { resultado: 0, sessoes: 0 };
    agg.resultado += net;
    agg.sessoes += 1;
    byDay.set(s.date, agg);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  let cumulative = 0;
  return days.map(([dia, agg]) => {
    cumulative += agg.resultado;
    return { dia, resultado: Math.round(agg.resultado * 100) / 100, acumulado: Math.round(cumulative * 100) / 100, sessoes: agg.sessoes };
  });
}
