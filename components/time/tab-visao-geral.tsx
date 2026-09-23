"use client";

import { AlertTriangle, CalendarDays, CalendarCheck } from "lucide-react";
import { EvolutionChart } from "@/components/time/evolution-chart";
import { TeamHeatmap } from "@/components/time/team-heatmap";
import { PainelCard } from "@/components/time/painel-card";
import { Kpi } from "@/components/time/kpi";
import { PrecisaAtencao, ResumoTime } from "@/components/time/resumo-time";
import { usePainelVidro } from "@/components/dashboard/kit";
import { PeriodSelector } from "@/components/period-selector";
import {
  calcularScore,
  type FinancialDay,
  type PeriodComparison,
  type TeamActivityDay,
  type TeamDashboardRow,
  type TeamScoreHistoryPoint,
} from "@/lib/services/team-service";
import type { TeamEvent } from "@/lib/services/team-calendar-service";

// Visão geral do time (antes "Estatísticas"), no visual da tela inicial e
// da Performance:
// 1. Resumo do time: números grandes com a variação contra o período
//    anterior (o filtro de 7/30/90 dias mora no próprio card);
// 2. "Precisa de atenção" (quem o coach deve olhar agora, com o motivo)
//    ao lado do resultado por período;
// 3. Estudo no período + consistência (heatmap);
// 4. Presença nos eventos do calendário.
// A antiga tabela "Comparação de período" saiu: a mesma comparação agora
// aparece embaixo de cada número do resumo.

export function TabVisaoGeral({
  jogadores,
  atividade,
  financeiro,
  comparacao,
  eventos,
  historicoScoreTime,
  pronto,
  dias,
  periodos,
  onDiasChange,
}: {
  jogadores: TeamDashboardRow[];
  atividade: TeamActivityDay[];
  financeiro: FinancialDay[];
  comparacao: PeriodComparison | null;
  eventos: TeamEvent[];
  /** Série do RPC team_score_history -- vazio pra jogador (RPC é só admin/coach), aí o hint cai pro texto sem tendência. */
  historicoScoreTime: TeamScoreHistoryPoint[];
  pronto: boolean;
  dias: number;
  periodos: { label: string; days: number }[];
  onDiasChange: (dias: number) => void;
}) {
  const scores = jogadores.map(calcularScore);
  const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.valor, 0) / scores.length) : null;

  // Compara a média de hoje com a mais antiga disponível até 7 dias
  // atrás -- mesma janela do selo individual (calcularTendencia), só
  // que aqui é a média do time (historicoScoreTime vem de
  // team_score_history, RPC que só admin/coach conseguem chamar).
  const tendenciaTime = (() => {
    if (scoreMedio === null || historicoScoreTime.length < 2) return null;
    const hoje = historicoScoreTime[historicoScoreTime.length - 1];
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const referencia = historicoScoreTime.find((p) => new Date(p.dia).getTime() >= limite) ?? historicoScoreTime[0];
    if (referencia === hoje) return null;
    return hoje.scoreMedio - referencia.scoreMedio;
  })();

  return (
    <div className="space-y-3.5">
      <ResumoTime
        jogadores={jogadores}
        comparacao={comparacao}
        tendenciaScore={tendenciaTime}
        dias={dias}
        pronto={pronto}
        acao={<div className="print:hidden"><PeriodSelector value={dias} onChange={onDiasChange} options={periodos} /></div>}
      />

      <section className="grid gap-3.5 lg:grid-cols-2">
        <PrecisaAtencao jogadores={jogadores} dias={dias} pronto={pronto} />
        <EvolutionChart
          dados={financeiro}
          pronto={pronto}
          titulo="Resultado por período"
        />
      </section>

      <section className="grid gap-3.5 lg:grid-cols-2">
        <GraficoEstudo dados={atividade} pronto={pronto} />

        <PainelCard titulo="Consistência do time" icone={<CalendarDays size={15} />} className="flex flex-col">
          <div className="flex flex-1 items-center">
            <TeamHeatmap dados={financeiro} />
          </div>
        </PainelCard>
      </section>

      <Presenca eventos={eventos} />

      {/* O Assistente do coach e o resumo do funil ("prontos"/"com
          faltas") que ficavam nesta aba foram para o AI Coach da tela
          inicial -- único lugar com orientações automáticas. */}
    </div>
  );
}

// ------------------------------------------------------------
function Presenca({ eventos }: { eventos: TeamEvent[] }) {
  const participantes = eventos.flatMap((e) => e.participants);
  const total = participantes.length;
  const confirmados = participantes.filter((p) => p.status === "confirmado").length;
  const recusados = participantes.filter((p) => p.status === "recusado").length;
  const pendentes = participantes.filter((p) => p.status === "pendente").length;
  const taxaResposta = total > 0 ? Math.round(((confirmados + recusados) / total) * 100) : null;
  const taxaConfirmacao = total > 0 ? Math.round((confirmados / total) * 100) : null;

  return (
    <PainelCard titulo="Presença nos eventos" icone={<CalendarCheck size={15} />}>
      {total === 0 ? (
        <p className="text-sm text-muted">Sem eventos com convidados no calendário ainda.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi icon={CalendarCheck} label="Confirmaram" value={taxaConfirmacao === null ? "—" : `${taxaConfirmacao}%`}
              hint={`${confirmados} de ${total} convites`} />
            <Kpi icon={AlertTriangle} label="Sem resposta" value={String(pendentes)}
              hint={`${taxaResposta}% já responderam`} tom={pendentes > 0 ? "negativo" : undefined} />
            <Kpi icon={CalendarDays} label="Recusas" value={String(recusados)} hint="no período" />
          </div>
        </>
      )}
    </PainelCard>
  );
}

// ------------------------------------------------------------
// Grafico de estudo: treinos + revisoes por dia, mesma grade do
// grafico financeiro ao lado.
// ------------------------------------------------------------
function GraficoEstudo({ dados, pronto }: { dados: TeamActivityDay[]; pronto: boolean }) {
  const vidro = usePainelVidro();
  const max = Math.max(1, ...dados.map((d) => d.treinos + d.revisoes));
  const totalTreinos = dados.reduce((a, d) => a + d.treinos, 0);
  const totalRev = dados.reduce((a, d) => a + d.revisoes, 0);

  return (
    <div
      className={`${vidro ? "painel-vidro rounded-3xl border border-white/10 p-4 sm:p-5" : "rounded-xl border border-hairline bg-surface p-5"} transition-all duration-500 delay-75 print:break-inside-avoid ${
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
