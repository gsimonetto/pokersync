"use client";

import { useMemo } from "react";
import { Flame, Target, CornerUpLeft, Repeat, Zap, TrendingUp, Eye, Trophy } from "lucide-react";
import { Painel, StatList, SubHeader, SampleBadge, toneFromRange, statBar } from "@/components/analysis/shared";
import { computePostflopMetrics, computeMetricTrend } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

function fmtRatio(v: number | null): string | null {
  return v === null ? null : v.toFixed(2);
}

// Segundo card da aba Preflop & Postflop — mesma leitura em lista do card
// de preflop, pra ficar visualmente um par (não duas linguagens
// diferentes na mesma tela).
export function PostflopTab({ rows, metrics }: { rows: AnalysisHandRow[]; metrics: PostflopMetrics }) {
  // Só o headliner (Flop C-Bet%) ganha tendência aqui — mesmo critério de
  // "não virar gráfico" do card de preflop.
  const cbetFlopTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePostflopMetrics(chunk).cbet_flop_pct), [rows]);

  return (
    <Painel titulo="Tendências pós-flop" icone={<Flame size={14} className="text-training" />} action={<SampleBadge hands={metrics.hands} />}>
      <SubHeader>C-Bet & fold to c-bet</SubHeader>
      <StatList
        items={[
          {
            label: "Flop C-Bet %",
            value: fmtPct(metrics.cbet_flop_pct),
            icon: Target,
            tone: toneFromRange(metrics.cbet_flop_pct, 55, 75),
            bar: statBar(metrics.cbet_flop_pct, 55, 75, 100),
            trend: cbetFlopTrend,
            hint: "Frequência de apostar no flop quando você foi o último agressor no preflop.",
          },
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
            label: "Fold to Flop C-Bet %",
            value: fmtPct(metrics.fold_to_cbet_flop_pct),
            icon: CornerUpLeft,
            tone: toneFromRange(metrics.fold_to_cbet_flop_pct, 40, 55),
            bar: statBar(metrics.fold_to_cbet_flop_pct, 40, 55, 100),
            hint: "Frequência que você desiste diante de um c-bet de flop adversário.",
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

      <SubHeader>Check-raise & donk bet</SubHeader>
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
        ]}
      />

      <SubHeader>Agressão & showdown</SubHeader>
      <StatList
        items={[
          {
            label: "Aggression Factor",
            value: fmtRatio(metrics.aggression_factor),
            icon: TrendingUp,
            tone: toneFromRange(metrics.aggression_factor, 2, 4),
            bar: statBar(metrics.aggression_factor, 2, 4, 8),
            hint: "(Bet + Raise) / Call pós-flop — quão agressivo você é quando participa da mão.",
          },
          {
            label: "Aggression Frequency %",
            value: fmtPct(metrics.aggression_frequency_pct),
            icon: TrendingUp,
            tone: toneFromRange(metrics.aggression_frequency_pct, 35, 50),
            bar: statBar(metrics.aggression_frequency_pct, 35, 50, 100),
            hint: "% das suas ações pós-flop que são bet ou raise, em vez de call ou fold.",
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
