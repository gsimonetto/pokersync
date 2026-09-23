"use client";

import { Swords } from "lucide-react";
import { Linha, Numero, PainelCard } from "@/components/painel/painel-card";
import { InfoHover, type Explicacao } from "@/components/painel/info-hover";
import type { AnalysisHandRow, PostflopMetrics } from "@/types/analysis";

// Showdown e agressão pós-flop em números grandes, cada um com a
// explicação no hover e a base ("x de y") escrita embaixo. Sem faixa
// ideal: AF e AFq são contas padrão de mercado, mas a faixa "boa" muda
// com o formato e não temos fonte confiável pra ela.

type Bloco = { rotulo: string; valor: number | null; formatar: (n: number) => string; sufixo?: string; base: string; explicacao: Explicacao };

const pct1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ShowdownAgressao({ rows, metrics, ordem = 0 }: { rows: AnalysisHandRow[]; metrics: PostflopMetrics; ordem?: number }) {
  const viuFlop = rows.filter((r) => r.posflop?.viu.flop);
  const foi = viuFlop.filter((r) => r.wentToShowdown === true);
  const ganhou = foi.filter((r) => r.wonShowdown === true);
  const soma = (f: (r: AnalysisHandRow) => number | null) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
  const agressivas = soma((r) => r.postflopBetCount) + soma((r) => r.postflopRaiseCount);
  const calls = soma((r) => r.postflopCallCount);
  const folds = soma((r) => r.postflopFoldCount);

  const blocos: Bloco[] = [
    {
      rotulo: "Vai ao showdown",
      valor: metrics.wsd_pct,
      formatar: pct1,
      sufixo: "%",
      base: `${foi.length} de ${viuFlop.length} flops vistos`,
      explicacao: {
        titulo: "Vai ao showdown (WTSD)",
        oQueE: "Das mãos em que você viu o flop, em quantas chegou a mostrar as cartas no final. Alto = você paga muito até o fim; baixo = você desiste cedo.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Mãos que foram ao showdown ÷ mãos em que você viu o flop.",
      },
    },
    {
      rotulo: "Ganha no showdown",
      valor: metrics.wsd_won_pct,
      formatar: pct1,
      sufixo: "%",
      base: `${ganhou.length} de ${foi.length} showdowns`,
      explicacao: {
        titulo: "Ganha no showdown (W$SD)",
        oQueE: "Quando a mão vai até o fim e as cartas são mostradas, quantas vezes você leva o pote.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "Showdowns ganhos ÷ showdowns.",
      },
    },
    {
      rotulo: "Fator de agressão",
      valor: metrics.aggression_factor,
      formatar: dec2,
      base: `${agressivas} apostas/aumentos · ${calls} calls`,
      explicacao: {
        titulo: "Fator de agressão (AF)",
        oQueE: "Quantas vezes você aposta ou aumenta pra cada vez que só paga, depois do flop. 1 = tanto quanto paga; 3 = três vezes mais apostando do que pagando.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "(Apostas + aumentos) ÷ calls, somando flop, turn e river.",
      },
    },
    {
      rotulo: "Frequência de agressão",
      valor: metrics.aggression_frequency_pct,
      formatar: pct1,
      sufixo: "%",
      base: `${agressivas} de ${agressivas + calls + folds} decisões`,
      explicacao: {
        titulo: "Frequência de agressão (AFq)",
        oQueE: "De todas as suas decisões depois do flop em que dava pra apostar, pagar ou desistir, em quantas você foi agressivo. Checks ficam de fora.",
        origem: "Performance · suas mãos importadas",
        comoCalcula: "(Apostas + aumentos) ÷ (apostas + aumentos + calls + folds).",
      },
    },
  ];

  return (
    <PainelCard title="Showdown e agressão" icon={<Swords size={15} />} ordem={ordem} rolagem={false}>
      <ul className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
        {blocos.map((b) => (
          <li key={b.rotulo} className="min-w-0">
            <InfoHover explicacao={b.explicacao} className="h-full">
              <Linha className="flex h-full min-h-[118px] flex-col !p-3">
                <span className="text-[12px] leading-tight text-muted/80 underline decoration-dotted decoration-white/20 underline-offset-2">{b.rotulo}</span>
                <span className="flex flex-1 flex-col items-center justify-center text-center">
                  <span className="tnum flex items-baseline text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
                    {b.valor == null ? "—" : <Numero valor={b.valor} formatar={b.formatar} />}
                    {b.valor != null && b.sufixo && <span className="ml-0.5 text-[0.55em] font-semibold text-muted/70">{b.sufixo}</span>}
                  </span>
                  <span className="mt-1.5 max-w-full truncate text-[11px] tabular-nums text-muted/70">{b.base}</span>
                </span>
              </Linha>
            </InfoHover>
          </li>
        ))}
      </ul>
    </PainelCard>
  );
}
