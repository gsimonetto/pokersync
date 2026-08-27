"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, TriangleAlert, BookOpen, Target, Wallet, Gamepad2, Kanban, CheckCircle2, AlertTriangle, ArrowRight, CalendarDays, Trophy, ChevronRight } from "lucide-react";
import { GraficoFinanceiro } from "@/components/time/grafico-financeiro";
import { TeamHeatmap } from "@/components/time/team-heatmap";
import { PainelCard } from "@/components/time/painel-card";
import { AssistenteCoach } from "@/components/time/assistente-coach";
import { Kpi } from "@/components/time/kpi";
import { Avatar } from "@/components/avatar";
import { PeriodSelector } from "@/components/period-selector";
import {
  diasSemAtividade,
  type FinancialDay,
  type PeriodComparison,
  type TeamActivityDay,
  type TeamDashboardRow,
} from "@/lib/services/team-service";
import { fetchPlayerCards, progressoPronto } from "@/lib/services/team-funnel-service";
import { BRL, variacao } from "@/lib/format";

// Estatisticas do time. Hierarquia visual:
// 1. KPIs agrupados por assunto (Financeiro / Treinos / Alertas) -- antes
//    era uma grade unica misturando dinheiro, estudo e risco no mesmo
//    nivel, sem hierarquia de leitura;
// 2. Resultado por periodo + heatmap de consistencia lado a lado (mesmo
//    par "Evolucao da banca" + "Consistencia de volume" do Gestor de
//    Banca), com o filtro de dias vivendo dentro do proprio card;
// 3. Assistente do coach como card entre os demais, no mesmo layout do
//    "AI Coach" da banca -- nao mais so' escondido na aba Jogadores.

const INATIVO_DIAS = 7;

export function TabVisaoGeral({
  teamId,
  jogadores,
  atividade,
  financeiro,
  comparacao,
  pronto,
  dias,
  periodos,
  onDiasChange,
  onAbrirFunil,
  onErro,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  atividade: TeamActivityDay[];
  financeiro: FinancialDay[];
  comparacao: PeriodComparison | null;
  pronto: boolean;
  dias: number;
  periodos: { label: string; days: number }[];
  onDiasChange: (dias: number) => void;
  onAbrirFunil: () => void;
  onErro: (s: string) => void;
}) {
  const treinos = jogadores.reduce((a, j) => a + j.treinos, 0);
  const acertos = jogadores.reduce((a, j) => a + j.acertosGto, 0);
  const revisadas = jogadores.reduce((a, j) => a + j.maosRevisadas, 0);
  const jogos = jogadores.reduce((a, j) => a + j.jogosNoTime, 0);
  const lucro = jogadores.reduce((a, j) => a + j.lucroNoTime, 0);
  const inativos = jogadores.filter((j) => {
    const d = diasSemAtividade(j.lastActivityAt);
    return d === null || d >= INATIVO_DIAS;
  }).length;
  const acertoPct = treinos > 0 ? Math.round((acertos / treinos) * 100) : null;

  const varTreinos = variacao(comparacao?.treinosAtual, comparacao?.treinosAnterior);
  const varRevisadas = variacao(comparacao?.revisadasAtual, comparacao?.revisadasAnterior);
  const acertoAnteriorPct =
    comparacao && comparacao.treinosAnterior > 0
      ? Math.round((comparacao.acertosAnterior / comparacao.treinosAnterior) * 100)
      : null;
  const varAcerto =
    acertoPct !== null && acertoAnteriorPct !== null ? acertoPct - acertoAnteriorPct : null;

  return (
    <div className="space-y-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Desempenho do time</p>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PainelCard titulo="Financeiro" icone={<Wallet size={13} className="text-positive" />}>
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi d={0} pronto={pronto} icon={Wallet} label="Resultado no time" value={BRL.format(lucro)}
              hint="desde a entrada de cada um" tom={lucro > 0 ? "positivo" : lucro < 0 ? "negativo" : undefined} destaque />
            <Kpi d={40} pronto={pronto} icon={Gamepad2} label="Jogos" value={String(jogos)} hint="desde a entrada" />
          </div>
        </PainelCard>

        <PainelCard titulo="Treinos" icone={<Target size={13} className="text-training" />}>
          <div className="grid grid-cols-2 gap-2.5">
            <Kpi d={80} pronto={pronto} icon={Target} label="Treinos no período" value={String(treinos)} tendencia={varTreinos} />
            <Kpi d={120} pronto={pronto} icon={Flame} label="Acerto GTO" value={acertoPct === null ? "—" : `${acertoPct}%`}
              hint={acertoPct === null ? "sem treinos" : undefined} tendencia={varAcerto} tendenciaSufixo="pp" />
            <Kpi d={160} pronto={pronto} icon={BookOpen} label="Mãos revisadas" value={String(revisadas)} tendencia={varRevisadas} />
          </div>
        </PainelCard>

        <PainelCard titulo="Alertas" icone={<TriangleAlert size={13} className="text-negative" />}>
          <div className="grid grid-cols-1 gap-2.5">
            <Kpi d={200} pronto={pronto} icon={TriangleAlert} label="Precisam de atenção" value={String(inativos)}
              hint={`${jogadores.length - inativos} ativos`} tom={inativos > 0 ? "negativo" : undefined} />
          </div>
        </PainelCard>
      </section>

      <ResumoFunilMini onAbrirFunil={onAbrirFunil} />

      <section className="grid gap-4 lg:grid-cols-2">
        <GraficoFinanceiro
          dados={financeiro}
          pronto={pronto}
          titulo="Resultado por período"
          acao={<div className="print:hidden"><PeriodSelector value={dias} onChange={onDiasChange} options={periodos} /></div>}
        />

        <PainelCard titulo="Consistência do time" icone={<CalendarDays size={13} className="text-evolution" />} className="flex flex-col">
          <div className="flex flex-1 items-center">
            <TeamHeatmap dados={financeiro} />
          </div>
        </PainelCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AssistenteCoach teamId={teamId} jogadores={jogadores} onErro={onErro} />
        <TopDoPeriodo jogadores={jogadores} />
      </section>

      <GraficoEstudo dados={atividade} pronto={pronto} />
    </div>
  );
}

// ------------------------------------------------------------
// Espelho compacto do assistente do Kanban — so pra quem abre o painel
// e fica na Visao Geral sem clicar em Funil. Busca leve (so cards),
// some sozinho se nao ha nada a mostrar.
function ResumoFunilMini({ onAbrirFunil }: { onAbrirFunil: () => void }) {
  const [prontos, setProntos] = useState(0);
  const [comFaltas, setComFaltas] = useState(0);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    fetchPlayerCards()
      .then((cards) => {
        setProntos(cards.filter(progressoPronto).length);
        setComFaltas(cards.filter((c) => c.eventosAusente >= 2).length);
      })
      .catch(() => {})
      .finally(() => setCarregado(true));
  }, []);

  if (!carregado || (prontos === 0 && comFaltas === 0)) return null;

  return (
    <button
      onClick={onAbrirFunil}
      className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-ink/30"
    >
      <Kanban size={16} className="shrink-0 text-muted" />
      <span className="text-[13px] text-muted">No funil:</span>
      {prontos > 0 && (
        <span className="flex items-center gap-1 text-[13px] font-medium text-positive">
          <CheckCircle2 size={13} /> {prontos} pronto{prontos > 1 ? "s" : ""} pra subir de fase
        </span>
      )}
      {comFaltas > 0 && (
        <span className="flex items-center gap-1 text-[13px] font-medium text-negative">
          <AlertTriangle size={13} /> {comFaltas} com faltas
        </span>
      )}
      <ArrowRight size={14} className="ml-auto shrink-0 text-muted" />
    </button>
  );
}

// ------------------------------------------------------------
// Ranking curto por XP no periodo — mesma metrica ja usada na ordenacao
// da aba Jogadores, aqui como vitrine rapida (top 5) dentro da grade de
// cards da Estatisticas, ao lado do Assistente do coach.
// ------------------------------------------------------------
function TopDoPeriodo({ jogadores }: { jogadores: TeamDashboardRow[] }) {
  const top = [...jogadores].sort((a, b) => b.xpPeriodo - a.xpPeriodo).slice(0, 5);

  return (
    <PainelCard titulo="Top do período" icone={<Trophy size={13} className="text-evolution" />}>
      {top.length === 0 ? (
        <p className="text-sm text-muted">Sem jogadores no período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {top.map((j, i) => (
            <li key={j.userId}>
              <Link
                href={`/time/jogador/${j.userId}`}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-elevated"
              >
                <span className={`w-4 shrink-0 text-center text-[12px] font-bold tnum ${i === 0 ? "text-evolution" : "text-muted"}`}>{i + 1}</span>
                <Avatar id={j.avatarId} url={j.avatarUrl} size={28} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{j.nome}</span>
                <span className="shrink-0 text-[12px] font-semibold tnum text-evolution">{j.xpPeriodo} XP</span>
                <ChevronRight size={13} className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}

// ------------------------------------------------------------
// Grafico de estudo: treinos + revisoes por dia, mesma grade do
// grafico financeiro ao lado.
// ------------------------------------------------------------
function GraficoEstudo({ dados, pronto }: { dados: TeamActivityDay[]; pronto: boolean }) {
  const max = Math.max(1, ...dados.map((d) => d.treinos + d.revisoes));
  const totalTreinos = dados.reduce((a, d) => a + d.treinos, 0);
  const totalRev = dados.reduce((a, d) => a + d.revisoes, 0);

  return (
    <div
      className={`rounded-xl border border-hairline bg-surface p-5 transition-all duration-500 delay-75 print:break-inside-avoid ${
        pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Estudo no período</h2>
        <span className="text-sm font-semibold tnum text-muted">{totalTreinos + totalRev} atividades</span>
      </div>

      <div className="mt-4 flex items-end gap-[2px]" style={{ height: 132 }}>
        {dados.map((d, i) => {
          const total = d.treinos + d.revisoes;
          return (
            <div key={d.dia} className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.treinos} treino(s), ${d.revisoes} revisão(ões)`}>
              {total === 0 ? (
                <div className="h-[2px] w-full rounded-sm bg-hairline" />
              ) : (
                <>
                  <div className="w-full rounded-t-sm bg-review transition-all ease-out"
                    style={{
                      height: pronto ? `${(d.revisoes / max) * 100}%` : "0%",
                      transitionDuration: "700ms",
                      transitionDelay: `${Math.min(i * 10, 350)}ms`,
                    }} />
                  <div className="w-full rounded-b-sm bg-training transition-all ease-out"
                    style={{
                      height: pronto ? `${(d.treinos / max) * 100}%` : "0%",
                      transitionDuration: "700ms",
                      transitionDelay: `${Math.min(i * 10, 350)}ms`,
                    }} />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-training" /> Treinos ({totalTreinos})</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-review" /> Revisões ({totalRev})</span>
      </div>
    </div>
  );
}
