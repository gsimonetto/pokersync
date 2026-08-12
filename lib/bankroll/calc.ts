import { weekdayName, hourOf, timeBucket } from "./format";
import type { Session, Transaction, Goal, StudyLog, BrmThreshold, BrmFormat } from "./types";

const TOURNEY = new Set(["MTT", "SNG", "Spin"]);

export function invested(s: Session) {
  return (Number(s.buyIn) || 0) * (1 + (Number(s.reentries) || 0));
}

export function entries(s: Session) {
  return 1 + (Number(s.reentries) || 0);
}

export function net(s: Session) {
  return (Number(s.cashout) || 0) - invested(s);
}

export interface Aggregate {
  n: number;
  totalInvested: number;
  totalCashout: number;
  profit: number;
  roi: number;
  itm: number;
  avgBuyIn: number;
  tourneyCount: number;
  itmCount: number;
}

export function aggregate(sessions: Session[]): Aggregate {
  const list = sessions || [];
  let totalInvested = 0,
    totalCashout = 0,
    buyInSum = 0,
    tourneyCount = 0,
    itmCount = 0;
  for (const s of list) {
    totalInvested += invested(s);
    totalCashout += Number(s.cashout) || 0;
    buyInSum += Number(s.buyIn) || 0;
    if (TOURNEY.has(s.format)) {
      tourneyCount += 1;
      if ((Number(s.cashout) || 0) > 0) itmCount += 1;
    }
  }
  const n = list.length;
  const profit = totalCashout - totalInvested;
  return {
    n,
    totalInvested,
    totalCashout,
    profit,
    roi: totalInvested > 0 ? (profit / totalInvested) * 100 : 0,
    itm: tourneyCount > 0 ? (itmCount / tourneyCount) * 100 : 0,
    avgBuyIn: n > 0 ? buyInSum / n : 0,
    tourneyCount,
    itmCount,
  };
}

const sortKey = (s: Session) => (s.date || "") + "T" + (s.time || "00:00");

export interface SeriesPoint {
  date: string;
  label: string;
  value: number;
  net: number;
  format: string;
}

export function evolutionSeries(sessions: Session[], start = 0): SeriesPoint[] {
  const sorted = [...(sessions || [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  let cum = start;
  return sorted.map((s) => {
    cum += net(s);
    return {
      date: s.date,
      label: (s.date || "").slice(5),
      value: +cum.toFixed(2),
      net: +net(s).toFixed(2),
      format: s.format,
    };
  });
}

function groupKey(s: Session, dimension: "format" | "weekday" | "time") {
  if (dimension === "format") return s.format || "—";
  if (dimension === "weekday") return weekdayName(s.date);
  if (dimension === "time") return timeBucket(hourOf(s)) ?? "Sem horario";
  return "—";
}

export interface GroupStat {
  key: string;
  n: number;
  invested: number;
  net: number;
  roi: number;
}

export function groupStats(sessions: Session[], dimension: "format" | "weekday" | "time"): GroupStat[] {
  const groups: Record<string, Session[]> = {};
  for (const s of sessions || []) {
    const key = groupKey(s, dimension);
    (groups[key] ||= []).push(s);
  }
  return Object.entries(groups)
    .map(([key, arr]) => {
      const a = aggregate(arr);
      return { key, n: arr.length, invested: a.totalInvested, net: a.profit, roi: a.roi };
    })
    .sort((a, b) => a.net - b.net);
}

// --- Leak comportamental: tilt/mood (diario pos-sessao) -------------------
// Cruza o diario (mood registrado na sessao) com o resultado — pra
// responder "eu realmente jogo pior quando marco tilt?" com numero, nao
// so intuicao. So considera sessoes que tem mood preenchido.
export interface TiltImpact {
  tiltN: number;
  tiltRoi: number;
  tiltNet: number;
  otherN: number;
  otherRoi: number;
  otherNet: number;
}

export function tiltImpact(sessions: Session[]): TiltImpact | null {
  const withMood = (sessions || []).filter((s) => s.mood);
  if (withMood.length === 0) return null;
  const tilt = withMood.filter((s) => s.mood === "tilt");
  const other = withMood.filter((s) => s.mood !== "tilt");
  if (tilt.length === 0) return null;
  const aTilt = aggregate(tilt);
  const aOther = aggregate(other);
  return {
    tiltN: tilt.length,
    tiltRoi: aTilt.roi,
    tiltNet: aTilt.profit,
    otherN: other.length,
    otherRoi: aOther.roi,
    otherNet: aOther.profit,
  };
}

export type RangeOption = "7D" | "30D" | "1Y" | "all";

export function filterSeriesByRange(series: SeriesPoint[], range: RangeOption): SeriesPoint[] {
  if (!series?.length || range === "all") return series;
  const days = { "7D": 7, "30D": 30, "1Y": 365 }[range];
  if (!days) return series;
  const ref = new Date(series[series.length - 1].date + "T12:00:00");
  const cutoff = new Date(ref);
  cutoff.setDate(ref.getDate() - days);
  return series.filter((p) => new Date(p.date + "T12:00:00") >= cutoff);
}

// Mesmo corte de `filterSeriesByRange`, mas sobre Session[] cru — usado
// pelo export CSV (que precisa dos campos originais da sessao, nao so o
// ponto acumulado da serie).
export function filterSessionsByRange(sessions: Session[], range: RangeOption): Session[] {
  if (!sessions?.length || range === "all") return sessions;
  const days = { "7D": 7, "30D": 30, "1Y": 365 }[range];
  if (!days) return sessions;
  const sorted = [...sessions].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const ref = new Date(sorted[sorted.length - 1].date + "T12:00:00");
  const cutoff = new Date(ref);
  cutoff.setDate(ref.getDate() - days);
  return sessions.filter((s) => new Date(s.date + "T12:00:00") >= cutoff);
}

// --- Patrimonio (banca de jogo vs total) --------------------------------
// Banca de jogo = base + resultado das sessoes + depositos - saques - caixinha.
// Patrimonio total = base + resultado das sessoes + depositos (ignora pra
// onde o dinheiro foi depois de sair da mesa — saque/caixinha nao e' perda,
// so muda de "em jogo" pra "reservado").
export interface NetWorth {
  playingBankroll: number;
  netWorth: number;
  withdrawn: number;
  caixinha: number;
  deposits: number;
}

export function netWorth(base: number, sessionsProfit: number, transactions: Transaction[]): NetWorth {
  let deposits = 0,
    withdrawn = 0,
    caixinha = 0;
  for (const t of transactions || []) {
    const v = Number(t.amount) || 0;
    if (t.type === "deposito") deposits += v;
    else if (t.type === "saque") withdrawn += v;
    else if (t.type === "caixinha") caixinha += v;
  }
  const totalIn = base + sessionsProfit + deposits;
  return {
    playingBankroll: totalIn - withdrawn - caixinha,
    netWorth: totalIn,
    withdrawn,
    caixinha,
    deposits,
  };
}

// --- Metas (volume e estudo) --------------------------------------------
function periodStart(period: "semanal" | "mensal", ref = new Date()): Date {
  const d = new Date(ref);
  if (period === "semanal") {
    const day = d.getDay(); // 0=domingo
    d.setDate(d.getDate() - day);
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface GoalProgress {
  goal: Goal;
  current: number;
  pct: number;
}

export function goalProgress(goal: Goal, sessions: Session[], studyLogs: StudyLog[]): GoalProgress {
  const start = periodStart(goal.period);
  let current = 0;
  if (goal.type === "volume") {
    current = (sessions || []).filter((s) => new Date(s.date + "T12:00:00") >= start).length;
  } else {
    current =
      (studyLogs || [])
        .filter((l) => new Date(l.date + "T12:00:00") >= start)
        .reduce((sum, l) => sum + (Number(l.minutes) || 0), 0) / 60;
  }
  const pct = goal.target > 0 ? Math.min(100, (current / goal.target) * 100) : 0;
  return { goal, current: +current.toFixed(1), pct };
}

// --- Risco de ruina (Monte Carlo simplificado) ----------------------------
// Bootstrap: reamostra os resultados HISTORICOS reais de sessao (nao
// assume distribuicao normal — variancia de poker e' assimetrica,
// principalmente em MTT) pra simular `horizonSessions` sessoes futuras,
// repetido `simulations` vezes. % de simulacoes que zeram a banca antes
// do fim do horizonte = risco de ruina estimado. Precisa de amostra
// minima (15 sessoes) pra nao virar numero aleatorio sem base.
export interface RiskOfRuinResult {
  ruinPct: number;
  simulations: number;
  horizonSessions: number;
  sampleSize: number;
}

const MIN_SAMPLE_FOR_RUIN = 15;

export function riskOfRuin(
  sessions: Session[],
  startingBankroll: number,
  horizonSessions = 100,
  simulations = 500
): RiskOfRuinResult | null {
  const results = (sessions || []).map((s) => net(s));
  if (results.length < MIN_SAMPLE_FOR_RUIN || startingBankroll <= 0) return null;
  let ruinCount = 0;
  for (let sim = 0; sim < simulations; sim++) {
    let bankroll = startingBankroll;
    for (let step = 0; step < horizonSessions; step++) {
      const idx = Math.floor(Math.random() * results.length);
      bankroll += results[idx];
      if (bankroll <= 0) {
        ruinCount++;
        break;
      }
    }
  }
  return {
    ruinPct: +((ruinCount / simulations) * 100).toFixed(1),
    simulations,
    horizonSessions,
    sampleSize: results.length,
  };
}

// --- Comparacao de periodos (mes atual vs mes anterior) -------------------
export interface PeriodComparison {
  current: Aggregate;
  previous: Aggregate;
  currentLabel: string;
  previousLabel: string;
}

function inMonthRange(dateStr: string, start: Date, end: Date): boolean {
  const dt = new Date(dateStr + "T12:00:00");
  return dt >= start && dt < end;
}

export function compareMonths(sessions: Session[], ref = new Date()): PeriodComparison {
  const y = ref.getFullYear(),
    m = ref.getMonth();
  const startCurrent = new Date(y, m, 1);
  const startPrev = new Date(y, m - 1, 1);
  const startNext = new Date(y, m + 1, 1);
  const current = (sessions || []).filter((s) => inMonthRange(s.date, startCurrent, startNext));
  const previous = (sessions || []).filter((s) => inMonthRange(s.date, startPrev, startCurrent));
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    current: aggregate(current),
    previous: aggregate(previous),
    currentLabel: fmt(startCurrent),
    previousLabel: fmt(startPrev),
  };
}

// --- BRM: moveup / movedown por formato ----------------------------------
// Padrao de mercado: cash tem variancia menor (30 buy-ins cobre bem, sobe
// de limite acima disso, desce abaixo de 15). Torneio (MTT/SNG/Spin) tem
// variancia bem maior — 100 buy-ins e o piso recomendado, desce abaixo de
// 50. Sao so os valores INICIAIS; o jogador pode editar cada um.
export const DEFAULT_BRM_THRESHOLDS: BrmThreshold[] = [
  { format: "Cash", moveupBuyins: 30, movedownBuyins: 15 },
  { format: "MTT", moveupBuyins: 100, movedownBuyins: 50 },
  { format: "SNG", moveupBuyins: 100, movedownBuyins: 50 },
  { format: "Spin", moveupBuyins: 100, movedownBuyins: 50 },
];

export function thresholdFor(thresholds: BrmThreshold[], format: string): BrmThreshold {
  return (
    thresholds.find((t) => t.format === format) ||
    DEFAULT_BRM_THRESHOLDS.find((t) => t.format === format) ||
    DEFAULT_BRM_THRESHOLDS[0]
  );
}

export type BrmStatus = "movedown" | "hold" | "moveup";

export interface BrmReading {
  format: BrmFormat;
  avgBuyIn: number;
  buyInsCovered: number;
  threshold: BrmThreshold;
  status: BrmStatus;
}

// Le' o formato/stake mais jogado recentemente (ultimas `lookback`
// sessoes) e calcula quantos buy-ins desse formato a banca atual cobre,
// comparando com o threshold configurado — usado tanto na UI quanto no
// Coach.
export function brmReading(
  sessions: Session[],
  bankroll: number,
  thresholds: BrmThreshold[],
  lookback = 15
): BrmReading | null {
  const recent = [...(sessions || [])].slice(-lookback);
  if (recent.length === 0) return null;
  const count: Record<string, number> = {};
  for (const s of recent) count[s.format] = (count[s.format] || 0) + 1;
  const format = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] as BrmFormat;
  const sameFormat = recent.filter((s) => s.format === format);
  const avgBuyIn = sameFormat.reduce((sum, s) => sum + (Number(s.buyIn) || 0), 0) / sameFormat.length;
  if (avgBuyIn <= 0) return null;
  const buyInsCovered = bankroll / avgBuyIn;
  const threshold = thresholdFor(thresholds, format);
  const status: BrmStatus =
    buyInsCovered >= threshold.moveupBuyins ? "moveup" : buyInsCovered < threshold.movedownBuyins ? "movedown" : "hold";
  return { format, avgBuyIn, buyInsCovered: +buyInsCovered.toFixed(1), threshold, status };
}
