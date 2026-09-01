"use client";

import { useMemo } from "react";
import { Flame, Target, CornerUpLeft, Repeat, Zap, Eye, Trophy } from "lucide-react";
import { Painel, StatCardGrid, HeroStrip, HealthGauge, SubHeader, SampleBadge, ReferenceProfileBadge, toneFromRange, rangeCoaching, statBar } from "@/components/analysis/shared";
import { computePostflopMetrics, computeMetricTrend, POSTFLOP_REFERENCE } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PostflopMetrics, ReferenceProfile } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

function fmtRatio(v: number | null): string | null {
  return v === null ? null : v.toFixed(2);
}

// Segundo card da aba Preflop & Postflop — mesma faixa de destaque +
// lista do card de preflop, pra ficar visualmente um par.
export function PostflopTab({
  rows,
  metrics,
  referenceProfile,
}: {
  rows: AnalysisHandRow[];
  metrics: PostflopMetrics;
  referenceProfile: ReferenceProfile;
}) {
  const ref = POSTFLOP_REFERENCE[referenceProfile];
  // Tendência dos 4 headliners (faixa de destaque) — mesmo critério de
  // "não virar gráfico" do card de preflop.
  const cbetFlopTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePostflopMetrics(chunk).cbet_flop_pct), [rows]);
  const foldCbetFlopTrend = useMemo(
    () => computeMetricTrend(rows, (chunk) => computePostflopMetrics(chunk).fold_to_cbet_flop_pct),
    [rows]
  );
  const aggFactorTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePostflopMetrics(chunk).aggression_factor), [rows]);
  const aggFreqTrend = useMemo(
    () => computeMetricTrend(rows, (chunk) => computePostflopMetrics(chunk).aggression_frequency_pct),
    [rows]
  );

  return (
    <Painel
      titulo="Tendências pós-flop"
      icone={<Flame size={14} className="icon-glow text-training" />}
      action={
        <div className="flex items-center gap-2">
          <ReferenceProfileBadge profile={referenceProfile} />
          <SampleBadge hands={metrics.hands} />
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        <HealthGauge
          items={[
            { value: metrics.cbet_flop_pct, min: ref.cbetFlop.min, max: ref.cbetFlop.max },
            { value: metrics.fold_to_cbet_flop_pct, min: ref.foldToCbetFlop.min, max: ref.foldToCbetFlop.max },
            { value: metrics.aggression_factor, min: ref.aggFactor.min, max: ref.aggFactor.max },
            { value: metrics.aggression_frequency_pct, min: ref.aggFreq.min, max: ref.aggFreq.max },
          ]}
        />
        <HeroStrip
          items={[
            {
              label: "Flop C-Bet %",
              value: fmtPct(metrics.cbet_flop_pct),
              tone: toneFromRange(metrics.cbet_flop_pct, ref.cbetFlop.min, ref.cbetFlop.max),
              trend: cbetFlopTrend,
              bar: statBar(metrics.cbet_flop_pct, ref.cbetFlop.min, ref.cbetFlop.max, 100),
              hint: "Frequência de apostar no flop quando você foi o último agressor no preflop.",
              coaching: rangeCoaching(
                metrics.cbet_flop_pct,
                ref.cbetFlop.min,
                ref.cbetFlop.max,
                "Flop C-Bet % abaixo da faixa — você está deixando fold equity na mesa como agressor pré-flop. Aposte mais no flop quando chegou como último agressor.",
                "Flop C-Bet % acima da faixa — apostar sem seletividade abre espaço pra check-raise e float. Reveja c-bets em boards ruins pro seu range."
              ),
            },
            {
              label: "Fold to Flop C-Bet %",
              value: fmtPct(metrics.fold_to_cbet_flop_pct),
              tone: toneFromRange(metrics.fold_to_cbet_flop_pct, ref.foldToCbetFlop.min, ref.foldToCbetFlop.max),
              trend: foldCbetFlopTrend,
              bar: statBar(metrics.fold_to_cbet_flop_pct, ref.foldToCbetFlop.min, ref.foldToCbetFlop.max, 100),
              hint: "Frequência que você desiste diante de um c-bet de flop adversário.",
              coaching: rangeCoaching(
                metrics.fold_to_cbet_flop_pct,
                ref.foldToCbetFlop.min,
                ref.foldToCbetFlop.max,
                "Fold to Flop C-Bet % abaixo da faixa — você está pagando c-bets demais. Considere desistir mais em boards que não favorecem seu range.",
                "Fold to Flop C-Bet % acima da faixa — você desiste demais contra c-bet. Pode estar sendo explorado por barrels leves."
              ),
            },
            {
              label: "Aggression Factor",
              value: fmtRatio(metrics.aggression_factor),
              tone: toneFromRange(metrics.aggression_factor, ref.aggFactor.min, ref.aggFactor.max),
              trend: aggFactorTrend,
              bar: statBar(metrics.aggression_factor, ref.aggFactor.min, ref.aggFactor.max, 8, ""),
              hint: "(Bet + Raise) / Call pós-flop — quão agressivo você é quando participa da mão.",
              coaching: rangeCoaching(
                metrics.aggression_factor,
                ref.aggFactor.min,
                ref.aggFactor.max,
                "Aggression Factor abaixo da faixa — você está mais passivo (call) que agressivo (bet/raise) pós-flop. Converta mais calls em raises com mãos fortes.",
                "Aggression Factor acima da faixa — você está muito agressivo em relação a quanto paga. Cuidado pra não virar alvo de check-raise."
              ),
            },
            {
              label: "Aggression Freq. %",
              value: fmtPct(metrics.aggression_frequency_pct),
              tone: toneFromRange(metrics.aggression_frequency_pct, ref.aggFreq.min, ref.aggFreq.max),
              trend: aggFreqTrend,
              bar: statBar(metrics.aggression_frequency_pct, ref.aggFreq.min, ref.aggFreq.max, 100),
              hint: "% das suas ações pós-flop que são bet ou raise, em vez de call ou fold.",
              coaching: rangeCoaching(
                metrics.aggression_frequency_pct,
                ref.aggFreq.min,
                ref.aggFreq.max,
                "Aggression Freq. % abaixo da faixa — a maioria das suas ações pós-flop são call/fold. Busque mais spots pra apostar/subir em vez de só acompanhar.",
                "Aggression Freq. % acima da faixa — você aposta/sobe demais em relação a quanto dá check/desiste. Pode estar se expondo a check-raise."
              ),
            },
          ]}
        />
      </div>

      <SubHeader>C-Bet & fold to c-bet</SubHeader>
      <StatCardGrid
        items={[
          {
            label: "Turn C-Bet %",
            value: fmtPct(metrics.cbet_turn_pct),
            icon: Target,
            hint: "Frequência de apostar no turn quando você já tinha feito c-bet no flop.",
          },
          {
            label: "River C-Bet %",
            value: fmtPct(metrics.cbet_river_pct),
            icon: Target,
            hint: "Frequência de apostar no river quando você já vinha apostando flop e turn.",
          },
          {
            label: "Fold to Turn C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_turn_pct),
            icon: CornerUpLeft,
            hint: "Frequência que você desiste diante de um c-bet de turn adversário.",
          },
          {
            label: "Fold to River C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_river_pct),
            icon: CornerUpLeft,
            hint: "Frequência que você desiste diante de um c-bet de river adversário.",
          },
        ]}
      />

      <SubHeader>Check-raise, donk bet & showdown</SubHeader>
      <StatCardGrid
        items={[
          {
            label: "Check-Raise Flop %",
            value: fmtPct(metrics.check_raise_flop_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no flop.",
          },
          {
            label: "Check-Raise Turn %",
            value: fmtPct(metrics.check_raise_turn_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no turn.",
          },
          {
            label: "Check-Raise River %",
            value: fmtPct(metrics.check_raise_river_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no river.",
          },
          {
            label: "Donk Bet %",
            value: fmtPct(metrics.donk_bet_pct),
            icon: Zap,
            hint: "Frequência que você aposta fora de posição sem ter sido o último agressor no preflop.",
          },
          {
            label: "WSD %",
            value: fmtPct(metrics.wsd_pct),
            icon: Eye,
            hint: "Frequência que você chega ao showdown, entre as mãos em que você viu o flop.",
          },
          {
            label: "W$SD %",
            value: fmtPct(metrics.wsd_won_pct),
            icon: Trophy,
            hint: "Frequência que você ganha o pote quando chega ao showdown.",
          },
        ]}
      />
    </Painel>
  );
}
