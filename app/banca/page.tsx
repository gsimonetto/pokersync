"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank, Wallet, BookOpen, ChevronDown, Plus, X, Gauge, Download, StickyNote, GitCompare, ShieldAlert, History, Landmark, LineChart, CalendarDays, TriangleAlert, Sparkles, AlertTriangle, CheckCircle2, Info, Skull, Coins, FileBarChart, Bot, Target } from "lucide-react";
import type { Session, Transaction, TransactionType, BrmThreshold, BrmFormat, Annotation } from "@/lib/bankroll/types";
import { aggregate, evolutionSeries, filterSeriesByRange, filterSessionsByRange, net, netWorth, brmReading, thresholdFor, tiltImpact, riskOfRuin, compareMonths, hourlyRate, platformBalances, currenciesInUse, dailyActivity, type RangeOption, type SeriesPoint, type BrmStatus, type DayActivity } from "@/lib/bankroll/calc";
import { buildCoachTips, drawdownBuyIns, type CoachTip } from "@/lib/bankroll/coach";
import { fmtMoneyIn, fmtSignedMoneyIn, fmtPct, FORMATS, CURRENCIES, todayISO, sessionsToCSV, downloadCSV } from "@/lib/bankroll/format";
import { niceTicks } from "@/lib/format";
import { PLATFORMS, OUTRO_PLATFORM } from "@/lib/bankroll/platforms";
import { fetchReviewCountsBySessionIds, linkHandSessionReviews } from "@/lib/services/hand-review-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { fetchTournamentSessions } from "@/lib/services/analysis-service";
import { fetchTournamentPayouts, type TournamentPayout } from "@/lib/services/tournament-payout-service";
import { fetchMostRecentAgentDevice, type AgentDeviceStatus } from "@/lib/services/agent-status-service";
import { getUsdBrlRate } from "@/lib/services/fx-service";
import { AppShell } from "@/components/app-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Modal } from "@/components/ui/modal";
import { MinhasMetasModalBody } from "@/components/goals/minhas-metas-modal";
import {
  fetchSessions,
  fetchSettings,
  addSession as apiAddSession,
  updateSession as apiUpdateSession,
  deleteSession as apiDeleteSession,
  fetchTransactions,
  addTransaction as apiAddTransaction,
  deleteTransaction as apiDeleteTransaction,
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

// Faixas de buy-in pro filtro de "Sessoes recentes" -- mesmos cortes do
// filtro de buy-in do Player Evolution (types/analysis.ts BuyinBucket),
// só que local aqui porque cobre todo tipo de sessão (cash e torneio),
// não só torneio.
const BUYIN_RANGES: { value: string; label: string; test: (v: number) => boolean }[] = [
  { value: "all", label: "Qualquer buy-in", test: () => true },
  { value: "0-10", label: "Até R$10", test: (v) => v > 0 && v <= 10 },
  { value: "10-50", label: "R$10–50", test: (v) => v > 10 && v <= 50 },
  { value: "50-200", label: "R$50–200", test: (v) => v > 50 && v <= 200 },
  { value: "200+", label: "R$200+", test: (v) => v > 200 },
];

// "Há X min/h/d" pro card de status do agente — só isso, sem lib externa.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

// Vocabulario do formulario por formato: "reentradas" e' termo de torneio;
// em cash o jogador recompra/recarrega o stack. Mesmo campo, o nome que ele
// usa de verdade em cada formato.
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

  // Filtros de "Sessoes recentes" -- sempre visiveis no cabecalho do
  // Painel, sem precisar abrir um historico separado pra filtrar.
  const [historyFormat, setHistoryFormat] = useState<string>("all");
  const [historyRange, setHistoryRange] = useState<RangeOption>("all");
  const [historyBuyin, setHistoryBuyin] = useState<string>("all");
  const [historyImported, setHistoryImported] = useState<"all" | "yes" | "no">("all");

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

  // Torneios que o agente desktop já capturou (buy-in/premiação sempre em
  // USD — o parser só extrai esses números quando a mão diz "USD" no
  // cabeçalho) e que ainda não viraram sessão de banca -- ver
  // pendingAgentTournaments/importAgentTournaments mais abaixo.
  const [agentTournaments, setAgentTournaments] = useState<HandSession[]>([]);
  const [agentPayouts, setAgentPayouts] = useState<TournamentPayout[]>([]);
  const [importingAgent, setImportingAgent] = useState(false);
  const [agentDevice, setAgentDevice] = useState<AgentDeviceStatus | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, cfg, tx, brm, annos, agentTourn, payouts] = await Promise.all([
          fetchSessions(),
          fetchSettings(),
          fetchTransactions(),
          fetchBrmThresholds(),
          fetchAnnotations(),
          fetchTournamentSessions(),
          fetchTournamentPayouts(),
        ]);
        if (!alive) return;
        setSessions(s);
        setBankroll(cfg.bankroll);
        setTransactions(tx);
        setBrmThresholds(brm);
        setAnnotations(annos);
        setAgentTournaments(agentTourn);
        setAgentPayouts(payouts);
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

  // Independente do carregamento principal — status do PokerSync Agent é
  // só um complemento informativo, não pode derrubar a tela inteira se a
  // consulta falhar.
  useEffect(() => {
    fetchMostRecentAgentDevice()
      .then(setAgentDevice)
      .catch(() => setAgentDevice(null));
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

  // Taxas de câmbio pra consolidar as moedas numa visão só -- não puxamos
  // cotação de nenhuma API (o produto não tem uma fonte confiável hoje),
  // então o jogador digita manualmente quanto vale 1 unidade de cada moeda
  // em BRL. Guardado só no navegador (localStorage): é uma conveniência de
  // visualização, não um dado financeiro registrado no servidor.
  const REFERENCE_CURRENCY = currencies.includes("BRL") ? "BRL" : currencies[0] ?? "BRL";
  const [fxRates, setFxRates] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("pokersync:banca:fxRates");
      if (raw) setFxRates(JSON.parse(raw));
    } catch {
      // localStorage indisponível (modo privado, etc.) -- consolidado cai
      // pra taxa 1:1 e o jogador ainda pode digitar, só não persiste.
    }
  }, []);
  function updateFxRate(currency: string, rate: string) {
    setFxRates((prev) => {
      const next = { ...prev, [currency]: rate };
      try {
        window.localStorage.setItem("pokersync:banca:fxRates", JSON.stringify(next));
      } catch {
        // idem — falha ao persistir não deve travar a edição.
      }
      return next;
    });
  }
  function fxRateOf(currency: string): number {
    if (currency === REFERENCE_CURRENCY) return 1;
    const v = Number(fxRates[currency]);
    return v > 0 ? v : 1;
  }
  const fmt = (v: number) => fmtMoneyIn(v, currencyFilter);

  // Torneios do agente ainda sem sessão de banca -- buy-in/premiação vêm
  // sempre em USD (ver comentário na declaração de agentTournaments), então
  // a importação busca sozinha a cotação USD→BRL do dia (API pública, sem
  // chave) antes de gravar — sem isso a gente estaria tratando US$ 1 como
  // R$ 1 na banca, o bug que gerou esse pedido. Cacheado 12h no navegador
  // pra não bater na API a cada carregamento de página.
  const pendingAgentTournaments = useMemo(
    () => agentTournaments.filter((h) => !sessions.some((s) => s.importedHandSessionId === h.id)),
    [agentTournaments, sessions]
  );
  const [usdRateError, setUsdRateError] = useState(false);

  async function importAgentTournaments(rate: number) {
    if (pendingAgentTournaments.length === 0 || rate <= 0) return;
    setImportingAgent(true);
    const imported: Session[] = [];
    for (const hs of pendingAgentTournaments) {
      try {
        const payout = agentPayouts.find((p) => p.tournamentIdPs === hs.tournament_id_ps);
        const buyInUsd = hs.buyin ?? 0;
        const cashoutUsd = payout?.heroPayoutAmount ?? 0;
        const rawVenue = (hs.label.split(" / ")[0] || "").trim();
        const saved = await apiAddSession({
          date: (hs.updated_at || hs.created_at || todayISO()).slice(0, 10),
          format: "MTT",
          buyIn: +(buyInUsd * rate).toFixed(2),
          reentries: 0,
          cashout: +(cashoutUsd * rate).toFixed(2),
          stake: "",
          venue: rawVenue || undefined,
          currency: "BRL",
          notes: `Importado do agente — ${hs.label} (US$ ${buyInUsd.toFixed(2)} × ${rate.toFixed(2)})`,
          importedHandSessionId: hs.id,
        });
        await linkHandSessionReviews(hs.id, saved.id);
        imported.push(saved);
      } catch (e) {
        console.error("Falha ao importar torneio do agente:", hs.id, e);
      }
    }
    if (imported.length > 0) setSessions((prev) => [...prev, ...imported]);
    setImportingAgent(false);
  }

  // Assim que existe torneio pendente, busca a cotação e importa sozinho —
  // nenhum passo manual do jogador.
  useEffect(() => {
    if (loading || pendingAgentTournaments.length === 0 || importingAgent) return;
    let alive = true;
    (async () => {
      const rate = await getUsdBrlRate();
      if (!alive) return;
      if (rate) {
        setUsdRateError(false);
        importAgentTournaments(rate);
      } else {
        setUsdRateError(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingAgentTournaments.length]);
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

  // Saldo por moeda, pra consolidar tudo numa visão só (ver fxRates acima) —
  // independe do currencyFilter selecionado, cada moeda entra com seu
  // próprio saldo (banca inicial só soma na moeda de referência, mesma
  // regra do `nw` abaixo).
  const perCurrencyBalances = useMemo(
    () =>
      currencies.map((c) => {
        const sess = sessions.filter((s) => (s.currency || "BRL") === c);
        const tx = transactions.filter((t) => (t.currency || "BRL") === c);
        const a = aggregate(sess);
        const balance = netWorth(c === REFERENCE_CURRENCY ? base : 0, a.profit, tx).playingBankroll;
        return { currency: c, balance };
      }),
    [currencies, sessions, transactions, base, REFERENCE_CURRENCY]
  );
  const consolidatedTotal = useMemo(
    () => perCurrencyBalances.reduce((sum, p) => sum + p.balance * fxRateOf(p.currency), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perCurrencyBalances, fxRates]
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
  // Resumo por ano -- respeita a moeda selecionada (misturar moedas na
  // mesma linha do relatório daria um total sem sentido), mas ignora o
  // filtro de plataforma (é uma visão de ano fechado, não de uma sala só).
  const yearlyReport = useMemo(() => {
    const byYear = new Map<string, Session[]>();
    for (const s of currencySessions) {
      const year = (s.date || "").slice(0, 4);
      if (!year) continue;
      const list = byYear.get(year) ?? [];
      list.push(s);
      byYear.set(year, list);
    }
    return [...byYear.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, list]) => ({ year, ...aggregate(list) }));
  }, [currencySessions]);

  const recentTx = [...platformTransactions].reverse();
  // O catalogo (FORMATS) e o que esta gravado nas sessoes nem sempre batem --
  // ha sessoes com formato "Torneio", que nao esta no seletor. Filtrar so'
  // pelo catalogo esconderia essas sessoes sem o jogador entender por que.
  const historyFormats = useMemo(
    () => Array.from(new Set([...FORMATS, ...platformSessions.map((s) => s.format)])).filter(Boolean),
    [platformSessions]
  );

  // "Sessoes recentes" mostra sempre a lista inteira (filtrada), com scroll
  // interno pra ver mais alem das ~3 primeiras -- nao tem mais um estado
  // "aberto/fechado" separado, os filtros (formato/periodo/buy-in) ficam
  // sempre visiveis no cabecalho do Painel.
  const historyFiltered = useMemo(() => {
    let base = platformSessions;
    if (historyFormat !== "all") base = base.filter((s) => s.format === historyFormat);
    if (historyRange !== "all") base = filterSessionsByRange(base, historyRange);
    if (historyBuyin !== "all") {
      const bucket = BUYIN_RANGES.find((r) => r.value === historyBuyin);
      if (bucket) base = base.filter((s) => bucket.test(Number(s.buyIn) || 0));
    }
    if (historyImported !== "all") {
      base = base.filter((s) => (historyImported === "yes" ? Boolean(s.importedHandSessionId) : !s.importedHandSessionId));
    }
    return [...base].reverse();
  }, [platformSessions, historyFormat, historyRange, historyBuyin, historyImported]);
  // Quantas maos foram revisadas por sessao -- antes o vinculo so existia
  // no sentido revisor->banca (session_id gravado na mao), a banca nunca
  // mostrava nada de volta. So busca pras sessoes realmente visiveis na
  // lista (nao a banca toda).
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});
  const visibleSessionIds = historyFiltered.map((s) => s.id).join(",");
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

  // Excluir sessao da banca NUNCA apaga o torneio/maos correspondente no
  // Revisor (pedido explicito): sao dois sistemas com fontes de verdade
  // diferentes -- Banca trata o resultado liquido (buyIn/cashout), Revisor
  // e' o historico de maos jogadas, que continua existindo mesmo que o
  // jogador tire aquele torneio da contabilidade da banca. So' apaga a
  // linha de bankroll_sessions; hand_sessions (e suas maos) fica intacta,
  // so perde o vinculo (FK SET NULL) -- reaparece como orfa se algum dia
  // for reimportada.
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

  function handleExportYearlyReport() {
    const header = ["Ano", "Sessões", "Total investido", "Total devolvido", "Lucro", "ROI %", "Buy-in médio", "ITM %"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = yearlyReport.map((y) => [
      y.year,
      y.n,
      y.totalInvested.toFixed(2),
      y.totalCashout.toFixed(2),
      y.profit.toFixed(2),
      y.roi.toFixed(1),
      y.avgBuyIn.toFixed(2),
      y.itm.toFixed(1),
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    downloadCSV(`pokersync-resumo-anual-${currencyFilter}-${todayISO()}.csv`, csv);
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
          <HeroMetric label="Buy-in médio" value={fmt(agg.avgBuyIn)} tone="neutro" hint="Média do valor de entrada das suas sessões." />
          <HeroMetric
            label="ITM"
            value={`${agg.itm.toFixed(1)}%`}
            tone="neutro"
            hint="Em quantos torneios você ficou premiado (in the money)."
          />
        </div>
      </section>

      {pendingAgentTournaments.length > 0 && usdRateError && (
        <div className="mt-6 rounded-xl border border-negative/30 bg-negative/[0.06] p-4">
          <p className="text-sm font-semibold text-ink">
            Não consegui buscar a cotação do dólar agora pra importar {pendingAgentTournaments.length} torneio
            {pendingAgentTournaments.length === 1 ? "" : "s"} do agente
          </p>
          <p className="mt-1 text-xs text-muted">
            A conversão USD→BRL é automática — deve funcionar sozinha na próxima vez que você abrir essa tela.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel
          titulo="Evolução da banca"
          icone={<LineChart size={14} className="icon-glow text-evolution" />}
          hint="Seu saldo acumulado ao longo do tempo, somando o resultado de cada sessão."
          className="flex h-full min-h-[380px] flex-col"
          acao={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPopover label="Filtrar por plataforma" active={isPlatformFiltered}>
                <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1">
                  <Landmark size={12} className="shrink-0 text-muted" />
                  <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    title="Filtrar por plataforma"
                    className="w-full bg-transparent text-[11px] font-semibold text-ink outline-none"
                  >
                    <option value="todas">Todas as plataformas</option>
                    {platformNames.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>
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
          icone={<CalendarDays size={14} className="icon-glow text-evolution" />}
          hint="Mostra em quais dias você mais jogou — quanto mais escuro, mais sessões naquele dia."
          className="flex h-full min-h-[380px] flex-col"
        >
          <div className="flex flex-1 items-center">
            <VolumeHeatmap activity={activity} currency={currencyFilter} />
          </div>
        </Painel>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Painel
          titulo="Risco"
          icone={<ShieldAlert size={14} className="icon-glow text-negative" />}
          hint="Sinais de alerta pra sua banca: quanto você já perdeu do topo e se o stake atual ainda cabe no seu bankroll."
          className="flex h-[260px] flex-col"
        >
          <div className="flex h-full flex-col justify-center">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className="rounded-lg border border-hairline bg-elevated p-4"
              title="Quanto sua banca já caiu desde o ponto mais alto, medido em buy-ins do seu stake médio."
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Drawdown atual</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${currentDrawdown >= 15 ? "text-negative" : "text-ink"}`}>
                {currentDrawdown > 0 ? `${currentDrawdown.toFixed(1)} BI` : "—"}
              </p>
              <p className="mt-1.5 text-[10.5px] text-muted">Queda desde o topo, em buy-ins</p>
            </div>

            <div
              className="rounded-lg border border-hairline bg-elevated p-4"
              title={
                ruin
                  ? `De ${ruin.simulations} simulações usando suas ${ruin.sampleSize} sessões reais, essa % zerou a banca antes de completar ${ruin.horizonSessions} sessões.`
                  : `Precisa de pelo menos ${15} sessões registradas pra calcular.`
              }
            >
              <div className="flex items-center gap-1.5">
                <Skull size={12} className="text-negative" />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Risco de ruína</p>
              </div>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${ruin && ruin.ruinPct >= 20 ? "text-negative" : ruin && ruin.ruinPct >= 8 ? "text-evolution" : "text-ink"}`}>
                {ruin ? `${ruin.ruinPct}%` : "—"}
              </p>
              <p className="mt-1.5 text-[10.5px] text-muted">
                {ruin ? `Chance de zerar em ${ruin.horizonSessions} sessões` : "Registre mais sessões pra calcular"}
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

            <button
              onClick={() => setGoalsModalOpen(true)}
              className="rounded-lg border border-hairline bg-elevated p-4 text-left transition-colors hover:border-training/40"
              title="Ver e criar metas"
            >
              <div className="flex items-center gap-1.5">
                <Target size={12} className="text-training" />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Metas</p>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">Volume, estudo e prazo de conclusão.</p>
            </button>
          </div>

          {tiltStats && tiltStats.tiltN > 0 && (
            <div className="mt-5 border-t border-hairline pt-4">
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

        <Painel
          titulo="AI Coach"
          icone={<Sparkles size={14} className="icon-glow text-evolution" />}
          hint="Dicas automáticas geradas a partir das suas sessões — leaks, tendências e alertas."
          className="flex h-[260px] flex-col"
          acao={
            tipsVisiveis.length > 0 ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{tipsVisiveis.length}</span>
            ) : undefined
          }
        >
          <div className="grid gap-3">
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
        </Painel>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Painel
          titulo={`Sessões recentes (${historyFiltered.length})`}
          icone={<History size={14} className="icon-glow text-training" />}
          hint="Suas últimas sessões registradas. Use os filtros pra achar um período ou faixa de buy-in específica."
          divisor
          className="flex h-[260px] flex-col"
          acao={
            <FilterPopover
              label="Filtrar sessões"
              active={historyFormat !== "all" || historyRange !== "all" || historyBuyin !== "all" || historyImported !== "all"}
            >
              <select
                value={historyFormat}
                onChange={(e) => setHistoryFormat(e.target.value)}
                aria-label="Filtrar por formato"
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
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
                title="Filtrar por período"
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
              >
                {HISTORY_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={historyBuyin}
                onChange={(e) => setHistoryBuyin(e.target.value)}
                aria-label="Filtrar por buy-in"
                title="Filtrar por faixa de buy-in"
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
              >
                {BUYIN_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                value={historyImported}
                onChange={(e) => setHistoryImported(e.target.value as "all" | "yes" | "no")}
                aria-label="Filtrar por origem"
                title="Filtrar por origem: importada do agente ou lançada à mão"
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[11px] text-ink outline-none transition-colors focus:border-ink/40"
              >
                <option value="all">Importadas e manuais</option>
                <option value="yes">Só importadas</option>
                <option value="no">Só manuais</option>
              </select>
            </FilterPopover>
          }
        >
          {historyFiltered.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma sessao encontrada com esses filtros.</p>
          ) : (
            <div className="mt-4 divide-y divide-hairline">
              {historyFiltered.map((s) => {
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
                          {s.importedHandSessionId && (
                            <span
                              title="Importada automaticamente de um torneio que o agente desktop já tinha capturado"
                              className="shrink-0 rounded border border-evolution/30 bg-evolution/[0.12] px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-evolution"
                            >
                              Importada
                            </span>
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

        <Painel
          titulo="Histórico de transações"
          icone={<Wallet size={14} className="icon-glow text-training" />}
          hint="Depósitos, saques e caixinha — não entra no resultado de jogo, só o dinheiro que entrou/saiu da banca."
          divisor
          className="flex h-[260px] flex-col"
        >
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

        <Painel
          titulo="Resumo anual"
          icone={<FileBarChart size={14} className="icon-glow text-training" />}
          hint="Fechamento de cada ano — útil pra imposto de renda ou pra ver a evolução ano a ano, sem precisar somar sessão por sessão."
          className="flex h-[260px] flex-col"
          divisor
          acao={
            yearlyReport.length > 0 && (
              <button
                onClick={handleExportYearlyReport}
                title="Baixar o resumo anual em CSV"
                className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-positive/50 hover:text-positive"
              >
                <Download size={13} /> Baixar CSV
              </button>
            )
          }
        >
          {yearlyReport.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Registre sessões pra ver o fechamento por ano.</p>
          ) : (
            <div className="mt-4">
              <table className="w-full table-fixed text-[11px]">
                <thead>
                  <tr className="border-b border-hairline text-left text-[9px] font-bold uppercase tracking-[0.06em] text-muted/80">
                    <th className="py-1.5 pr-1.5">Ano</th>
                    <th className="px-1.5 py-1.5">Sessões</th>
                    <th className="px-1.5 py-1.5">Investido</th>
                    <th className="px-1.5 py-1.5">Lucro</th>
                    <th className="px-1.5 py-1.5">ROI</th>
                    <th className="px-1.5 py-1.5">ITM</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyReport.map((y, i) => (
                    <tr key={y.year} className={i < yearlyReport.length - 1 ? "border-b border-hairline" : ""}>
                      <td className="truncate py-2 pr-1.5 font-semibold">{y.year}</td>
                      <td className="truncate px-1.5 py-2 tabular-nums text-muted">{y.n}</td>
                      <td className="truncate px-1.5 py-2 tabular-nums text-muted">{fmtMoneyIn(y.totalInvested, currencyFilter)}</td>
                      <td className={`truncate px-1.5 py-2 font-semibold tabular-nums ${y.profit >= 0 ? "text-positive" : "text-negative"}`}>
                        {fmtSignedMoneyIn(y.profit, currencyFilter)}
                      </td>
                      <td className="truncate px-1.5 py-2 tabular-nums text-muted">{fmtPct(y.roi)}</td>
                      <td className="truncate px-1.5 py-2 tabular-nums text-muted">{y.itm.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>

      <div className="mt-6">
        <Painel
          titulo="Importação automática"
          icone={<Bot size={14} className="icon-glow text-training" />}
          hint="Mãos e torneios chegam sozinhos aqui pelo PokerSync Agent, rodando no seu computador — sem precisar colar hand history nem clicar em importar."
          divisor
          className="flex h-[140px] flex-col"
        >
          {agentDevice ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-positive/15 text-positive">
                  <Bot size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{agentDevice.deviceName}</p>
                  <p className="text-[11.5px] text-muted">Última sincronização {timeAgo(agentDevice.lastSyncAt)}</p>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2">
                <div className="rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted/80">Mãos</p>
                  <p className="text-[11px] font-semibold text-positive">Automático</p>
                </div>
                <div className="rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted/80">Torneios</p>
                  <p className="text-[11px] font-semibold text-positive">Automático</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink">Nenhum agente sincronizando ainda.</p>
              <p className="mt-1 text-[11.5px] text-muted">
                Instale o PokerSync Agent no seu computador pra importar mãos e torneios automaticamente — hoje o
                único jeito de trazer dados pra cá sem ele é colar hand history na mão em{" "}
                <Link href="/performance" className="text-training hover:underline">
                  Player Evolution → Importar
                </Link>
                .
              </p>
            </div>
          )}
        </Painel>
      </div>

      {isMultiCurrency && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Painel
            titulo="Patrimônio consolidado"
            icone={<Coins size={14} className="icon-glow text-evolution" />}
            hint="Soma o saldo de todas as moedas numa visão só, usando a taxa de câmbio que você digitar abaixo — é uma estimativa sua, não uma cotação ao vivo."
            className="flex h-[260px] flex-col"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {perCurrencyBalances.map((p) => (
                <div key={p.currency} className="rounded-lg border border-hairline bg-elevated p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{p.currency}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-ink">{fmtMoneyIn(p.balance, p.currency)}</p>
                  {p.currency === REFERENCE_CURRENCY ? (
                    <p className="mt-1.5 text-[10.5px] text-muted">Moeda de referência</p>
                  ) : (
                    <label className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted">
                      1 {p.currency} =
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fxRates[p.currency] ?? ""}
                        onChange={(e) => updateFxRate(p.currency, e.target.value)}
                        placeholder="1.00"
                        className="w-16 rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10.5px] text-ink outline-none focus:border-ink/40"
                      />
                      {REFERENCE_CURRENCY}
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Total consolidado (estimado)</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${consolidatedTotal < 0 ? "text-negative" : "text-ink"}`}>
                {fmtMoneyIn(consolidatedTotal, REFERENCE_CURRENCY)}
              </p>
            </div>
          </Painel>
        </div>
      )}

      <Modal open={goalsModalOpen} onClose={() => setGoalsModalOpen(false)} title="Minhas Metas" wide>
        <MinhasMetasModalBody />
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
          <div className="flex gap-2">
            <input
              placeholder="Stake"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              title="Moeda da sessao"
              className="w-[92px] shrink-0 rounded-lg border border-hairline bg-elevated px-2 py-2.5 text-xs text-muted outline-none transition-colors focus:border-ink/40"
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
          <div className="flex gap-2">
            <input
              placeholder="Valor"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm outline-none transition-colors focus:border-ink/40"
            />
            <select
              value={txCurrency}
              onChange={(e) => setTxCurrency(e.target.value)}
              title="Moeda"
              className="w-[92px] shrink-0 rounded-lg border border-hairline bg-elevated px-2 py-2.5 text-xs text-muted outline-none transition-colors focus:border-ink/40"
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
  hint,
  className,
  children,
  divisor,
}: {
  titulo: string;
  icone: React.ReactNode;
  acao?: React.ReactNode;
  // Explicação simples em texto puro — aparece ao passar o mouse no
  // título (mesmo mecanismo do `hint` do Player Evolution: title nativo
  // do navegador, sem componente novo), pra quem não conhece o termo.
  hint?: string;
  className?: string;
  children: React.ReactNode;
  // Linha fina sob o cabeçalho, mesmo estilo do separador da tabela de
  // Resumo Anual — usado nos cards de histórico/resumo, que sem ela
  // pareciam blocos soltos sem conexão visual com o título.
  divisor?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-hairline bg-surface p-5 ${className ?? ""}`}>
      <div className={`mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 ${divisor ? "border-b border-hairline pb-3" : ""}`}>
        <div className="flex items-center gap-1.5">
          {icone}
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
          {hint && (
            <span title={hint} className="text-muted/60 hover:text-muted">
              <Info size={11} />
            </span>
          )}
        </div>
        {acao}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
  // Marcas do eixo em números redondos (ex: R$500, não R$417,24) -- o
  // yMin/yMax do plot se ajusta pra sempre caber a primeira/última marca.
  const yTicks = niceTicks(min, max, Y_TICKS);
  const yMin = Math.min(min - spread * 0.08, yTicks[0]);
  const yMax = Math.max(max + spread * 0.08, yTicks[yTicks.length - 1]);
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

  const xTickCount = Math.min(6, series.length);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (series.length - 1))
  );

  // Marca sutil (bolinha roxa) em cima da própria curva, na data em que o
  // jogador anotou algo -- antes era uma linha tracejada vertical inteira +
  // bolinha solta no topo, chamativo demais pra uma nota opcional.
  const plottedAnnotations = annotations
    .map((a) => {
      // Antes so' plotava com data identica a uma sessao — se o dia
      // anotado nao tinha sessao registrada (comum: anotacao feita num
      // dia sem jogo), a nota sumia do grafico sem aviso. Agora cai no
      // ponto da curva com a data mais proxima, sempre visivel.
      let idx = series.findIndex((p) => p.date === a.date);
      if (idx === -1) {
        const target = new Date(a.date).getTime();
        let bestDiff = Infinity;
        series.forEach((p, i) => {
          const diff = Math.abs(new Date(p.date).getTime() - target);
          if (diff < bestDiff) {
            bestDiff = diff;
            idx = i;
          }
        });
      }
      return idx === -1 ? null : { ...a, x: xAt(idx), y: yAt(points[idx]) };
    })
    .filter((a): a is Annotation & { x: number; y: number } => a !== null);

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

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={color} filter={`url(#${glowId})`} opacity={0.9}>
        <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.45;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="#fff" />

      {plottedAnnotations.map((a) => (
        <circle key={a.id} cx={a.x} cy={a.y} r={3} fill="var(--color-review)" stroke="var(--color-surface)" strokeWidth={1.5} opacity={0.85}>
          <title>{`${a.date} · ${a.note}`}</title>
        </circle>
      ))}

      {hoverPoint && hoverData && (
        <g pointerEvents="none">
          <line x1={hoverPoint.x} y1={padT} x2={hoverPoint.x} y2={padT + plotH} stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
          <g transform={`translate(${Math.min(Math.max(hoverPoint.x - 58, padL), w - padR - 124)}, ${Math.max(hoverPoint.y - 54, padT)})`}>
            <rect width={124} height={46} rx={6} fill="var(--color-elevated)" stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={9} y={16} fontSize={9} fill="var(--color-muted)">
              {hoverData.date}
            </text>
            <text x={9} y={30} fontSize={11} fontWeight={700} fill="var(--color-ink)">
              {fmt(hoverData.value)}
            </text>
            <text x={9} y={41} fontSize={9.5} fontWeight={600} fill={hoverData.net >= 0 ? "#22c55e" : "#e0555a"}>
              {hoverData.net >= 0 ? "+" : ""}
              {fmt(hoverData.net)}
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
      <div className="flex justify-center gap-[8px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[8px]">
            {week.map(({ date, d }) => {
              const a = activity[date];
              const future = d > today;
              return (
                <div
                  key={date}
                  onMouseEnter={() => !future && setHoverKey(date)}
                  onMouseLeave={() => setHoverKey((k) => (k === date ? null : k))}
                  className="size-[32px] rounded-[6px] transition-transform duration-100 hover:scale-110"
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
