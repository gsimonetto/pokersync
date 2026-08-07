import { Wallet, TrendingUp, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Stat {
  label: string;
  value: string;
  meta: string;
  icon: LucideIcon;
  accent: string;
}

export function StatCards({
  bankrollAtual,
  resultado,
  roi,
  itmPct,
  sessionsCount,
  tourneyCount,
}: {
  bankrollAtual: string;
  resultado: string;
  roi: string;
  itmPct: string;
  sessionsCount: number;
  tourneyCount: number;
  resultadoPositivo: boolean;
}) {
  const stats: Stat[] = [
    {
      label: "Banca atual",
      value: bankrollAtual,
      meta: `${sessionsCount} ${sessionsCount === 1 ? "sessão" : "sessões"}`,
      icon: Wallet,
      accent: "#22c55e",
    },
    {
      label: "Resultado",
      value: resultado,
      meta: `${roi} ROI`,
      icon: TrendingUp,
      accent: "#22c55e",
    },
    {
      label: "ITM (torneios)",
      value: itmPct,
      meta: `${tourneyCount} ${tourneyCount === 1 ? "torneio" : "torneios"}`,
      icon: Trophy,
      accent: "#f59e0b",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            style={{ "--acc": s.accent } as React.CSSProperties}
            className="acc-card group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-hairline bg-surface px-4 py-3.5"
          >
            <div
              aria-hidden="true"
              className="acc-glow pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl"
            />
            <span className="acc-border grid size-9 shrink-0 place-items-center rounded-lg border border-hairline bg-white/[0.03]">
              <Icon className="acc-fg size-[18px] text-ink" />
            </span>

            <div className="relative min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="acc-bg pulse-dot size-1.5 rounded-full bg-ink" />
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {s.label}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="acc-fg tnum text-lg font-bold tracking-tight text-ink">{s.value}</span>
                <span className="tnum text-xs text-muted">{s.meta}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
