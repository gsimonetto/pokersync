"use client";

import { Flame } from "lucide-react";
import { Painel, MetricGrid } from "@/components/analysis/shared";
import type { PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

const AF_AFQ_LOCKED = "Exige contar bet/raise/call por rua — hand_tags hoje só guarda flags booleanas (fez c-bet ou não), não a contagem de ações necessária pro Aggression Factor/Frequency";
const WSD_LOCKED = "Showdown não é sinalizado como coluna própria em hand_tags ainda — falta ligar hero_reviews.parsed_data.showdown ao resultado em bb da mão";

export function PostflopTab({ metrics }: { metrics: PostflopMetrics }) {
  return (
    <div className="space-y-4">
      <Painel titulo="C-Bet & fold to C-Bet" icone={<Flame size={14} className="text-training" />}>
        <MetricGrid
          items={[
            { label: "Flop C-Bet %", value: fmtPct(metrics.cbet_flop_pct), sample: metrics.hands },
            { label: "Turn C-Bet %", value: fmtPct(metrics.cbet_turn_pct) },
            { label: "River C-Bet %", value: null, locked: "Motor pós-flop ainda não roda a rua river (ver pipeline no backlog, item #1)" },
            { label: "Fold to Flop C-Bet %", value: fmtPct(metrics.fold_to_cbet_flop_pct) },
            { label: "Fold to Turn C-Bet %", value: null, locked: "Só flop tem fold_to_cbet gravado hoje" },
            { label: "Fold to River C-Bet %", value: null, locked: "Só flop tem fold_to_cbet gravado hoje" },
          ]}
        />
      </Painel>

      <Painel titulo="Check-raise, donk bet & agressão" icone={<Flame size={14} className="text-negative" />}>
        <MetricGrid
          items={[
            { label: "Check-Raise (flop/turn)", value: fmtPct(metrics.check_raise_flop_pct) },
            { label: "Donk Bet %", value: fmtPct(metrics.donk_bet_pct) },
            { label: "Aggression Factor", value: null, locked: AF_AFQ_LOCKED },
            { label: "Aggression Frequency %", value: null, locked: AF_AFQ_LOCKED },
            { label: "WSD %", value: null, locked: WSD_LOCKED },
            { label: "W$SD %", value: null, locked: WSD_LOCKED },
          ]}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
          Check-Raise hoje é uma única flag por mão (qualquer rua) — não dá pra separar flop de turn sem que o parser grave em qual
          rua o check-raise aconteceu. Registrado como pendência.
        </p>
      </Painel>
    </div>
  );
}
