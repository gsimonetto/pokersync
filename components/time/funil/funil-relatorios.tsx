"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Clock3, Database, Snowflake, TrendingUp, Users } from "lucide-react";
import { StatCardGrid } from "@/components/dashboard/kit";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fetchFunnelFlow, traduzErroFunil, type FunnelFlowRow, type FunnelPhase } from "@/lib/services/team-funnel-service";
import type { ItemFunil } from "@/components/time/funil/tipos";

// Relatórios do funil -- responde "como o time está andando" sem abrir
// cartão por cartão:
//   1) destaques (blocos de número): quem está pronto, esfriando, sem
//      próximo passo; quantos subiram no período e em quanto tempo;
//   2) fluxo por fase: barras horizontais de UMA cor (é comparação de
//      quantidade, não identidade -- a cor da fase fica só na bolinha),
//      cada barra com os números ao lado, que servem de tabela;
//   3) carga por coach.
// Destaques e carga saem do que a tela já carregou; o fluxo vem de
// team_funnel_flow (histórico de fases), com período próprio.

const PERIODOS = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
];

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

export function FunilRelatorios({
  fases,
  itens,
  semCard,
  coaches,
  onErro,
}: {
  fases: FunnelPhase[];
  /** Todos os cartões ativos, sem filtro -- relatório é do funil inteiro. */
  itens: ItemFunil[];
  semCard: number;
  coaches: { userId: string; nome: string }[];
  onErro: (s: string) => void;
}) {
  const [dias, setDias] = useState(90);
  const [fluxo, setFluxo] = useState<FunnelFlowRow[] | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    setFluxo(undefined);
    fetchFunnelFlow(dias)
      .then((f) => vivo && setFluxo(f))
      .catch((e) => {
        if (!vivo) return;
        onErro(traduzErroFunil(e));
        setFluxo(null);
      });
    return () => {
      vivo = false;
    };
  }, [dias, onErro]);

  const total = itens.length;
  const prontos = itens.filter((i) => i.prontidao.pronto).length;
  const esfriando = itens.filter((i) => i.temperatura !== "em_dia").length;
  const semPasso = itens.filter((i) => i.passo === "sem" || i.passo === "atrasado").length;
  // Sem a migração não existe próximo passo: "—", não "0" (zero diria "tudo em dia").
  const temPasso = itens.some((i) => i.passo !== null);

  const resumoFluxo = useMemo(() => {
    if (!fluxo) return null;
    const promovidos = fluxo.reduce((s, f) => s + f.promovidos, 0);
    const encerradas = fluxo.reduce((s, f) => s + f.promovidos + f.regressos + f.sairam, 0);
    const comTempo = fluxo.filter((f) => f.tempoMedioDias != null && f.entradas > 0);
    const pesos = comTempo.reduce((s, f) => s + f.entradas, 0);
    const tempoMedio = pesos > 0 ? comTempo.reduce((s, f) => s + (f.tempoMedioDias as number) * f.entradas, 0) / pesos : null;
    return { promovidos, encerradas, tempoMedio };
  }, [fluxo]);

  const porCoach = useMemo(
    () =>
      [...coaches, { userId: "~sem", nome: "Sem coach" }]
        .map((c) => {
          const meus = itens.filter((i) => (i.jogador?.coachId ?? "~sem") === c.userId);
          return {
            coach: c,
            total: meus.length,
            prontos: meus.filter((i) => i.prontidao.pronto).length,
            esfriando: meus.filter((i) => i.temperatura !== "em_dia").length,
            semPasso: meus.filter((i) => i.passo === "sem" || i.passo === "atrasado").length,
            tarefas: meus.reduce((s, i) => s + (i.checklist ? i.checklist.total - i.checklist.done : 0), 0),
          };
        })
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    [coaches, itens]
  );

  if (total === 0) {
    return (
      <section className="rounded-xl border border-hairline bg-surface p-6 text-center">
        <BarChart3 size={22} className="mx-auto text-muted" />
        <p className="mt-2 text-sm text-muted">Nenhum jogador no funil ainda — os relatórios aparecem assim que o primeiro cartão for criado.</p>
      </section>
    );
  }

  const maxAtivos = Math.max(1, ...fases.map((f) => fluxo?.find((x) => x.phaseId === f.id)?.ativos ?? itens.filter((i) => i.card.phaseId === f.id).length));

  return (
    <div className="painel-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pb-3">
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <Users size={13} />
        <b className="font-semibold tabular-nums text-ink">{total}</b> jogador{total === 1 ? "" : "es"} no funil
        {semCard > 0 && <span className="text-muted/70">· {semCard} do time ainda fora</span>}
      </p>
      {/* 5 blocos = uma linha cheia na grade de 5 colunas do painel. */}
      <StatCardGrid
        items={[
          { label: "Prontos pra subir", value: String(prontos), icon: ArrowUpRight, tone: prontos > 0 ? "bom" : undefined, hint: "Bateram todos os requisitos da fase — decisão do coach" },
          { label: "Esfriando ou parados", value: String(esfriando), icon: Snowflake, tone: esfriando > 0 ? "abaixo" : undefined, hint: "Passaram do prazo da fase sem mudar de fase" },
          {
            label: "Sem próximo passo",
            value: temPasso ? String(semPasso) : null,
            icon: AlertCircle,
            tone: temPasso && semPasso > 0 ? "abaixo" : undefined,
            hint: temPasso ? "Sem próximo passo marcado ou com o passo atrasado" : "Precisa da atualização do banco do funil",
          },
          {
            label: `Subiram (${dias}d)`,
            value: resumoFluxo ? String(resumoFluxo.promovidos) : null,
            icon: TrendingUp,
            hint: resumoFluxo ? `${pct(resumoFluxo.promovidos, resumoFluxo.encerradas)} das passagens encerradas no período terminaram em subida` : "Precisa da atualização do banco do funil",
          },
          {
            label: "Tempo médio por fase",
            value: resumoFluxo?.tempoMedio != null ? `${resumoFluxo.tempoMedio.toFixed(0)} dias` : null,
            icon: Clock3,
            hint: "Média ponderada pelo número de entradas em cada fase",
          },
        ]}
      />

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Fluxo por fase</h3>
            <p className="mt-0.5 text-[12px] text-muted">Quantos estão em cada fase hoje e o que aconteceu com quem passou por ela no período.</p>
          </div>
          <SegmentedControl value={dias} onChange={setDias} options={PERIODOS} />
        </div>

        {fluxo === null && (
          <p className="mb-3 flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[12px] text-muted">
            <Database size={13} className="shrink-0" />
            Entradas, subidas e tempo médio aparecem depois da atualização do banco do funil. A ocupação abaixo já é real.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="pb-2 text-left font-bold">Fase</th>
                <th scope="col" className="pb-2 text-left font-bold">Hoje</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Entradas na fase no período">Entraram</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Saíram para uma fase mais à frente">Subiram</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Voltaram para uma fase anterior">Voltaram</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Saíram do funil (arquivados)">Saíram</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Das passagens encerradas, quantas terminaram em subida">Taxa de subida</th>
                <th scope="col" className="pb-2 text-right font-bold" title="Tempo médio de permanência na fase">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {fases.map((f) => {
                const linha = fluxo?.find((x) => x.phaseId === f.id);
                const ativos = linha?.ativos ?? itens.filter((i) => i.card.phaseId === f.id).length;
                const encerradas = linha ? linha.promovidos + linha.regressos + linha.sairam : 0;
                const lotada = f.wipLimit != null && ativos > f.wipLimit;
                return (
                  <tr key={f.id} className="group">
                    <td className="border-t border-hairline/60 py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                        <span className="font-medium text-ink">{f.name}</span>
                      </span>
                    </td>
                    <td className="w-[34%] border-t border-hairline/60 py-2.5 pr-4">
                      {/* Barra: quantidade hoje. Uma cor só; número direto ao lado. */}
                      <span className="relative flex items-center gap-2">
                        <span className="h-2.5 flex-1 overflow-hidden rounded-r-[4px] bg-white/[0.04]">
                          <span
                            className="block h-full rounded-r-[4px] bg-white/55 transition-all group-hover:bg-white/75"
                            style={{ width: `${Math.max(ativos > 0 ? 3 : 0, (ativos / maxAtivos) * 100)}%` }}
                          />
                        </span>
                        <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${lotada ? "text-negative" : "text-ink"}`}>
                          {ativos}
                          {f.wipLimit != null && <span className="font-normal text-muted/70">/{f.wipLimit}</span>}
                        </span>
                        {/* Detalhe ao passar o mouse. */}
                        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 w-max max-w-[260px] rounded-lg border border-hairline bg-[#141414] px-3 py-2 text-[11.5px] leading-relaxed text-ink shadow-xl group-hover:block">
                          <b>{f.name}</b>: {ativos} jogador{ativos === 1 ? "" : "es"} hoje
                          {f.wipLimit != null && ` de ${f.wipLimit} de capacidade`}
                          {linha && (
                            <>
                              <br />
                              {linha.entradas} entrada{linha.entradas === 1 ? "" : "s"} em {dias} dias · {linha.promovidos} subi{linha.promovidos === 1 ? "u" : "ram"}
                            </>
                          )}
                          {lotada && (
                            <>
                              <br />
                              <span className="text-negative">Acima da capacidade</span>
                            </>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="border-t border-hairline/60 py-2.5 text-right tabular-nums text-ink/85">{linha ? linha.entradas : "—"}</td>
                    <td className="border-t border-hairline/60 py-2.5 text-right tabular-nums">
                      {linha ? (
                        <span className={linha.promovidos > 0 ? "inline-flex items-center gap-0.5 font-semibold text-positive" : "text-ink/85"}>
                          {linha.promovidos > 0 && <ArrowUpRight size={11} />}
                          {linha.promovidos}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="border-t border-hairline/60 py-2.5 text-right tabular-nums">
                      {linha ? (
                        <span className={linha.regressos > 0 ? "inline-flex items-center gap-0.5 text-[#f59e0b]" : "text-ink/85"}>
                          {linha.regressos > 0 && <ArrowDownRight size={11} />}
                          {linha.regressos}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="border-t border-hairline/60 py-2.5 text-right tabular-nums text-ink/85">{linha ? linha.sairam : "—"}</td>
                    <td className="border-t border-hairline/60 py-2.5 text-right font-semibold tabular-nums text-ink">{linha ? pct(linha.promovidos, encerradas) : "—"}</td>
                    <td className="border-t border-hairline/60 py-2.5 text-right tabular-nums text-ink/85">
                      {linha?.tempoMedioDias != null ? `${linha.tempoMedioDias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {fluxo === undefined && <p className="mt-2 text-[11.5px] text-muted">Carregando fluxo…</p>}
      </section>

      {porCoach.length > 0 && (
        <section className="rounded-xl border border-hairline bg-surface p-5">
          <h3 className="text-sm font-semibold">Carga por coach</h3>
          <p className="mt-0.5 text-[12px] text-muted">Onde a atenção do staff está faltando.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="pb-2 text-left font-bold">Coach</th>
                  <th scope="col" className="pb-2 text-right font-bold">Jogadores</th>
                  <th scope="col" className="pb-2 text-right font-bold">Prontos</th>
                  <th scope="col" className="pb-2 text-right font-bold">Esfriando</th>
                  <th scope="col" className="pb-2 text-right font-bold">Sem próximo passo</th>
                  <th scope="col" className="pb-2 text-right font-bold">Tarefas abertas</th>
                </tr>
              </thead>
              <tbody>
                {porCoach.map((c) => (
                  <tr key={c.coach.userId}>
                    <td className="border-t border-hairline/60 py-2 font-medium text-ink">{c.coach.nome}</td>
                    <td className="border-t border-hairline/60 py-2 text-right tabular-nums text-ink/85">{c.total}</td>
                    <td className={`border-t border-hairline/60 py-2 text-right tabular-nums ${c.prontos > 0 ? "font-semibold text-positive" : "text-muted"}`}>{c.prontos}</td>
                    <td className={`border-t border-hairline/60 py-2 text-right tabular-nums ${c.esfriando > 0 ? "font-semibold text-[#f59e0b]" : "text-muted"}`}>{c.esfriando}</td>
                    <td className={`border-t border-hairline/60 py-2 text-right tabular-nums ${temPasso && c.semPasso > 0 ? "font-semibold text-negative" : "text-muted"}`}>{temPasso ? c.semPasso : "—"}</td>
                    <td className="border-t border-hairline/60 py-2 text-right tabular-nums text-ink/85">{c.tarefas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
