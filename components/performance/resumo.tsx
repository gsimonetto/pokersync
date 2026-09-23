"use client";

import { motion } from "framer-motion";
import { Percent, Repeat, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { EASE, Linha, Numero, PainelCard } from "@/components/painel/painel-card";
import { InfoHover, type Explicacao } from "@/components/painel/info-hover";
import { computePreflopMetrics } from "@/lib/services/analysis-service";
import type { Session } from "@/lib/bankroll/types";
import type { AnalysisHandRow, PreflopMetrics, TournamentMetrics } from "@/types/analysis";
import { PerfilJogo } from "./perfil-jogo";
import { AMOSTRA_MINIMA_MAOS, COR_NEGATIVO, COR_POSITIVO, SeloAmostra } from "./graficos/base";
import { invested, net, torneiosNumaMoeda } from "./graficos/torneios";

// Resumo no topo da Performance, no MESMO padrão do card "Seus
// indicadores" da tela inicial: pentágono do Perfil de jogo à esquerda
// (o Score fica só na tela inicial) e os números que um grinder olha
// primeiro à direita -- VPIP, PFR, 3-Bet (das mãos, respeitando os
// filtros) e ROI de torneio.
//
// Sem "faixa ideal": não temos fonte validada pra essas faixas, então o
// número fica neutro (sem cor de bom/ruim). No lugar, a direção: quanto
// mudou nos últimos 30 dias contra os 30 dias antes -- só aparece quando
// as duas janelas têm amostra suficiente.

const DIA = 86_400_000;
const MIN_JANELA_MAOS = 30;
const MIN_JANELA_CHANCES = 10;
const MIN_JANELA_TORNEIOS = 5;

type Variacao = { delta: number; agora: number; antes: number; unidade: string } | null;

type Kpi = {
  rotulo: string;
  icone: LucideIcon;
  valor: number | null;
  formatar: (n: number) => string;
  sufixo?: string;
  cor: string;
  detalhe: string;
  amostra?: number;
  variacao: Variacao;
  explicacao: Explicacao;
};

const pct1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Divide as mãos em "últimos 30 dias" e "30 dias antes disso", contando a
// partir da mão mais recente (não de hoje: quem ficou uma semana sem jogar
// ainda vê a comparação).
function janelas<T>(itens: T[], data: (x: T) => number): [T[], T[]] {
  if (itens.length === 0) return [[], []];
  const fim = Math.max(...itens.map(data));
  const corte = fim - 30 * DIA;
  const inicio = corte - 30 * DIA;
  return [itens.filter((x) => data(x) > corte), itens.filter((x) => data(x) > inicio && data(x) <= corte)];
}

function variacaoPreflop(rows: AnalysisHandRow[]): Record<"vpip" | "pfr" | "tresBet", Variacao> {
  const [agora, antes] = janelas(rows, (r) => new Date(r.playedAt).getTime());
  const a = computePreflopMetrics(agora);
  const b = computePreflopMetrics(antes);
  const chances = (xs: AnalysisHandRow[]) => xs.filter((r) => r.threeBetOpportunity === true).length;
  const par = (x: number | null, y: number | null, ok: boolean): Variacao =>
    ok && x != null && y != null ? { delta: x - y, agora: x, antes: y, unidade: "pts" } : null;
  const maosOk = agora.length >= MIN_JANELA_MAOS && antes.length >= MIN_JANELA_MAOS;
  return {
    vpip: par(a.vpip_pct, b.vpip_pct, maosOk),
    pfr: par(a.pfr_pct, b.pfr_pct, maosOk),
    tresBet: par(a.three_bet_pct, b.three_bet_pct, chances(agora) >= MIN_JANELA_CHANCES && chances(antes) >= MIN_JANELA_CHANCES),
  };
}

function variacaoRoi(sessoes: Session[]): Variacao {
  const { lista } = torneiosNumaMoeda(sessoes);
  const [agora, antes] = janelas(lista, (s) => new Date(s.date).getTime());
  if (agora.length < MIN_JANELA_TORNEIOS || antes.length < MIN_JANELA_TORNEIOS) return null;
  const roi = (xs: Session[]) => {
    const inv = xs.reduce((t, s) => t + invested(s), 0);
    return inv > 0 ? (xs.reduce((t, s) => t + net(s), 0) / inv) * 100 : null;
  };
  const x = roi(agora);
  const y = roi(antes);
  return x != null && y != null ? { delta: x - y, agora: x, antes: y, unidade: "pts" } : null;
}

export function ResumoPerformance({
  rows,
  preflop,
  tournament,
  sessoes,
  ordem = 0,
}: {
  rows: AnalysisHandRow[];
  preflop: PreflopMetrics;
  tournament: TournamentMetrics | null;
  /** Sessões da Gestão de Banca (variação do ROI em 30 dias). */
  sessoes: Session[];
  ordem?: number;
}) {
  const v = variacaoPreflop(rows);
  const chances3bet = rows.filter((r) => r.threeBetOpportunity === true).length;

  const kpis: Kpi[] = [
    {
      rotulo: "VPIP",
      icone: Target,
      valor: preflop.vpip_pct,
      formatar: pct1,
      sufixo: "%",
      cor: "#ffffff",
      detalhe: "entra no pote",
      amostra: preflop.hands,
      variacao: v.vpip,
      explicacao: {
        titulo: "VPIP",
        oQueE: "Em quantas mãos você colocou dinheiro no pote por vontade própria (call ou raise antes do flop). Mais alto = jogo mais solto.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Mãos em que você deu call ou raise voluntário ÷ mãos jogadas. Respeita os filtros ativos.",
      },
    },
    {
      rotulo: "PFR",
      icone: TrendingUp,
      valor: preflop.pfr_pct,
      formatar: pct1,
      sufixo: "%",
      cor: "#ffffff",
      detalhe: "aumenta antes do flop",
      amostra: preflop.hands,
      variacao: v.pfr,
      explicacao: {
        titulo: "PFR",
        oQueE: "Em quantas mãos você aumentou antes do flop. Perto do VPIP = jogo agressivo; muito abaixo = você entra muito só de call.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Mãos com raise antes do flop ÷ mãos jogadas. Respeita os filtros ativos.",
      },
    },
    {
      rotulo: "3-Bet",
      icone: Repeat,
      valor: preflop.three_bet_pct,
      formatar: pct1,
      sufixo: "%",
      cor: "#ffffff",
      detalhe: `${chances3bet.toLocaleString("pt-BR")} chances`,
      amostra: preflop.hands,
      variacao: v.tresBet,
      explicacao: {
        titulo: "3-Bet",
        oQueE: "Das vezes em que alguém já tinha aberto o pote antes de você, quantas você re-aumentou.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Re-aumentos ÷ vezes em que havia exatamente 1 raise na mesa na sua vez (com ou sem calls no meio). Respeita os filtros ativos.",
      },
    },
    {
      rotulo: "ROI torneios",
      icone: Percent,
      valor: tournament?.roi_pct ?? null,
      formatar: (n) => `${n > 0 ? "+" : ""}${pct1(n)}`,
      sufixo: "%",
      // Aqui a cor é o sinal do resultado (lucro/prejuízo), não uma faixa.
      cor:
        tournament?.roi_pct == null ? "#ffffff" : tournament.roi_pct > 0 ? COR_POSITIVO : tournament.roi_pct < 0 ? COR_NEGATIVO : "#ffffff",
      detalhe: tournament ? `${tournament.total_games.toLocaleString("pt-BR")} torneios` : "sem torneios",
      variacao: variacaoRoi(sessoes),
      explicacao: {
        titulo: "ROI de torneios",
        oQueE: "Quanto voltou de lucro pra cada real investido em buy-ins de torneio.",
        origem: "Gestão de Banca · sessões de torneio",
        comoCalcula: "Lucro total ÷ total investido (buy-ins e reentradas). Segue o filtro de buy-in da aba Estatísticas.",
      },
    },
  ];

  return (
    <PainelCard title="Seu resumo" icon={<Target size={15} />} ordem={ordem} rolagem={false}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)]">
        <Linha className="flex min-h-[250px] !p-2.5 md:min-h-[270px]">
          <PerfilJogo rows={rows} preflop={preflop} />
        </Linha>
        <ul className="grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-4">
          {kpis.map((k, i) => {
            const Icone = k.icone;
            const pequena = k.amostra != null && k.amostra < AMOSTRA_MINIMA_MAOS;
            const t = k.valor;
            const va = k.variacao;
            const explicacao: Explicacao = va
              ? {
                  ...k.explicacao,
                  itens: [
                    { rotulo: "Últimos 30 dias", valor: `${pct1(va.agora)}%` },
                    { rotulo: "30 dias antes", valor: `${pct1(va.antes)}%` },
                  ],
                }
              : k.explicacao;
            return (
              <motion.li
                key={k.rotulo}
                className="min-w-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.3 + i * 0.06 }}
              >
                <InfoHover explicacao={explicacao} className="h-full">
                  <Linha className={`flex h-full min-h-[132px] min-w-0 flex-col !p-3 ${pequena ? "opacity-80" : ""}`}>
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-[12px] leading-tight text-muted/80">{k.rotulo}</span>
                      <Icone size={15} className="shrink-0 text-muted" aria-hidden />
                    </span>
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-1.5 text-center">
                      <p
                        className="tnum flex max-w-full items-baseline justify-center truncate text-[30px] font-bold leading-none tracking-[-0.02em]"
                        style={{ color: k.cor }}
                      >
                        {t == null ? "—" : <Numero valor={t} formatar={k.formatar} />}
                        {t != null && k.sufixo && (
                          <span className="ml-0.5 text-[0.55em] font-semibold tracking-normal text-muted/70">{k.sufixo}</span>
                        )}
                      </p>
                      {/* Direção em 30 dias: seta + pontos, cor neutra (subir
                          não é bom nem ruim sem uma referência validada). */}
                      {va && Math.abs(va.delta) >= 0.05 ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold tabular-nums text-ink/85">
                          <span aria-hidden>{va.delta > 0 ? "↑" : "↓"}</span>
                          {pct1(Math.abs(va.delta))} {va.unidade}
                          <span className="font-normal text-muted/70">em 30 dias</span>
                        </p>
                      ) : va ? (
                        <p className="mt-1.5 text-[11px] text-muted/70">estável em 30 dias</p>
                      ) : null}
                      <p className="mt-1 max-w-full truncate text-[11px] leading-tight text-muted/70">{k.detalhe}</p>
                    </div>
                    {k.amostra != null && (
                      <div className="mt-2 flex justify-center">
                        <SeloAmostra n={k.amostra} />
                      </div>
                    )}
                  </Linha>
                </InfoHover>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </PainelCard>
  );
}
