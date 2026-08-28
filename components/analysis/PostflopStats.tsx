"use client";

import { Flame, Target, CornerUpLeft, Repeat, Zap, TrendingUp, Eye, Trophy } from "lucide-react";
import { Painel, StatList, SubHeader, SampleBadge } from "@/components/analysis/shared";
import type { PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

function fmtRatio(v: number | null): string | null {
  return v === null ? null : v.toFixed(2);
}

// Segundo card da aba Preflop & Postflop — mesma leitura em lista do card
// de preflop, pra ficar visualmente um par (não duas linguagens
// diferentes na mesma tela).
export function PostflopTab({ metrics }: { metrics: PostflopMetrics }) {
  return (
    <Painel titulo="Tendências pós-flop" icone={<Flame size={14} className="text-training" />} action={<SampleBadge hands={metrics.hands} />}>
      <SubHeader>C-Bet & fold to c-bet</SubHeader>
      <StatList
        items={[
          { label: "Flop C-Bet %", value: fmtPct(metrics.cbet_flop_pct), icon: Target },
          { label: "Turn C-Bet %", value: fmtPct(metrics.cbet_turn_pct), icon: Target },
          { label: "River C-Bet %", value: fmtPct(metrics.cbet_river_pct), icon: Target },
          { label: "Fold to Flop C-Bet %", value: fmtPct(metrics.fold_to_cbet_flop_pct), icon: CornerUpLeft },
          { label: "Fold to Turn C-Bet %", value: fmtPct(metrics.fold_to_cbet_turn_pct), icon: CornerUpLeft },
          { label: "Fold to River C-Bet %", value: fmtPct(metrics.fold_to_cbet_river_pct), icon: CornerUpLeft },
        ]}
      />

      <SubHeader>Check-raise & donk bet</SubHeader>
      <StatList
        items={[
          { label: "Check-Raise Flop %", value: fmtPct(metrics.check_raise_flop_pct), icon: Repeat },
          { label: "Check-Raise Turn %", value: fmtPct(metrics.check_raise_turn_pct), icon: Repeat },
          { label: "Check-Raise River %", value: fmtPct(metrics.check_raise_river_pct), icon: Repeat },
          { label: "Donk Bet %", value: fmtPct(metrics.donk_bet_pct), icon: Zap },
        ]}
      />

      <SubHeader>Agressão & showdown</SubHeader>
      <StatList
        items={[
          { label: "Aggression Factor", value: fmtRatio(metrics.aggression_factor), icon: TrendingUp },
          { label: "Aggression Frequency %", value: fmtPct(metrics.aggression_frequency_pct), icon: TrendingUp },
          { label: "WSD %", value: fmtPct(metrics.wsd_pct), icon: Eye },
          { label: "W$SD %", value: fmtPct(metrics.wsd_won_pct), icon: Trophy },
        ]}
      />

      <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
        W$SD% usa o vencedor gravado da mão (um único nome) como aproximação — não cobre split pot com precisão de equity.
        Aggression Factor fica sem valor quando não há nenhum call registrado na amostra (denominador zero).
      </p>
    </Painel>
  );
}
