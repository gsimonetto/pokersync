"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchLast7DaysActivity, fetchProgress, type Progress } from "@/lib/services/xp-service";
import {
  fetchBrmThresholds,
  fetchGoals,
  fetchSessions,
  fetchSettings,
  fetchStudyLogs,
  fetchTransactions,
} from "@/lib/services/bankroll-service";
import { consolidarEmReais, saldosPorMoeda } from "@/lib/bankroll/consolidado";
import { useTaxasCambio } from "@/lib/hooks/use-taxas-cambio";
import type { BrmThreshold, Goal, Session, StudyLog, Transaction } from "@/lib/bankroll/types";
import {
  fetchPlayerInsights,
  fetchPlayerPerformance,
  type PlayerPerformance,
} from "@/lib/services/performance-service";
import { fetchDrillFacets, fetchTodayTrainingCount, suggestionHasDrills } from "@/lib/services/drill-service";
import { fetchAnalysisHandRows } from "@/lib/services/analysis-service";
import type { AnalysisHandRow } from "@/types/analysis";
import { fetchUserLeaksWithDrills, listReviews, type ReviewListItem } from "@/lib/services/hand-review-service";
import {
  fetchTeamBirthdays,
  fetchTeamEvents,
  type TeamBirthday,
  type TeamEvent,
} from "@/lib/services/team-calendar-service";
import {
  fetchMyTeamCached,
  fetchTeamAlerts,
  fetchTeamDashboardCached,
  fetchTeamLeaks,
  type TeamAlert,
  type TeamDashboardRow,
  type TeamLeak,
} from "@/lib/services/team-service";
import {
  fetchFunnelPhases,
  fetchPlayerCards,
  type FunnelPhase,
  type PlayerCard,
} from "@/lib/services/team-funnel-service";
import { fetchLiveTournaments, type LiveStreamChannel } from "@/lib/services/live-stream-service";
import { fetchRadarModuleScope } from "@/lib/services/radar-module-scope-service";

// Carregador ÚNICO de dados do Painel. Antes cada card buscava os
// próprios dados, e vários buscavam os mesmos: sessões 4 vezes, drills de
// hoje 3 vezes, metas/estudo/performance/progresso/revisões 2 vezes cada
// -- umas 11 consultas repetidas a cada abertura da tela. Agora a tela
// busca tudo uma vez só, em paralelo, e os cards só leem daqui.

/** Leak recorrente das próprias mãos revisadas (o antigo Leak Finder do
 *  Revisor, RPC suggest_drills_for_user). */
export interface LeakRecorrente {
  motivo: string;
  rua: string;
  ocorrencias: number;
  drillId: string | null;
  drillTitulo: string | null;
  /** Existe drill de verdade pra esse leak (não leva a uma tela vazia). */
  treinavel: boolean;
}

/** O que o antigo Assistente do coach (aba Jogadores do Time) e os
 *  "Leaks mais frequentes" do time usavam. Só existe pra admin/coach. */
export interface TimeDoCoach {
  teamId: string;
  jogadores: TeamDashboardRow[];
  fases: FunnelPhase[];
  cards: PlayerCard[];
  alertas: TeamAlert[];
  leaks: TeamLeak[];
}

export interface PainelDados {
  carregando: boolean;
  perfil: Profile | null;
  progresso: Progress | null;
  /** Sessões visíveis pela regra da Gestão de Banca (corte do Radar). */
  sessoes: Session[];
  /** Todas as sessões, sem corte -- é o que o cadastro de metas da
   *  Gestão de Banca usa pra medir progresso (minhas-metas-modal). */
  todasSessoes: Session[];
  metas: Goal[];
  setMetas: React.Dispatch<React.SetStateAction<Goal[]>>;
  logsEstudo: StudyLog[];
  limitesBrm: BrmThreshold[] | undefined;
  /** Banca atual, com a MESMA conta da Gestão de Banca (null = sem dado). */
  bancaAtual: number | null;
  /** Resultado dos últimos 30 dias, contados a partir de hoje. */
  resultado30d: number | null;
  /** Moeda em que bancaAtual está: BRL, a não ser que falte cotação. */
  moedaBanca: string;
  /** Saldos em outra moeda que entraram na banca convertidos pra reais. */
  bancaConvertida: { moeda: string; saldo: number; taxa: number }[];
  performance: PlayerPerformance | null;
  insights: string[];
  drillsHoje: number | null;
  diasAtivos7: boolean[] | null;
  /** Mãos importadas dos últimos 14 dias (semana atual + anterior). */
  maos14d: AnalysisHandRow[] | null;
  /** Revisões ainda não concluídas (fila do Revisor). */
  pendentes: ReviewListItem[];
  setPendentes: React.Dispatch<React.SetStateAction<ReviewListItem[]>>;
  eventos: TeamEvent[];
  aoVivo: LiveStreamChannel[];
  aniversarios: TeamBirthday[];
  /** Leak Finder das mãos revisadas (vazio = sem amostra suficiente). */
  leaksRecorrentes: LeakRecorrente[];
  /** Visão de coach/admin do time; null pra jogador ou sem time. */
  timeCoach: TimeDoCoach | null;
}

const Ctx = createContext<PainelDados | null>(null);

export function usePainelDados(): PainelDados {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePainelDados fora do <PainelDadosProvider>");
  return v;
}

function ok<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

export function PainelDadosProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [progresso, setProgresso] = useState<Progress | null>(null);
  const [todasSessoes, setTodasSessoes] = useState<Session[]>([]);
  const [corteRadar, setCorteRadar] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transaction[]>([]);
  const [bancaBase, setBancaBase] = useState<number | null>(null);
  const [limitesBrm, setLimitesBrm] = useState<BrmThreshold[] | undefined>(undefined);
  const [metas, setMetas] = useState<Goal[]>([]);
  const [logsEstudo, setLogsEstudo] = useState<StudyLog[]>([]);
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [drillsHoje, setDrillsHoje] = useState<number | null>(null);
  const [diasAtivos7, setDiasAtivos7] = useState<boolean[] | null>(null);
  const [maos14d, setMaos14d] = useState<AnalysisHandRow[] | null>(null);
  const [pendentes, setPendentes] = useState<ReviewListItem[]>([]);
  const [eventos, setEventos] = useState<TeamEvent[]>([]);
  const [aoVivo, setAoVivo] = useState<LiveStreamChannel[]>([]);
  const [aniversarios, setAniversarios] = useState<TeamBirthday[]>([]);
  const [leaksRecorrentes, setLeaksRecorrentes] = useState<LeakRecorrente[]>([]);
  const [timeCoach, setTimeCoach] = useState<TimeDoCoach | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const corte14 = new Date();
      corte14.setDate(corte14.getDate() - 14);

      // Revisões dependem do id do usuário; o resto sai em paralelo.
      const revisoesPendentes = (async () => {
        const { data } = await createClient().auth.getUser();
        if (!data.user) return [] as ReviewListItem[];
        return (await listReviews(data.user.id)).filter((r) => r.status !== "concluida");
      })();

      // Leak Finder: as facets dizem quais drills existem de verdade na
      // base -- sem elas não dá pra saber se um leak é treinável (leak de
      // preflop, por exemplo, não tem drill hoje).
      const leakFinder = (async (): Promise<LeakRecorrente[]> => {
        const [cru, facets] = await Promise.all([
          fetchUserLeaksWithDrills(30, 3),
          fetchDrillFacets().catch(() => []),
        ]);
        return cru
          .filter((l) => l?.reason_label && Number(l.occurrences) > 0)
          .map((l) => ({
            motivo: String(l.reason_label),
            rua: String(l.street ?? ""),
            ocorrencias: Number(l.occurrences),
            drillId: l.drill_id ?? null,
            drillTitulo: l.drill_title ?? null,
            treinavel: Boolean(l.drill_id) && suggestionHasDrills(l.filter_config, facets),
          }));
      })();

      // Visão de coach: só pra admin/coach de um time (as RPCs recusam
      // jogador). Entra no carregamento principal, e não depois, porque o
      // Coach monta a fila UMA vez quando os dados chegam.
      const doTime = (async (): Promise<TimeDoCoach | null> => {
        const meu = await fetchMyTeamCached();
        if (!meu || (meu.role !== "admin" && meu.role !== "coach")) return null;
        const teamId = meu.team.id;
        const [jogadores, fases, cards, alertas, leaks] = await Promise.all([
          fetchTeamDashboardCached(30),
          fetchFunnelPhases(teamId).catch(() => []),
          fetchPlayerCards().catch(() => []),
          fetchTeamAlerts(14).catch(() => []),
          fetchTeamLeaks(30).catch(() => []),
        ]);
        return { teamId, jogadores, fases, cards, alertas, leaks };
      })();

      const [
        rPerfil,
        rProgresso,
        rSessoes,
        rRadar,
        rTransacoes,
        rSettings,
        rLimites,
        rMetas,
        rLogs,
        rPerf,
        rInsights,
        rDrills,
        rDias,
        rMaos,
        rRevisoes,
        rEventos,
        rAoVivo,
        rLeakFinder,
        rTime,
      ] = await Promise.allSettled([
        fetchProfile(),
        fetchProgress(),
        fetchSessions(),
        fetchRadarModuleScope("banca"),
        fetchTransactions(),
        fetchSettings(),
        fetchBrmThresholds(),
        fetchGoals(),
        fetchStudyLogs(),
        fetchPlayerPerformance(),
        fetchPlayerInsights(),
        fetchTodayTrainingCount(),
        fetchLast7DaysActivity(),
        fetchAnalysisHandRows(corte14.toISOString()),
        revisoesPendentes,
        fetchTeamEvents({ onlyUpcoming: false, limit: 200 }),
        fetchLiveTournaments(),
        leakFinder,
        doTime,
      ]);
      if (!vivo) return;

      setPerfil(ok(rPerfil));
      setProgresso(ok(rProgresso));
      setTodasSessoes(ok(rSessoes) ?? []);
      const radar = ok(rRadar);
      setCorteRadar(radar && radar.scope === "from_now" ? radar.since : null);
      setTransacoes(ok(rTransacoes) ?? []);
      setBancaBase(ok(rSettings)?.bankroll ?? null);
      setLimitesBrm(ok(rLimites) ?? undefined);
      setMetas(ok(rMetas) ?? []);
      setLogsEstudo(ok(rLogs) ?? []);
      setPerformance(ok(rPerf));
      setInsights(ok(rInsights) ?? []);
      setDrillsHoje(ok(rDrills));
      setDiasAtivos7(ok(rDias));
      setMaos14d(ok(rMaos));
      setPendentes(ok(rRevisoes) ?? []);
      setEventos(ok(rEventos) ?? []);
      setAoVivo(ok(rAoVivo) ?? []);
      setLeaksRecorrentes(ok(rLeakFinder) ?? []);
      setTimeCoach(ok(rTime));
      setCarregando(false);

      // Aniversários vêm depois: precisam da lista de membros do time, e
      // a RPC só devolve quem é do MEU time. Sem time, fica vazio.
      try {
        const membros = await fetchTeamDashboardCached();
        const lista = await fetchTeamBirthdays(membros.map((m) => m.userId));
        if (vivo) setAniversarios(lista);
      } catch {
        // sem time ou sem permissão: o calendário segue sem aniversários
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Mesmo corte do Radar que a Gestão de Banca aplica ("a partir de
  // agora" esconde sessões importadas antes da data escolhida). Sem isso
  // a banca daqui não batia com a de lá.
  const sessoes = useMemo(() => {
    if (!corteRadar) return todasSessoes;
    const corte = corteRadar.slice(0, 10);
    return todasSessoes.filter((s) => !s.importedHandSessionId || s.date >= corte);
  }, [todasSessoes, corteRadar]);

  // Banca atual = base + lucro + depósitos - saques - caixinha, com a
  // MESMA conta da Gestão de Banca. Cada moeda é calculada à parte e
  // convertida pra reais (dólar pela cotação do dia) -- antes só entrava
  // o que estava em BRL, e quem depositou em dólar via "R$ 0" aqui.
  const { taxaParaBRL } = useTaxasCambio();
  const { bancaAtual, resultado30d, moedaBanca, bancaConvertida } = useMemo((): Pick<
    PainelDados,
    "bancaAtual" | "resultado30d" | "moedaBanca" | "bancaConvertida"
  > => {
    const vazio = { bancaAtual: null, resultado30d: null, moedaBanca: "BRL", bancaConvertida: [] };
    if (bancaBase == null && todasSessoes.length === 0 && transacoes.length === 0) return vazio;
    const saldos = saldosPorMoeda(sessoes, transacoes, bancaBase ?? 0);
    if (saldos.length === 0) return { ...vazio, bancaAtual: 0, resultado30d: 0 };
    const c = consolidarEmReais(saldos, taxaParaBRL);
    // Sem cotação (API fora do ar) e uma moeda só: mostra na própria
    // moeda em vez de esconder o saldo.
    if (c.total == null) {
      const unica = saldos.length === 1 ? saldos[0] : null;
      return unica
        ? { bancaAtual: unica.saldo, resultado30d: unica.resultado30d, moedaBanca: unica.moeda, bancaConvertida: [] }
        : vazio;
    }
    return { bancaAtual: c.total, resultado30d: c.resultado30d, moedaBanca: "BRL", bancaConvertida: c.convertidas };
  }, [bancaBase, todasSessoes.length, sessoes, transacoes, taxaParaBRL]);

  const valor: PainelDados = {
    carregando,
    perfil,
    progresso,
    sessoes,
    todasSessoes,
    metas,
    setMetas,
    logsEstudo,
    limitesBrm,
    bancaAtual,
    resultado30d,
    moedaBanca,
    bancaConvertida,
    performance,
    insights,
    drillsHoje,
    diasAtivos7,
    maos14d,
    pendentes,
    setPendentes,
    eventos,
    aoVivo,
    aniversarios,
    leaksRecorrentes,
    timeCoach,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
