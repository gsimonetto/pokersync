"use client";

import { Flame } from "lucide-react";
import { Painel, MetricGrid } from "@/components/analysis/shared";
import type { PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

function fmtRatio(v: number | null): string | null {
  return v === null ? null : v.toFixed(2);
}

export function PostflopTab({ metrics }: { metrics: PostflopMetrics }) {
  return (
    <div className="space-y-4">
      <Painel titulo="C-Bet & fold to C-Bet" icone={<Flame size={14} className="text-training" />}>
        <MetricGrid
          items={[
            { label: "Flop C-Bet %", value: fmtPct(metrics.cbet_flop_pct), sample: metrics.hands },
            { label: "Turn C-Bet %", value: fmtPct(metrics.cbet_turn_pct) },
            { label: "River C-Bet %", value: fmtPct(metrics.cbet_river_pct) },
            { label: "Fold to Flop C-Bet %", value: fmtPct(metrics.fold_to_cbet_flop_pct) },
            { label: "Fold to Turn C-Bet %", value: fmtPct(metrics.fold_to_cbet_turn_pct) },
            { label: "Fold to River C-Bet %", value: fmtPct(metrics.fold_to_cbet_river_pct) },
          ]}
        />
      </Painel>

      <Painel titulo="Check-raise, donk bet & agressão" icone={<Flame size={14} className="text-negative" />}>
        <MetricGrid
          items={[
            { label: "Check-Raise Flop %", value: fmtPct(metrics.check_raise_flop_pct) },
            { label: "Check-Raise Turn %", value: fmtPct(metrics.check_raise_turn_pct) },
            { label: "Check-Raise River %", value: fmtPct(metrics.check_raise_river_pct) },
            { label: "Donk Bet %", value: fmtPct(metrics.donk_bet_pct) },
            { label: "Aggression Factor", value: fmtRatio(metrics.aggression_factor) },
            { label: "Aggression Frequency %", value: fmtPct(metrics.aggression_frequency_pct) },
            { label: "WSD %", value: fmtPct(metrics.wsd_pct) },
            { label: "W$SD %", value: fmtPct(metrics.wsd_won_pct) },
          ]}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
          W$SD% usa o vencedor gravado da mão (um único nome) como aproximação — não cobre split pot com precisão de equity.
          Aggression Factor fica sem valor quando não há nenhum call registrado na amostra (denominador zero).
        </p>
      </Painel>
    </div>
  );
}
