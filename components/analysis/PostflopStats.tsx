"use client";

import { useMemo } from "react";
import { Flame, Target, CornerUpLeft, Repeat, Zap, Eye, Trophy } from "lucide-react";
import { Painel, StatList, HeroStrip, SubHeader, SampleBadge, toneFromRange, statBar } from "@/components/analysis/shared";
import { computePostflopMetrics, computeMetricTrend } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

function fmtRatio(v: number | null): string | null {
  return v === null ? null : v.toFixed(2);
}

// Segundo card da aba Preflop & Postflop — mesma faixa de destaque +
// lista do card de preflop, pra ficar visualmente um par.
export function PostflopTab({ rows, metrics }: { rows: AnalysisHandRow[]; metrics: PostflopMetrics }) {
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
    <Painel titulo="Tendências pós-flop" icone={<Flame size={14} className="text-training" />} action={<SampleBadge hands={metrics.hands} />}>
      <HeroStrip
        items={[
          {
            label: "Flop C-Bet %",
            value: fmtPct(metrics.cbet_flop_pct),
            tone: toneFromRange(metrics.cbet_flop_pct, 55, 75),
            trend: cbetFlopTrend,
            hint: "Frequência de apostar no flop quando você foi o último agressor no preflop.",
          },
          {
            label: "Fold to Flop C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_flop_pct),
            tone: toneFromRange(metrics.fold_to_cbet_flop_pct, 40, 55),
            trend: foldCbetFlopTrend,
            hint: "Frequência que você desiste diante de um c-bet de flop adversário.",
          },
          {
            label: "Aggression Factor",
            value: fmtRatio(metrics.aggression_factor),
            tone: toneFromRange(metrics.aggression_factor, 2, 4),
            trend: aggFactorTrend,
            hint: "(Bet + Raise) / Call pós-flop — quão agressivo você é quando participa da mão.",
          },
          {
            label: "Aggression Freq. %",
            value: fmtPct(metrics.aggression_frequency_pct),
            tone: toneFromRange(metrics.aggression_frequency_pct, 35, 50),
            trend: aggFreqTrend,
            hint: "% das suas ações pós-flop que são bet ou raise, em vez de call ou fold.",
          },
        ]}
      />

      <SubHeader>C-Bet & fold to c-bet</SubHeader>
      <StatList
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
      <StatList
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

      <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
        Cor e barra = faixa de referência comum pra 6-max/MTT (heurística de população, não output do motor GTO) — métrica
        sem barra é métrica sem consenso amplo, mostramos só o número. Passe o mouse sobre qualquer linha pra ver a
        definição. W$SD% usa o vencedor gravado da mão (um único nome) como aproximação — não cobre split pot com precisão
        de equity. Aggression Factor fica sem valor quando não há nenhum call registrado na amostra (denominador zero).
      </p>
    </Painel>
  );
}
