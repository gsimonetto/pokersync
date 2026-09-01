"use client";

import { useMemo } from "react";
import { Flame, Target, CornerUpLeft, Repeat, Zap, Eye, Trophy } from "lucide-react";
import {
  Painel,
  StatCardGrid,
  HeroStrip,
  HealthGauge,
  SubHeader,
  SampleBadge,
  ReferenceProfileBadge,
  CategoryLegend,
  toneFromRange,
  rangeCoaching,
  statBar,
} from "@/components/analysis/shared";
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
                "Quando você foi o último a apostar antes das primeiras 3 cartas da mesa, você quase não continua apostando depois delas. Está desistindo de uma vantagem que já tinha construído — o adversário pode não ter nada e vai desistir se você continuar apostando.",
                "Você continua apostando depois das primeiras 3 cartas da mesa com frequência alta demais, mesmo quando elas não ajudam sua mão. Isso fica fácil de perceber e o adversário passa a te desafiar de volta."
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
                "Você continua pagando quando o adversário aposta logo depois das primeiras 3 cartas da mesa com frequência alta demais. Desista mais quando essas cartas não ajudam a mão que você tinha.",
                "Você desiste demais quando o adversário aposta logo depois das primeiras 3 cartas da mesa. Isso é fácil de perceber, e o adversário passa a apostar mesmo sem ter nada, só porque sabe que você desiste."
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
                "Depois das primeiras cartas da mesa, você prefere só pagar em vez de apostar mais. Isso entrega o controle da mão pro adversário — com mão boa, aposte mais em vez de só acompanhar.",
                "Você aposta e sobe demais em relação a quanto só paga depois das primeiras cartas da mesa. Cuidado pra não virar alvo fácil de um contra-ataque forte."
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
                "A maioria das suas decisões depois das primeiras cartas da mesa são só pagar ou desistir. Procure mais chances de apostar ou subir em vez de só reagir ao que o adversário faz.",
                "Você aposta ou sobe demais em relação a quanto só observa ou desiste. Pode estar se expondo a um contra-ataque forte com muita frequência."
              ),
            },
          ]}
        />
      </div>

      <SubHeader>C-Bet & fold to c-bet</SubHeader>
      <div className="mb-2 flex justify-end">
        <CategoryLegend categories={["agressao", "defesa"]} />
      </div>
      <StatCardGrid
        items={[
          {
            label: "Turn C-Bet %",
            value: fmtPct(metrics.cbet_turn_pct),
            icon: Target,
            tone: toneFromRange(metrics.cbet_turn_pct, ref.cbetTurn.min, ref.cbetTurn.max),
            bar: statBar(metrics.cbet_turn_pct, ref.cbetTurn.min, ref.cbetTurn.max, 100),
            hint: "Frequência de apostar no turn quando você já tinha feito c-bet no flop.",
            category: "agressao",
          },
          {
            label: "River C-Bet %",
            value: fmtPct(metrics.cbet_river_pct),
            icon: Target,
            tone: toneFromRange(metrics.cbet_river_pct, ref.cbetRiver.min, ref.cbetRiver.max),
            bar: statBar(metrics.cbet_river_pct, ref.cbetRiver.min, ref.cbetRiver.max, 100),
            hint: "Frequência de apostar no river quando você já vinha apostando flop e turn.",
            category: "agressao",
          },
          {
            label: "Fold to Turn C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_turn_pct),
            icon: CornerUpLeft,
            tone: toneFromRange(metrics.fold_to_cbet_turn_pct, ref.foldToCbetTurn.min, ref.foldToCbetTurn.max),
            bar: statBar(metrics.fold_to_cbet_turn_pct, ref.foldToCbetTurn.min, ref.foldToCbetTurn.max, 100),
            hint: "Frequência que você desiste diante de um c-bet de turn adversário.",
            category: "defesa",
          },
          {
            label: "Fold to River C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_river_pct),
            icon: CornerUpLeft,
            tone: toneFromRange(metrics.fold_to_cbet_river_pct, ref.foldToCbetRiver.min, ref.foldToCbetRiver.max),
            bar: statBar(metrics.fold_to_cbet_river_pct, ref.foldToCbetRiver.min, ref.foldToCbetRiver.max, 100),
            hint: "Frequência que você desiste diante de um c-bet de river adversário.",
            category: "defesa",
          },
        ]}
      />

      <SubHeader>Check-raise, donk bet & showdown</SubHeader>
      <div className="mb-2 flex justify-end">
        <CategoryLegend categories={["agressao", "resultado"]} />
      </div>
      <StatCardGrid
        items={[
          {
            label: "Check-Raise Flop %",
            value: fmtPct(metrics.check_raise_flop_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no flop.",
            category: "agressao",
          },
          {
            label: "Check-Raise Turn %",
            value: fmtPct(metrics.check_raise_turn_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no turn.",
            category: "agressao",
          },
          {
            label: "Check-Raise River %",
            value: fmtPct(metrics.check_raise_river_pct),
            icon: Repeat,
            hint: "Frequência que você dá check e depois raise na mesma rua, no river.",
            category: "agressao",
          },
          {
            label: "Donk Bet %",
            value: fmtPct(metrics.donk_bet_pct),
            icon: Zap,
            tone: toneFromRange(metrics.donk_bet_pct, ref.donkBet.min, ref.donkBet.max),
            bar: statBar(metrics.donk_bet_pct, ref.donkBet.min, ref.donkBet.max, 20),
            hint: "Frequência que você aposta fora de posição sem ter sido o último agressor no preflop.",
            category: "agressao",
          },
          {
            label: "WSD %",
            value: fmtPct(metrics.wsd_pct),
            icon: Eye,
            hint: "Frequência que você chega ao showdown, entre as mãos em que você viu o flop.",
            category: "resultado",
          },
          {
            label: "W$SD %",
            value: fmtPct(metrics.wsd_won_pct),
            icon: Trophy,
            hint: "Frequência que você ganha o pote quando chega ao showdown.",
            category: "resultado",
          },
        ]}
      />
    </Painel>
  );
}
