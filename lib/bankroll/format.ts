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

// --- Multi-moeda -------------------------------------------------------
// A maioria dos jogadores so' usa uma moeda (BRL) — esses formatters so'
// entram em cena quando a tela detecta mais de uma moeda nos dados
// (ver `currencyFilter` em app/banca/page.tsx), pra nunca somar R$ com
// $ como se fossem a mesma unidade.
export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const CURRENCY_FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  BRL: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  EUR: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),
};

export function fmtMoneyIn(v: number, currency: string) {
  const fmt = CURRENCY_FORMATTERS[currency as Currency] ?? CURRENCY_FORMATTERS.BRL;
  return fmt.format(Number(v) || 0);
}

export function fmtSignedMoneyIn(v: number, currency: string) {
  const n = Number(v) || 0;
  return (n > 0 ? "+" : "") + fmtMoneyIn(n, currency);
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

// --- Exportar relatorio (CSV) ---------------------------------------------
// CSV simples, direto do client (sem lib externa) — separador virgula,
// campos entre aspas (escapa aspas internas dobrando, padrao RFC4180).
// Cobre o pedido de "relatorio por periodo" — a UI ja filtra `sessions`
// pelo range antes de chamar isso.
export function sessionsToCSV(sessions: Session[], resultOf: (s: Session) => number): string {
  const header = ["Data", "Formato", "Buy-in", "Reentradas", "Cashout", "Resultado", "Stake", "Moeda", "Local", "Notas"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = sessions.map((s) => [
    s.date,
    s.format,
    s.buyIn,
    s.reentries,
    s.cashout,
    resultOf(s).toFixed(2),
    s.stake || "",
    s.currency || "BRL",
    s.venue || "",
    s.notes || "",
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  // BOM (\uFEFF) pra Excel PT-BR abrir acentuacao certo — sem isso "ROI"
  // e afins ficam com encoding quebrado no Excel default do Windows.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
