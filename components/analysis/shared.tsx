"use client";

import { Lock } from "lucide-react";

// Blocos reusados pelas 5 abas do módulo de Análise — mesmo "Painel"
// (rounded-xl border-hairline bg-surface) que app/performance/page.tsx já
// usa, centralizado aqui porque as 5 abas precisam dele em paralelo (uma
// única tela, não 5 telas isoladas reinventando o card cada uma).
export function Painel({ titulo, icone, action, children }: { titulo: string; icone?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icone}
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, sample, tone }: { label: string; value: string | null; sample?: number; tone?: "bom" | "ruim" }) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="rounded-lg border border-hairline bg-elevated p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">{label}</p>
      <p className={`mt-1 text-xl font-bold leading-none tabular-nums ${value ? cor : "text-muted/30"}`}>{value ?? "—"}</p>
      {sample !== undefined && <p className="mt-1.5 text-[11px] text-muted/70">{sample} {sample === 1 ? "amostra" : "amostras"}</p>}
    </div>
  );
}

// Grade densa de métricas (rótulo + valor + amostra opcional) — usada nas
// Data Grids de Preflop/Postflop/Torneios em vez de tabela HTML, pra
// caber bem em telas estreitas e mobile sem scroll horizontal.
export function MetricGrid({ items }: { items: { label: string; value: string | null; sample?: number | null; locked?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) =>
        it.locked ? (
          <LockedMetric key={it.label} label={it.label} reason={it.locked} />
        ) : (
          <MetricCard key={it.label} label={it.label} value={it.value} sample={it.sample ?? undefined} />
        )
      )}
    </div>
  );
}

// Cabeçalho de subseção dentro de um Painel — separa grupos de métricas
// relacionadas sem abrir um novo card pra cada grupo (evita a "poluição"
// de muitos cards pequenos competindo por atenção na mesma tela).
export function SubHeader({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/70 first:mt-0">{children}</p>;
}

// Lista densa de métricas (rótulo + valor, uma linha por métrica) — usada
// no lugar de MetricGrid quando o número de métricas é alto e o grid de
// cards vira ruído visual (ex.: Tendências pós-flop). Mesma leitura
// escaneável de uma tabela, sem as bordas repetidas de cada card.
export function StatList({ items }: { items: { label: string; value: string | null; locked?: string }[] }) {
  return (
    <div className="divide-y divide-hairline">
      {items.map((it) =>
        it.locked ? (
          <div key={it.label} className="flex items-center justify-between gap-3 py-2.5 opacity-60" title={it.locked}>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <Lock size={11} />
              {it.label}
            </span>
            <span className="shrink-0 text-base font-bold tabular-nums text-muted/40">—</span>
          </div>
        ) : (
          <div key={it.label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[13px] font-medium text-ink">{it.label}</span>
            <span className={`shrink-0 text-base font-bold tabular-nums ${it.value ? "text-ink" : "text-muted/30"}`}>{it.value ?? "—"}</span>
          </div>
        )
      )}
    </div>
  );
}

export function LockedMetric({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-dashed border-hairline p-3.5 opacity-70" title={reason}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted/60">
        <Lock size={10} />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold leading-none text-muted/30">—</p>
    </div>
  );
}

export function Bloqueado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-hairline p-3.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-void/40 text-muted">
        <Lock size={13} />
      </span>
      <div>
        <p className="text-sm font-medium text-muted">{titulo}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted/70">{texto}</p>
      </div>
    </div>
  );
}

export function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
      <p className="text-sm text-muted">{texto}</p>
    </div>
  );
}
