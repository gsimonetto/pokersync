"use client";

import { useEffect, useMemo, useState } from "react";
import type { Annotation, BrmFormat, BrmThreshold, Session, Transaction } from "@/lib/bankroll/types";
import {
  aggregate,
  bbHourlyRate,
  brmReading,
  compareMonths,
  currenciesInUse,
  dailyActivity,
  drawdownSeries,
  evolutionSeries,
  groupStats,
  hourlyRate,
  net,
  netWorth,
  platformBalances,
  riskOfRuin,
  tiltImpact,
} from "@/lib/bankroll/calc";
import { saldosPorMoeda } from "@/lib/bankroll/consolidado";
import { todayISO } from "@/lib/bankroll/format";
import { useTaxasCambio } from "@/lib/hooks/use-taxas-cambio";
import { linkHandSessionReviews } from "@/lib/services/hand-review-service";
import { excludeSessionFromBankroll, type HandSession } from "@/lib/services/hand-session-service";
import { fetchTournamentSessions } from "@/lib/services/analysis-service";
import { fetchTournamentPayouts, type TournamentPayout } from "@/lib/services/tournament-payout-service";
import { fetchMostRecentAgentDevice, type AgentDeviceStatus } from "@/lib/services/agent-status-service";
import { getUsdBrlRate } from "@/lib/services/fx-service";
import { fetchRadarModuleScope } from "@/lib/services/radar-module-scope-service";
import {
  addAnnotation as apiAddAnnotation,
  addSession as apiAddSession,
  addTransaction as apiAddTransaction,
  deleteAnnotation as apiDeleteAnnotation,
  deleteSession as apiDeleteSession,
  deleteTransaction as apiDeleteTransaction,
  fetchAnnotations,
  fetchBrmThresholds,
  fetchSessions,
  fetchSettings,
  fetchTransactions,
  notifyBrmAlert,
  resetBancaRadarImports,
  saveBrmThreshold as apiSaveBrmThreshold,
  updateSession as apiUpdateSession,
} from "@/lib/services/bankroll-service";

// Dados e contas da Gestão de Banca num lugar só -- as 5 abas só leem
// daqui. As regras são as mesmas da tela antiga (app/banca/page.tsx antes
// do redesenho): corte do Radar, uma moeda por vez (nunca soma R$ com
// US$), filtro de plataforma e importação automática dos torneios do
// agente desktop.

export const SEM_PLATAFORMA = "Sem plataforma";
const plataformaDe = (v?: string) => v?.trim() || SEM_PLATAFORMA;
const moedaDe = (m?: string) => m || "BRL";

/** Ponto da curva de saldo: sessão OU movimentação de dinheiro. */
export interface PontoSaldo {
  date: string;
  valor: number;
  variacao: number;
  tipo: "inicio" | "sessao" | "deposito" | "saque" | "caixinha";
  rotulo: string;
}

export function useBanca() {
  const [todasSessoes, setSessoes] = useState<Session[]>([]);
  const [transacoes, setTransacoes] = useState<Transaction[]>([]);
  const [limites, setLimites] = useState<BrmThreshold[]>([]);
  const [anotacoes, setAnotacoes] = useState<Annotation[]>([]);
  const [base, setBase] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [moeda, setMoeda] = useState("BRL");
  const [plataforma, setPlataforma] = useState("todas");

  const [torneiosAgente, setTorneiosAgente] = useState<HandSession[]>([]);
  const [premiosAgente, setPremiosAgente] = useState<TournamentPayout[]>([]);
  const [importando, setImportando] = useState(false);
  const [erroCotacao, setErroCotacao] = useState(false);
  const [agente, setAgente] = useState<AgentDeviceStatus | null>(null);
  // Corte do botão do Radar: esconde sessões IMPORTADAS jogadas antes
  // dele. Sessão lançada à mão nunca some.
  const [corteRadar, setCorteRadar] = useState<string | null>(null);

  const cambio = useTaxasCambio();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [s, cfg, tx, brm, annos, tourn, payouts] = await Promise.all([
          fetchSessions(),
          fetchSettings(),
          fetchTransactions(),
          fetchBrmThresholds(),
          fetchAnnotations(),
          fetchTournamentSessions(),
          fetchTournamentPayouts(),
        ]);
        if (!vivo) return;
        setSessoes(s);
        setBase(Number(cfg.bankroll) || 0);
        setTransacoes(tx);
        setLimites(brm);
        setAnotacoes(annos);
        setTorneiosAgente(tourn);
        setPremiosAgente(payouts);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Falha ao carregar sua banca.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Status do Radar é complemento: se falhar, a tela segue normal.
  useEffect(() => {
    fetchMostRecentAgentDevice()
      .then(setAgente)
      .catch(() => setAgente(null));
    fetchRadarModuleScope("banca")
      .then((s) => setCorteRadar(s.scope === "from_now" ? s.since : null))
      .catch(() => {});
  }, []);

  const sessoes = useMemo(() => {
    if (!corteRadar) return todasSessoes;
    const corte = corteRadar.slice(0, 10);
    return todasSessoes.filter((s) => !s.importedHandSessionId || s.date >= corte);
  }, [todasSessoes, corteRadar]);

  // ---- Importação automática dos torneios do agente (sempre em USD) ----
  const pendentesAgente = useMemo(
    () => torneiosAgente.filter((h) => !h.bankroll_excluded && !todasSessoes.some((s) => s.importedHandSessionId === h.id)),
    [torneiosAgente, todasSessoes],
  );

  async function importarTorneios(taxa: number) {
    if (pendentesAgente.length === 0 || taxa <= 0) return;
    setImportando(true);
    const novas: Session[] = [];
    for (const hs of pendentesAgente) {
      try {
        const premio = premiosAgente.find((p) => p.tournamentIdPs === hs.tournament_id_ps);
        const buyInUsd = hs.buyin ?? 0;
        const cashoutUsd = premio?.heroPayoutAmount ?? 0;
        const sala = (hs.label.split(" / ")[0] || "").trim();
        const salva = await apiAddSession({
          date: (hs.updated_at || hs.created_at || todayISO()).slice(0, 10),
          format: "MTT",
          buyIn: +(buyInUsd * taxa).toFixed(2),
          reentries: 0,
          cashout: +(cashoutUsd * taxa).toFixed(2),
          stake: "",
          venue: sala || undefined,
          currency: "BRL",
          notes: `Importado do agente — ${hs.label} (US$ ${buyInUsd.toFixed(2)} × ${taxa.toFixed(2)})`,
          importedHandSessionId: hs.id,
        });
        await linkHandSessionReviews(hs.id, salva.id);
        novas.push(salva);
      } catch (e) {
        console.error("Falha ao importar torneio do agente:", hs.id, e);
      }
    }
    if (novas.length > 0) setSessoes((prev) => [...prev, ...novas]);
    setImportando(false);
  }

  useEffect(() => {
    if (carregando || pendentesAgente.length === 0 || importando) return;
    let vivo = true;
    (async () => {
      const taxa = await getUsdBrlRate();
      if (!vivo) return;
      if (taxa) {
        setErroCotacao(false);
        importarTorneios(taxa);
      } else {
        setErroCotacao(true);
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, pendentesAgente.length]);

  // ---- Moeda: uma por vez, nunca presa numa moeda que sumiu ----
  const moedas = useMemo(() => currenciesInUse(sessoes, transacoes), [sessoes, transacoes]);
  const multiMoeda = moedas.length > 1;
  useEffect(() => {
    if (moedas.length > 0 && !moedas.includes(moeda)) setMoeda(moedas[0]);
  }, [moedas, moeda]);

  const sessoesMoeda = useMemo(
    () => (multiMoeda ? sessoes.filter((s) => moedaDe(s.currency) === moeda) : sessoes),
    [sessoes, moeda, multiMoeda],
  );
  const transacoesMoeda = useMemo(
    () => (multiMoeda ? transacoes.filter((t) => moedaDe(t.currency) === moeda) : transacoes),
    [transacoes, moeda, multiMoeda],
  );

  // ---- Plataforma: só as que têm dado de verdade ----
  const plataformas = useMemo(() => platformBalances(sessoesMoeda, transacoesMoeda), [sessoesMoeda, transacoesMoeda]);
  const nomesPlataformas = useMemo(() => plataformas.map((p) => p.platform), [plataformas]);
  useEffect(() => {
    if (plataforma !== "todas" && !nomesPlataformas.includes(plataforma)) setPlataforma("todas");
  }, [nomesPlataformas, plataforma]);
  const filtrandoPlataforma = plataforma !== "todas";
  const sessoesFiltradas = useMemo(
    () => (filtrandoPlataforma ? sessoesMoeda.filter((s) => plataformaDe(s.venue) === plataforma) : sessoesMoeda),
    [sessoesMoeda, plataforma, filtrandoPlataforma],
  );
  const transacoesFiltradas = useMemo(
    () => (filtrandoPlataforma ? transacoesMoeda.filter((t) => plataformaDe(t.venue) === plataforma) : transacoesMoeda),
    [transacoesMoeda, plataforma, filtrandoPlataforma],
  );

  // A banca inicial cadastrada é em reais e não pertence a nenhuma sala:
  // só entra na visão BRL sem filtro de plataforma.
  const baseAplicada = !filtrandoPlataforma && moeda === "BRL" ? base : 0;

  const agg = useMemo(() => aggregate(sessoesFiltradas), [sessoesFiltradas]);
  const patrimonio = useMemo(
    () => netWorth(baseAplicada, agg.profit, transacoesFiltradas),
    [baseAplicada, agg.profit, transacoesFiltradas],
  );
  const bancaAtual = filtrandoPlataforma
    ? plataformas.find((p) => p.platform === plataforma)?.balance ?? 0
    : patrimonio.playingBankroll;

  // Curva do SALDO (não só do resultado de jogo): depósitos e saques
  // também movem a linha, então o último ponto é exatamente a banca
  // atual. Na tela antiga a curva ignorava depósitos e terminava num
  // valor diferente do número grande lá em cima.
  const curvaSaldo = useMemo((): PontoSaldo[] => {
    const eventos: { chave: string; date: string; variacao: number; tipo: PontoSaldo["tipo"]; rotulo: string }[] = [];
    for (const s of sessoesFiltradas) {
      const n = net(s);
      eventos.push({
        chave: `${s.date}T${s.time || "00:00"}`,
        date: s.date,
        variacao: n,
        tipo: "sessao",
        rotulo: [s.format, s.venue].filter(Boolean).join(" · "),
      });
    }
    for (const t of transacoesFiltradas) {
      const v = Number(t.amount) || 0;
      eventos.push({
        chave: `${t.date}T00:00`,
        date: t.date,
        variacao: t.type === "deposito" ? v : -v,
        tipo: t.type,
        rotulo: [t.type === "deposito" ? "Depósito" : t.type === "saque" ? "Saque" : "Caixinha", t.venue].filter(Boolean).join(" · "),
      });
    }
    if (eventos.length === 0) return [];
    eventos.sort((a, b) => a.chave.localeCompare(b.chave));
    let acc = baseAplicada;
    const pontos: PontoSaldo[] = [{ date: eventos[0].date, valor: acc, variacao: 0, tipo: "inicio", rotulo: "Início" }];
    for (const e of eventos) {
      acc += e.variacao;
      pontos.push({ date: e.date, valor: +acc.toFixed(2), variacao: +e.variacao.toFixed(2), tipo: e.tipo, rotulo: e.rotulo });
    }
    return pontos;
  }, [sessoesFiltradas, transacoesFiltradas, baseAplicada]);

  // ---- Risco ----
  const serieJogo = useMemo(() => evolutionSeries(sessoesFiltradas), [sessoesFiltradas]);
  const serieQueda = useMemo(() => drawdownSeries(serieJogo), [serieJogo]);
  const queda = useMemo(() => {
    if (serieJogo.length === 0 || agg.avgBuyIn <= 0) return { atual: 0, maxima: 0, emDinheiro: 0 };
    let pico = 0;
    let maxima = 0;
    for (const p of serieJogo) {
      pico = Math.max(pico, p.value);
      maxima = Math.max(maxima, pico - p.value);
    }
    const ultimo = serieJogo[serieJogo.length - 1].value;
    const atualDinheiro = Math.max(0, pico - ultimo);
    return { atual: atualDinheiro / agg.avgBuyIn, maxima: maxima / agg.avgBuyIn, emDinheiro: atualDinheiro };
  }, [serieJogo, agg.avgBuyIn]);

  const brm = useMemo(() => brmReading(sessoesMoeda, patrimonio.playingBankroll, limites), [sessoesMoeda, patrimonio.playingBankroll, limites]);
  const ruina = useMemo(() => riskOfRuin(sessoesMoeda, patrimonio.playingBankroll), [sessoesMoeda, patrimonio.playingBankroll]);
  const tilt = useMemo(() => tiltImpact(sessoesFiltradas), [sessoesFiltradas]);

  // ---- Ritmo ----
  const porHora = useMemo(() => hourlyRate(sessoesFiltradas), [sessoesFiltradas]);
  const bbPorHora = useMemo(() => bbHourlyRate(sessoesFiltradas), [sessoesFiltradas]);
  const atividade = useMemo(() => dailyActivity(sessoesFiltradas), [sessoesFiltradas]);
  const comparacao = useMemo(() => compareMonths(sessoesFiltradas), [sessoesFiltradas]);
  const variacao30d = useMemo(() => {
    const corte = new Date();
    corte.setDate(corte.getDate() - 30);
    const iso = corte.toISOString().slice(0, 10);
    return aggregate(sessoesFiltradas.filter((s) => s.date >= iso));
  }, [sessoesFiltradas]);

  // ---- Relatórios ----
  const porFormato = useMemo(() => groupStats(sessoesFiltradas, "format"), [sessoesFiltradas]);
  const porDia = useMemo(() => groupStats(sessoesFiltradas, "weekday"), [sessoesFiltradas]);
  const porHorario = useMemo(() => groupStats(sessoesFiltradas, "time"), [sessoesFiltradas]);
  // Fechamento anual: ignora o filtro de plataforma (é o ano fechado).
  const anual = useMemo(() => {
    const porAno = new Map<string, Session[]>();
    for (const s of sessoesMoeda) {
      const ano = (s.date || "").slice(0, 4);
      if (!ano) continue;
      porAno.set(ano, [...(porAno.get(ano) ?? []), s]);
    }
    return [...porAno.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([ano, lista]) => ({ ano, ...aggregate(lista) }));
  }, [sessoesMoeda]);

  // ---- Todas as moedas juntas (aba Dinheiro) ----
  const saldosMoedas = useMemo(() => saldosPorMoeda(sessoes, transacoes, base), [sessoes, transacoes, base]);

  // ---- Alerta de BRM (notificação) ----
  useEffect(() => {
    if (carregando || !brm) return;
    if (brm.status === "moveup") {
      notifyBrmAlert(
        `Banca pronta pra subir em ${brm.format}`,
        `Sua banca cobre ${brm.buyInsCovered} buy-ins — acima do seu limite pra subir (${brm.threshold.moveupBuyins}).`,
      ).catch(() => {});
    } else if (brm.status === "movedown") {
      notifyBrmAlert(
        `Banca abaixo do mínimo em ${brm.format}`,
        `Sua banca cobre só ${brm.buyInsCovered} buy-ins — abaixo do seu limite pra descer (${brm.threshold.movedownBuyins}). Considere descer de stake.`,
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, brm?.status, brm?.format]);

  // ---- Ações (otimistas: a tela muda na hora e volta se falhar) ----
  async function salvarSessao(rascunho: Session, editandoId: string | null): Promise<boolean> {
    const backup = todasSessoes;
    setSessoes((prev) => (editandoId ? prev.map((x) => (x.id === editandoId ? rascunho : x)) : [...prev, rascunho]));
    setErro("");
    try {
      const salva = editandoId ? await apiUpdateSession(editandoId, rascunho) : await apiAddSession(rascunho);
      setSessoes((prev) => prev.map((x) => (x.id === rascunho.id ? salva : x)));
      return true;
    } catch (e) {
      const limite = e instanceof Error && e.message.includes("LIMITE_MENSAL_BANCA");
      setErro(
        limite
          ? "Você atingiu o limite de 10 registros por mês do plano Free. Veja os planos pra continuar registrando."
          : editandoId
            ? "Não foi possível salvar a edição."
            : "Não foi possível salvar a sessão.",
      );
      setSessoes(editandoId ? backup : (prev) => prev.filter((x) => x.id !== rascunho.id));
      return false;
    }
  }

  // Excluir da banca NUNCA apaga o torneio/mãos no Revisor. Sessão
  // importada também marca o torneio como "fora da banca", senão a
  // importação automática trazia ela de volta no próximo carregamento.
  async function removerSessao(id: string) {
    const backup = todasSessoes;
    const removida = todasSessoes.find((x) => x.id === id);
    setSessoes((prev) => prev.filter((x) => x.id !== id));
    const marcar = (excluida: boolean) =>
      removida?.importedHandSessionId &&
      setTorneiosAgente((prev) => prev.map((h) => (h.id === removida.importedHandSessionId ? { ...h, bankroll_excluded: excluida } : h)));
    marcar(true);
    try {
      await apiDeleteSession(id);
    } catch {
      setErro("Não foi possível excluir. Restaurando.");
      setSessoes(backup);
      marcar(false);
      return;
    }
    if (removida?.importedHandSessionId) {
      excludeSessionFromBankroll(removida.importedHandSessionId).catch(() => {
        console.error("Falha ao marcar torneio como excluído da banca:", removida.importedHandSessionId);
      });
    }
  }

  async function adicionarTransacao(rascunho: Transaction): Promise<boolean> {
    setTransacoes((prev) => [...prev, rascunho]);
    setErro("");
    try {
      const salva = await apiAddTransaction(rascunho);
      setTransacoes((prev) => prev.map((x) => (x.id === rascunho.id ? salva : x)));
      return true;
    } catch {
      setErro("Não foi possível salvar a movimentação.");
      setTransacoes((prev) => prev.filter((x) => x.id !== rascunho.id));
      return false;
    }
  }

  async function removerTransacao(id: string) {
    const backup = transacoes;
    setTransacoes((prev) => prev.filter((x) => x.id !== id));
    try {
      await apiDeleteTransaction(id);
    } catch {
      setErro("Não foi possível excluir a movimentação. Restaurando.");
      setTransacoes(backup);
    }
  }

  async function salvarLimite(format: BrmFormat, moveupBuyins: number, movedownBuyins: number) {
    const backup = limites;
    setLimites((prev) =>
      prev.some((t) => t.format === format)
        ? prev.map((t) => (t.format === format ? { format, moveupBuyins, movedownBuyins } : t))
        : [...prev, { format, moveupBuyins, movedownBuyins }],
    );
    try {
      await apiSaveBrmThreshold({ format, moveupBuyins, movedownBuyins });
    } catch {
      setErro("Não foi possível salvar o limite de BRM.");
      setLimites(backup);
    }
  }

  async function adicionarAnotacao(date: string, note: string) {
    if (!note.trim() || !date) return;
    const rascunho: Annotation = { id: `tmp-${Date.now()}`, date, note: note.trim() };
    setAnotacoes((prev) => [...prev, rascunho]);
    try {
      const salva = await apiAddAnnotation(rascunho);
      setAnotacoes((prev) => prev.map((a) => (a.id === rascunho.id ? salva : a)));
    } catch {
      setErro("Não foi possível salvar a anotação.");
      setAnotacoes((prev) => prev.filter((a) => a.id !== rascunho.id));
    }
  }

  async function removerAnotacao(id: string) {
    const backup = anotacoes;
    setAnotacoes((prev) => prev.filter((a) => a.id !== id));
    try {
      await apiDeleteAnnotation(id);
    } catch {
      setErro("Não foi possível remover a anotação. Restaurando.");
      setAnotacoes(backup);
    }
  }

  async function zerarImportacoesRadar() {
    await resetBancaRadarImports();
    setCorteRadar(null);
    setSessoes(await fetchSessions());
  }

  return {
    carregando,
    erro,
    setErro,
    // dados crus
    todasSessoes,
    sessoes,
    transacoes,
    limites,
    anotacoes,
    base,
    // moeda / plataforma
    moeda,
    setMoeda,
    moedas,
    multiMoeda,
    plataforma,
    setPlataforma,
    nomesPlataformas,
    filtrandoPlataforma,
    sessoesMoeda,
    transacoesMoeda,
    sessoesFiltradas,
    transacoesFiltradas,
    // números
    agg,
    patrimonio,
    bancaAtual,
    curvaSaldo,
    serieQueda,
    queda,
    brm,
    ruina,
    tilt,
    porHora,
    bbPorHora,
    atividade,
    comparacao,
    variacao30d,
    porFormato,
    porDia,
    porHorario,
    anual,
    plataformas,
    saldosMoedas,
    cambio,
    // Radar / agente
    agente,
    corteRadar,
    setCorteRadar,
    pendentesAgente,
    erroCotacao,
    importando,
    // ações
    salvarSessao,
    removerSessao,
    adicionarTransacao,
    removerTransacao,
    salvarLimite,
    adicionarAnotacao,
    removerAnotacao,
    zerarImportacoesRadar,
  };
}

export type Banca = ReturnType<typeof useBanca>;
