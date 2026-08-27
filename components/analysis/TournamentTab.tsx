"use client";

import { Trophy, Layers } from "lucide-react";
import { Painel, MetricGrid, Bloqueado } from "@/components/analysis/shared";
import type { TournamentMetrics } from "@/types/analysis";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtMoney(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${BRL.format(v)}`;
}

export function TournamentTab({ metrics }: { metrics: TournamentMetrics }) {
  return (
    <div className="space-y-4">
      <Painel titulo="Resultado em torneios" icone={<Trophy size={14} className="text-evolution" />}>
        <MetricGrid
          items={[
            { label: "Total Games", value: metrics.total_games > 0 ? String(metrics.total_games) : null },
            { label: "ROI %", value: fmtPct(metrics.roi_pct) },
            { label: "ITM %", value: fmtPct(metrics.itm_pct) },
            { label: "Lucro total", value: fmtMoney(metrics.total_profit) },
          ]}
        />
        {metrics.total_games === 0 && (
          <p className="mt-3 text-xs text-muted">
            Nenhuma sessão de torneio registrada na Gestão de Banca ainda — ROI/ITM/lucro vêm de lá (buy-in, re-entries e cashout).
          </p>
        )}
      </Painel>

      <Painel titulo="cEV & ICM" icone={<Layers size={14} className="text-review" />}>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Expected Value em chips (cEV) e ajuste por ICM exigem simular o all-in equity de cada mão contra o motor GTO — o motor
          já resolve isso (CFR + ICM), mas o job que gravaria cEV por mão nunca rodou em produção. É o gap #1 do produto hoje.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Bloqueado titulo="Chip EV Total & cEV/game" texto="Depende do motor rodar equity de all-in por mão — nenhuma linha gravada ainda." />
          <Bloqueado titulo="Net Expected Profit ($ EV) & EV ROI %" texto="Mesma dependência: sem cEV por mão, não dá pra somar $EV." />
          <Bloqueado titulo="Desempenho por faixa de blind" texto="Existe a estrutura (hand_sessions), mas sem stack/blind por mão associado ao resultado." />
          <Bloqueado titulo="Situações de ICM (bolha, mesa final)" texto="tournament_phase e icm_pressure existem no schema, mas o parser ainda não os preenche." />
        </div>
      </Painel>
    </div>
  );
}
