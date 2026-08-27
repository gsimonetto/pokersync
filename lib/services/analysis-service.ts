import { createClient } from "@/lib/supabase/client";
import { fetchSessions } from "@/lib/services/bankroll-service";
import type { Session as BankrollSession } from "@/lib/bankroll/types";
import type { FinancialDay } from "@/lib/services/team-service";
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
  type HandCell,
  type Leak,
  type LeakHandForReview,
  type TournamentMetrics,
  HERO_POSITION_ORDER,
  PREFLOP_ACTION_TO_POT_TYPE,
} from "@/types/analysis";

// ============================================================
// Fonte crua: hand_tags (uma linha por mão, já classificada pelo trigger
// sync_hand_tags) embutido com hand_reviews (data + cartas do herói).
// Tudo daqui pra baixo neste arquivo é derivado no cliente em cima dessa
// lista — sem RPC nova, sem recálculo no banco. RLS de hand_tags e
// hand_reviews já restringe a linhas do próprio usuário.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    doubleBarrel: r.double_barrel,
    tripleBarrel: r.triple_barrel,
    donkBetFlop: r.donk_bet_flop,
    checkRaise: r.check_raise,
    foldToCbetFlop: r.fold_to_cbet_flop,
    heroOpenRaise: r.hero_open_raise,
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
        "in_position, is_preflop_aggressor, cbet_flop, cbet_turn, double_barrel, triple_barrel, donk_bet_flop, " +
        "check_raise, fold_to_cbet_flop, hero_open_raise, steal_attempt, steal_success, hero_faced_3bet, " +
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
  // steal_attempt só vem preenchido (true/false) quando a mão de fato era
  // uma chance de steal (CO/BTN/SB com a ação fechando nele) — null nas
  // demais, então "!== null" já é a oportunidade, sem checar posição de novo.
  const stealOpp = rows.filter((r) => r.stealAttempt !== null);
  const stealAttempts = countIf(rows, (r) => r.stealAttempt);
  const facedThreeBet = rows.filter((r) => r.facedThreeBet !== null);
  const facedFourBet = rows.filter((r) => r.facedFourBet !== null);
  // matchup só vem preenchido em pots heads-up até o flop ("SB_vs_BTN"),
  // então dá pra isolar o vilão real do steal em vez de aproximar por
  // blind_defense_opportunity genérico (que não distingue quem abriu).
  const stealVsSbBtn = rows.filter((r) => r.heroPosition === "SB" && r.matchup === "SB_vs_BTN" && r.blindDefenseOpportunity !== null);
  const stealVsBbBtn = rows.filter((r) => r.heroPosition === "BB" && r.matchup === "BB_vs_BTN" && r.blindDefenseOpportunity !== null);
  const stealVsBbSb = rows.filter((r) => r.heroPosition === "BB" && r.matchup === "BB_vs_SB" && r.blindDefenseOpportunity !== null);
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

// ============================================================
// Postflop
// ============================================================
export function computePostflopMetrics(rows: AnalysisHandRow[]): PostflopMetrics {
  const pfaHands = rows.filter((r) => r.isPreflopAggressor === true);
  const nonPfaHands = rows.filter((r) => r.isPreflopAggressor === false);
  const facedCbetFlop = rows.filter((r) => r.foldToCbetFlop !== null);

  return {
    hands: rows.length,
    cbet_flop_pct: pct(countIf(pfaHands, (r) => r.cbetFlop), pfaHands.length),
    cbet_turn_pct: pct(countIf(pfaHands, (r) => r.cbetTurn), pfaHands.length),
    cbet_river_pct: null, // hand_tags não rastreia c-bet de river (motor pós-flop ainda não roda essa rua)
    fold_to_cbet_flop_pct: pct(countIf(facedCbetFlop, (r) => r.foldToCbetFlop), facedCbetFlop.length),
    fold_to_cbet_turn_pct: null,
    fold_to_cbet_river_pct: null,
    // check_raise é uma flag única (qualquer rua) — não dá pra separar
    // flop/turn sem inventar um dado que a base não guarda.
    check_raise_flop_pct: pct(countIf(nonPfaHands, (r) => r.checkRaise), nonPfaHands.length),
    check_raise_turn_pct: null,
    donk_bet_pct: pct(countIf(nonPfaHands, (r) => r.donkBetFlop), nonPfaHands.length),
    aggression_factor: null, // exige contagem de bet/raise/call por rua — não gravado por hand_tags
    aggression_frequency_pct: null,
    wsd_pct: null, // showdown não é sinalizado como coluna própria ainda
    wsd_won_pct: null,
  };
}

// ============================================================
// Matriz 13x13
// ============================================================
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

// Referência simplificada de RFI (não é output de solver) — mesma lógica
// de "faixa de referência, não veredito" já usada em REF (VPIP/PFR) na
// tela de Performance: dá escala visual pro heatmap sem fingir precisão
// que o produto ainda não tem (o motor GTO próprio nunca rodou pra este
// grid — ver preflop_ranges/flop_subsets em POKERSYNC.md §8, órfãos).
function referenceRfiPct(row: number, col: number): number {
  const gap = Math.abs(row - col);
  if (row === col) return Math.max(6, 100 - row * 7); // pares: baixa com a força
  const suited = col > row;
  const base = suited ? 100 - gap * 9 - row * 4 : 100 - gap * 13 - row * 6;
  return Math.max(0, Math.min(100, base));
}

function cardToHandLabel(a: string, b: string): { hand: string; row: number; col: number } | null {
  const rankOf = (c: string) => c[0]?.toUpperCase();
  const ra = rankOf(a);
  const rb = rankOf(b);
  const ia = RANKS.indexOf(ra);
  const ib = RANKS.indexOf(rb);
  if (ia === -1 || ib === -1) return null;
  const suited = a[1]?.toLowerCase() === b[1]?.toLowerCase();
  if (ia === ib) return { hand: `${ra}${rb}`, row: ia, col: ia };
  const hi = Math.min(ia, ib);
  const lo = Math.max(ia, ib);
  // Convenção HM3/PT4: acima da diagonal = suited (col > row), abaixo = offsuit.
  if (suited) return { hand: `${RANKS[hi]}${RANKS[lo]}s`, row: hi, col: lo };
  return { hand: `${RANKS[hi]}${RANKS[lo]}o`, row: lo, col: hi };
}

export function computeHandMatrix(rows: AnalysisHandRow[]): HandCell[] {
  const cells: HandCell[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const suited = col > row;
      const hand = row === col ? `${RANKS[row]}${RANKS[row]}` : suited ? `${RANKS[row]}${RANKS[col]}s` : `${RANKS[col]}${RANKS[row]}o`;
      cells.push({ hand, row, col, playedPct: null, gtoPct: referenceRfiPct(row, col), sample: 0, netBB: null });
    }
  }

  const byHand = new Map(cells.map((c) => [`${c.row}-${c.col}`, c]));
  const dealtCount = new Map<string, { dealt: number; played: number }>();

  for (const r of rows) {
    if (!r.heroCards) continue;
    const label = cardToHandLabel(r.heroCards[0], r.heroCards[1]);
    if (!label) continue;
    const key = `${label.row}-${label.col}`;
    const agg = dealtCount.get(key) ?? { dealt: 0, played: 0 };
    agg.dealt += 1;
    if (r.vpip) agg.played += 1;
    dealtCount.set(key, agg);
  }

  for (const [key, agg] of dealtCount) {
    const cell = byHand.get(key);
    if (!cell) continue;
    cell.sample = agg.dealt;
    cell.playedPct = pct(agg.played, agg.dealt);
  }

  return cells;
}

// ============================================================
// Leak Finder
// ============================================================
// Faixas de referência (mesmo espírito do REF em performance-service.ts):
// contexto, não veredito — variam por formato/mesa e nunca viram "erro"
// sozinhas, só entram como leak quando a amostra já é razoável.
const LEAK_THRESHOLDS: {
  id: string;
  title: string;
  category: Leak["category"];
  metric: (pf: PreflopMetrics, po: PostflopMetrics) => number | null;
  min?: number;
  max?: number;
  minSample: number;
  sample: (pf: PreflopMetrics, po: PostflopMetrics) => number;
  describe: (v: number) => string;
}[] = [
  {
    id: "low-cbet-flop",
    title: "C-Bet Flop muito baixo",
    category: "postflop",
    metric: (_pf, po) => po.cbet_flop_pct,
    min: 45,
    minSample: 15,
    sample: (_pf, po) => po.hands,
    describe: (v) => `Você faz c-bet no flop em apenas ${v}% das vezes como agressor pré-flop — abaixo do comum (55–75%). Está deixando fold equity na mesa.`,
  },
  {
    id: "high-fold-cbet-flop",
    title: "Fold to C-Bet Flop muito alto",
    category: "postflop",
    metric: (_pf, po) => po.fold_to_cbet_flop_pct,
    max: 65,
    minSample: 10,
    sample: (_pf, po) => po.hands,
    describe: (v) => `Você foldou ${v}% das vezes que enfrentou c-bet no flop — acima do comum (40–60%). Pode estar sendo explorado por barrels leves.`,
  },
  {
    id: "low-3bet",
    title: "3-Bet % muito baixo",
    category: "preflop",
    metric: (pf) => pf.three_bet_pct,
    min: 4,
    minSample: 40,
    sample: (pf) => pf.hands,
    describe: (v) => `Sua taxa de 3-bet está em ${v}% — abaixo da faixa comum (5–10%). Range preflop provavelmente passivo demais.`,
  },
  {
    id: "high-fold-3bet",
    title: "Fold to 3-Bet muito alto",
    category: "preflop",
    metric: (pf) => pf.fold_to_3bet_pct,
    max: 65,
    minSample: 8,
    sample: (pf) => pf.hands,
    describe: (v) => `Você foldou para 3-bet em ${v}% das vezes — acima do comum (35–55%). Está aberto para squeeze e 3-bet bluff.`,
  },
  {
    id: "low-steal",
    title: "Steal % muito baixo",
    category: "preflop",
    metric: (pf) => pf.steal_pct,
    min: 25,
    minSample: 20,
    sample: (pf) => pf.hands,
    describe: (v) => `Você tenta roubar o pote em apenas ${v}% das suas chances (CO/BTN/SB) — abaixo do comum (35–55%). Está deixando dinheiro fácil na mesa.`,
  },
];

export function computeLeaks(preflop: PreflopMetrics, postflop: PostflopMetrics): Leak[] {
  const leaks: Leak[] = [];
  for (const t of LEAK_THRESHOLDS) {
    const value = t.metric(preflop, postflop);
    const sample = t.sample(preflop, postflop);
    if (value === null || sample < t.minSample) continue;
    const below = t.min !== undefined && value < t.min;
    const above = t.max !== undefined && value > t.max;
    if (!below && !above) continue;
    const severity: Leak["severity"] =
      (below && value < t.min! - 8) || (above && value > t.max! + 15) ? "critical" : "warning";
    leaks.push({
      id: t.id,
      title: t.title,
      description: t.describe(value),
      metricValue: value,
      benchmarkRange: t.min !== undefined || t.max !== undefined ? { min: t.min ?? 0, max: t.max ?? 100 } : null,
      severity,
      category: t.category,
      sampleSize: sample,
      estimatedCostBB: null, // exigiria ligar cada decisão a um resultado em bb — não temos essa amarração ainda
    });
  }
  return leaks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}

// Mãos candidatas a revisão pra cada leak — filtra pelas mesmas flags que
// geraram o leak, sem novo fetch (opera sobre os rows já carregados).
export function computeLeakHands(rows: AnalysisHandRow[], leakId: string): LeakHandForReview[] {
  const predicate: Record<string, (r: AnalysisHandRow) => boolean> = {
    "low-cbet-flop": (r) => r.isPreflopAggressor === true && r.cbetFlop === false,
    "high-fold-cbet-flop": (r) => r.foldToCbetFlop === true,
    "low-3bet": (r) => r.facedThreeBet === false && r.potType === "single_raised" && r.pfr === true,
    "high-fold-3bet": (r) => r.foldToThreeBet === true,
    "low-steal": (r) => r.stealAttempt === false,
  };
  const pred = predicate[leakId];
  if (!pred) return [];
  return rows
    .filter(pred)
    .slice(-25)
    .map((r) => ({
      handId: r.handReviewId,
      playedAt: r.playedAt,
      format: r.format ?? "mtt",
      position: r.heroPosition,
      street: "preflop",
      potBB: null,
      netResultBB: null,
      leakTags: [leakId],
    }));
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

export async function fetchTournamentMetrics(): Promise<TournamentMetrics> {
  const sessions = (await fetchSessions()).filter(isTournamentSession);
  const invested = sessions.reduce((acc, s) => acc + s.buyIn * (1 + (s.reentries || 0)), 0);
  const returned = sessions.reduce((acc, s) => acc + s.cashout, 0);
  const itmCount = sessions.filter((s) => s.cashout > 0).length;

  return {
    total_games: sessions.length,
    roi_pct: invested > 0 ? Math.round(((returned - invested) / invested) * 1000) / 10 : null,
    itm_pct: sessions.length > 0 ? pct(itmCount, sessions.length) : null,
    total_profit: sessions.length > 0 ? Math.round((returned - invested) * 100) / 100 : null,
    net_ev_profit: null,
    chip_ev_total: null,
    cev_per_game: null,
    ev_roi_pct: null,
  };
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
