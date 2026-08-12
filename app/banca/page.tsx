"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, PiggyBank, Wallet, Target, BookOpen, ChevronDown, Plus, X } from "lucide-react";
import type { Session, Transaction, TransactionType, Goal, GoalType, GoalPeriod, StudyLog, BrmThreshold, BrmFormat } from "@/lib/bankroll/types";
import { aggregate, evolutionSeries, filterSeriesByRange, net, netWorth, goalProgress, brmReading, groupStats, tiltImpact, type RangeOption, type SeriesPoint, type GroupStat } from "@/lib/bankroll/calc";
import { buildCoachTips, type CoachTip } from "@/lib/bankroll/coach";
import { fmtMoney, fmtSignedMoney, fmtPct, FORMATS, todayISO } from "@/lib/bankroll/format";
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
  const [showBrmEdit, setShowBrmEdit] = useState(false);
  const [leakDimension, setLeakDimension] = useState<"format" | "weekday" | "time">("format");
  const [bankroll, setBankroll] = useState(0);
  const [range, setRange] = useState<RangeOption>("all");
  const [view, setView] = useState<"jogo" | "patrimonio">("jogo");
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
  const [showDiary, setShowDiary] = useState(false);
  const [mood, setMood] = useState("");
  const [tilt, setTilt] = useState("");
  const [diaryNote, setDiaryNote] = useState("");

  const [txType, setTxType] = useState<TransactionType>("saque");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txNote, setTxNote] = useState("");

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("volume");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("semanal");
  const [goalTarget, setGoalTarget] = useState("");

  const [coachExpanded, setCoachExpanded] = useState(false);

  // Registro rapido (2026-08): "Registrar sessao" e "Deposito/saque" viram
  // modais acionados por atalho logo abaixo do header — o jogador nao
  // precisa mais rolar a tela ate o fim pra bater o registro pos-sessao.
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, cfg, tx, gl, sl, brm] = await Promise.all([
          fetchSessions(),
          fetchSettings(),
          fetchTransactions(),
          fetchGoals(),
          fetchStudyLogs(),
          fetchBrmThresholds(),
        ]);
        if (!alive) return;
        setSessions(s);
        setBankroll(cfg.bankroll);
        setTransactions(tx);
        setGoals(gl);
        setStudyLogs(sl);
        setBrmThresholds(brm);
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
  const nw = useMemo(() => netWorth(base, agg.profit, transactions), [base, agg.profit, transactions]);
  const currentBankroll = view === "jogo" ? nw.playingBankroll : nw.netWorth;
  const series = useMemo(() => evolutionSeries(sessions, base), [sessions, base]);
  const filteredSeries = useMemo(() => filterSeriesByRange(series, range), [series, range]);
  const tips = useMemo(
    () => buildCoachTips(sessions, { bankroll: nw.playingBankroll, brmThresholds }),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  const currentBrm = useMemo(
    () => brmReading(sessions, nw.playingBankroll, brmThresholds),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  const leakStats = useMemo(() => groupStats(sessions, leakDimension), [sessions, leakDimension]);
  const tiltStats = useMemo(() => tiltImpact(sessions), [sessions]);
  const recent = [...sessions].reverse().slice(0, 8);
  const recentTx = [...transactions].reverse().slice(0, 6);
  const goalsProgress = useMemo(() => goals.map((g) => goalProgress(g, sessions, studyLogs)), [goals, sessions, studyLogs]);

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
      mood: mood || undefined,
      tilt: tilt ? Number(tilt) : undefined,
      diaryNote: diaryNote || undefined,
    };
    setSessions((prev) => [...prev, draft]);
    setBuyIn("");
    setCashout("");
    setStake("");
    setVenue("");
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
    const draft: Transaction = { id: `tmp-${Date.now()}`, date: txDate, type: txType, amount: Number(txAmount), note: txNote };
    setTransactions((prev) => [...prev, draft]);
    setTxAmount("");
    setTxNote("");
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
      setShowGoalForm(false);
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

  if (loading) {
    return <main className="p-10 text-center text-sm text-muted">Carregando sua banca...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
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

      {/* Atalho de registro rapido do lado direito; toggle Banca/Patrimonio
          do lado esquerdo — mesma linha, nao empilhados. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          <button
            onClick={() => setView("jogo")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              view === "jogo" ? "bg-ink text-void" : "text-muted hover:text-ink"
            }`}
          >
            Banca de jogo
          </button>
          <button
            onClick={() => setView("patrimonio")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              view === "patrimonio" ? "bg-ink text-void" : "text-muted hover:text-ink"
            }`}
          >
            Patrimonio total
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setSessionModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-void transition-opacity hover:opacity-90"
          >
            <Plus size={15} /> Registrar sessao
          </button>
          <button
            onClick={() => setTxModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink/40"
          >
            <Plus size={15} /> Deposito / saque
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={view === "jogo" ? "Banca atual" : "Patrimonio total"}
          value={fmtMoney(currentBankroll)}
          tone={currentBankroll < 0 ? "negative" : undefined}
          accent={currentBankroll < 0 ? "#e0555a" : "#22c55e"}
        />
        <StatCard
          label="Resultado"
          value={fmtSignedMoney(agg.profit)}
          tone={agg.profit >= 0 ? "positive" : "negative"}
          accent={agg.profit >= 0 ? "#22c55e" : "#e0555a"}
        />
        <StatCard label="ROI" value={fmtPct(agg.roi)} tone="training" accent="#3b82f6" />
        <StatCard label="ITM" value={`${agg.itm.toFixed(1)}%`} tone="evolution" accent="#f59e0b" />
      </div>

      {(nw.withdrawn > 0 || nw.caixinha > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Sacado" value={fmtMoney(nw.withdrawn)} icon={<Wallet size={13} />} accent="#e0555a" />
          <StatCard label="Guardado (caixinha)" value={fmtMoney(nw.caixinha)} icon={<PiggyBank size={13} />} accent="#a855f7" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Evolucao da banca</h2>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                    range === r.value ? "bg-ink text-void" : "text-muted hover:text-ink"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <EvolutionChart series={filteredSeries} />
          </div>
        </section>

        {/* Coach compacto — espaco pequeno, nao domina a tela. Mostra o
            tip mais relevante (primeiro da lista) sempre; o resto fica
            atras de um "ver mais" pra nao empurrar o resto da pagina. */}
        <section className="flex max-h-[320px] flex-col rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-ink/20">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">AI Coach</h2>
          <div className="mt-3 flex flex-col gap-2 overflow-y-auto">
            {tips.slice(0, coachExpanded ? tips.length : 1).map((tip: CoachTip) => (
              <div key={tip.id} className={`rounded-lg border p-2.5 text-xs ${toneClasses(tip.level)}`}>
                <p className="font-semibold leading-snug">{tip.title}</p>
                <p className="mt-1 text-[11px] text-muted leading-snug">{tip.text}</p>
              </div>
            ))}
          </div>
          {tips.length > 1 && (
            <button
              onClick={() => setCoachExpanded((v) => !v)}
              className="mt-2 flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink"
            >
              {coachExpanded ? "Mostrar menos" : `+${tips.length - 1} insights`}
              <ChevronDown size={13} className={`transition-transform ${coachExpanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </section>
      </div>

      {/* Metas de volume e estudo */}
      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            <Target size={14} /> Metas
          </h2>
          <button
            onClick={() => setShowGoalForm((v) => !v)}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase text-muted transition-colors hover:text-ink"
          >
            {showGoalForm ? "Cancelar" : "+ Meta"}
          </button>
        </div>

        {showGoalForm && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-hairline bg-elevated p-3 sm:grid-cols-4">
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm">
              <option value="volume">Volume (sessoes)</option>
              <option value="estudo">Estudo (horas)</option>
            </select>
            <select value={goalPeriod} onChange={(e) => setGoalPeriod(e.target.value as GoalPeriod)} className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm">
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
            </select>
            <input
              placeholder="Meta (numero)"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
            <button onClick={handleAddGoal} className="rounded-lg bg-ink text-xs font-bold uppercase tracking-[0.1em] text-void transition-opacity hover:opacity-90">
              Salvar
            </button>
          </div>
        )}

        {goalsProgress.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma meta ativa. Crie uma meta de volume ou estudo pra acompanhar aqui.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {goalsProgress.map(({ goal, current, pct }) => (
              <div key={goal.id} className="rounded-lg border border-hairline bg-elevated p-3 transition-colors hover:border-ink/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">
                    {goal.type === "volume" ? "Volume" : "Estudo"} · {goal.period}
                  </p>
                  <button onClick={() => handleRemoveGoal(goal.id)} className="text-muted transition-colors hover:text-negative">
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {current} / {goal.target} {goal.unit}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-void/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-review to-evolution transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {goal.type === "estudo" && (
                  <div className="mt-2 flex gap-1.5">
                    {[30, 60, 90].map((m) => (
                      <button
                        key={m}
                        onClick={() => handleQuickStudy(m)}
                        className="rounded-md border border-hairline px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
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

      {/* BRM: moveup/movedown por formato — leitura atual sempre visivel
          (compacta, 1 linha), edicao dos thresholds fica atras de um
          "Editar" pra nao pesar a tela. */}
      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">BRM — moveup / movedown</h2>
          <button
            onClick={() => setShowBrmEdit((v) => !v)}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase text-muted transition-colors hover:text-ink"
          >
            {showBrmEdit ? "Fechar" : "Editar"}
          </button>
        </div>

        {currentBrm ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-hairline bg-elevated p-3">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                currentBrm.status === "moveup"
                  ? "bg-positive/15 text-positive"
                  : currentBrm.status === "movedown"
                    ? "bg-negative/15 text-negative"
                    : "bg-void/40 text-muted"
              }`}
            >
              {currentBrm.status === "moveup" ? "Pode subir" : currentBrm.status === "movedown" ? "Desca de stake" : "Mantenha"}
            </span>
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{currentBrm.format}</span> · banca cobre{" "}
              <span className="font-semibold text-ink">{currentBrm.buyInsCovered}</span> buy-ins de{" "}
              {fmtMoney(currentBrm.avgBuyIn)}{" "}
              <span className="text-muted">
                (moveup {currentBrm.threshold.moveupBuyins} · movedown {currentBrm.threshold.movedownBuyins})
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Registre sessoes pra ver sua leitura de BRM aqui.</p>
        )}

        {showBrmEdit && (
          <div className="mt-3 flex flex-col gap-2">
            {brmThresholds.map((t) => (
              <BrmThresholdRow key={t.format} threshold={t} onSave={handleSaveBrmThreshold} />
            ))}
          </div>
        )}
      </section>

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
          <input
            placeholder="Local"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm transition-colors hover:border-ink/30"
          />
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
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-void transition-opacity hover:opacity-90"
        >
          Salvar sessao
        </button>
      </Modal>

      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Sessoes recentes</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma sessao registrada.</p>
        ) : (
          <div className="mt-2 flex flex-col">
            {recent.map((s) => {
              const result = net(s);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border-t border-hairline px-1.5 py-2.5 transition-colors first:border-t-0 hover:bg-elevated"
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
                    <button onClick={() => handleRemove(s.id)} className="text-muted transition-colors hover:text-negative">
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
        </div>
        <button
          onClick={handleAddTransaction}
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-void transition-opacity hover:opacity-90"
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
                className="flex items-center gap-3 rounded-lg border-t border-hairline px-1.5 py-2.5 transition-colors first:border-t-0 hover:bg-elevated"
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
                  </p>
                  {t.note && <p className="truncate text-xs text-muted">{t.note}</p>}
                </div>
                <span className={`text-sm font-bold ${t.type === "deposito" ? "text-positive" : "text-negative"}`}>
                  {t.type === "deposito" ? "+" : "-"}
                  {fmtMoney(t.amount)}
                </span>
                <button onClick={() => handleRemoveTransaction(t.id)} className="text-muted transition-colors hover:text-negative">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Painel de leaks financeiro/comportamental — reusa groupStats
          (ja calculado, nunca tinha sido visualizado) agrupando por
          formato, dia da semana ou horario. Ordenado do pior pro melhor
          (groupStats ja devolve nessa ordem). Leak TECNICO (spot a spot)
          continua no Revisor de Maos — isso aqui e' leak financeiro. */}
      <section className="mt-6 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-ink/20">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Painel de leaks</h2>
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {[
              { value: "format" as const, label: "Formato" },
              { value: "weekday" as const, label: "Dia" },
              { value: "time" as const, label: "Horario" },
            ].map((d) => (
              <button
                key={d.value}
                onClick={() => setLeakDimension(d.value)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                  leakDimension === d.value ? "bg-ink text-void" : "text-muted hover:text-ink"
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
          <div className="mt-4 flex flex-col gap-2">
            {leakStats.map((g: GroupStat) => {
              const maxAbs = Math.max(...leakStats.map((x) => Math.abs(x.net)), 1);
              const width = Math.max(4, (Math.abs(g.net) / maxAbs) * 100);
              const negative = g.net < 0;
              return (
                <div key={g.key} className="rounded-lg border border-hairline bg-elevated p-3 transition-colors hover:border-ink/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{g.key}</p>
                    <p className="text-xs text-muted">
                      {g.n} {g.n === 1 ? "sessao" : "sessoes"} · ROI {fmtPct(g.roi)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void/40">
                      <div
                        className={`h-full rounded-full ${negative ? "bg-negative" : "bg-positive"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${negative ? "text-negative" : "text-positive"}`}>
                      {fmtSignedMoney(g.net)}
                    </span>
                  </div>
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

      <p className="mt-6 text-xs text-muted">Calculadora de BRM fica para a proxima leva desta fase.</p>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  accent,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "training" | "evolution";
  icon?: React.ReactNode;
  accent: string;
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
      className="acc-card acc-lift group relative cursor-pointer overflow-hidden rounded-xl border border-hairline bg-surface p-4"
    >
      <div aria-hidden="true" className="acc-glow pointer-events-none absolute -right-6 -top-6 size-20 rounded-full blur-2xl" />
      <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {icon}
        {label}
      </p>
      <p className={`relative mt-1.5 text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

// Linha editavel de threshold por formato — salva no blur (sem botao de
// "salvar" por linha, pra manter a secao compacta como pedido).
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
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2">
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

// Modal/drawer no topo (2026-08): usado pro registro rapido de sessao e
// transacao. Fecha com Esc, clique no backdrop ou no X — nunca trava o
// jogador sem saida. Entra deslizando do topo pra reforcar "isso e um
// atalho rapido", nao uma pagina nova.
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

// Grafico com eixos (2026-08 v7): antes era so uma linha solta (sparkline).
// Pedido explicito de ter eixo X (dias) e eixo Y (valor) visiveis, como no
// Sharkscope — grid horizontal com valores em R$ a esquerda, datas
// abaixo do eixo X. Mantém o efeito LED (glow + ponto pulsante) so na
// linha, os eixos ficam discretos (cor hairline/muted) pra nao competir
// visualmente com o dado principal.
const Y_TICKS = 4;

function EvolutionChart({ series }: { series: SeriesPoint[] }) {
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
  // Respiro de 8% acima/abaixo pra linha e pontos nao colarem no grid.
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

  // Eixo Y: Y_TICKS+1 linhas igualmente espacadas entre yMin e yMax.
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i) / Y_TICKS);

  // Eixo X: no maximo 6 labels de data, igualmente espacados pelos pontos
  // reais da serie (evita rotular todo ponto e poluir em series longas).
  const xTickCount = Math.min(6, series.length);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (series.length - 1))
  );

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

      {/* Grid + labels do eixo Y (valor) */}
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

      {/* Labels do eixo X (dias) */}
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

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={color} filter={`url(#${glowId})`} opacity={0.9}>
        <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.45;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="#fff" />
    </svg>
  );
}
