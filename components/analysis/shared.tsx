"use client";

import { Lock, type LucideIcon } from "lucide-react";

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
// escaneável de uma tabela, sem as bordas repetidas de cada card. `icon`
// é opcional — um ícone fino por linha ajuda a escanear rápido sem virar
// decoração (mesmo ícone pra métricas da mesma família, ex. todo "fold
// to X" usa o mesmo ícone de retorno).
// `bar` só existe quando há faixa de referência conhecida (toneFromRange
// com min/max reais) — vira uma trilha horizontal com a faixa saudável
// sombreada e um traço na posição do seu valor, no estilo HUD do
// HM3/PT4 (barra vs. população) em vez de só número solto. Métrica sem
// consenso de faixa fica só como número — não inventamos escala pra ela.
type StatBar = { pct: number; bandStart: number; bandEnd: number };

export function StatList({
  items,
}: {
  items: { label: string; value: string | null; icon?: LucideIcon; tone?: "bom" | "ruim"; hint?: string; bar?: StatBar; locked?: string }[];
}) {
  return (
    <div className="divide-y divide-hairline">
      {items.map((it) => {
        const Icon = it.icon;
        const cor = it.tone === "bom" ? "text-positive" : it.tone === "ruim" ? "text-negative" : "text-ink";
        const barCor = it.tone === "bom" ? "bg-positive" : it.tone === "ruim" ? "bg-negative" : "bg-muted";
        return it.locked ? (
          <div key={it.label} className="flex items-center justify-between gap-3 py-2.5 opacity-60" title={it.locked}>
            <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
              <Lock size={13} className="shrink-0" />
              {it.label}
            </span>
            <span className="shrink-0 text-base font-bold tabular-nums text-muted/40">—</span>
          </div>
        ) : (
          <div key={it.label} className="py-2.5" title={it.hint}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                {Icon && <Icon size={13} className="shrink-0 text-muted" />}
                {it.label}
              </span>
              <span className={`shrink-0 text-base font-bold tabular-nums ${it.value ? cor : "text-muted/30"}`}>{it.value ?? "—"}</span>
            </div>
            {it.bar && it.value && (
              <div className="relative mt-1.5 h-1 rounded-full bg-elevated">
                <div
                  className="absolute inset-y-0 rounded-full bg-positive/15"
                  style={{ left: `${it.bar.bandStart}%`, width: `${Math.max(0, it.bar.bandEnd - it.bar.bandStart)}%` }}
                />
                <div className={`absolute inset-y-0 w-[3px] rounded-full ${barCor}`} style={{ left: `calc(${it.bar.pct}% - 1.5px)` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Referência simplificada de "faixa saudável" pra colorir StatList sem
// depender do solver — mesmo espírito da matriz 13×13 (heurística de
// população, não output de GTO). `tone()` devolve undefined (cor
// neutra) fora das métricas com consenso conhecido, em vez de inventar
// faixa pra tudo.
export function toneFromRange(value: number | null, min: number, max: number): "bom" | "ruim" | undefined {
  if (value === null) return undefined;
  if (value >= min && value <= max) return "bom";
  if (value < min * 0.6 || value > max * 1.6) return "ruim";
  return undefined;
}

// Monta a trilha visual (StatBar) pra uma métrica com faixa de referência
// conhecida — `scaleMax` é só o teto visual da barra (não um limite real),
// escolhido folgado o bastante pra outliers não estourarem 100%.
export function statBar(value: number | null, min: number, max: number, scaleMax: number): StatBar | undefined {
  if (value === null) return undefined;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    pct: clamp((value / scaleMax) * 100),
    bandStart: clamp((min / scaleMax) * 100),
    bandEnd: clamp((max / scaleMax) * 100),
  };
}

// Contador único de amostra pro cabeçalho de um Painel (slot `action`) —
// uma vez por card, no lugar do número repetido em cada métrica dentro
// dele (era isso que gerava "203 amostras" três vezes na mesma tela).
export function SampleBadge({ hands }: { hands: number }) {
  return (
    <span className="text-[10.5px] font-semibold text-muted/70">
      {hands} {hands === 1 ? "mão" : "mãos"}
    </span>
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
