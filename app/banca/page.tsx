"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Session } from "@/lib/bankroll/types";
import { aggregate, evolutionSeries, filterSeriesByRange, net, type RangeOption } from "@/lib/bankroll/calc";
import { buildCoachTips, type CoachTip } from "@/lib/bankroll/coach";
import { fmtMoney, fmtSignedMoney, fmtPct, FORMATS, todayISO } from "@/lib/bankroll/format";
import {
  fetchSessions,
  fetchSettings,
  addSession as apiAddSession,
  deleteSession as apiDeleteSession,
} from "@/lib/services/bankroll-service";

const RANGES: { value: RangeOption; label: string }[] = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "1Y", label: "Ano" },
  { value: "all", label: "Tudo" },
];

export default function BankrollPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bankroll, setBankroll] = useState(0);
  const [range, setRange] = useState<RangeOption>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [format, setFormat] = useState(FORMATS[0]);
  const [date, setDate] = useState(todayISO());
  const [buyIn, setBuyIn] = useState("");
  const [reentries, setReentries] = useState("0");
  const [cashout, setCashout] = useState("");
  const [stake, setStake] = useState("");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, cfg] = await Promise.all([fetchSessions(), fetchSettings()]);
        if (!alive) return;
        setSessions(s);
        setBankroll(cfg.bankroll);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Falha ao carregar sua banca.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const base = Number(bankroll) || 0;
  const agg = useMemo(() => aggregate(sessions), [sessions]);
  const currentBankroll = base + agg.profit;
  const series = useMemo(() => evolutionSeries(sessions, base), [sessions, base]);
  const filteredSeries = useMemo(() => filterSeriesByRange(series, range), [series, range]);
  const tips = useMemo(() => buildCoachTips(sessions, { bankroll: currentBankroll }), [sessions, currentBankroll]);
  const recent = [...sessions].reverse().slice(0, 8);

  async function handleAddSession() {
    if (!buyIn || !cashout || !date) {
      setErr("Preencha data, buy-in e cashout.");
      return;
    }
    const draft: Session = {
      id: `tmp-${Date.now()}`,
      date,
      format,
      buyIn: Number(buyIn),
      reentries: Number(reentries) || 0,
      cashout: Number(cashout),
      stake,
      venue,
      notes,
    };
    setSessions((prev) => [...prev, draft]);
    setBuyIn("");
    setCashout("");
    setStake("");
    setVenue("");
    setNotes("");
    setReentries("0");
    setErr("");
    try {
      const saved = await apiAddSession(draft);
      setSessions((prev) => prev.map((x) => (x.id === draft.id ? saved : x)));
    } catch {
      setErr("Nao foi possivel salvar a sessao.");
      setSessions((prev) => prev.filter((x) => x.id !== draft.id));
    }
  }

  async function handleRemove(id: string) {
    const backup = sessions;
    setSessions((prev) => prev.filter((x) => x.id !== id));
    try {
      await apiDeleteSession(id);
    } catch {
      setErr("Nao foi possivel excluir. Restaurando.");
      setSessions(backup);
    }
  }

  if (loading) {
    return <main className="p-10 text-center text-sm text-muted">Carregando sua banca...</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Link href="/modulos" className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestao de Banca</h1>
          <p className="mt-0.5 text-sm text-muted">Controle de risco, ROI e coach de bankroll.</p>
        </div>
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Banca atual" value={fmtMoney(currentBankroll)} />
        <StatCard label="Resultado" value={fmtSignedMoney(agg.profit)} tone={agg.profit >= 0 ? "positive" : "negative"} />
        <StatCard label="ROI" value={fmtPct(agg.roi)} tone={agg.roi >= 0 ? "positive" : "negative"} />
        <StatCard label="ITM" value={`${agg.itm.toFixed(1)}%`} />
      </div>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Evolucao da banca</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase ${
                  range === r.value ? "bg-ink text-void" : "text-muted"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <EvolutionSparkline points={filteredSeries.map((p) => p.value)} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">AI Poker Coach</h2>
        <div className="mt-4 flex flex-col gap-3">
          {tips.map((tip: CoachTip) => (
            <div key={tip.id} className={`rounded-lg border p-3 text-sm ${toneClasses(tip.level)}`}>
              <p className="font-semibold">{tip.title}</p>
              <p className="mt-1 text-xs text-muted">{tip.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Registrar sessao</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Buy-in"
              value={buyIn}
              onChange={(e) => setBuyIn(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Reentradas"
              value={reentries}
              onChange={(e) => setReentries(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Cashout"
              value={cashout}
              onChange={(e) => setCashout(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Stake"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Local"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm"
            />
          </div>
          <button
            onClick={handleAddSession}
            className="mt-4 w-full rounded-lg bg-ink py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-void"
          >
            Salvar sessao
          </button>
        </section>

        <section className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Sessoes recentes</h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma sessao registrada.</p>
          ) : (
            <div className="mt-2 flex flex-col">
              {recent.map((s) => {
                const result = net(s);
                return (
                  <div key={s.id} className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {s.format} · {s.date}
                        {s.stake ? ` · ${s.stake}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {s.venue || "—"}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${result >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmtSignedMoney(result)}
                    </span>
                    <button onClick={() => handleRemove(s.id)} className="text-muted">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-muted">
        Calculadora de BRM e painel de leaks ficam para a proxima leva desta fase.
      </p>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  const color = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink";
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-1.5 text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function toneClasses(level: CoachTip["level"]) {
  if (level === "good") return "border-positive/35 bg-positive/10";
  if (level === "bad") return "border-negative/35 bg-negative/10";
  if (level === "warn") return "border-evolution/35 bg-evolution/10";
  return "border-hairline bg-elevated";
}

function EvolutionSparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted">Registre ao menos 2 sessoes para ver o grafico.</p>;
  }
  const w = 600,
    h = 120,
    pad = 8;
  const min = Math.min(...points),
    max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1];
  const color = last >= 0 ? "#22c55e" : "#e0555a";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
