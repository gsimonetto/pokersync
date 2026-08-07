import { weekdayName, hourOf, timeBucket } from "./format";
import type { Session } from "./types";

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
