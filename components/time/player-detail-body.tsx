"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TriangleAlert,
  MessageSquare,
  Eye,
  ChevronRight,
  Handshake,
  CalendarDays,
  LayoutDashboard,
  Wallet,
  BookOpen,
  Target,
} from "lucide-react";
import { Chip } from "@/components/chip";
import { TabNav } from "@/components/ui/tab-nav";
import { EvolutionChart } from "@/components/time/evolution-chart";
import { ScoreHistoryChart } from "@/components/time/score-history-chart";
import { TeamHeatmap } from "@/components/time/team-heatmap";
import { PainelCard } from "@/components/time/painel-card";
import { MetasCard } from "@/components/time/metas-card";
import { HeroMetric } from "@/components/time/hero-metric";
import { BRL, variacao } from "@/lib/format";
import {
  ALERTA_LABEL,
  type FinancialDay,
  type PlayerActivityDay,
  type PlayerEvolutionStats,
  type PlayerScoreHistoryPoint,
  type TeamAlert,
  type PlayerDetail,
  type PlayerSharedHand,
  type PlayerLeak,
  type PlayerStakingSession,
} from "@/lib/services/team-service";

type Aba = "geral" | "financeiro" | "estudo" | "performance";

const TABS: { value: Aba; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "geral", label: "Visão Geral", icon: LayoutDashboard },
  { value: "financeiro", label: "Financeiro", icon: Wallet },
  { value: "estudo", label: "Estudo", icon: BookOpen },
  { value: "performance", label: "Performance", icon: Target },
];

// Corpo da ficha do jogador — mesmo padrão de abas do Player Evolution
// (TabNav, um container só) em vez de empilhar hero + score + gráfico
// financeiro + heatmap + estudo + staking + metas + mãos + alertas +
// leaks tudo junto numa rolagem só. O herói (identidade/resumo) fica
// fora das abas -- é o "quem é esse jogador" que faz sentido ver
// sempre, o resto é organizado por assunto. Extraído pra ser reusado
// tanto na página cheia (/time/jogador/[id]) quanto no modal aberto de
// dentro da lista de Jogadores, sem duplicar a mesma marcação em dois
// lugares.
export function PlayerDetailBody({
  id,
  p,
  atividade,
  leaks,
  maos,
  alertas,
  financeiro,
  staking,
  historicoScore,
  evolutionStats,
  podeGerenciarMetas,
  hrefMaoCompartilhada = (reviewId) => `/revisor?shared=${reviewId}`,
}: {
  id: string;
  p: PlayerDetail;
  atividade: PlayerActivityDay[];
  leaks: PlayerLeak[];
  maos: PlayerSharedHand[];
  alertas: TeamAlert[];
  financeiro: FinancialDay[];
  staking: PlayerStakingSession[];
  historicoScore: PlayerScoreHistoryPoint[];
  evolutionStats: PlayerEvolutionStats | null;
  podeGerenciarMetas: boolean;
  hrefMaoCompartilhada?: (reviewId: string) => string;
}) {
  const [aba, setAba] = useState<Aba>("geral");

  const acertoPct = p.treinos === 0 ? null : Math.round((p.acertosGto / p.treinos) * 100);
  const varTreinos = variacao(p.treinos, p.treinosPeriodoAnterior);
  const acertoAnteriorPct =
    p.treinosPeriodoAnterior > 0 ? Math.round((100 * (p.acertosGtoPeriodoAnterior ?? 0)) / p.treinosPeriodoAnterior) : null;
  const varAcerto = acertoPct !== null && acertoAnteriorPct !== null ? acertoPct - acertoAnteriorPct : null;

  return (
    <div className="space-y-5">
      {/* Faixa herói — mesmo padrão e MESMA contagem de colunas (5, a
          partir de lg) do Gestor de Banca, da Performance e da aba
          Estatísticas do time: 6 colunas espremia demais o valor em R$.
          "Jogos" virou hint do "Resultado no time" em vez de coluna própria. */}
      <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
          <p className="text-sm text-muted">Desempenho no time</p>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full opacity-[0.13] blur-3xl"
          style={{ background: p.lucroNoTime < 0 ? "#e0555a" : "#2FB89A" }}
        />

        <div className="relative grid grid-cols-2 divide-x divide-y divide-hairline sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <HeroMetric
            label="Resultado no time"
            value={p.jogosNoTime > 0 ? BRL.format(p.lucroNoTime) : "—"}
            tone={p.lucroNoTime > 0 ? "bom" : p.lucroNoTime < 0 ? "ruim" : "neutro"}
            hint={`${p.jogosNoTime} jogo${p.jogosNoTime === 1 ? "" : "s"}${staking.length > 0 ? " · líquido, já descontado o staking" : " desde que entrou"}`}
            destaque
          />
          <HeroMetric
            label="Treinos"
            value={String(p.treinos)}
            tone="neutro"
            hint={`${p.xpPeriodo} XP · ${varTreinos != null ? `${varTreinos > 0 ? "+" : ""}${varTreinos}% vs período anterior` : "sem comparação"}`}
          />
          <HeroMetric
            label="Acerto GTO"
            value={acertoPct === null ? "—" : `${acertoPct}%`}
            tone={acertoPct === null ? "neutro" : acertoPct >= 50 ? "bom" : "ruim"}
            hint={p.errosGraves > 0 ? `${p.errosGraves} erro(s) grave(s)` : varAcerto != null ? `${varAcerto > 0 ? "+" : ""}${varAcerto}pp vs período anterior` : undefined}
          />
          <HeroMetric
            label="Mãos revisadas"
            value={String(p.maosRevisadas)}
            tone="neutro"
            hint={p.maosPendentes > 0 ? `${p.maosPendentes} na fila` : undefined}
          />
          <HeroMetric
            label="Ofensiva"
            value={p.streakDays ? `${p.streakDays}d` : "—"}
            tone={p.streakDays ? "bom" : "neutro"}
            hint={p.streakBest ? `recorde ${p.streakBest}d` : undefined}
          />
        </div>
      </section>

      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5 print:border-0 print:bg-transparent print:p-0">
        <div className="print:hidden">
          <TabNav value={aba} onChange={setAba} options={TABS} />
        </div>

        <div className="mt-4">
          {aba === "geral" && (
            <AbaGeral p={p} leaks={leaks} alertas={alertas} historicoScore={historicoScore} />
          )}
          {aba === "financeiro" && <AbaFinanceiro financeiro={financeiro} staking={staking} />}
          {aba === "estudo" && (
            <AbaEstudo id={id} atividade={atividade} maos={maos} podeGerenciarMetas={podeGerenciarMetas} hrefMaoCompartilhada={hrefMaoCompartilhada} />
          )}
          {aba === "performance" && <AbaPerformance stats={evolutionStats} />}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Visão Geral: o que o coach checa primeiro ao abrir a ficha -- a
// tendência do Score e o que já está gerando alerta ou leak, antes de
// entrar em financeiro/estudo/performance.
// ------------------------------------------------------------
function AbaGeral({
  p,
  leaks,
  alertas,
  historicoScore,
}: {
  p: PlayerDetail;
  leaks: PlayerLeak[];
  alertas: TeamAlert[];
  historicoScore: PlayerScoreHistoryPoint[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Score de evolução</h2>
        <p className="mt-1 text-sm text-muted">
          Resume atividade, acerto GTO, consistência e progresso num número só, dia a dia.
        </p>
        <div className="mt-4">
          <ScoreHistoryChart dados={historicoScore} />
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="border-t border-hairline pt-5">
          <h2 className="text-base font-semibold">Alertas recentes</h2>
          <ul className="mt-3 space-y-2">
            {alertas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Chip color={a.kind === "lembrete_estudo" ? "#8b8b8b" : "#F59E0B"} size="sm">
                  {ALERTA_LABEL[a.kind]}
                </Chip>
                <span className="min-w-0 flex-1 text-ink/85">{a.detail}</span>
                <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-hairline pt-5">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <TriangleAlert size={15} className="text-evolution" />
          Leaks recorrentes
        </h2>
        {leaks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sem erros classificados no período.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {leaks.map((l) => {
              const maior = leaks[0].total || 1;
              return (
                <li key={l.reasonCode} className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] font-medium">{l.label}</span>
                    <span className="shrink-0 text-xs text-muted tnum">{l.total}×</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-void">
                    <div
                      className="h-full rounded-full bg-review"
                      style={{ width: `${Math.max(6, Math.round((l.total / maior) * 100))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Financeiro: resultado, consistência e staking -- tudo que envolve
// dinheiro do jogador, junto.
// ------------------------------------------------------------
function AbaFinanceiro({ financeiro, staking }: { financeiro: FinancialDay[]; staking: PlayerStakingSession[] }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <EvolutionChart dados={financeiro} titulo="Resultado no período" />
        <PainelCard titulo="Consistência" icone={<CalendarDays size={13} className="text-evolution" />} className="flex flex-col">
          <div className="flex flex-1 items-center">
            <TeamHeatmap dados={financeiro} />
          </div>
        </PainelCard>
      </section>

      {staking.length > 0 && (
        <section className="border-t border-hairline pt-5">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            <Handshake size={15} className="text-training" />
            Staking recente
          </h2>
          <p className="mt-1 text-sm text-muted">
            Sessões em que o jogador vendeu parte da ação — resultado líquido é o que fica com ele, bruto é o
            tamanho real do swing da sessão.
          </p>
          <ul className="mt-4 divide-y divide-hairline">
            {staking.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
                <span className="text-muted">{new Date(s.dia).toLocaleDateString("pt-BR")}</span>
                <span className="font-medium">{s.formato}</span>
                <span className="rounded-full border border-training/40 bg-training/10 px-2 py-0.5 text-[10.5px] font-semibold text-training">
                  {s.ownPct}% dele · markup {s.markup.toFixed(2)}
                </span>
                {s.backerName && <span className="text-muted">backer: {s.backerName}</span>}
                <span className="ml-auto flex items-center gap-3 tnum">
                  <span className={s.resultadoLiquido >= 0 ? "text-positive" : "text-negative"}>
                    líquido {BRL.format(s.resultadoLiquido)}
                  </span>
                  <span className="text-xs text-muted">bruto {BRL.format(s.resultadoBruto)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Estudo: frequência (treino/revisão), metas definidas pelo coach e as
// mãos que o jogador compartilhou -- tudo que é rotina de aprendizado.
// ------------------------------------------------------------
function AbaEstudo({
  id,
  atividade,
  maos,
  podeGerenciarMetas,
  hrefMaoCompartilhada,
}: {
  id: string;
  atividade: PlayerActivityDay[];
  maos: PlayerSharedHand[];
  podeGerenciarMetas: boolean;
  hrefMaoCompartilhada: (reviewId: string) => string;
}) {
  const maxDia = Math.max(1, ...atividade.map((d) => d.treinos + d.revisoes));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Frequência de estudo</h2>
        <p className="mt-1 text-sm text-muted">Treinos e revisões concluídas por dia.</p>

        <div className="mt-4 flex h-28 items-end gap-[3px]">
          {atividade.map((d) => {
            const total = d.treinos + d.revisoes;
            const alturaTreino = (d.treinos / maxDia) * 100;
            const alturaRevisao = (d.revisoes / maxDia) * 100;
            return (
              <div
                key={d.dia}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.treinos} treino(s), ${d.revisoes} revisão(ões)`}
              >
                {total === 0 ? (
                  <div className="h-[2px] w-full rounded-sm bg-hairline" />
                ) : (
                  <>
                    <div className="w-full rounded-t-sm bg-review" style={{ height: `${alturaRevisao}%` }} />
                    <div className="w-full rounded-b-sm bg-training" style={{ height: `${alturaTreino}%` }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-training" /> Treinos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-review" /> Revisões
          </span>
        </div>
      </div>

      <div className="border-t border-hairline pt-5">
        <MetasCard playerId={id} podeGerenciar={podeGerenciarMetas} />
      </div>

      <div className="border-t border-hairline pt-5">
        <h2 className="text-base font-semibold">Mãos enviadas para você</h2>
        {maos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma mão compartilhada até agora.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {maos.map((m) => (
              <li key={m.shareId}>
                <Link href={hrefMaoCompartilhada(m.reviewId)} className="flex items-center gap-3 py-3 transition-colors hover:text-ink">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.titulo}</p>
                    <p className="text-xs text-muted">
                      {new Date(m.compartilhadaEm).toLocaleDateString("pt-BR")}
                      {m.comentarios > 0 && ` · ${m.comentarios} comentário(s)`}
                    </p>
                  </div>
                  {!m.vistaEm ? (
                    <span className="rounded-full bg-evolution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void">
                      Nova
                    </span>
                  ) : m.comentarios === 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Eye size={12} /> vista
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-training">
                      <MessageSquare size={12} /> respondida
                    </span>
                  )}
                  <ChevronRight size={15} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Performance: as mesmas métricas do Player Evolution (/performance),
// em lista -- não a matriz 13x13 nem os gráficos completos (aquilo é
// análise do próprio jogador sobre o próprio jogo); aqui é o resumo que
// o coach precisa pra saber COMO esse jogador joga, não só o quanto.
// ------------------------------------------------------------
function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function AbaPerformance({ stats }: { stats: PlayerEvolutionStats | null }) {
  if (!stats || stats.hands === 0) {
    return (
      <p className="text-sm text-muted">
        Sem mãos com hand history estruturada no período selecionado — as métricas aparecem aqui assim que o jogador
        importar ou registrar mãos no Revisor.
      </p>
    );
  }

  const linhas: { label: string; valor: string; hint?: string }[] = [
    { label: "VPIP", valor: fmtPct(stats.vpipPct) },
    { label: "PFR", valor: fmtPct(stats.pfrPct) },
    { label: "3-Bet", valor: fmtPct(stats.threeBetPct) },
    { label: "Fold to 3-Bet", valor: fmtPct(stats.foldTo3betPct) },
    { label: "C-Bet Flop", valor: fmtPct(stats.cbetFlopPct) },
    { label: "Fold to C-Bet Flop", valor: fmtPct(stats.foldToCbetFlopPct) },
    { label: "Aggression Factor", valor: stats.aggressionFactor === null ? "—" : stats.aggressionFactor.toFixed(2) },
    { label: "Aggression Frequency", valor: fmtPct(stats.aggressionFrequencyPct) },
    { label: "WSD%", valor: fmtPct(stats.wsdPct), hint: "chegou ao showdown" },
    { label: "W$SD%", valor: fmtPct(stats.wsdWonPct), hint: "ganhou quando chegou" },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Estatísticas de jogo</h2>
        <span className="text-sm text-muted">
          {stats.hands} mão{stats.hands === 1 ? "" : "s"} etiquetada{stats.hands === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">Mesmas métricas do Player Evolution, calculadas só com as mãos deste jogador.</p>

      <ul className="mt-4 divide-y divide-hairline">
        {linhas.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="text-ink/85">
              {l.label}
              {l.hint && <span className="ml-1.5 text-xs text-muted">· {l.hint}</span>}
            </span>
            <span className="font-semibold tnum">{l.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
