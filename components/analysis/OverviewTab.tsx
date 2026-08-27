"use client";

import { Wallet, Hash, AlertTriangle } from "lucide-react";
import { EvolutionChart } from "@/components/time/evolution-chart";
import { Painel, MetricCard, EmptyState } from "@/components/analysis/shared";
import type { FinancialDay } from "@/lib/services/team-service";
import type { PlayerPerformance } from "@/lib/services/performance-service";
import type { Leak } from "@/types/analysis";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const SEVERITY_COLOR: Record<Leak["severity"], string> = {
  critical: "border-negative/40 bg-negative/10 text-negative",
  warning: "border-evolution/40 bg-evolution/10 text-evolution",
  info: "border-hairline bg-elevated text-muted",
};

export function OverviewTab({
  performance,
  financialDays,
  handCount,
  leaks,
  onGoToLeaks,
}: {
  performance: PlayerPerformance | null;
  financialDays: FinancialDay[];
  handCount: number;
  leaks: Leak[];
  onGoToLeaks: () => void;
}) {
  const acumFinal = financialDays.length ? financialDays[financialDays.length - 1].acumulado : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Resultado no período" value={BRL.format(acumFinal)} tone={acumFinal >= 0 ? "bom" : "ruim"} />
        <MetricCard
          label="ROI acumulado"
          value={performance?.roi_pct != null ? `${Number(performance.roi_pct).toFixed(2)}%` : null}
          tone={performance?.roi_pct != null ? (Number(performance.roi_pct) >= 0 ? "bom" : "ruim") : undefined}
        />
        <MetricCard label="Mãos analisadas" value={handCount.toLocaleString("pt-BR")} />
        <MetricCard label="Sessões" value={performance?.num_sessoes != null ? String(performance.num_sessoes) : null} />
      </div>

      <Painel titulo="Resultado & volume" icone={<Wallet size={14} className="text-training" />}>
        {financialDays.length < 2 ? (
          <EmptyState texto="Registre sessões na Gestão de Banca para ver a evolução de resultado aqui." />
        ) : (
          <EvolutionChart dados={financialDays} titulo="Net Won acumulado" />
        )}
        <p className="mt-2 text-[11px] text-muted/70">
          All-in EV ainda não entra no gráfico — depende do motor rodar equity de all-in por mão, que ainda não existe no pipeline.
        </p>
      </Painel>

      <Painel
        titulo="Leaks em destaque"
        icone={<AlertTriangle size={14} className="text-negative" />}
        action={
          leaks.length > 0 && (
            <button onClick={onGoToLeaks} className="text-[11.5px] font-semibold text-muted hover:text-ink">
              Ver todos →
            </button>
          )
        }
      >
        {leaks.length === 0 ? (
          <EmptyState texto="Nenhum leak destacado com a amostra atual — volte a olhar aqui conforme joga mais mãos." />
        ) : (
          <div className="space-y-2">
            {leaks.slice(0, 3).map((l) => (
              <div key={l.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 ${SEVERITY_COLOR[l.severity]}`}>
                <div>
                  <p className="text-sm font-semibold">{l.title}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{l.description}</p>
                </div>
                <span className="shrink-0 text-lg font-bold tabular-nums">{l.metricValue}%</span>
              </div>
            ))}
          </div>
        )}
      </Painel>

      <Painel titulo="Amostra" icone={<Hash size={14} className="text-evolution" />}>
        <p className="text-xs leading-relaxed text-muted">
          Todas as métricas desta tela vêm de <strong className="text-ink/85">{handCount}</strong> mãos com hand history estruturada
          (importadas manualmente ou pelo agente desktop). Quanto mais mãos, mais confiáveis os percentuais — leve isso em conta
          antes de mudar de estratégia com base em amostras pequenas.
        </p>
      </Painel>
    </div>
  );
}
