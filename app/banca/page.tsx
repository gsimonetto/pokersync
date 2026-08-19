"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, PiggyBank, Wallet, Target, BookOpen, ChevronDown, Plus, X, Gauge, Flame, Download, StickyNote, GitCompare, ShieldAlert, Hash, History, Clock, Landmark, Search } from "lucide-react";
import type { Session, Transaction, TransactionType, Goal, GoalType, GoalPeriod, StudyLog, BrmThreshold, BrmFormat, Annotation } from "@/lib/bankroll/types";
import { aggregate, evolutionSeries, filterSeriesByRange, filterSessionsByRange, net, netWorth, goalProgress, brmReading, thresholdFor, groupStats, tiltImpact, riskOfRuin, compareMonths, hourlyRate, platformBalances, dailyActivity, type RangeOption, type SeriesPoint, type GroupStat, type BrmStatus, type DayActivity } from "@/lib/bankroll/calc";
import { buildCoachTips, drawdownBuyIns, type CoachTip } from "@/lib/bankroll/coach";
import { fmtMoney, fmtSignedMoney, fmtPct, FORMATS, todayISO, sessionsToCSV, downloadCSV } from "@/lib/bankroll/format";
import { PLATFORMS, OUTRO_PLATFORM } from "@/lib/bankroll/platforms";
import {
  fetchSessions,
  fetchSettings,
  addSession as apiAddSession,
  deleteSession as apiDeleteSession,
  updateSessionDiary as apiUpdateSessionDiary,
  fetchTransactions,
  addTransaction as apiAddTransaction,
  deleteTransaction as apiDeleteTransaction,
  fetchGoals,
  addGoal as apiAddGoal,
  deleteGoal as apiDeleteGoal,
  fetchStudyLogs,
  addStudyLog as apiAddStudyLog,
  fetchBrmThresholds,
  saveBrmThreshold as apiSaveBrmThreshold,
  fetchAnnotations,
  addAnnotation as apiAddAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
  notifyBrmAlert,
} from "@/lib/services/bankroll-service";

const RANGES: { value: RangeOption; label: string }[] = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "1Y", label: "Ano" },
  { value: "all", label: "Tudo" },
];

const TX_LABELS: Record<TransactionType, string> = {
  deposito: "Deposito",
  saque: "Saque",
  caixinha: "Caixinha",
};

export default function BankrollPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [brmThresholds, setBrmThresholds] = useState<BrmThreshold[]>([]);
  const [leakDimension, setLeakDimension] = useState<"format" | "weekday" | "time">("format");
  const [bankroll, setBankroll] = useState(0);
  const [range, setRange] = useState<RangeOption>("all");
  const [view, setView] = useState<"jogo" | "patrimonio">("jogo");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("todas");

  const [format, setFormat] = useState(FORMATS[0]);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [reentries, setReentries] = useState("0");
  const [cashout, setCashout] = useState("");
  const [stake, setStake] = useState("");
  const [venue, setVenue] = useState<string>(PLATFORMS[0]);
  const [venueOther, setVenueOther] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [showDiary, setShowDiary] = useState(false);
  const [mood, setMood] = useState("");
  const [tilt, setTilt] = useState("");
  const [diaryNote, setDiaryNote] = useState("");

  const [txType, setTxType] = useState<TransactionType>("saque");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txNote, setTxNote] = useState("");
  const [txVenue, setTxVenue] = useState<string>(PLATFORMS[0]);
  const [txVenueOther, setTxVenueOther] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const [goalType, setGoalType] = useState<GoalType>("volume");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("semanal");
  const [goalTarget, setGoalTarget] = useState("");

  const [coachExpanded, setCoachExpanded] = useState(false);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [brmModalOpen, setBrmModalOpen] = useState(false);
  const leaksRef = useRef<HTMLElement | null>(null);
  const [calcFormat, setCalcFormat] = useState<BrmFormat>("Cash");
  const [calcBuyIn, setCalcBuyIn] = useState("");

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annoModalOpen, setAnnoModalOpen] = useState(false);
  const [annoDate, setAnnoDate] = useState(todayISO());
  const [annoNote, setAnnoNote] = useState("");

  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, cfg, tx, gl, sl, brm, annos] = await Promise.all([
          fetchSessions(),
          fetchSettings(),
          fetchTransactions(),
          fetchGoals(),
          fetchStudyLogs(),
          fetchBrmThresholds(),
          fetchAnnotations(),
        ]);
        if (!alive) return;
        setSessions(s);
        setBankroll(cfg.bankroll);
        setTransactions(tx);
        setGoals(gl);
        setStudyLogs(sl);
        setBrmThresholds(brm);
        setAnnotations(annos);
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

  const platforms = useMemo(() => platformBalances(sessions, transactions), [sessions, transactions]);
  const platformNames = useMemo(() => {
    const known = new Set<string>(PLATFORMS as readonly string[]);
    for (const p of platforms) known.add(p.platform);
    return Array.from(known);
  }, [platforms]);
  const isPlatformFiltered = platformFilter !== "todas";
  const platformSessions = useMemo(
    () => (isPlatformFiltered ? sessions.filter((s) => (s.venue?.trim() || "Sem plataforma") === platformFilter) : sessions),
    [sessions, platformFilter, isPlatformFiltered]
  );
  const platformTransactions = useMemo(
    () => (isPlatformFiltered ? transactions.filter((t) => (t.venue?.trim() || "Sem plataforma") === platformFilter) : transactions),
    [transactions, platformFilter, isPlatformFiltered]
  );

  const agg = useMemo(() => aggregate(platformSessions), [platformSessions]);
  const nw = useMemo(
    () => (isPlatformFiltered ? netWorth(0, agg.profit, platformTransactions) : netWorth(base, agg.profit, transactions)),
    [isPlatformFiltered, base, agg.profit, transactions, platformTransactions]
  );
  const currentBankroll = isPlatformFiltered
    ? platforms.find((p) => p.platform === platformFilter)?.balance ?? 0
    : view === "jogo"
      ? nw.playingBankroll
      : nw.netWorth;
  const series = useMemo(
    () => evolutionSeries(platformSessions, isPlatformFiltered ? 0 : base),
    [platformSessions, isPlatformFiltered, base]
  );
  const filteredSeries = useMemo(() => filterSeriesByRange(series, range), [series, range]);
  const tips = useMemo(
    () => buildCoachTips(sessions, { bankroll: nw.playingBankroll, brmThresholds }),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  const currentBrm = useMemo(
    () => brmReading(sessions, nw.playingBankroll, brmThresholds),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  const leakStats = useMemo(() => groupStats(platformSessions, leakDimension), [platformSessions, leakDimension]);
  const tiltStats = useMemo(() => tiltImpact(platformSessions), [platformSessions]);
  const rate = useMemo(() => hourlyRate(platformSessions), [platformSessions]);
  const activity = useMemo(() => dailyActivity(platformSessions), [platformSessions]);
  const calcThreshold = useMemo(() => thresholdFor(brmThresholds, calcFormat), [brmThresholds, calcFormat]);
  const ruin = useMemo(() => riskOfRuin(sessions, nw.playingBankroll), [sessions, nw.playingBankroll]);
  const comparison = useMemo(() => compareMonths(platformSessions), [platformSessions]);
  const currentDrawdown = useMemo(() => drawdownBuyIns(platformSessions, agg.avgBuyIn), [platformSessions, agg.avgBuyIn]);
  const profitDelta = comparison.current.profit - comparison.previous.profit;
  const roiDelta = comparison.current.roi - comparison.previous.roi;
  const calcBuyInsCovered = Number(calcBuyIn) > 0 ? nw.playingBankroll / Number(calcBuyIn) : null;
  const calcStatus: BrmStatus | null =
    calcBuyInsCovered == null
      ? null
      : calcBuyInsCovered >= calcThreshold.moveupBuyins
        ? "moveup"
        : calcBuyInsCovered < calcThreshold.movedownBuyins
          ? "movedown"
          : "hold";
  const recent = [...platformSessions].reverse().slice(0, 8);
  const recentTx = [...platformTransactions].reverse().slice(0, 6);
  const historyFiltered = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const list = [...platformSessions].reverse();
    if (!q) return list;
    return list.filter((s) =>
      [s.format, s.date, s.stake, s.venue, s.notes, s.mood].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [platformSessions, historySearch]);
  const goalsProgress = useMemo(() => goals.map((g) => goalProgress(g, sessions, studyLogs)), [goals, sessions, studyLogs]);

  const featuredTip = useFeaturedCoachTip(tips);

  useEffect(() => {
    if (loading || !currentBrm) return;
    if (currentBrm.status === "moveup") {
      notifyBrmAlert(
        `Banca pronta pra subir em ${currentBrm.format}`,
        `Sua banca cobre ${currentBrm.buyInsCovered} buy-ins — acima do seu threshold de moveup (${currentBrm.threshold.moveupBuyins}).`
      ).catch(() => {});
    } else if (currentBrm.status === "movedown") {
      notifyBrmAlert(
        `Banca abaixo do minimo em ${currentBrm.format}`,
        `Sua banca cobre so ${currentBrm.buyInsCovered} buy-ins — abaixo do seu threshold de movedown (${currentBrm.threshold.movedownBuyins}). Considere descer de stake.`
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentBrm?.status, currentBrm?.format]);

  async function handleAddSession() {
    if (!buyIn || !cashout || !date) {
      setErr("Preencha data, buy-in e cashout.");
      return;
    }
    const resolvedVenue = venue === OUTRO_PLATFORM ? venueOther.trim() : venue;
    const draft: Session = {
      id: `tmp-${Date.now()}`,
      date,
      time: time || undefined,
      format,
      buyIn: Number(buyIn),
      reentries: Number(reentries) || 0,
      cashout: Number(cashout),
      stake,
      hours: hours ? Number(hours) : undefined,
      venue: resolvedVenue || undefined,
      notes,
      mood: mood || undefined,
      tilt: tilt ? Number(tilt) : undefined,
      diaryNote: diaryNote || undefined,
    };
    setSessions((prev) => [...prev, draft]);
    setBuyIn("");
    setCashout("");
    setStake("");
    setVenue(PLATFORMS[0]);
    setVenueOther("");
    setHours("");
    setTime("");
    setNotes("");
    setReentries("0");
    setMood("");
    setTilt("");
    setDiaryNote("");
    setShowDiary(false);
    setErr("");
    setSessionModalOpen(false);
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

  async function handleAddTransaction() {
    if (!txAmount || !txDate) {
      setErr("Preencha valor e data da transacao.");
      return;
    }
    const resolvedTxVenue = txVenue === OUTRO_PLATFORM ? txVenueOther.trim() : txVenue;
    const draft: Transaction = {
      id: `tmp-${Date.now()}`,
      date: txDate,
      type: txType,
      amount: Number(txAmount),
      note: txNote,
      venue: resolvedTxVenue || undefined,
    };
    setTransactions((prev) => [...prev, draft]);
    setTxAmount("");
    setTxNote("");
    setTxVenue(PLATFORMS[0]);
    setTxVenueOther("");
    setErr("");
    setTxModalOpen(false);
    try {
      const saved = await apiAddTransaction(draft);
      setTransactions((prev) => prev.map((x) => (x.id === draft.id ? saved : x)));
    } catch {
      setErr("Nao foi possivel salvar a transacao.");
      setTransactions((prev) => prev.filter((x) => x.id !== draft.id));
    }
  }

  async function handleRemoveTransaction(id: string) {
    const backup = transactions;
    setTransactions((prev) => prev.filter((x) => x.id !== id));
    try {
      await apiDeleteTransaction(id);
    } catch {
      setErr("Nao foi possivel excluir a transacao. Restaurando.");
      setTransactions(backup);
    }
  }

  async function handleAddGoal() {
    if (!goalTarget) return;
    const unit = goalType === "volume" ? "sessoes" : "horas";
    try {
      const saved = await apiAddGoal({ type: goalType, period: goalPeriod, target: Number(goalTarget), unit });
      setGoals((prev) => [...prev, saved]);
      setGoalTarget("");
      setGoalsModalOpen(false);
    } catch {
      setErr("Nao foi possivel criar a meta.");
    }
  }

  async function handleRemoveGoal(id: string) {
    const backup = goals;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await apiDeleteGoal(id);
    } catch {
      setErr("Nao foi possivel remover a meta. Restaurando.");
      setGoals(backup);
    }
  }

  async function handleQuickStudy(minutes: number) {
    const draft: StudyLog = { id: `tmp-${Date.now()}`, date: todayISO(), minutes };
    setStudyLogs((prev) => [...prev, draft]);
    try {
      const saved = await apiAddStudyLog(draft);
      setStudyLogs((prev) => prev.map((x) => (x.id === draft.id ? saved : x)));
    } catch {
      setErr("Nao foi possivel registrar o estudo.");
      setStudyLogs((prev) => prev.filter((x) => x.id !== draft.id));
    }
  }

  async function handleSaveBrmThreshold(format: BrmFormat, moveupBuyins: number, movedownBuyins: number) {
    const backup = brmThresholds;
    setBrmThresholds((prev) => prev.map((t) => (t.format === format ? { format, moveupBuyins, movedownBuyins } : t)));
    try {
      await apiSaveBrmThreshold({ format, moveupBuyins, movedownBuyins });
    } catch {
      setErr("Nao foi possivel salvar o threshold de BRM.");
      setBrmThresholds(backup);
    }
  }

  async function handleAddAnnotation() {
    if (!annoNote.trim() || !annoDate) return;
    const draft: Annotation = { id: `tmp-${Date.now()}`, date: annoDate, note: annoNote.trim() };
    setAnnotations((prev) => [...prev, draft]);
    setAnnoNote("");
    try {
      const saved = await apiAddAnnotation(draft);
      setAnnotations((prev) => prev.map((a) => (a.id === draft.id ? saved : a)));
    } catch {
      setErr("Nao foi possivel salvar a anotacao.");
      setAnnotations((prev) => prev.filter((a) => a.id !== draft.id));
    }
  }

  async function handleRemoveAnnotation(id: string) {
    const backup = annotations;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    try {
      await apiDeleteAnnotation(id);
    } catch {
      setErr("Nao foi possivel remover a anotacao. Restaurando.");
      setAnnotations(backup);
    }
  }

  function handleExportCSV() {
    const inRange = filterSessionsByRange(sessions, range);
    const csv = sessionsToCSV(inRange);
    downloadCSV(`pokersync-sessoes-${range}-${todayISO()}.csv`, csv);
  }

  if (loading) {
    return <main className="p-10 text-center text-sm text-muted">Carregando sua banca...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
        >
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          <button
            onClick={() => setView("jogo")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
              view === "jogo" ? "bg-ink text-void" : "text-muted hover:scale-105 hover:text-ink"
            }`}
          >
            Banca de jogo
          </button>
          <button
            onClick={() => setView("patrimonio")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
              view === "patrimonio" ? "bg-ink text-void" : "text-muted hover:scale-105 hover:text-ink"
            }`}
          >
            Patrimonio total
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5">
            <Landmark size={13} className="text-muted" />
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.06em] text-ink outline-none"
            >
              <option value="todas">Todas as plataformas</option>
              {platformNames.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setSessionModalOpen(true)}
            aria-label="Registrar sessao"
            title="Registrar sessao"
            className="group flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-void shadow-lg shadow-black/30 transition-transform duration-200 hover:scale-110 active:scale-90"
          >
            <Plus size={20} strokeWidth={2.5} className="transition-transform duration-200 group-hover:rotate-90" />
          </button>
          <button
            onClick={() => setTxModalOpen(true)}
            aria-label="Deposito / saque"
            title="Deposito / saque"
            className="group flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-elevated text-ink shadow-lg shadow-black/20 transition-transform duration-200 hover:scale-110 hover:border-ink/40 active:scale-90"
          >
            <Wallet size={19} className="transition-transform duration-200 group-hover:-rotate-12" />
          </button>

          <div className="mx-1 h-7 w-px bg-hairline" />

          <button
            onClick={() => setGoalsModalOpen(true)}
            aria-label="Nova meta"
            title="Nova meta"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-muted transition-all duration-200 hover:scale-110 hover:border-review/50 hover:text-review hover:shadow-[0_0_12px_rgba(168,85,247,.35)] active:scale-90"
          >
            <Target size={16} className="transition-transform duration-200 group-hover:rotate-45" />
          </button>
          <button
            onClick={() => setBrmModalOpen(true)}
            aria-label="BRM — moveup / movedown"
            title="BRM — moveup / movedown"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-muted transition-all duration-200 hover:scale-110 hover:border-training/50 hover:text-training hover:shadow-[0_0_12px_rgba(59,130,246,.35)] active:scale-90"
          >
            <Gauge size={16} className="transition-transform duration-200 group-hover:-rotate-12" />
          </button>
          <button
            onClick={() => leaksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            aria-label="Ir pro painel de leaks"
            title="Ir pro painel de leaks"
            className="group flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-muted transition-all duration-200 hover:scale-110 hover:border-evolution/50 hover:text-evolution hover:shadow-[0_0_12px_rgba(245,158,11,.35)] active:scale-90"
          >
            <Flame size={16} className="transition-transform duration-200 group-hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <HeroStat
          label={view === "jogo" ? "Banca atual" : "Patrimônio total"}
          value={fmtMoney(currentBankroll)}
          negative={currentBankroll < 0}
          delta={
            comparison.previous.n > 0
              ? { text: `${fmtSignedMoney(profitDelta)} vs mês passado`, positive: profitDelta >= 0 }
              : undefined
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard
          label="Resultado"
          value={fmtSignedMoney(agg.profit)}
          tone={agg.profit >= 0 ? "positive" : "negative"}
          accent={agg.profit >= 0 ? "#22c55e" : "#e0555a"}
        />
        <StatCard
          label="ROI"
          value={fmtPct(agg.roi)}
          accent="#22d3ee"
          delta={
            comparison.previous.n > 0
              ? { text: `${fmtPct(roiDelta)} vs mês passado`, positive: roiDelta >= 0 }
              : undefined
          }
        />
        <StatCard label="ITM" value={`${agg.itm.toFixed(1)}%`} accent="#f59e0b" />
        <StatCard label="Sessões" value={String(agg.n)} icon={<Hash size={11} />} accent="#14b8a6" />
        <StatCard label="Buy-in médio" value={fmtMoney(agg.avgBuyIn)} icon={<Wallet size={11} />} accent="#6366f1" />
        <StatCard
          label="Drawdown atual"
          value={currentDrawdown > 0 ? `${currentDrawdown.toFixed(1)} BI` : "—"}
          tone={currentDrawdown >= 15 ? "negative" : undefined}
          icon={<History size={11} />}
          accent={currentDrawdown >= 15 ? "#e0555a" : currentDrawdown >= 8 ? "#f59e0b" : "#22c55e"}
        />
        <StatCard
          label="R$/hora"
          value={rate ? fmtMoney(rate.value) : "—"}
          tone={rate ? (rate.value >= 0 ? "positive" : "negative") : undefined}
          icon={<Clock size={11} />}
          accent={rate ? (rate.value >= 0 ? "#22c55e" : "#e0555a") : "#6b7280"}
        />
      </div>
      {!rate && (
        <p className="mt-2 text-[11px] text-muted">
          R$/hora aparece quando voce registra as horas jogadas ao salvar uma sessao.
        </p>
      )}

      {(nw.withdrawn > 0 || nw.caixinha > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Sacado" value={fmtMoney(nw.withdrawn)} icon={<Wallet size={13} />} accent="#e0555a" />
          <StatCard label="Guardado (caixinha)" value={fmtMoney(nw.caixinha)} icon={<PiggyBank size={13} />} accent="#ec4899" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Evolucao da banca</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-all ${
                      range === r.value ? "bg-ink text-void" : "text-muted hover:scale-105 hover:text-ink"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAnnoModalOpen(true)}
                title="Anotar evento na timeline"
                className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-muted transition-all hover:scale-110 hover:border-review/50 hover:text-review"
              >
                <StickyNote size={13} />
              </button>
              <button
                onClick={() => setCompareOpen((v) => !v)}
                title="Comparar meses"
                className={`grid h-7 w-7 place-items-center rounded-md border transition-all hover:scale-110 ${
                  compareOpen ? "border-training bg-training/15 text-training" : "border-hairline text-muted hover:border-training/50 hover:text-training"
                }`}
              >
                <GitCompare size={13} />
              </button>
              <button
                onClick={handleExportCSV}
                title="Exportar CSV do periodo"
                className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-muted transition-all hover:scale-110 hover:border-positive/50 hover:text-positive"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
          <div className="mt-4">
            <EvolutionChart series={filteredSeries} annotations={annotations} />
          </div>

          {compareOpen && (
            <div className="mt-4 rounded-lg border border-hairline bg-elevated p-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                {comparison.currentLabel} vs {comparison.previousLabel}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div />
                <p className="text-[10px] font-semibold uppercase text-muted">{comparison.currentLabel.split(" ")[0]}</p>
                <p className="text-[10px] font-semibold uppercase text-muted">{comparison.previousLabel.split(" ")[0]}</p>

                <p className="text-left text-[11px] text-muted">Resultado</p>
                <p className={`text-sm font-bold ${comparison.current.profit >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSignedMoney(comparison.current.profit)}
                </p>
                <p className={`text-sm font-bold ${comparison.previous.profit >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSignedMoney(comparison.previous.profit)}
                </p>

                <p className="text-left text-[11px] text-muted">ROI</p>
                <p className="text-sm font-bold text-training">{fmtPct(comparison.current.roi)}</p>
                <p className="text-sm font-bold text-training">{fmtPct(comparison.previous.roi)}</p>

                <p className="text-left text-[11px] text-muted">Sessões</p>
                <p className="text-sm font-bold text-ink">{comparison.current.n}</p>
                <p className="text-sm font-bold text-ink">{comparison.previous.n}</p>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <section className="flex max-h-[150px] flex-col rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-ink/20">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">AI Coach</h2>
            <div className="mt-2 flex flex-col gap-1.5 overflow-y-auto">
              {featuredTip && (
                <div className={`rounded-lg border p-2 text-[11px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneClasses(featuredTip.level)}`}>
                  <p className="font-semibold leading-snug">{featuredTip.title}</p>
                  <p className="mt-0.5 text-[10.5px] text-muted leading-snug">{featuredTip.text}</p>
                </div>
              )}
              {coachExpanded &&
                tips
                  .filter((t) => t.id !== featuredTip?.id)
                  .map((tip: CoachTip) => (
                    <div key={tip.id} className={`rounded-lg border p-2 text-[11px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneClasses(tip.level)}`}>
                      <p className="font-semibold leading-snug">{tip.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted leading-snug">{tip.text}</p>
                    </div>
                  ))}
            </div>
            {tips.length > 1 && (
              <button
                onClick={() => setCoachExpanded((v) => !v)}
                className="mt-1.5 flex items-center justify-center gap-1 rounded-md py-1 text-[10.5px] font-semibold text-muted transition-colors hover:text-ink"
              >
                {coachExpanded ? "Mostrar menos" : `+${tips.length - 1} insights`}
                <ChevronDown size={12} className={`transition-transform ${coachExpanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </section>

          {platforms.length > 0 && (
            <section className="rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-ink/20">
              <div className="flex items-center gap-1.5">
                <Landmark size={12} className="text-evolution" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Saldo por plataforma</h2>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {platforms.map((p) => (
                  <button
                    key={p.platform}
                    onClick={() => setPlatformFilter(platformFilter === p.platform ? "todas" : p.platform)}
                    className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-all duration-150 hover:bg-elevated ${
                      platformFilter === p.platform ? "bg-elevated ring-1 ring-inset ring-evolution/40" : ""
                    }`}
                  >
                    <span className="truncate text-[11px] font-semibold text-ink">{p.platform}</span>
                    <span className={`shrink-0 text-[11px] font-bold tabular-nums ${p.balance >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmtMoney(p.balance)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-ink/20">
            <div className="flex items-center gap-1.5">
              <Target size={12} className="text-review" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Metas</h2>
            </div>
            {goalsProgress.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted">Nenhuma meta ativa. Use o icone de alvo pra criar.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {goalsProgress.map(({ goal, current, pct }) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold capitalize">
                        {goal.type === "volume" ? "Volume" : "Estudo"} · {goal.period}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted">
                          {current}/{goal.target}
                        </span>
                        <button onClick={() => handleRemoveGoal(goal.id)} className="text-muted transition-all duration-150 hover:scale-125 hover:text-negative">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-void/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-review to-evolution transition-[width] duration-500 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {goal.type === "estudo" && (
                      <div className="mt-1.5 flex gap-1">
                        {[30, 60, 90].map((m) => (
                          <button
                            key={m}
                            onClick={() => handleQuickStudy(m)}
                            className="rounded-md border border-hairline px-1.5 py-0.5 text-[9.5px] font-semibold text-muted transition-all duration-150 hover:scale-110 hover:border-evolution/50 hover:text-evolution"
                          >
                            +{m}min
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-ink/20">
            <div className="flex items-center gap-1.5">
              <Gauge size={12} className="text-training" />
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">BRM</h2>
            </div>
            {currentBrm ? (
              <div className="mt-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] ${
                    currentBrm.status === "moveup"
                      ? "bg-positive/15 text-positive"
                      : currentBrm.status === "movedown"
                        ? "bg-negative/15 text-negative"
                        : "bg-void/40 text-muted"
                  }`}
                >
                  {currentBrm.status === "moveup" ? "Pode subir" : currentBrm.status === "movedown" ? "Desca de stake" : "Mantenha"}
                </span>
                <p className="mt-1.5 text-[11px] text-muted">
                  <span className="font-semibold text-ink">{currentBrm.format}</span> · cobre{" "}
                  <span className="font-semibold text-ink">{currentBrm.buyInsCovered}</span> buy-ins
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted">Registre sessoes pra ver sua leitura de BRM.</p>
            )}
          </section>
        </div>
      </div>

      <Modal open={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Nova meta">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm">
            <option value="volume">Volume (sessoes)</option>
            <option value="estudo">Estudo (horas)</option>
          </select>
          <select value={goalPeriod} onChange={(e) => setGoalPeriod(e.target.value as GoalPeriod)} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm">
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
          <input
            placeholder="Meta (numero)"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            className="col-span-2 rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm sm:col-span-1"
          />
          <button
            onClick={handleAddGoal}
            className="col-span-2 rounded-lg bg-ink py-2 text-xs font-bold uppercase tracking-[0.1em] text-void transition-all duration-200 hover:opacity-90 hover:scale-[1.02] hover:shadow-lg hover:shadow-ink/10 active:scale-[0.98] sm:col-span-4"
          >
            Criar meta
          </button>
        </div>
      </Modal>

      <Modal open={brmModalOpen} onClose={() => setBrmModalOpen(false)} title="BRM — moveup / movedown">
        <div className="rounded-lg border border-hairline bg-elevated p-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Calculadora</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              value={calcFormat}
              onChange={(e) => setCalcFormat(e.target.value as BrmFormat)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="MTT">MTT</option>
              <option value="SNG">SNG</option>
              <option value="Spin">Spin</option>
            </select>
            <input
              placeholder="Buy-in (R$)"
              value={calcBuyIn}
              onChange={(e) => setCalcBuyIn(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
          </div>
          {calcBuyInsCovered != null && (
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                  calcStatus === "moveup"
                    ? "bg-positive/15 text-positive"
                    : calcStatus === "movedown"
                      ? "bg-negative/15 text-negative"
                      : "bg-void/40 text-muted"
                }`}
              >
                {calcStatus === "moveup" ? "Pode subir" : calcStatus === "movedown" ? "Desca de stake" : "Mantenha"}
              </span>
              <p className="text-sm text-muted">
                Sua banca cobre <span className="font-semibold text-ink">{calcBuyInsCovered.toFixed(1)}</span> buy-ins de{" "}
                {fmtMoney(Number(calcBuyIn))} em {calcFormat}{" "}
                <span className="text-muted">
                  (moveup {calcThreshold.moveupBuyins} · movedown {calcThreshold.movedownBuyins})
                </span>
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-muted">Thresholds por formato</p>
        <div className="mt-2 flex flex-col gap-2">
          {brmThresholds.map((t) => (
            <BrmThresholdRow key={t.format} threshold={t} onSave={handleSaveBrmThreshold} />
          ))}
        </div>

        {ruin && (
          <div className="mt-4 rounded-lg border border-hairline bg-elevated p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted">
              <ShieldAlert size={13} className="text-negative" /> Risco de ruína
            </p>
            <p className="mt-1.5 text-sm text-muted">
              <span className={`font-bold ${ruin.ruinPct >= 20 ? "text-negative" : ruin.ruinPct >= 8 ? "text-evolution" : "text-positive"}`}>
                {ruin.ruinPct}%
              </span>{" "}
              de chance de zerar a banca em {ruin.horizonSessions} sessões, simulado {ruin.simulations}x a partir das
              suas {ruin.sampleSize} sessões reais.
            </p>
          </div>
        )}
      </Modal>

      <Modal open={annoModalOpen} onClose={() => setAnnoModalOpen(false)} title="Anotações no gráfico">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <input
            type="date"
            value={annoDate}
            onChange={(e) => setAnnoDate(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm"
          />
          <input
            placeholder="Ex: Subi pra NL100"
            value={annoNote}
            onChange={(e) => setAnnoNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAnnotation()}
            className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleAddAnnotation}
          className="mt-2 w-full rounded-lg bg-ink py-2 text-xs font-bold uppercase tracking-[0.1em] text-void transition-all duration-200 hover:opacity-90 hover:scale-[1.02] hover:shadow-lg hover:shadow-ink/10 active:scale-[0.98]"
        >
          Adicionar
        </button>

        {annotations.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {[...annotations].reverse().map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2">
                <p className="text-xs text-ink">
                  <span className="text-muted">{a.date}</span> · {a.note}
                </p>
                <button onClick={() => handleRemoveAnnotation(a.id)} className="shrink-0 text-muted transition-all duration-150 hover:scale-125 hover:text-negative">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={sessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Registrar sessao">
        <div className="grid grid-cols-2 gap-3">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
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
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            title="Horario que a sessao comecou"
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-muted transition-colors hover:border-ink/30"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Horas jogadas"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Buy-in"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Reentradas"
            value={reentries}
            onChange={(e) => setReentries(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Cashout"
            value={cashout}
            onChange={(e) => setCashout(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Stake"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className={`rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30 ${venue === OUTRO_PLATFORM ? "" : "col-span-2"}`}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={OUTRO_PLATFORM}>{OUTRO_PLATFORM}</option>
          </select>
          {venue === OUTRO_PLATFORM && (
            <input
              placeholder="Qual plataforma?"
              value={venueOther}
              onChange={(e) => setVenueOther(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
            />
          )}
          <input
            placeholder="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
        </div>

        <button
          onClick={() => setShowDiary((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <BookOpen size={13} /> Diario pos-sessao (opcional)
          <ChevronDown size={13} className={`transition-transform ${showDiary ? "rotate-180" : ""}`} />
        </button>
        {showDiary && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-hairline bg-elevated p-3">
            <select value={mood} onChange={(e) => setMood(e.target.value)} className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm">
              <option value="">Como foi?</option>
              <option value="focado">Focado</option>
              <option value="neutro">Neutro</option>
              <option value="tilt">Tilt</option>
            </select>
            <select value={tilt} onChange={(e) => setTilt(e.target.value)} className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm">
              <option value="">Nivel de tilt</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
            <input
              placeholder="Principal aprendizado da sessao"
              value={diaryNote}
              onChange={(e) => setDiaryNote(e.target.value)}
              className="col-span-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={handleAddSession}
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-void transition-all duration-200 hover:opacity-90 hover:scale-[1.02] hover:shadow-lg hover:shadow-ink/10 active:scale-[0.98]"
        >
          Salvar sessao
        </button>
      </Modal>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {historyOpen ? `Historico de sessoes (${historyFiltered.length})` : "Sessoes recentes"}
          </h2>
          <div className="flex items-center gap-2">
            {historyOpen && (
              <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1">
                <Search size={12} className="text-muted" />
                <input
                  placeholder="Buscar por formato, stake, plataforma..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-52 bg-transparent text-[11px] text-ink outline-none placeholder:text-muted"
                />
              </div>
            )}
            {platformSessions.length > 8 && (
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
              >
                {historyOpen ? "Mostrar recentes" : `Ver todas (${platformSessions.length})`}
              </button>
            )}
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma sessao registrada.</p>
        ) : (
          <div className={`mt-2 flex flex-col ${historyOpen ? "max-h-[520px] overflow-y-auto" : ""}`}>
            {(historyOpen ? historyFiltered : recent).map((s) => {
              const result = net(s);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border-t border-hairline px-1.5 py-2.5 transition-all duration-200 first:border-t-0 hover:translate-x-1 hover:bg-elevated"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {s.format} · {s.date}
                        {s.stake ? ` · ${s.stake}` : ""}
                        {s.mood ? ` · ${s.mood}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {s.venue || "—"}
                        {s.notes ? ` · ${s.notes}` : ""}
                        {s.diaryNote ? ` · ${s.diaryNote}` : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${result >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmtSignedMoney(result)}
                    </span>
                    <button onClick={() => handleRemove(s.id)} className="text-muted transition-all duration-150 hover:scale-125 hover:text-negative">
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Deposito / saque / caixinha">
        <p className="text-xs text-muted">
          Nao entra no resultado de jogo — so move dinheiro entre banca de jogo e patrimonio guardado.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as TransactionType)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          >
            <option value="deposito">Deposito</option>
            <option value="saque">Saque</option>
            <option value="caixinha">Caixinha</option>
          </select>
          <input
            type="date"
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Valor"
            value={txAmount}
            onChange={(e) => setTxAmount(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <input
            placeholder="Nota (opcional)"
            value={txNote}
            onChange={(e) => setTxNote(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
          <select
            value={txVenue}
            onChange={(e) => setTxVenue(e.target.value)}
            className={`rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30 ${txVenue === OUTRO_PLATFORM ? "" : "col-span-2"}`}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={OUTRO_PLATFORM}>{OUTRO_PLATFORM}</option>
          </select>
          {txVenue === OUTRO_PLATFORM && (
            <input
              placeholder="Qual plataforma?"
              value={txVenueOther}
              onChange={(e) => setTxVenueOther(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
            />
          )}
        </div>
        <button
          onClick={handleAddTransaction}
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-void transition-all duration-200 hover:opacity-90 hover:scale-[1.02] hover:shadow-lg hover:shadow-ink/10 active:scale-[0.98]"
        >
          Registrar
        </button>
      </Modal>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Historico de transacoes</h2>
        {recentTx.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma transacao registrada.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {recentTx.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border-t border-hairline px-1.5 py-2.5 transition-all duration-200 first:border-t-0 hover:translate-x-1 hover:bg-elevated"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-void/40">
                  {t.type === "deposito" ? (
                    <TrendingUp size={14} className="text-positive" />
                  ) : t.type === "saque" ? (
                    <TrendingDown size={14} className="text-negative" />
                  ) : (
                    <PiggyBank size={14} className="text-evolution" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {TX_LABELS[t.type]} · {t.date}
                    {t.venue ? ` · ${t.venue}` : ""}
                  </p>
                  {t.note && <p className="truncate text-xs text-muted">{t.note}</p>}
                </div>
                <span className={`text-sm font-bold ${t.type === "deposito" ? "text-positive" : "text-negative"}`}>
                  {t.type === "deposito" ? "+" : "-"}
                  {fmtMoney(t.amount)}
                </span>
                <button onClick={() => handleRemoveTransaction(t.id)} className="text-muted transition-all duration-150 hover:scale-125 hover:text-negative">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Consistência de volume</h2>
        <VolumeHeatmap activity={activity} />
      </section>

      <section ref={leaksRef} className="mt-6 scroll-mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Flame size={13} className="text-evolution" />
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Painel de leaks</h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {[
              { value: "format" as const, label: "Formato" },
              { value: "weekday" as const, label: "Dia" },
              { value: "time" as const, label: "Horario" },
            ].map((d) => (
              <button
                key={d.value}
                onClick={() => setLeakDimension(d.value)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-all ${
                  leakDimension === d.value ? "bg-ink text-void" : "text-muted hover:scale-105 hover:text-ink"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {leakStats.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Registre sessoes pra ver seus leaks aqui.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-1.5">
            {leakStats.map((g: GroupStat) => {
              const maxAbs = Math.max(...leakStats.map((x) => Math.abs(x.net)), 1);
              const halfWidth = Math.max(2, (Math.abs(g.net) / maxAbs) * 50);
              const negative = g.net < 0;
              const lowSample = g.n < 5;
              return (
                <div key={g.key} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-md">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.key}</p>
                    <p className="text-[10.5px] text-muted">
                      {g.n} {g.n === 1 ? "sessao" : "sessoes"} · ROI {fmtPct(g.roi)}
                      {lowSample && <span className="ml-1 text-evolution">· amostra pequena</span>}
                    </p>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-void/40">
                    <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-hairline" />
                    {negative ? (
                      <div
                        className="absolute right-1/2 top-0 h-full rounded-l-full bg-negative transition-[width] duration-500 ease-out"
                        style={{ width: `${halfWidth}%`, opacity: lowSample ? 0.55 : 1 }}
                      />
                    ) : (
                      <div
                        className="absolute left-1/2 top-0 h-full rounded-r-full bg-positive transition-[width] duration-500 ease-out"
                        style={{ width: `${halfWidth}%`, opacity: lowSample ? 0.55 : 1 }}
                      />
                    )}
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${negative ? "text-negative" : "text-positive"}`}>
                    {fmtSignedMoney(g.net)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tiltStats && tiltStats.tiltN > 0 && (
          <div className="mt-4 rounded-lg border border-hairline bg-elevated p-3">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Sessoes com tilt vs demais</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted">Tilt ({tiltStats.tiltN})</p>
                <p className={`text-sm font-bold ${tiltStats.tiltNet >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSignedMoney(tiltStats.tiltNet)} · ROI {fmtPct(tiltStats.tiltRoi)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Demais ({tiltStats.otherN})</p>
                <p className={`text-sm font-bold ${tiltStats.otherNet >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSignedMoney(tiltStats.otherNet)} · ROI {fmtPct(tiltStats.otherRoi)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

    </main>
  );
}

function HeroStat({
  label,
  value,
  negative,
  delta,
}: {
  label: string;
  value: string;
  negative?: boolean;
  delta?: { text: string; positive: boolean };
}) {
  const accent = negative ? "#e0555a" : "#22c55e";
  return (
    <div
      style={{ "--acc": accent } as React.CSSProperties}
      className="acc-card relative overflow-hidden rounded-xl border border-ink/15 bg-surface p-6"
    >
      <div aria-hidden="true" className="acc-glow pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-3xl" />
      <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`relative mt-2 text-4xl font-bold tabular-nums ${negative ? "text-negative" : "text-ink"}`}>{value}</p>
      {delta && (
        <p className={`relative mt-2 text-[12px] font-semibold tabular-nums ${delta.positive ? "text-positive" : "text-negative"}`}>
          {delta.positive ? "▲" : "▼"} {delta.text}
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  accent,
  delta,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "training" | "evolution";
  icon?: React.ReactNode;
  accent: string;
  delta?: { text: string; positive: boolean };
}) {
  const color =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "training"
          ? "text-training"
          : tone === "evolution"
            ? "text-evolution"
            : "text-ink";
  return (
    <div
      style={{ "--acc": accent } as React.CSSProperties}
      className="acc-card acc-lift group relative cursor-pointer overflow-hidden rounded-xl border border-hairline bg-surface p-3.5"
    >
      <div aria-hidden="true" className="acc-glow pointer-events-none absolute -right-6 -top-6 size-20 rounded-full blur-2xl" />
      <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {icon}
        {label}
      </p>
      <p className={`relative mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {delta && (
        <p className={`relative mt-1 text-[11px] font-semibold tabular-nums ${delta.positive ? "text-positive" : "text-negative"}`}>
          {delta.positive ? "▲" : "▼"} {delta.text}
        </p>
      )}
    </div>
  );
}

function BrmThresholdRow({
  threshold,
  onSave,
}: {
  threshold: BrmThreshold;
  onSave: (format: BrmFormat, moveupBuyins: number, movedownBuyins: number) => void;
}) {
  const [moveup, setMoveup] = useState(String(threshold.moveupBuyins));
  const [movedown, setMovedown] = useState(String(threshold.movedownBuyins));

  function commit() {
    const u = Number(moveup) || threshold.moveupBuyins;
    const d = Number(movedown) || threshold.movedownBuyins;
    if (u !== threshold.moveupBuyins || d !== threshold.movedownBuyins) {
      onSave(threshold.format, u, d);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 transition-colors hover:border-training/40">
      <span className="w-14 shrink-0 text-xs font-semibold">{threshold.format}</span>
      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        Moveup
        <input
          value={moveup}
          onChange={(e) => setMoveup(e.target.value)}
          onBlur={commit}
          className="w-14 rounded-md border border-hairline bg-surface px-1.5 py-1 text-xs tabular-nums text-ink"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-muted">
        Movedown
        <input
          value={movedown}
          onChange={(e) => setMovedown(e.target.value)}
          onBlur={commit}
          className="w-14 rounded-md border border-hairline bg-surface px-1.5 py-1 text-xs tabular-nums text-ink"
        />
      </label>
      <span className="text-[11px] text-muted">buy-ins</span>
    </div>
  );
}

function toneClasses(level: CoachTip["level"]) {
  if (level === "good") return "border-positive/35 bg-positive/10";
  if (level === "bad") return "border-negative/35 bg-negative/10";
  if (level === "warn") return "border-evolution/35 bg-evolution/10";
  return "border-hairline bg-elevated";
}

const COACH_TTL_MS: Record<CoachTip["level"], number> = {
  bad: 24 * 60 * 60 * 1000,
  warn: 24 * 60 * 60 * 1000,
  good: 6 * 60 * 60 * 1000,
  info: 3 * 60 * 60 * 1000,
};
const COACH_FEATURED_KEY = "pokersync_coach_featured_tip";

function useFeaturedCoachTip(tips: CoachTip[]): CoachTip | null {
  const [featuredId, setFeaturedId] = useState<string | null>(null);

  useEffect(() => {
    if (tips.length === 0) {
      setFeaturedId(null);
      return;
    }
    let stored: { id: string; since: number } | null = null;
    try {
      const raw = localStorage.getItem(COACH_FEATURED_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }

    const storedTip = stored ? tips.find((t) => t.id === stored!.id) : undefined;
    const ttl = storedTip ? COACH_TTL_MS[storedTip.level] : 0;
    const expired = !stored || !storedTip || Date.now() - stored.since > ttl;

    if (!expired) {
      setFeaturedId(stored!.id);
      return;
    }

    const currentIdx = storedTip ? tips.findIndex((t) => t.id === storedTip.id) : -1;
    const next = tips[(currentIdx + 1) % tips.length];
    try {
      localStorage.setItem(COACH_FEATURED_KEY, JSON.stringify({ id: next.id, since: Date.now() }));
    } catch {
      // storage indisponivel (modo privado etc) — segue sem persistir,
      // so nao rotaciona entre reloads.
    }
    setFeaturedId(next.id);
  }, [tips]);

  return tips.find((t) => t.id === featuredId) ?? tips[0] ?? null;
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 px-4 pb-8 pt-16 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg animate-[modalIn_.16s_ease-out] rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-ink">{title}</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const Y_TICKS = 4;

function EvolutionChart({ series, annotations = [] }: { series: SeriesPoint[]; annotations?: Annotation[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (series.length < 2) {
    return <p className="text-sm text-muted">Registre ao menos 2 sessoes para ver o grafico.</p>;
  }
  const points = series.map((p) => p.value);
  const w = 640,
    h = 220,
    padL = 54,
    padR = 12,
    padT = 12,
    padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const min = Math.min(...points),
    max = Math.max(...points);
  const spread = max - min || 1;
  const yMin = min - spread * 0.08;
  const yMax = max + spread * 0.08;
  const yRange = yMax - yMin || 1;

  const xAt = (i: number) => padL + (series.length === 1 ? 0 : (i / (series.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const coords = points.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${padT + plotH} L${coords[0].x.toFixed(1)},${padT + plotH} Z`;

  const last = points[points.length - 1];
  const up = last >= (points[0] ?? 0);
  const color = up ? "#22c55e" : "#e0555a";
  const lastPoint = coords[coords.length - 1];
  const gradId = "bankrollLedFill";
  const glowId = "bankrollLedGlow";

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i) / Y_TICKS);

  const xTickCount = Math.min(6, series.length);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (series.length - 1))
  );

  const plottedAnnotations = annotations
    .map((a) => {
      const idx = series.findIndex((p) => p.date === a.date);
      return idx === -1 ? null : { ...a, x: xAt(idx) };
    })
    .filter((a): a is Annotation & { x: number } => a !== null);

  const hoverPoint = hoverIdx != null ? coords[hoverIdx] : null;
  const hoverData = hoverIdx != null ? series[hoverIdx] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {yTicks.map((v, i) => {
        const y = yAt(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="var(--color-muted)">
              {fmtMoney(v)}
            </text>
          </g>
        );
      })}

      {xTickIdx.map((idx) => (
        <text
          key={idx}
          x={xAt(idx)}
          y={h - 8}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-muted)"
        >
          {series[idx].label}
        </text>
      ))}

      {plottedAnnotations.map((a) => (
        <g key={a.id}>
          <line
            x1={a.x}
            y1={padT}
            x2={a.x}
            y2={padT + plotH}
            stroke="var(--color-review)"
            strokeWidth={1}
            strokeDasharray="3,3"
            opacity={0.45}
          />
          <circle cx={a.x} cy={padT + 6} r={3.5} fill="var(--color-review)">
            <title>{`${a.date} · ${a.note}`}</title>
          </circle>
        </g>
      ))}

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={color} filter={`url(#${glowId})`} opacity={0.9}>
        <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.45;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="#fff" />

      {hoverPoint && hoverData && (
        <g pointerEvents="none">
          <line x1={hoverPoint.x} y1={padT} x2={hoverPoint.x} y2={padT + plotH} stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
          <g transform={`translate(${Math.min(Math.max(hoverPoint.x - 46, padL), w - padR - 92)}, ${Math.max(hoverPoint.y - 46, padT)})`}>
            <rect width={92} height={34} rx={6} fill="var(--color-elevated)" stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={8} y={14} fontSize={9} fill="var(--color-muted)">
              {hoverData.date}
            </text>
            <text x={8} y={26} fontSize={10.5} fontWeight={700} fill={hoverData.net >= 0 ? "#22c55e" : "#e0555a"}>
              {fmtMoney(hoverData.value)} ({hoverData.net >= 0 ? "+" : ""}
              {fmtMoney(hoverData.net)})
            </text>
          </g>
        </g>
      )}

      <rect
        x={padL}
        y={padT}
        width={plotW}
        height={plotH}
        fill="transparent"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      />
    </svg>
  );
}

// Heatmap estilo GitHub: cada coluna e' uma semana, cada celula um dia.
// Cor = resultado (verde/vermelho), intensidade = magnitude do resultado
// do dia — mostra consistencia de volume, nao so o quanto ganhou/perdeu.
function VolumeHeatmap({ activity }: { activity: Record<string, DayActivity> }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const weeksCount = 20;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  const totalDays = weeksCount * 7;
  const start = new Date(endOfWeek);
  start.setDate(endOfWeek.getDate() - totalDays + 1);

  const days: { date: string; d: Date }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), d });
  }

  const maxAbsNet = Math.max(...Object.values(activity).map((a) => Math.abs(a.net)), 1);

  function cellColor(a: DayActivity | undefined) {
    if (!a || a.n === 0) return "var(--color-hairline)";
    const intensity = Math.min(1, Math.abs(a.net) / maxAbsNet);
    const alpha = 0.25 + intensity * 0.65;
    return a.net >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(224,85,90,${alpha})`;
  }

  const weeks: { date: string; d: Date }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const hovered = hoverKey ? activity[hoverKey] : null;

  return (
    <div className="mt-3">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map(({ date, d }) => {
              const a = activity[date];
              const future = d > today;
              return (
                <div
                  key={date}
                  onMouseEnter={() => !future && setHoverKey(date)}
                  onMouseLeave={() => setHoverKey((k) => (k === date ? null : k))}
                  className="size-[11px] rounded-[2px] transition-transform duration-100 hover:scale-125"
                  style={{ background: future ? "transparent" : cellColor(a) }}
                  title={a ? `${date} · ${a.n} sessão(ões) · ${fmtSignedMoney(a.net)}` : date}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
        <span>{weeksCount} semanas · verde = dia positivo, vermelho = dia negativo, cinza = sem sessão</span>
        {hovered && (
          <span className="font-semibold text-ink">
            {hovered.date} · {hovered.n} {hovered.n === 1 ? "sessão" : "sessões"} · {fmtSignedMoney(hovered.net)}
          </span>
        )}
      </div>
    </div>
  );
}
