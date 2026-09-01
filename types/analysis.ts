// Tipos do módulo de Análise (Player Evolution → /performance/analise).
// Cobre o volume de dados que HM3/PT4 expõem: preflop, postflop, torneios,
// matriz de mãos e leak finder. Pensado pra Supabase/Postgres: toda métrica
// vem `number | null` (null = sem amostra, nunca 0 forçado) e toda contagem
// vem junto do numerador/denominador quando a UI precisa mostrar amostra.

// ------------------------------------------------------------------
// Filtros globais (Top Bar)
// ------------------------------------------------------------------
export type GameFormat = "mtt" | "spin" | "sng" | "cash";

export const GAME_FORMAT_LABEL: Record<GameFormat, string> = {
  mtt: "MTT",
  spin: "Spin & Go / Hyper",
  sng: "SnG",
  cash: "Cash",
};

// ------------------------------------------------------------------
// Perfil de referência (faixas "comuns" de população, ver
// computeReferenceProfile em analysis-service.ts) — MTT joga com mais
// gente por mesa (8-9 handed) que Cash (6-max padrão), então a faixa
// saudável de VPIP/PFR/etc. é mais apertada em torneio. Escolhido pelo
// formato predominante nas mãos filtradas, nunca pelo usuário à mão —
// se a maioria das mãos é "mtt", usa mtt8max; qualquer outra maioria
// (cash/spin/sng/sem formato) usa cash6max, que já era a única faixa
// que o produto tinha antes disso existir.
// ------------------------------------------------------------------
export type ReferenceProfile = "cash6max" | "mtt8max";

export const REFERENCE_PROFILE_LABEL: Record<ReferenceProfile, string> = {
  cash6max: "Cash 6-max",
  mtt8max: "MTT 8-max",
};

// Faixas batem exatamente com `compute_stack_bucket()` no Postgres (stack
// do herói em bb no início da mão) — não inventamos cortes diferentes dos
// que o trigger de hand_tags já grava, senão o filtro nunca bateria com
// nenhuma linha.
export type StackDepthBucket = "0-10" | "10-20" | "20-40" | "40-60" | "60+";

export const STACK_DEPTH_LABEL: Record<StackDepthBucket, string> = {
  "0-10": "0–10bb",
  "10-20": "10–20bb",
  "20-40": "20–40bb",
  "40-60": "40–60bb",
  "60+": "60bb+",
};

export type TournamentStage = "early" | "mid" | "late" | "bubble" | "final_table";

export const TOURNAMENT_STAGE_LABEL: Record<TournamentStage, string> = {
  early: "Early",
  mid: "Mid",
  late: "Late",
  bubble: "Bolha",
  final_table: "Mesa Final",
};

// Faixa de buy-in pra filtrar a aba Torneios — cortes fixos em R$, mesmo
// espírito do StackDepthBucket (faixas arredondadas, não um número por
// torneio). Ver buyinBucketOf em analysis-service.ts.
export type BuyinBucket = "0-10" | "10-50" | "50-200" | "200+";

export const BUYIN_BUCKET_LABEL: Record<BuyinBucket, string> = {
  "0-10": "Até R$10",
  "10-50": "R$10–50",
  "50-200": "R$50–200",
  "200+": "R$200+",
};

// 8 posições reais gravadas em hand_tags.hero_position (mesma granularidade
// de components/services/performance-service.ts POSITION_ORDER) — UTG+1 e
// HJ não colapsam em MP/CO pra não perder resolução que a base já tem.
export type HeroPosition = "UTG" | "UTG+1" | "MP" | "HJ" | "CO" | "BTN" | "SB" | "BB";

export const HERO_POSITION_LABEL: Record<HeroPosition, string> = {
  UTG: "UTG",
  "UTG+1": "UTG+1",
  MP: "MP",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB",
};

export const HERO_POSITION_ORDER: HeroPosition[] = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

export type PreflopActionType = "srp" | "3bet_pot" | "4bet_plus_pot" | "limped";

export const PREFLOP_ACTION_LABEL: Record<PreflopActionType, string> = {
  srp: "Single Raised Pot",
  "3bet_pot": "3-Bet Pot",
  "4bet_plus_pot": "4-Bet+ Pot",
  limped: "Limped",
};

// hand_tags.pot_type grava esses 4 valores (compute_pot_type() no Postgres)
// — o filtro de "Ação Preflop" e' so' um rotulo mais amigavel em cima do
// mesmo dominio, sem reclassificar nada no cliente.
export type PotType = "limped" | "single_raised" | "three_bet" | "four_bet_plus";

export const PREFLOP_ACTION_TO_POT_TYPE: Record<PreflopActionType, PotType> = {
  srp: "single_raised",
  "3bet_pot": "three_bet",
  "4bet_plus_pot": "four_bet_plus",
  limped: "limped",
};

export interface DateRange {
  from: string | null; // ISO date
  to: string | null; // ISO date
}

export interface AnalysisFilters {
  dateRange: DateRange;
  formats: GameFormat[];
  stackDepths: StackDepthBucket[];
  stages: TournamentStage[];
  positions: HeroPosition[];
  preflopActions: PreflopActionType[];
}

export const EMPTY_ANALYSIS_FILTERS: AnalysisFilters = {
  dateRange: { from: null, to: null },
  formats: [],
  stackDepths: [],
  stages: [],
  positions: [],
  preflopActions: [],
};

// ------------------------------------------------------------------
// Preflop — VPIP/PFR/3-Bet/Steal/Squeeze (Data Grid)
// ------------------------------------------------------------------
export interface PreflopMetrics {
  hands: number;
  vpip_pct: number | null;
  pfr_pct: number | null;
  three_bet_pct: number | null;
  fold_to_3bet_pct: number | null;
  four_bet_pct: number | null;
  fold_to_4bet_pct: number | null;
  steal_pct: number | null;
  fold_to_steal_sb_vs_btn_pct: number | null;
  fold_to_steal_bb_vs_btn_pct: number | null;
  fold_to_steal_bb_vs_sb_pct: number | null;
  squeeze_pct: number | null;
  limp_fold_pct: number | null;
  open_push_pct: number | null;
}

export interface PreflopMetricsByPosition extends PreflopMetrics {
  position: HeroPosition;
}

// ------------------------------------------------------------------
// Postflop — C-Bet/Fold to C-Bet/Check-Raise/Aggression (Data Grid)
// ------------------------------------------------------------------
export interface PostflopMetrics {
  hands: number;
  cbet_flop_pct: number | null;
  cbet_turn_pct: number | null;
  cbet_river_pct: number | null;
  fold_to_cbet_flop_pct: number | null;
  fold_to_cbet_turn_pct: number | null;
  fold_to_cbet_river_pct: number | null;
  check_raise_flop_pct: number | null;
  check_raise_turn_pct: number | null;
  check_raise_river_pct: number | null;
  donk_bet_pct: number | null;
  aggression_factor: number | null; // (bet+raise) / call
  aggression_frequency_pct: number | null; // (bet+raise) / (bet+raise+call+fold)
  wsd_pct: number | null; // Went to Showdown
  wsd_won_pct: number | null; // Won $ at Showdown
}

export interface PostflopMetricsByStreet extends PostflopMetrics {
  street: "flop" | "turn" | "river";
}

// ------------------------------------------------------------------
// Torneios — ROI/ITM/cEV/ICM
// ------------------------------------------------------------------
export interface TournamentMetrics {
  total_games: number;
  roi_pct: number | null;
  itm_pct: number | null;
  total_profit: number | null;
  net_ev_profit: number | null; // lucro esperado (all-in EV)
  chip_ev_total: number | null; // cEV acumulado, em chips
  cev_per_game: number | null;
  ev_roi_pct: number | null;
}

export interface BlindLevelPerformance {
  blindLevelLabel: string; // ex: "50/100"
  games: number;
  netResultBB: number | null;
  cevBB: number | null;
}

export interface IcmSituationPerformance {
  situation: string; // ex: "Bolha — push/fold 15bb"
  occurrences: number;
  cevDelta: number | null; // impacto cEV médio da decisão
  icmDelta: number | null; // impacto em $EV ajustado por ICM
}

export interface PayoutStructureRow {
  place: number;
  payoutPct: number;
  payoutAmount: number | null;
}


// ------------------------------------------------------------------
// Leak Finder & Replayer
// ------------------------------------------------------------------
export type LeakSeverity = "critical" | "warning" | "info";
export type LeakCategory = "preflop" | "postflop" | "tournament" | "mental";

export interface Leak {
  id: string;
  title: string;
  description: string;
  metricValue: number | null;
  benchmarkRange: { min: number; max: number } | null;
  severity: LeakSeverity;
  category: LeakCategory;
  sampleSize: number;
  estimatedCostBB: number | null; // custo estimado do leak, em bb/100 ou bb total
}

export interface LeakHandForReview {
  handId: string;
  playedAt: string; // ISO
  format: GameFormat;
  position: HeroPosition | null;
  street: "preflop" | "flop" | "turn" | "river";
  potBB: number | null;
  netResultBB: number | null;
  leakTags: string[];
}

// ------------------------------------------------------------------
// Gráfico principal — Net Won / All-in EV / Volume
// ------------------------------------------------------------------
export interface NetWonPoint {
  date: string; // ISO date
  netWon: number;
  allInEv: number | null;
  cumulativeHandsOrGames: number;
}

// ------------------------------------------------------------------
// Linha crua — 1:1 com hand_tags + hand_reviews.parsed_data, é a unidade
// que o service busca do Supabase e sobre a qual todo o resto deste
// arquivo (filtros, métricas, matriz, leaks) é derivado no cliente.
// ------------------------------------------------------------------
export interface AnalysisHandRow {
  handReviewId: string;
  playedAt: string; // hand_reviews.created_at
  format: GameFormat | null; // normalizado de parsed_data.format ("MTT"/"Cash")
  stakes: string | null;
  heroCards: [string, string] | null; // ex: ["Kd","Qd"]
  potType: PotType | null;
  heroPosition: HeroPosition | null;
  matchup: string | null; // ex: "SB_vs_BTN" — só preenchido em pots heads-up até o flop
  stackDepthBucket: StackDepthBucket | null;
  tournamentStage: TournamentStage | null; // hoje sempre null (motor não popula ainda)
  vpip: boolean | null;
  pfr: boolean | null;
  threeBet: boolean | null;
  inPosition: boolean | null;
  isPreflopAggressor: boolean | null;
  cbetFlop: boolean | null;
  cbetTurn: boolean | null;
  cbetRiver: boolean | null;
  doubleBarrel: boolean | null;
  tripleBarrel: boolean | null;
  donkBetFlop: boolean | null;
  checkRaise: boolean | null;
  checkRaiseFlop: boolean | null;
  checkRaiseTurn: boolean | null;
  checkRaiseRiver: boolean | null;
  foldToCbetFlop: boolean | null;
  foldToCbetTurn: boolean | null;
  foldToCbetRiver: boolean | null;
  postflopBetCount: number | null;
  postflopRaiseCount: number | null;
  postflopCallCount: number | null;
  postflopFoldCount: number | null;
  wentToShowdown: boolean | null;
  wonShowdown: boolean | null;
  heroOpenRaise: boolean | null;
  stealOpportunity: boolean | null;
  stealAttempt: boolean | null;
  stealSuccess: boolean | null;
  facedThreeBet: boolean | null;
  foldToThreeBet: boolean | null;
  callThreeBet: boolean | null;
  madeFourBet: boolean | null;
  facedFourBet: boolean | null;
  foldToFourBet: boolean | null;
  blindDefenseOpportunity: boolean | null;
  blindDefended: boolean | null;
  reSteal: boolean | null;
  squeeze: boolean | null;
}
