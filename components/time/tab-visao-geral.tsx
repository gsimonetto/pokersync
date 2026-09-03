"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kanban, CheckCircle2, AlertTriangle, ArrowRight, CalendarDays, GitCompare, CalendarCheck } from "lucide-react";
import { EvolutionChart } from "@/components/time/evolution-chart";
import { TeamHeatmap } from "@/components/time/team-heatmap";
import { PainelCard } from "@/components/time/painel-card";
import { AssistenteCoach } from "@/components/time/assistente-coach";
import { Kpi } from "@/components/time/kpi";
import { HeroMetric } from "@/components/time/hero-metric";
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
import { fetchPlayerCards, progressoPronto } from "@/lib/services/team-funnel-service";
import { BRL, variacao } from "@/lib/format";

// Estatisticas do time. Hierarquia visual:
// 1. Faixa herói com os KPIs lado a lado (mesmo padrão do Gestor de
//    Banca e da Performance) -- antes cada metrica vivia dentro do
//    proprio card agrupado por assunto, empilhando borda dentro de
//    borda e ficando pesado;
// 2. Resultado por periodo + heatmap de consistencia lado a lado (mesmo
//    par "Evolucao da banca" + "Consistencia de volume" do Gestor de
//    Banca), com o filtro de dias vivendo dentro do proprio card;
// 3. Treino x Revisoes + Comparacao de periodo/Confirmacao de presenca
//    lado a lado -- a comparacao nao repete XP aqui, ja que mora do
//    lado do proprio grafico de treino;
// 4. Assistente do coach por ultimo, largura cheia (Top do periodo foi
//    removido daqui por pedido explicito -- ranking mora na aba
//    Jogadores).

export function TabVisaoGeral({
  teamId,
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
  onAbrirFunil,
  onErro,
}: {
  teamId: string;
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
  onAbrirFunil: () => void;
  onErro: (s: string) => void;
}) {
  const treinos = jogadores.reduce((a, j) => a + j.treinos, 0);
  const acertos = jogadores.reduce((a, j) => a + j.acertosGto, 0);
  const revisadas = jogadores.reduce((a, j) => a + j.maosRevisadas, 0);
  const jogos = jogadores.reduce((a, j) => a + j.jogosNoTime, 0);
  const lucro = jogadores.reduce((a, j) => a + j.lucroNoTime, 0);
  const scores = jogadores.map(calcularScore);
  const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.valor, 0) / scores.length) : null;
  const emRiscoAlto = scores.filter((s) => s.risco === "alto").length;
  const acertoPct = treinos > 0 ? Math.round((acertos / treinos) * 100) : null;

  // Compara a média de hoje com a mais antiga disponível até 7 dias
  // atrás -- mesma janela do selo individual (calcularTendencia), só
  // que aqui é a média do time (historicoScoreTime vem de
  // team_score_history, RPC que só admin/coach conseguem chamar).
  const tendenciaTime = (() => {
    if (scoreMedio === null || historicoScoreTime.length < 2) return null;
    const hoje = historicoScoreTime[historicoScoreTime.length - 1];
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const referencia = historicoScoreTime.find((p) => new Date(p.dia).getTime() >= limite) ?? historicoScoreTime[0];
    if (referencia === hoje || referencia.scoreMedio === hoje.scoreMedio) return null;
    const diff = hoje.scoreMedio - referencia.scoreMedio;
    return diff > 0 ? `+${diff} vs 7 dias atrás` : `${diff} vs 7 dias atrás`;
  })();

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
      {/* Faixa herói — mesmo padrão e MESMA contagem de colunas (5, a
          partir de lg) do Gestor de Banca e da Performance: 6 colunas
          espremia demais o valor em R$ (mais largo que qualquer outra
          métrica) e o texto vazava por cima da coluna vizinha. "Jogos"
          virou hint do "Resultado no time" em vez de coluna própria. */}
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
          <p className="text-sm text-muted">Desempenho do time</p>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full opacity-[0.13] blur-3xl"
          style={{ background: lucro < 0 ? "#e0555a" : "#2FB89A" }}
        />

        <div className="relative grid grid-cols-2 divide-x divide-y divide-hairline sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <HeroMetric
            label="Resultado no time"
            value={BRL.format(lucro)}
            tone={lucro > 0 ? "bom" : lucro < 0 ? "ruim" : "neutro"}
            hint={`${jogos} jogo${jogos === 1 ? "" : "s"} desde a entrada de cada um`}
            destaque
          />
          <HeroMetric
            label="Treinos no período"
            value={String(treinos)}
            tone="neutro"
            hint={varTreinos != null ? `${varTreinos > 0 ? "+" : ""}${varTreinos}% vs período anterior` : undefined}
          />
          <HeroMetric
            label="Acerto GTO"
            value={acertoPct === null ? "—" : `${acertoPct}%`}
            tone={acertoPct === null ? "neutro" : acertoPct >= 50 ? "bom" : "ruim"}
            hint={acertoPct === null ? "sem treinos" : varAcerto != null ? `${varAcerto > 0 ? "+" : ""}${varAcerto}pp vs período anterior` : undefined}
          />
          <HeroMetric
            label="Mãos revisadas"
            value={String(revisadas)}
            tone="neutro"
            hint={varRevisadas != null ? `${varRevisadas > 0 ? "+" : ""}${varRevisadas}% vs período anterior` : undefined}
          />
          <HeroMetric
            label="Score de evolução do time"
            value={scoreMedio === null ? "—" : String(scoreMedio)}
            tone={scoreMedio === null ? "neutro" : scoreMedio >= 70 ? "bom" : scoreMedio >= 40 ? "neutro" : "ruim"}
            hint={
              tendenciaTime
                ? `${tendenciaTime} · ${emRiscoAlto > 0 ? `${emRiscoAlto} em risco alto` : "ninguém em risco alto"}`
                : emRiscoAlto > 0
                ? `${emRiscoAlto} em risco alto`
                : "ninguém em risco alto"
            }
          />
        </div>
      </section>

      <ResumoFunilMini onAbrirFunil={onAbrirFunil} />

      <section className="grid gap-4 lg:grid-cols-2">
        <EvolutionChart
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
        <GraficoEstudo dados={atividade} pronto={pronto} />
        <ComparacaoEPresenca comparacao={comparacao} eventos={eventos} />
      </section>

      <AssistenteCoach teamId={teamId} jogadores={jogadores} onErro={onErro} />
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
// Comparação de período (atual vs anterior) e confirmação de presença
// nos eventos do calendário, juntas no mesmo card -- fica ao lado do
// gráfico de Treino x Revisões, entao a comparação aqui não repete a
// info de XP que já aparece no gráfico ao lado.
// ------------------------------------------------------------
function ComparacaoEPresenca({ comparacao, eventos }: { comparacao: PeriodComparison | null; eventos: TeamEvent[] }) {
  const temComparacao = comparacao && (comparacao.treinosAnterior > 0 || comparacao.treinosAtual > 0);
  const acertoAtualPct = comparacao && comparacao.treinosAtual > 0 ? Math.round((comparacao.acertosAtual / comparacao.treinosAtual) * 100) : null;
  const acertoAnteriorPct = comparacao && comparacao.treinosAnterior > 0 ? Math.round((comparacao.acertosAnterior / comparacao.treinosAnterior) * 100) : null;

  const linhas: { label: string; atual: string; anterior: string }[] = comparacao
    ? [
        { label: "Treinos", atual: String(comparacao.treinosAtual), anterior: String(comparacao.treinosAnterior) },
        { label: "Acerto GTO", atual: acertoAtualPct === null ? "—" : `${acertoAtualPct}%`, anterior: acertoAnteriorPct === null ? "—" : `${acertoAnteriorPct}%` },
        { label: "Mãos revisadas", atual: String(comparacao.revisadasAtual), anterior: String(comparacao.revisadasAnterior) },
      ]
    : [];

  const participantes = eventos.flatMap((e) => e.participants);
  const total = participantes.length;
  const confirmados = participantes.filter((p) => p.status === "confirmado").length;
  const recusados = participantes.filter((p) => p.status === "recusado").length;
  const pendentes = participantes.filter((p) => p.status === "pendente").length;
  const taxaResposta = total > 0 ? Math.round(((confirmados + recusados) / total) * 100) : null;
  const taxaConfirmacao = total > 0 ? Math.round((confirmados / total) * 100) : null;

  return (
    <PainelCard titulo="Comparação de período" icone={<GitCompare size={13} className="text-training" />}>
      {temComparacao ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div />
          <p className="text-[10px] font-semibold uppercase text-muted">Atual</p>
          <p className="text-[10px] font-semibold uppercase text-muted">Anterior</p>

          {linhas.map((l) => (
            <div key={l.label} className="contents">
              <p className="text-left text-[12px] text-muted">{l.label}</p>
              <p className="text-sm font-bold tnum text-ink">{l.atual}</p>
              <p className="text-sm font-bold tnum text-muted">{l.anterior}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sem dados suficientes pra comparar com o período anterior.</p>
      )}

      <div className="mt-4 border-t border-hairline pt-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <CalendarCheck size={12} className="text-review" />
          Confirmação de presença
        </p>
        {total === 0 ? (
          <p className="mt-2 text-sm text-muted">Sem eventos com convidados no calendário ainda.</p>
        ) : (
          <>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <Kpi icon={CalendarCheck} label="Confirmaram presença" value={taxaConfirmacao === null ? "—" : `${taxaConfirmacao}%`}
                hint={`${confirmados} de ${total} convites`} tom={taxaConfirmacao !== null && taxaConfirmacao >= 60 ? "positivo" : undefined} />
              <Kpi icon={AlertTriangle} label="Sem resposta" value={String(pendentes)}
                hint={`${taxaResposta}% já responderam`} tom={pendentes > 0 ? "negativo" : undefined} />
            </div>
            {recusados > 0 && <p className="mt-2.5 text-xs text-muted">{recusados} recusa(s) registrada(s) no período.</p>}
          </>
        )}
      </div>
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
