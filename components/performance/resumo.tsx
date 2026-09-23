"use client";

import { motion } from "framer-motion";
import { Percent, Repeat, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { toneFromRange, type Tone } from "@/components/dashboard/kit";
import { EASE, Linha, Numero, PainelCard } from "@/components/painel/painel-card";
import { InfoHover, type Explicacao } from "@/components/painel/info-hover";
import { PREFLOP_REFERENCE } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PreflopMetrics, ReferenceProfile, TournamentMetrics } from "@/types/analysis";
import { PerfilJogo } from "./perfil-jogo";
import { AMOSTRA_MINIMA_MAOS, COR_NEGATIVO, COR_POSITIVO, SeloAmostra } from "./graficos/base";

// Resumo no topo da Performance, no MESMO padrão do card "Seus
// indicadores" da tela inicial: pentágono do Perfil de jogo à esquerda
// (o Score fica só na tela inicial) e os
// números que um grinder olha primeiro à direita -- VPIP, PFR, 3-Bet
// (das mãos, respeitando os filtros) e ROI de torneio. Número grande,
// negrito, centralizado; cor pelo que ele SIGNIFICA (dentro da faixa
// ideal = verde, abaixo = âmbar, acima = vermelho).

const COR_TOM: Record<Tone, string> = { bom: COR_POSITIVO, abaixo: "#f59e0b", acima: COR_NEGATIVO };
const TEXTO_TOM: Record<Tone, string> = { bom: "na faixa ideal", abaixo: "abaixo da faixa", acima: "acima da faixa" };

type Kpi = {
  rotulo: string;
  icone: LucideIcon;
  valor: number | null;
  formatar: (n: number) => string;
  sufixo?: string;
  cor: string;
  /** Dentro/abaixo/acima da faixa ideal (escrito embaixo do número). */
  tom?: Tone;
  detalhe: string;
  amostra?: number;
  explicacao: Explicacao;
};

const pct1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ResumoPerformance({
  rows,
  preflop,
  referenceProfile,
  tournament,
  ordem = 0,
}: {
  rows: AnalysisHandRow[];
  preflop: PreflopMetrics;
  referenceProfile: ReferenceProfile;
  tournament: TournamentMetrics | null;
  ordem?: number;
}) {
  const ref = PREFLOP_REFERENCE[referenceProfile];
  const faixa = (r: { min: number; max: number }) => `faixa ideal ${r.min}–${r.max}%`;
  const tom = (v: number | null, r: { min: number; max: number }) => toneFromRange(v, r.min, r.max);
  const corTom = (t: Tone | undefined) => (t ? COR_TOM[t] : "#ffffff");
  const perfil = referenceProfile === "cash6max" ? "cash 6-max" : "torneio (mesa cheia)";

  const kpis: Kpi[] = [
    {
      rotulo: "VPIP",
      icone: Target,
      valor: preflop.vpip_pct,
      formatar: pct1,
      sufixo: "%",
      tom: tom(preflop.vpip_pct, ref.vpip),
      cor: corTom(tom(preflop.vpip_pct, ref.vpip)),
      detalhe: faixa(ref.vpip),
      amostra: preflop.hands,
      explicacao: {
        titulo: "VPIP",
        oQueE: `Em quantas mãos você colocou dinheiro no pote por vontade própria (call ou raise antes do flop). Referência de ${perfil}: ${ref.vpip.min}–${ref.vpip.max}%.`,
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
      tom: tom(preflop.pfr_pct, ref.pfr),
      cor: corTom(tom(preflop.pfr_pct, ref.pfr)),
      detalhe: faixa(ref.pfr),
      amostra: preflop.hands,
      explicacao: {
        titulo: "PFR",
        oQueE: `Em quantas mãos você aumentou antes do flop. Perto do VPIP = jogo agressivo; muito abaixo = você entra muito só de call. Referência de ${perfil}: ${ref.pfr.min}–${ref.pfr.max}%.`,
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
      tom: tom(preflop.three_bet_pct, ref.threeBet),
      cor: corTom(tom(preflop.three_bet_pct, ref.threeBet)),
      detalhe: faixa(ref.threeBet),
      amostra: preflop.hands,
      explicacao: {
        titulo: "3-Bet",
        oQueE: `Quantas vezes você re-aumentou quando alguém já tinha aberto o pote. Referência de ${perfil}: ${ref.threeBet.min}–${ref.threeBet.max}%.`,
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Mãos em que você deu 3-bet ÷ mãos jogadas. Respeita os filtros ativos.",
      },
    },
    {
      rotulo: "ROI torneios",
      icone: Percent,
      valor: tournament?.roi_pct ?? null,
      formatar: (n) => `${n > 0 ? "+" : ""}${pct1(n)}`,
      sufixo: "%",
      cor:
        tournament?.roi_pct == null ? "#ffffff" : tournament.roi_pct > 0 ? COR_POSITIVO : tournament.roi_pct < 0 ? COR_NEGATIVO : "#ffffff",
      detalhe: tournament ? `${tournament.total_games.toLocaleString("pt-BR")} torneios` : "sem torneios",
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
            return (
              <motion.li
                key={k.rotulo}
                className="min-w-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.3 + i * 0.06 }}
              >
                <InfoHover explicacao={k.explicacao} className="h-full">
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
                      {/* Dentro/fora da faixa escrito, não só na cor. */}
                      {t != null && k.tom && (
                        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: k.cor }}>
                          {TEXTO_TOM[k.tom]}
                        </p>
                      )}
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
