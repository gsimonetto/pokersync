"use client";

import { useEffect, useState } from "react";
import { Flame, TriangleAlert, BookOpen, Target, Wallet, Gamepad2, Trophy, Send, Info, Kanban, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { GraficoFinanceiro } from "@/components/time/grafico-financeiro";
import { Kpi } from "@/components/time/kpi";
import { Avatar } from "@/components/avatar";
import { PeriodSelector } from "@/components/period-selector";
import {
  assignTeamDrill,
  diasSemAtividade,
  type FinancialDay,
  type PeriodComparison,
  type TeamActivityDay,
  type TeamDashboardRow,
  type TeamLeak,
} from "@/lib/services/team-service";
import { fetchPlayerCards, progressoPronto } from "@/lib/services/team-funnel-service";
import { BRL, variacao } from "@/lib/format";

// Visao geral do time. Hierarquia visual proposital:
// 1. KPIs (leitura de 2s) -> 2. graficos lado a lado (dinheiro e estudo,
// a relacao que o coach precisa enxergar) -> 3. leaks (acao).
// Dinheiro vem primeiro da esquerda porque e' a metrica de resultado;
// estudo a direita porque e' a metrica de causa.

const INATIVO_DIAS = 7;

export function TabVisaoGeral({
  jogadores,
  atividade,
  financeiro,
  leaks,
  comparacao,
  pronto,
  dias,
  periodos,
  onDiasChange,
  onAtribuido,
  onAbrirFunil,
}: {
  jogadores: TeamDashboardRow[];
  atividade: TeamActivityDay[];
  financeiro: FinancialDay[];
  leaks: TeamLeak[];
  comparacao: PeriodComparison | null;
  pronto: boolean;
  dias: number;
  periodos: { label: string; days: number }[];
  onDiasChange: (dias: number) => void;
  onAtribuido: () => void;
  onAbrirFunil: () => void;
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
      <div className="flex justify-end print:hidden">
        <PeriodSelector value={dias} onChange={onDiasChange} options={periodos} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 print:grid-cols-3">
        <Kpi d={0} pronto={pronto} icon={Wallet} label="Resultado no time" value={BRL.format(lucro)}
          hint="desde a entrada de cada um" tom={lucro > 0 ? "positivo" : lucro < 0 ? "negativo" : undefined} destaque />
        <Kpi d={40} pronto={pronto} icon={Gamepad2} label="Jogos" value={String(jogos)} hint="desde a entrada" />
        <Kpi d={80} pronto={pronto} icon={Target} label="Treinos no período" value={String(treinos)} tendencia={varTreinos} />
        <Kpi d={120} pronto={pronto} icon={Flame} label="Acerto GTO" value={acertoPct === null ? "—" : `${acertoPct}%`}
          hint={acertoPct === null ? "sem treinos" : undefined} tendencia={varAcerto} tendenciaSufixo="pp" />
        <Kpi d={160} pronto={pronto} icon={BookOpen} label="Mãos revisadas" value={String(revisadas)} tendencia={varRevisadas} />
        <Kpi d={200} pronto={pronto} icon={TriangleAlert} label="Precisam de atenção" value={String(inativos)}
          hint={`${jogadores.length - inativos} ativos`} tom={inativos > 0 ? "negativo" : undefined} />
      </section>

      <ResumoFunilMini onAbrirFunil={onAbrirFunil} />

      <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        <GraficoFinanceiro dados={financeiro} pronto={pronto} />
        <GraficoEstudo dados={atividade} pronto={pronto} />
      </section>

      <Leaderboard jogadores={jogadores} pronto={pronto} />

      <LeaksCard leaks={leaks} pronto={pronto} dias={dias} onAtribuido={onAtribuido} />
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
// Leaks do time com atribuicao em massa: quando um leak tem drill
// compativel (mesma regra do Revisor individual — nem todo leak tem),
// o coach manda o treino pra todos os jogadores afetados de uma vez,
// em vez de repetir "Treinar esse leak" jogador por jogador.
//
// Redesenho: severidade em selo de cor (Alta/Média/Baixa, calculada
// pela posição no ranking — mais claro que uma barra de progresso
// sem escala) + botão com rótulo explícito do que ele faz.
// ------------------------------------------------------------
function severidade(indice: number, total: number): { label: string; cor: string; bg: string } {
  const pct = total <= 1 ? 0 : indice / (total - 1);
  if (pct <= 0.33) return { label: "Alta", cor: "#F26D6D", bg: "rgba(242,109,109,0.14)" };
  if (pct <= 0.66) return { label: "Média", cor: "#F2B84C", bg: "rgba(242,184,76,0.14)" };
  return { label: "Baixa", cor: "#8b8b8b", bg: "rgba(139,139,139,0.14)" };
}

function LeaksCard({
  leaks,
  pronto,
  dias,
  onAtribuido,
}: {
  leaks: TeamLeak[];
  pronto: boolean;
  dias: number;
  onAtribuido: () => void;
}) {
  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function atribuir(l: TeamLeak) {
    if (!l.drillId) return;
    const chave = `${l.reasonCode}:${l.street}`;
    setAtribuindo(chave);
    try {
      const n = await assignTeamDrill(l.reasonCode, l.street, l.drillId, dias);
      setFeedback((prev) => ({
        ...prev,
        [chave]: n > 0 ? `Enviado para ${n} jogador${n === 1 ? "" : "es"}` : "Já estavam com esse treino recente",
      }));
      onAtribuido();
    } catch {
      setFeedback((prev) => ({ ...prev, [chave]: "Não foi possível atribuir" }));
    } finally {
      setAtribuindo(null);
    }
  }

  return (
    <section
      className={`rounded-xl border border-hairline bg-surface p-5 transition-all duration-500 print:break-inside-avoid ${
        pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Leaks mais frequentes</h2>
        <span className="flex items-center gap-1 text-xs text-muted" title="Baseado nas autoavaliações de rua feitas no Revisor de Mãos">
          <Info size={12} />
          avaliações de rua no Revisor
        </span>
      </div>
      {leaks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Ainda não há erros classificados neste período.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {leaks.map((l, i) => {
            const chave = `${l.reasonCode}:${l.street}`;
            const msg = feedback[chave];
            const sev = severidade(i, leaks.length);
            return (
              <li key={chave} className="flex items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                <span
                  className="shrink-0 rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: sev.cor, backgroundColor: sev.bg }}
                >
                  {sev.label}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{l.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted">{l.street}</span>
                  </div>
                  {l.drillTitle && !msg && (
                    <p className="mt-0.5 text-[11px] text-muted">→ {l.drillTitle}</p>
                  )}
                  {msg && <p className="mt-0.5 text-[11px] text-training">{msg}</p>}
                </div>

                <span className="shrink-0 text-xs text-muted tnum">
                  {l.total}× · {l.jogadores} jogador(es)
                </span>

                {l.treinavel && (
                  <button
                    onClick={() => atribuir(l)}
                    disabled={atribuindo === chave}
                    title="Envia o drill correspondente a este leak para todos os jogadores afetados"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-review/40 px-2.5 py-1.5 text-[11px] font-semibold text-review transition-colors hover:bg-review/10 disabled:opacity-50 print:hidden"
                  >
                    <Send size={12} />
                    {atribuindo === chave ? "Enviando…" : "Enviar treino ao time"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Leaderboard: reconhecimento entre jogadores, nao so vigilancia do
// coach. Ranking por XP do periodo (o que reflete esforco recente,
// nao nivel acumulado — um jogador novo pode liderar a semana).
// Empate de XP desempata por ofensiva. Top 3 ganham medalha de cor.
// ------------------------------------------------------------
const MEDALHA = ["#F2C94C", "#C0C0C0", "#CD7F32"];

function Leaderboard({ jogadores, pronto }: { jogadores: TeamDashboardRow[]; pronto: boolean }) {
  const ranking = [...jogadores]
    .filter((j) => j.xpPeriodo > 0)
    .sort((a, b) => b.xpPeriodo - a.xpPeriodo || (b.streakDays ?? 0) - (a.streakDays ?? 0))
    .slice(0, 8);

  return (
    <section
      className={`rounded-xl border border-hairline bg-surface p-5 transition-all duration-500 delay-100 print:break-inside-avoid ${
        pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <Trophy size={15} className="text-evolution" />
          Ranking do time
        </h2>
        <span className="text-xs text-muted">XP no período</span>
      </div>

      {ranking.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Ninguém pontuou XP neste período ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-hairline">
          {ranking.map((j, i) => (
            <li key={j.userId} className="flex items-center gap-3 py-2.5">
              <span
                className="w-5 shrink-0 text-center text-[13px] font-bold tnum"
                style={{ color: MEDALHA[i] ?? "var(--color-muted, #8b8b8b)" }}
              >
                {i + 1}
              </span>
              <Avatar id={j.avatarId} url={j.avatarUrl} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{j.nome}</span>
              {j.streakDays ? (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-evolution">
                  <Flame size={11} />
                  {j.streakDays}
                </span>
              ) : null}
              <span className="w-16 shrink-0 text-right text-[13px] font-semibold tnum text-evolution">
                {j.xpPeriodo} XP
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
