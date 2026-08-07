import type { Session } from "./types";

export const FORMATS = ["MTT", "Cash", "SNG", "Spin"];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function fmtMoney(v: number) {
  return money.format(Number(v) || 0);
}

export function fmtSignedMoney(v: number) {
  const n = Number(v) || 0;
  return (n > 0 ? "+" : "") + money.format(n);
}

export function fmtPct(v: number, digits = 1) {
  const n = Number(v) || 0;
  return (n > 0 ? "+" : "") + n.toFixed(digits) + "%";
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

export function weekdayIndex(dateStr: string) {
  return new Date((dateStr || "") + "T12:00:00").getDay();
}

export function weekdayName(dateStr: string) {
  return WEEKDAYS[weekdayIndex(dateStr)] ?? "—";
}

export const TIME_BUCKETS = ["Madrugada", "Manha", "Tarde", "Noite"];

export function hourOf(session: Session) {
  if (!session?.time) return null;
  const h = parseInt(String(session.time).slice(0, 2), 10);
  return Number.isNaN(h) ? null : h;
}

export function timeBucket(hour: number | null) {
  if (hour == null || Number.isNaN(hour)) return null;
  if (hour < 6) return "Madrugada";
  if (hour < 12) return "Manha";
  if (hour < 18) return "Tarde";
  return "Noite";
}

export function suggestFormat(sessions: Session[], lookback = 10) {
  if (!sessions?.length) return "MTT";
  const recent = sessions.slice(-lookback);
  const count: Record<string, number> = {};
  for (const s of recent) count[s.format] = (count[s.format] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
}

export function suggestBuyIn(sessions: Session[], format: string) {
  const last = [...(sessions || [])].reverse().find((s) => s.format === format);
  return last ? last.buyIn : "";
}

export function knownVenues(sessions: Session[]) {
  return [...new Set((sessions || []).map((s) => s.venue).filter(Boolean))] as string[];
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
