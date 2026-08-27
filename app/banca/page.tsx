"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, PlayCircle, NotebookPen, Trash2, TrendingUp, TrendingDown, PiggyBank, Wallet, Target, BookOpen, ChevronDown, Plus, X, Gauge, Download, StickyNote, GitCompare, ShieldAlert, History, Landmark, Search, LineChart, CalendarDays, TriangleAlert, Sparkles, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Session, Transaction, TransactionType, Goal, GoalType, GoalPeriod, StudyLog, BrmThreshold, BrmFormat, Annotation } from "@/lib/bankroll/types";
import { aggregate, evolutionSeries, filterSeriesByRange, filterSessionsByRange, net, netWorth, goalProgress, brmReading, thresholdFor, groupStats, tiltImpact, riskOfRuin, compareMonths, hourlyRate, platformBalances, currenciesInUse, dailyActivity, type RangeOption, type SeriesPoint, type GroupStat, type BrmStatus, type DayActivity } from "@/lib/bankroll/calc";
import { buildCoachTips, drawdownBuyIns, type CoachTip } from "@/lib/bankroll/coach";
import { fmtMoneyIn, fmtSignedMoneyIn, fmtPct, FORMATS, TOURNEY_FORMATS, CURRENCIES, todayISO, sessionsToCSV, downloadCSV } from "@/lib/bankroll/format";
import { PLATFORMS, OUTRO_PLATFORM } from "@/lib/bankroll/platforms";
import { fetchReviewCountsBySessionIds } from "@/lib/services/hand-review-service";
import { AppShell } from "@/components/app-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  fetchSessions,
  fetchSettings,
  addSession as apiAddSession,
  updateSession as apiUpdateSession,
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

// Mesmos periodos do resto da tela (RANGES), com rotulo por extenso: aqui
// o select fica solto numa toolbar, sem o contexto que faz "7D" bastar.
const HISTORY_RANGE_LABELS: Record<RangeOption, string> = {
  "7D": "Ultimos 7 dias",
  "30D": "Ultimos 30 dias",
  "1Y": "Ultimo ano",
  all: "Todo o periodo",
};
const HISTORY_RANGES = [...RANGES]
  .sort((a, b) => (a.value === "all" ? -1 : b.value === "all" ? 1 : 0))
  .map((r) => ({ value: r.value, label: HISTORY_RANGE_LABELS[r.value] }));

// Vocabulario do formulario por formato: "reentradas" e' termo de torneio;
// em cash o jogador recompra/recarrega o stack. Mesmo campo, o nome que ele
// usa de verdade em cada formato.
// Mesmo stack curto que a dica de leak do Treino ja aplica -- a acao rapida
// so' encurta o caminho, nao inventa um alvo diferente.
const LEAK_SHORT_STACK_BB = 15;

const REENTRY_LABEL: Record<string, string> = {
  MTT: "Reentradas",
  SNG: "Reentradas",
  Spin: "Reentradas",
  Cash: "Rebuys/Add-on",
};

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
  const [bankroll, setBankroll] = useState(0);
  const [range, setRange] = useState<RangeOption>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("todas");
  const [currencyFilter, setCurrencyFilter] = useState<string>("BRL");

  const [format, setFormat] = useState(FORMATS[0]);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [reentries, setReentries] = useState("");
  const [cashout, setCashout] = useState("");
  const [stake, setStake] = useState("");
  const [venue, setVenue] = useState<string>(PLATFORMS[0]);
  const [venueOther, setVenueOther] = useState("");
  const [hours, setHours] = useState("");
  const [currency, setCurrency] = useState<string>("BRL");
  const [notes, setNotes] = useState("");
  const [showDiary, setShowDiary] = useState(false);
  const [mood, setMood] = useState("");
  const [tilt, setTilt] = useState("");
  const [diaryNote, setDiaryNote] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rake, setRake] = useState("");
  const [rakeback, setRakeback] = useState("");
  const [bigBlind, setBigBlind] = useState("");
  const [ownPct, setOwnPct] = useState("");
  const [markup, setMarkup] = useState("");
  const [backerName, setBackerName] = useState("");

  const [txType, setTxType] = useState<TransactionType>("saque");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txNote, setTxNote] = useState("");
  const [txVenue, setTxVenue] = useState<string>(PLATFORMS[0]);
  const [txVenueOther, setTxVenueOther] = useState("");
  const [txCurrency, setTxCurrency] = useState<string>("BRL");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  // Filtros dedicados do historico -- a busca livre resolve "achar aquela
  // sessao", mas nao responde "como foi meu MTT nos ultimos 30 dias".
  const [historyFormat, setHistoryFormat] = useState<string>("all");
  const [historyRange, setHistoryRange] = useState<RangeOption>("all");

  const [goalType, setGoalType] = useState<GoalType>("volume");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("semanal");
  const [goalTarget, setGoalTarget] = useState("");

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  // id da sessao sendo editada (null = o modal esta em modo "registrar")
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [brmModalOpen, setBrmModalOpen] = useState(false);
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

  // Moeda: so' entra em jogo quando o jogador de fato usa mais de uma —
  // nesse caso currencyFilter nunca pode ficar preso numa moeda que nao
  // existe mais nos dados (ex: apagou a unica sessao em USD).
  const currencies = useMemo(() => currenciesInUse(sessions, transactions), [sessions, transactions]);
  const isMultiCurrency = currencies.length > 1;
  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(currencyFilter)) {
      setCurrencyFilter(currencies[0]);
    }
  }, [currencies, currencyFilter]);
  const fmt = (v: number) => fmtMoneyIn(v, currencyFilter);
  const fmtSigned = (v: number) => fmtSignedMoneyIn(v, currencyFilter);
  const currencySessions = useMemo(
    () => (isMultiCurrency ? sessions.filter((s) => (s.currency || "BRL") === currencyFilter) : sessions),
    [sessions, currencyFilter, isMultiCurrency]
  );
  const currencyTransactions = useMemo(
    () => (isMultiCurrency ? transactions.filter((t) => (t.currency || "BRL") === currencyFilter) : transactions),
    [transactions, currencyFilter, isMultiCurrency]
  );

  const platforms = useMemo(() => platformBalances(currencySessions, currencyTransactions), [currencySessions, currencyTransactions]);
  // So' plataformas com sessao/transacao de verdade -- antes juntava com
  // o catalogo inteiro (PLATFORMS), entao o filtro oferecia opcoes sem
  // nenhum dado; escolher uma delas filtrava pra uma lista vazia e a
  // tela inteira parecia ter quebrado (tudo em branco: sem grafico, sem
  // stats, sem historico).
  const platformNames = useMemo(() => platforms.map((p) => p.platform), [platforms]);
  // Sem isso, trocar de moeda (ou apagar a ultima sessao de uma
  // plataforma) deixava platformFilter apontando pra um valor que nao
  // existe mais em platformNames -- o <select> controlado nao acha
  // nenhuma <option> com esse value e renderiza em branco, sem nenhuma
  // opcao selecionada visivel (mesmo bug que currencyFilter ja tinha e
  // corrigiu acima).
  useEffect(() => {
    if (platformFilter !== "todas" && !platformNames.includes(platformFilter)) {
      setPlatformFilter("todas");
    }
  }, [platformNames, platformFilter]);
  const isPlatformFiltered = platformFilter !== "todas";
  const platformSessions = useMemo(
    () =>
      isPlatformFiltered
        ? currencySessions.filter((s) => (s.venue?.trim() || "Sem plataforma") === platformFilter)
        : currencySessions,
    [currencySessions, platformFilter, isPlatformFiltered]
  );
  const platformTransactions = useMemo(
    () =>
      isPlatformFiltered
        ? currencyTransactions.filter((t) => (t.venue?.trim() || "Sem plataforma") === platformFilter)
        : currencyTransactions,
    [currencyTransactions, platformFilter, isPlatformFiltered]
  );

  const agg = useMemo(() => aggregate(platformSessions), [platformSessions]);
  const nw = useMemo(
    () =>
      isPlatformFiltered || currencyFilter !== "BRL"
        ? netWorth(0, agg.profit, platformTransactions)
        : netWorth(base, agg.profit, currencyTransactions),
    [isPlatformFiltered, currencyFilter, base, agg.profit, currencyTransactions, platformTransactions]
  );
  const currentBankroll = isPlatformFiltered
    ? platforms.find((p) => p.platform === platformFilter)?.balance ?? 0
    : nw.playingBankroll;
  const series = useMemo(
    () => evolutionSeries(platformSessions, isPlatformFiltered ? 0 : base),
    [platformSessions, isPlatformFiltered, base]
  );
  const filteredSeries = useMemo(() => filterSeriesByRange(series, range), [series, range]);
  const tips = useMemo(
    () => buildCoachTips(sessions, { bankroll: nw.playingBankroll, brmThresholds }),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  // Dica some sozinha 24h depois de aparecer pela 1a vez (ou na hora, se
  // dispensada) -- mesma memoria do Assistente do coach (Time > Jogadores):
  // sem isso a mesma dica ficaria fixa pra sempre, mesmo already vista.
  const { registrarVistas: registrarVistasCoach, dispensar: dispensarCoachTip, visivel: coachTipVisivel } = useCoachTipMemoria();
  useEffect(() => {
    registrarVistasCoach(tips.map((t) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tips]);
  const tipsVisiveis = tips.filter((t) => coachTipVisivel(t.id));
  const currentBrm = useMemo(
    () => brmReading(sessions, nw.playingBankroll, brmThresholds),
    [sessions, nw.playingBankroll, brmThresholds]
  );
  const leakStats = useMemo(() => groupStats(platformSessions, "format"), [platformSessions]);
  const tiltStats = useMemo(() => tiltImpact(platformSessions), [platformSessions]);
  const rate = useMemo(() => hourlyRate(platformSessions), [platformSessions]);
  const activity = useMemo(() => dailyActivity(platformSessions), [platformSessions]);
  const calcThreshold = useMemo(() => thresholdFor(brmThresholds, calcFormat), [brmThresholds, calcFormat]);
  const ruin = useMemo(() => riskOfRuin(sessions, nw.playingBankroll), [sessions, nw.playingBankroll]);
  const comparison = useMemo(() => compareMonths(platformSessions), [platformSessions]);
  const currentDrawdown = useMemo(() => drawdownBuyIns(platformSessions, agg.avgBuyIn), [platformSessions, agg.avgBuyIn]);
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
  // O catalogo (FORMATS) e o que esta gravado nas sessoes nem sempre batem --
  // ha sessoes com formato "Torneio", que nao esta no seletor. Filtrar so'
  // pelo catalogo esconderia essas sessoes sem o jogador entender por que.
  const historyFormats = useMemo(
    () => Array.from(new Set([...FORMATS, ...platformSessions.map((s) => s.format)])).filter(Boolean),
    [platformSessions]
  );

  const historyFiltered = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    let base = platformSessions;
    if (historyFormat !== "all") base = base.filter((s) => s.format === historyFormat);
    if (historyRange !== "all") base = filterSessionsByRange(base, historyRange);
    const list = [...base].reverse();
    if (!q) return list;
    return list.filter((s) =>
      [s.format, s.date, s.stake, s.venue, s.notes, s.mood].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
    );
  }, [platformSessions, historySearch, historyFormat, historyRange]);
  const goalsProgress = useMemo(() => goals.map((g) => goalProgress(g, sessions, studyLogs)), [goals, sessions, studyLogs]);

  // Quantas maos foram revisadas por sessao -- antes o vinculo so existia
  // no sentido revisor->banca (session_id gravado na mao), a banca nunca
  // mostrava nada de volta. So busca pras sessoes realmente visiveis na
  // lista (nao a banca toda).
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const visibleSessionIds = (historyOpen ? historyFiltered : recent).map((s) => s.id).join(",");
  useEffect(() => {
    const ids = visibleSessionIds ? visibleSessionIds.split(",") : [];
    if (ids.length === 0) return;
    fetchReviewCountsBySessionIds(ids).then(setReviewCounts).catch(() => {});
  }, [visibleSessionIds]);

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

  // Reset dos campos do formulario de sessao -- usado ao salvar e ao sair do
  // modo de edicao, pra um "editar" nunca deixar campo preenchido sujando o
  // proximo "registrar".
  function resetSessionForm() {
    setBuyIn("");
    setCashout("");
    setStake("");
    setVenue(PLATFORMS[0]);
    setVenueOther("");
    setHours("");
    setTime("");
    setCurrency("BRL");
    setNotes("");
    setReentries("");
    setMood("");
    setTilt("");
    setDiaryNote("");
    setShowDiary(false);
    setRake("");
    setRakeback("");
    setBigBlind("");
    setOwnPct("");
    setMarkup("");
    setBackerName("");
    setShowAdvanced(false);
    setEditingSessionId(null);
  }

  // Abre o mesmo modal do registro, mas preenchido -- editar e registrar sao
  // o mesmo formulario, entao qualquer campo novo entra nos dois de graca.
  function handleEditSession(s: Session) {
    setEditingSessionId(s.id);
    setDate(s.date);
    setTime(s.time ?? "");
    setFormat(s.format);
    setBuyIn(String(s.buyIn));
    setReentries(String(s.reentries ?? 0));
    setCashout(String(s.cashout));
    setStake(s.stake ?? "");
    setHours(s.hours != null ? String(s.hours) : "");
    setCurrency(s.currency ?? "BRL");
    setNotes(s.notes ?? "");
    // Plataforma fora do catalogo volta como "Outro" + texto livre, senao o
    // select cairia no primeiro item e a edicao trocaria a plataforma sozinha.
    const known = s.venue && (PLATFORMS as readonly string[]).includes(s.venue);
    setVenue(known ? (s.venue as string) : s.venue ? OUTRO_PLATFORM : PLATFORMS[0]);
    setVenueOther(known ? "" : s.venue ?? "");
    setMood(s.mood ?? "");
    setTilt(s.tilt != null ? String(s.tilt) : "");
    setDiaryNote(s.diaryNote ?? "");
    setRake(s.rake != null ? String(s.rake) : "");
    setRakeback(s.rakeback != null ? String(s.rakeback) : "");
    setBigBlind(s.bigBlind != null ? String(s.bigBlind) : "");
    setOwnPct(s.ownPct != null ? String(s.ownPct) : "");
    setMarkup(s.markup != null ? String(s.markup) : "");
    setBackerName(s.backerName ?? "");
    // Secoes recolhidas abrem quando ja tem conteudo -- senao o jogador
    // editaria sem ver que existe diario/staking preenchido ali dentro.
    setShowDiary(Boolean(s.mood || s.tilt != null || s.diaryNote));
    setShowAdvanced(Boolean(s.rake != null || s.rakeback != null || s.bigBlind != null || s.ownPct != null || s.markup != null || s.backerName));
    setErr("");
    setSessionModalOpen(true);
  }

  function closeSessionModal() {
    setSessionModalOpen(false);
    if (editingSessionId) resetSessionForm();
  }

  async function handleSaveSession() {
    if (!buyIn || !cashout || !date) {
      setErr("Preencha data, buy-in e cashout.");
      return;
    }
    const resolvedVenue = venue === OUTRO_PLATFORM ? venueOther.trim() : venue;
    const draft: Session = {
      id: editingSessionId ?? `tmp-${Date.now()}`,
      date,
      time: time || undefined,
      format,
      buyIn: Number(buyIn),
      reentries: Number(reentries) || 0,
      cashout: Number(cashout),
      stake,
      hours: hours ? Number(hours) : undefined,
      venue: resolvedVenue || undefined,
      currency,
      notes,
      mood: mood || undefined,
      tilt: tilt ? Number(tilt) : undefined,
      diaryNote: diaryNote || undefined,
      rake: rake ? Number(rake) : undefined,
      rakeback: rakeback ? Number(rakeback) : undefined,
      bigBlind: bigBlind ? Number(bigBlind) : undefined,
      ownPct: ownPct ? Number(ownPct) : undefined,
      markup: markup ? Number(markup) : undefined,
      backerName: backerName || undefined,
    };
    const editingId = editingSessionId;
    const backup = sessions;
    setSessions((prev) => (editingId ? prev.map((x) => (x.id === editingId ? draft : x)) : [...prev, draft]));
    resetSessionForm();
    setErr("");
    setSessionModalOpen(false);
    try {
      const saved = editingId ? await apiUpdateSession(editingId, draft) : await apiAddSession(draft);
      setSessions((prev) => prev.map((x) => (x.id === draft.id ? saved : x)));
    } catch {
      // Edicao volta ao estado anterior; registro novo some da lista.
      setErr(editingId ? "Nao foi possivel salvar a edicao." : "Nao foi possivel salvar a sessao.");
      setSessions(editingId ? backup : (prev) => prev.filter((x) => x.id !== draft.id));
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
      currency: txCurrency,
    };
    setTransactions((prev) => [...prev, draft]);
    setTxAmount("");
    setTxNote("");
    setTxVenue(PLATFORMS[0]);
    setTxVenueOther("");
    setTxCurrency("BRL");
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
    const inRange = filterSessionsByRange(platformSessions, range);
    const csv = sessionsToCSV(inRange, net);
    downloadCSV(`pokersync-sessoes-${range}-${todayISO()}.csv`, csv);
  }

  if (loading) {
    return (
      <AppShell>
        <main className="w-full px-6 py-10 text-center text-sm text-muted">Carregando sua banca...</main>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <main className="w-full px-6 py-10 text-ink">
      {err && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>
      )}

      {/* Faixa herói — mesmo padrão da Performance (Player Evolution):
          nada de card por metrica, os numeros vivem soltos dentro de um
          unico container, separados por divisor. */}
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
          <p className="text-sm text-muted">Sua banca, sessão a sessão</p>
          <div className="flex items-center gap-2">
            {isMultiCurrency && (
              <div className="flex items-center gap-1.5 rounded-lg border border-training/40 bg-training/10 px-2.5 py-1.5">
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  title="Moeda — os stats abaixo nunca somam moedas diferentes"
                  className="bg-transparent text-[11px] font-bold uppercase tracking-[0.06em] text-training outline-none"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => {
                // Sempre entra em modo "registrar": se o modal foi usado pra
                // editar antes, os campos preenchidos ficariam ali.
                if (editingSessionId) resetSessionForm();
                setSessionModalOpen(true);
              }}
              aria-label="Registrar sessao"
              title="Registrar sessao"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-void transition-colors hover:opacity-90"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setTxModalOpen(true)}
              aria-label="Deposito / saque"
              title="Deposito / saque"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              <Wallet size={17} />
            </button>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full opacity-[0.13] blur-3xl"
          style={{ background: currentBankroll < 0 ? "#e0555a" : "#2FB89A" }}
        />

        <div className="relative grid grid-cols-2 divide-x divide-y divide-hairline sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <HeroMetric
            label="Banca atual"
            value={fmt(currentBankroll)}
            tone={currentBankroll < 0 ? "ruim" : "bom"}
            hint={`${fmtSigned(agg.profit)} de resultado`}
            destaque
          />
          <HeroMetric
            label="ROI"
            value={fmtPct(agg.roi)}
            tone={agg.roi >= 0 ? "bom" : "ruim"}
            hint={comparison.previous.n > 0 ? `${fmtPct(roiDelta)} vs mês passado` : undefined}
          />
          <HeroMetric
            label="R$/hora"
            value={rate ? fmt(rate.value) : "—"}
            tone={!rate ? "neutro" : rate.value >= 0 ? "bom" : "ruim"}
            hint={!rate ? "Registre horas jogadas na sessão pra ver isso." : undefined}
          />
          <HeroMetric label="Buy-in médio" value={fmt(agg.avgBuyIn)} tone="neutro" />
          <HeroMetric label="ITM" value={`${agg.itm.toFixed(1)}%`} tone="neutro" />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel
          titulo="Evolução da banca"
          icone={<LineChart size={14} className="text-evolution" />}
          className="flex h-full flex-col"
          acao={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1">
                <Landmark size={12} className="text-muted" />
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  title="Filtrar por plataforma"
                  className="bg-transparent text-[11px] font-semibold text-ink outline-none"
                >
                  <option value="todas">Todas as plataformas</option>
                  {platformNames.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <SegmentedControl value={range} onChange={setRange} options={RANGES} />
              <button
                onClick={() => setAnnoModalOpen(true)}
                title="Anotar evento na timeline"
                className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-muted transition-colors hover:border-review/50 hover:text-review"
              >
                <StickyNote size={13} />
              </button>
              <button
                onClick={() => setCompareOpen((v) => !v)}
                title="Comparar meses"
                className={`grid h-7 w-7 place-items-center rounded-md border transition-colors ${
                  compareOpen ? "border-training bg-training/15 text-training" : "border-hairline text-muted hover:border-training/50 hover:text-training"
                }`}
              >
                <GitCompare size={13} />
              </button>
              <button
                onClick={handleExportCSV}
                title="Exportar CSV do periodo"
                className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-muted transition-colors hover:border-positive/50 hover:text-positive"
              >
                <Download size={13} />
              </button>
            </div>
          }
        >
          <div className="flex-1">
            <EvolutionChart series={filteredSeries} annotations={annotations} currency={currencyFilter} />
          </div>

          {compareOpen && (
            <div className="mt-4 rounded-lg border border-hairline bg-elevated p-3">
              <p className="text-xs font-semibold text-muted">
                {comparison.currentLabel} vs {comparison.previousLabel}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div />
                <p className="text-[10px] font-semibold uppercase text-muted">{comparison.currentLabel.split(" ")[0]}</p>
                <p className="text-[10px] font-semibold uppercase text-muted">{comparison.previousLabel.split(" ")[0]}</p>

                <p className="text-left text-[11px] text-muted">Resultado</p>
                <p className={`text-sm font-bold ${comparison.current.profit >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSigned(comparison.current.profit)}
                </p>
                <p className={`text-sm font-bold ${comparison.previous.profit >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtSigned(comparison.previous.profit)}
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
        </Painel>

        <Painel
          titulo="Consistência de volume"
          icone={<CalendarDays size={14} className="text-evolution" />}
          className="flex h-full flex-col"
        >
          <div className="flex flex-1 items-center">
            <VolumeHeatmap activity={activity} currency={currencyFilter} />
          </div>
        </Painel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Risco" icone={<ShieldAlert size={14} className="text-negative" />}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-hairline bg-elevated p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Drawdown atual</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${currentDrawdown >= 15 ? "text-negative" : "text-ink"}`}>
                {currentDrawdown > 0 ? `${currentDrawdown.toFixed(1)} BI` : "—"}
              </p>
            </div>

            <button
              onClick={() => setBrmModalOpen(true)}
              className="rounded-lg border border-hairline bg-elevated p-4 text-left transition-colors hover:border-training/40"
              title="Clique pra ajustar os limites de BRM"
            >
              <div className="flex items-center gap-1.5">
                <Gauge size={12} className="text-training" />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">BRM</p>
              </div>
              {currentBrm ? (
                <>
                  <span
                    className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] ${
                      currentBrm.status === "moveup"
                        ? "bg-positive/15 text-positive"
                        : currentBrm.status === "movedown"
                          ? "bg-negative/15 text-negative"
                          : "bg-void/40 text-muted"
                    }`}
                  >
                    {currentBrm.status === "moveup" ? "Pode subir" : currentBrm.status === "movedown" ? "Desça de stake" : "Mantenha"}
                  </span>
                  <p className="mt-1.5 text-[11px] text-muted">
                    <span className="font-semibold text-ink">{currentBrm.format}</span> · cobre{" "}
                    <span className="font-semibold text-ink">{currentBrm.buyInsCovered}</span> buy-ins
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted">Registre sessões pra ver sua leitura de BRM.</p>
              )}
            </button>
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Leaks recorrentes por formato</p>

            {leakStats.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Registre sessoes pra ver seus leaks aqui.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {leakStats.map((g: GroupStat) => {
                  const negative = g.net < 0;
                  const lowSample = g.n < 5;
                  return (
                    <div key={g.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{g.key}</p>
                        <p className="text-[10.5px] text-muted">
                          {g.n} {g.n === 1 ? "sessao" : "sessoes"} · ROI {fmtPct(g.roi)}
                          {lowSample && <span className="ml-1 text-evolution">· amostra pequena</span>}
                        </p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${negative ? "text-negative" : "text-positive"}`}>
                        {fmtSigned(g.net)}
                      </span>
                      {/* Acoes rapidas: so' em fatia que esta perdendo -- num grupo
                          positivo elas seriam ruido. "Treinar" so' aparece onde o
                          estoque de spots casa com a fatia (motor e' ICM de
                          torneio), senao levaria a um treino sem relacao com o
                          leak. "Registrar mao" vale pra qualquer fatia: e' o
                          primeiro passo de investigar o proprio erro. */}
                      <div className="flex items-center gap-1">
                        {negative && TOURNEY_FORMATS.has(g.key) && (
                          <Link
                            href={`/treino?stack=${LEAK_SHORT_STACK_BB}`}
                            title={`Treinar stack curto (${LEAK_SHORT_STACK_BB}bb) — onde esse leak costuma doer`}
                            aria-label={`Treinar ${g.key}`}
                            className="flex items-center gap-1 rounded-lg border border-training/40 px-2 py-1 text-[10.5px] font-semibold text-training transition-colors hover:bg-training/10"
                          >
                            <PlayCircle size={13} />
                            Treinar
                          </Link>
                        )}
                        {negative && (
                          <Link
                            href="/revisor?nova=1"
                            title="Registrar uma mao desse leak pra revisar"
                            aria-label={`Registrar mao de ${g.key}`}
                            className="flex items-center gap-1 rounded-lg border border-review/40 px-2 py-1 text-[10.5px] font-semibold text-review transition-colors hover:bg-review/10"
                          >
                            <NotebookPen size={13} />
                            Registrar mao
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tiltStats && tiltStats.tiltN > 0 && (
              <div className="mt-3 rounded-lg border border-hairline bg-elevated p-3">
                <p className="text-xs font-semibold text-muted">Sessoes com tilt vs demais</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted">Tilt ({tiltStats.tiltN})</p>
                    <p className={`text-sm font-bold ${tiltStats.tiltNet >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmtSigned(tiltStats.tiltNet)} · ROI {fmtPct(tiltStats.tiltRoi)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">Demais ({tiltStats.otherN})</p>
                    <p className={`text-sm font-bold ${tiltStats.otherNet >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmtSigned(tiltStats.otherNet)} · ROI {fmtPct(tiltStats.otherRoi)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Painel>

        <section className="rounded-xl border border-hairline bg-surface p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles size={16} className="text-evolution" />
            AI Coach
            <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{tipsVisiveis.length}</span>
          </div>

          <div className="mt-3 grid gap-3">
            {tipsVisiveis.length === 0 ? (
              <p className="text-sm text-muted">
                Sem novidades por enquanto — volte amanhã ou registre mais sessões pra o coach analisar.
              </p>
            ) : (
              COACH_LEVELS.map((level) => {
                const items = tipsVisiveis.filter((t) => t.level === level);
                if (items.length === 0) return null;
                const meta = COACH_LEVEL_META[level];
                return (
                  <div key={level} className={`rounded-lg border p-3 ${toneClasses(level)}`}>
                    <p className={`flex items-center gap-1.5 text-[12px] font-semibold ${meta.text}`}>
                      <meta.Icon size={13} /> {meta.label}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {items.map((tip) => (
                        <li key={tip.id} className="flex items-start justify-between gap-2 text-[13px]">
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{tip.title}</p>
                            <p className="text-[11.5px] leading-snug text-muted">{tip.text}</p>
                          </div>
                          <button
                            onClick={() => dispensarCoachTip(tip.id)}
                            aria-label="Dispensar"
                            className="shrink-0 text-muted/60 transition-colors hover:text-muted"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel
          titulo="Metas"
          icone={<Target size={14} className="text-review" />}
          acao={
            <button
              onClick={() => setGoalsModalOpen(true)}
              className="text-[11px] font-semibold text-muted transition-colors hover:text-ink"
              title="Clique pra criar ou ajustar metas"
            >
              + nova meta
            </button>
          }
        >
          {goalsProgress.length === 0 ? (
            <button onClick={() => setGoalsModalOpen(true)} className="block text-left text-[11px] text-muted hover:text-ink">
              Nenhuma meta ativa. Clique aqui pra criar.
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {goalsProgress.map(({ goal, current, pct }) => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold capitalize">
                      {goal.type === "volume" ? "Volume" : "Estudo"} · {goal.period}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted">
                        {current}/{goal.target}
                      </span>
                      <button onClick={() => handleRemoveGoal(goal.id)} className="text-muted transition-colors hover:text-negative">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-void/40">
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
                          className="rounded-md border border-hairline px-1.5 py-0.5 text-[9.5px] font-semibold text-muted transition-colors hover:border-evolution/50 hover:text-evolution"
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
        </Painel>

        <Painel
          titulo={historyOpen ? `Historico de sessoes (${historyFiltered.length})` : "Sessoes recentes"}
          icone={<History size={14} className="text-training" />}
          acao={
            <div className="flex flex-wrap items-center gap-2">
              {historyOpen && (
                <>
                  <select
                    value={historyFormat}
                    onChange={(e) => setHistoryFormat(e.target.value)}
                    aria-label="Filtrar por formato"
                    className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
                  >
                    <option value="all">Todos os formatos</option>
                    {historyFormats.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <select
                    value={historyRange}
                    onChange={(e) => setHistoryRange(e.target.value as RangeOption)}
                    aria-label="Filtrar por periodo"
                    className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
                  >
                    {HISTORY_RANGES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1">
                    <Search size={12} className="text-muted" />
                    <input
                      placeholder="Buscar..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-32 bg-transparent text-[11px] text-ink outline-none placeholder:text-muted"
                    />
                  </div>
                </>
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
          }
        >
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma sessao registrada.</p>
          ) : (
            <div className={`mt-4 divide-y divide-hairline ${historyOpen ? "max-h-[520px] overflow-y-auto" : ""}`}>
              {(historyOpen ? historyFiltered : recent).map((s) => {
                const result = net(s);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-1.5 py-2.5 transition-colors hover:bg-elevated"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          <span className="truncate">
                            {s.format} · {s.date}
                            {s.stake ? ` · ${s.stake}` : ""}
                            {s.mood ? ` · ${s.mood}` : ""}
                            {s.ownPct != null && s.ownPct < 100 ? ` · ${s.ownPct}% sua` : ""}
                          </span>
                          {reviewCounts[s.id] > 0 && (
                            <Link
                              href="/revisor"
                              onClick={(e) => e.stopPropagation()}
                              title={`${reviewCounts[s.id]} mão(s) revisada(s) desta sessão`}
                              className="flex shrink-0 items-center gap-0.5 rounded border border-review/30 bg-review/[0.12] px-1 py-0.5 text-[10px] font-semibold text-review"
                            >
                              <BookOpen size={9} /> {reviewCounts[s.id]}
                            </Link>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {s.venue || "—"}
                          {s.notes ? ` · ${s.notes}` : ""}
                          {s.diaryNote ? ` · ${s.diaryNote}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${result >= 0 ? "text-positive" : "text-negative"}`}>
                        {fmtSigned(result)}
                      </span>
                      <button
                        onClick={() => handleEditSession(s)}
                        aria-label="Editar sessao"
                        title="Editar sessao"
                        className="text-muted transition-colors hover:text-ink"
                      >
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleRemove(s.id)} aria-label="Excluir sessao" title="Excluir sessao" className="text-muted transition-colors hover:text-negative">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
        </Painel>
      </div>

      <Modal open={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Nova meta">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm outline-none transition-colors focus:border-ink/40 sm:col-span-2">
            <option value="volume">Volume (sessoes)</option>
            <option value="estudo">Estudo (horas)</option>
          </select>
          <select value={goalPeriod} onChange={(e) => setGoalPeriod(e.target.value as GoalPeriod)} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm outline-none transition-colors focus:border-ink/40">
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
          <input
            placeholder="Meta (numero)"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-2.5 py-2 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <button
            onClick={handleAddGoal}
            className="rounded-lg bg-ink py-2.5 text-sm font-semibold text-void transition-colors hover:opacity-90 sm:col-span-4"
          >
            Criar meta
          </button>
        </div>
      </Modal>

      <Modal open={brmModalOpen} onClose={() => setBrmModalOpen(false)} title="BRM — moveup / movedown">
        <div className="rounded-lg border border-hairline bg-elevated p-3">
          <p className="text-xs font-semibold text-muted">Calculadora</p>
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
                {fmt(Number(calcBuyIn))} em {calcFormat}{" "}
                <span className="text-muted">
                  (moveup {calcThreshold.moveupBuyins} · movedown {calcThreshold.movedownBuyins})
                </span>
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs font-semibold text-muted">Thresholds por formato</p>
        <div className="mt-2 flex flex-col gap-2">
          {brmThresholds.map((t) => (
            <BrmThresholdRow key={t.format} threshold={t} onSave={handleSaveBrmThreshold} />
          ))}
        </div>

        {ruin && (
          <div className="mt-4 rounded-lg border border-hairline bg-elevated p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
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
          className="mt-2 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-void transition-colors hover:opacity-90"
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
                <button onClick={() => handleRemoveAnnotation(a.id)} className="shrink-0 text-muted transition-colors hover:text-negative">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={sessionModalOpen} onClose={closeSessionModal} title={editingSessionId ? "Editar sessao" : "Registrar sessao"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
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
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            title="Horario que a sessao comecou"
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-muted outline-none transition-colors focus:border-ink/40"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Horas jogadas"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          {format === "Cash" && (
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Big blind (p/ bb/hora)"
              title="Big blind da mesa — alimenta o bb/hora"
              value={bigBlind}
              onChange={(e) => setBigBlind(e.target.value)}
              className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
          )}
          <input
            placeholder="Buy-in"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <input
            placeholder={REENTRY_LABEL[format] ?? "Reentradas"}
            title={REENTRY_LABEL[format] ?? "Reentradas"}
            value={reentries}
            onChange={(e) => setReentries(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <input
            placeholder="Cashout"
            value={cashout}
            onChange={(e) => setCashout(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <div className="grid grid-cols-[1fr_64px] gap-2">
            <input
              placeholder="Stake"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              title="Moeda da sessao"
              className="rounded-lg border border-hairline bg-elevated px-1.5 py-2.5 text-xs text-muted outline-none transition-colors focus:border-ink/40"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className={`rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40 ${venue === OUTRO_PLATFORM ? "" : "col-span-2"}`}
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
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
          )}
          <input
            placeholder="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="col-span-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
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
          onClick={() => setShowAdvanced((v) => !v)}
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          <Landmark size={13} /> Rake, bb/hora e staking (opcional)
          <ChevronDown size={13} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
        {showAdvanced && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-hairline bg-elevated p-3">
            <input
              type="number"
              step="0.01"
              placeholder="Rake pago"
              value={rake}
              onChange={(e) => setRake(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Rakeback recebido"
              value={rakeback}
              onChange={(e) => setRakeback(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
            {/* Em Cash o big blind sai daqui e sobe pro formulario principal:
                la ele e' campo de rotina (alimenta bb/hora), nao "avancado". */}
            {format !== "Cash" && (
              <input
                type="number"
                step="0.01"
                placeholder="Big blind (só cash, p/ bb/hora)"
                value={bigBlind}
                onChange={(e) => setBigBlind(e.target.value)}
                className="col-span-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
              />
            )}
            <div className="col-span-2 mt-1 border-t border-hairline pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              Staking (deixe em branco se a banca é 100% sua)
            </div>
            <input
              type="number"
              min="1"
              max="100"
              placeholder="% que é sua (ex: 50)"
              value={ownPct}
              onChange={(e) => setOwnPct(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Markup (ex: 1.1)"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              className="rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
            <input
              placeholder="Nome do backer"
              value={backerName}
              onChange={(e) => setBackerName(e.target.value)}
              className="col-span-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={handleSaveSession}
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-void transition-colors hover:opacity-90"
        >
          {editingSessionId ? "Salvar alteracoes" : "Salvar sessao"}
        </button>
      </Modal>

      <Modal open={txModalOpen} onClose={() => setTxModalOpen(false)} title="Deposito / saque / caixinha">
        <p className="text-xs text-muted">
          Nao entra no resultado de jogo — so move dinheiro entre banca de jogo e patrimonio guardado.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as TransactionType)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          >
            <option value="deposito">Deposito</option>
            <option value="saque">Saque</option>
            <option value="caixinha">Caixinha</option>
          </select>
          <input
            type="date"
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <div className="grid grid-cols-[1fr_64px] gap-2">
            <input
              placeholder="Valor"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
            <select
              value={txCurrency}
              onChange={(e) => setTxCurrency(e.target.value)}
              title="Moeda"
              className="rounded-lg border border-hairline bg-elevated px-1.5 py-2.5 text-xs text-muted outline-none transition-colors focus:border-ink/40"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <input
            placeholder="Nota (opcional)"
            value={txNote}
            onChange={(e) => setTxNote(e.target.value)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
          />
          <select
            value={txVenue}
            onChange={(e) => setTxVenue(e.target.value)}
            className={`rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40 ${txVenue === OUTRO_PLATFORM ? "" : "col-span-2"}`}
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
              className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
          )}
        </div>
        <button
          onClick={handleAddTransaction}
          className="mt-4 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-void transition-colors hover:opacity-90"
        >
          Registrar
        </button>
      </Modal>

      <Painel titulo="Historico de transacoes" icone={<Wallet size={14} className="text-training" />} className="mt-6">
        {recentTx.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma transacao registrada.</p>
        ) : (
          <div className="mt-4 divide-y divide-hairline">
            {recentTx.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-1.5 py-2.5 transition-colors hover:bg-elevated"
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
                  {fmt(t.amount)}
                </span>
                <button onClick={() => handleRemoveTransaction(t.id)} className="text-muted transition-colors hover:text-negative">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Painel>
    </main>
    </AppShell>
  );
}

// Mesmo padrao visual da Performance (Player Evolution): metrica solta
// dentro de um container comum, sem virar card proprio.
function HeroMetric({
  label,
  value,
  hint,
  tone,
  destaque = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "bom" | "ruim" | "neutro";
  destaque?: boolean;
}) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="px-6 py-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{label}</p>
      <p
        className={`mt-2 font-bold leading-none tracking-tight tabular-nums ${
          destaque ? "text-[2.25rem]" : "text-[1.75rem]"
        } ${cor}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}

// Mesmo componente "Painel" da Performance: titulo pequeno em caixa alta
// + icone, sem o peso visual de um h2 grande por secao.
function Painel({
  titulo,
  icone,
  acao,
  className,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-hairline bg-surface p-5 ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icone}
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

// Linha densa label/valor — substitui o card por metrica dentro de um Painel.
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

// Mesma logica de agrupamento por severidade do Assistente do coach (Time
// > Jogadores): cada nivel vira um bloco tingido com icone + lista, em vez
// de uma unica dica "em destaque" que ficava girando sozinha.
const COACH_LEVELS: CoachTip["level"][] = ["bad", "warn", "good", "info"];
const COACH_LEVEL_META: Record<CoachTip["level"], { label: string; text: string; Icon: typeof AlertTriangle }> = {
  bad: { label: "Precisa de atenção", text: "text-negative", Icon: AlertTriangle },
  warn: { label: "Fique de olho", text: "text-evolution", Icon: TriangleAlert },
  good: { label: "Indo bem", text: "text-positive", Icon: CheckCircle2 },
  info: { label: "Pra saber", text: "text-muted", Icon: Info },
};

// Mesma memoria do Assistente do coach (Time > Jogadores): guardada no
// navegador, nao no banco -- e' so' preferencia de leitura. Cada dica some
// sozinha 24h depois de aparecer pela 1a vez, ou na hora se dispensada,
// liberando espaco pra proxima leva de analise.
const COACH_MEMORIA_KEY = "pokersync_banca_coach_memoria";
const COACH_EXPIRA_MS = 24 * 60 * 60 * 1000;

function useCoachTipMemoria() {
  const [memoria, setMemoria] = useState<Record<string, { primeiraVezEm: number; dispensadoEm?: number }>>({});

  useEffect(() => {
    try {
      setMemoria(JSON.parse(localStorage.getItem(COACH_MEMORIA_KEY) ?? "{}"));
    } catch {
      setMemoria({});
    }
  }, []);

  function persistir(next: typeof memoria) {
    setMemoria(next);
    try {
      localStorage.setItem(COACH_MEMORIA_KEY, JSON.stringify(next));
    } catch {
      // localStorage indisponivel (modo privado etc.) — degrada pra "sempre visivel", sem quebrar a tela.
    }
  }

  function registrarVistas(chaves: string[]) {
    let mudou = false;
    const next = { ...memoria };
    for (const k of chaves) {
      if (!next[k]) {
        next[k] = { primeiraVezEm: Date.now() };
        mudou = true;
      }
    }
    if (mudou) persistir(next);
  }

  function dispensar(chave: string) {
    persistir({ ...memoria, [chave]: { primeiraVezEm: memoria[chave]?.primeiraVezEm ?? Date.now(), dispensadoEm: Date.now() } });
  }

  function visivel(chave: string): boolean {
    const m = memoria[chave];
    if (!m) return true;
    if (m.dispensadoEm) return false;
    return Date.now() - m.primeiraVezEm < COACH_EXPIRA_MS;
  }

  return { registrarVistas, dispensar, visivel };
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
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
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

function EvolutionChart({
  series,
  annotations = [],
  currency = "BRL",
}: {
  series: SeriesPoint[];
  annotations?: Annotation[];
  currency?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const fmt = (v: number) => fmtMoneyIn(v, currency);
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
    // aspect-ratio no lugar de h-56 fixo -- antes a caixa renderizada
    // (w-full x altura fixa) quase nunca batia com a proporcao intrinseca
    // do viewBox (640x220), entao o SVG "letterboxava" com faixas pretas
    // nas laterais (preserveAspectRatio default = meet). Travando a
    // proporcao da propria caixa igual ao viewBox, a faixa preta some sem
    // esticar/distorcer os rotulos de texto (que "none" faria).
    <svg viewBox={`0 0 ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} className="w-full overflow-visible">
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
              {fmt(v)}
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
              {fmt(hoverData.value)} ({hoverData.net >= 0 ? "+" : ""}
              {fmt(hoverData.net)})
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
function VolumeHeatmap({ activity, currency = "BRL" }: { activity: Record<string, DayActivity>; currency?: string }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const fmtSigned = (v: number) => fmtSignedMoneyIn(v, currency);
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
    <div className="mt-3 w-full">
      <div className="flex justify-center gap-[5px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[5px]">
            {week.map(({ date, d }) => {
              const a = activity[date];
              const future = d > today;
              return (
                <div
                  key={date}
                  onMouseEnter={() => !future && setHoverKey(date)}
                  onMouseLeave={() => setHoverKey((k) => (k === date ? null : k))}
                  className="size-[20px] rounded-[4px] transition-transform duration-100 hover:scale-110"
                  style={{ background: future ? "transparent" : cellColor(a) }}
                  title={a ? `${date} · ${a.n} sessão(ões) · ${fmtSigned(a.net)}` : date}
                />
              );
            })}
          </div>
        ))}
      </div>
      {hovered && (
        <div className="mt-3 flex items-center justify-end text-[10px] text-muted">
          <span className="font-semibold text-ink">
            {hovered.date} · {hovered.n} {hovered.n === 1 ? "sessão" : "sessões"} · {fmtSigned(hovered.net)}
          </span>
        </div>
      )}
    </div>
  );
}
