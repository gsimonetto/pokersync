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
import { aggregate, netWorth } from "@/lib/bankroll/calc";
import type { BrmThreshold, Goal, Session, StudyLog, Transaction } from "@/lib/bankroll/types";
import {
  fetchPlayerInsights,
  fetchPlayerPerformance,
  type PlayerPerformance,
} from "@/lib/services/performance-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { fetchAnalysisHandRows } from "@/lib/services/analysis-service";
import type { AnalysisHandRow } from "@/types/analysis";
import { listReviews, type ReviewListItem } from "@/lib/services/hand-review-service";
import {
  fetchTeamBirthdays,
  fetchTeamEvents,
  type TeamBirthday,
  type TeamEvent,
} from "@/lib/services/team-calendar-service";
import { fetchTeamDashboardCached } from "@/lib/services/team-service";
import { fetchLiveTournaments, type LiveStreamChannel } from "@/lib/services/live-stream-service";
import { fetchRadarModuleScope } from "@/lib/services/radar-module-scope-service";

// Carregador ÚNICO de dados do Painel. Antes cada card buscava os
// próprios dados, e vários buscavam os mesmos: sessões 4 vezes, drills de
// hoje 3 vezes, metas/estudo/performance/progresso/revisões 2 vezes cada
// -- umas 11 consultas repetidas a cada abertura da tela. Agora a tela
// busca tudo uma vez só, em paralelo, e os cards só leem daqui.

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
}

const Ctx = createContext<PainelDados | null>(null);

export function usePainelDados(): PainelDados {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePainelDados fora do <PainelDadosProvider>");
  return v;
}

// Sessão sem moeda informada é BRL (convenção da Gestão de Banca).
const emReais = (moeda?: string) => (moeda || "BRL") === "BRL";

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

  // Banca atual = base + lucro + depósitos - saques - caixinha, em reais
  // (visão padrão da Gestão de Banca). O Coach usava só a base cadastrada,
  // e o "Banca cobre X buy-ins" daqui dava número diferente do de lá.
  const { bancaAtual, resultado30d } = useMemo(() => {
    if (bancaBase == null && todasSessoes.length === 0) return { bancaAtual: null, resultado30d: null };
    const sessoesReais = sessoes.filter((s) => emReais(s.currency));
    const transacoesReais = transacoes.filter((t) => emReais(t.currency));
    const banca = netWorth(bancaBase ?? 0, aggregate(sessoesReais).profit, transacoesReais).playingBankroll;
    const corte = new Date();
    corte.setDate(corte.getDate() - 30);
    const iso = corte.toISOString().slice(0, 10);
    const r30 = aggregate(sessoesReais.filter((s) => s.date >= iso)).profit;
    return { bancaAtual: banca, resultado30d: r30 };
  }, [bancaBase, todasSessoes.length, sessoes, transacoes]);

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
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
