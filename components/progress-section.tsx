// Secao estatica de preview, igual a referencia do v0 — os 3 indicadores
// (maos revisadas, ranges mapeados) dependem de modulos que ainda nao
// existem no produto real (Revisao/Construtor), por isso ficam "Em breve"
// e sem fonte de dados por enquanto.
interface ProgressItem {
  label: string;
  current: number;
  total: number;
  percent: number;
  accent: string;
}

const items: ProgressItem[] = [
  { label: "Sessões este mês", current: 0, total: 30, percent: 0, accent: "#22c55e" },
  { label: "Mãos revisadas", current: 0, total: 200, percent: 0, accent: "#3b82f6" },
  { label: "Ranges mapeados", current: 0, total: 10, percent: 0, accent: "#f59e0b" },
];

export function ProgressSection() {
  return (
    <section aria-labelledby="progress-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="progress-heading" className="text-sm font-medium text-muted">
          Progresso Recente
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.label}
            style={{ "--acc": it.accent } as React.CSSProperties}
            className="acc-card group cursor-pointer rounded-xl border border-hairline bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {it.label}
              </span>
              <span className="rounded-full border border-hairline bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                Em breve
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="acc-fg tnum text-2xl font-bold tracking-tight text-ink">{it.current}</span>
              <span className="tnum text-sm text-muted">/{it.total}</span>
            </div>

            <div
              className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuenow={it.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={it.label}
            >
              <div
                className="acc-bar animate-shimmer relative h-full rounded-full bg-ink/70"
                style={{ width: `${it.percent}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] text-muted/70">{it.percent}% concluído</p>
          </div>
        ))}
      </div>
    </section>
  );
}
