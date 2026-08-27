"use client";

// Mesmo HeroMetric do Gestor de Banca e da Performance: numero solto
// dentro de uma faixa herói (grid divide-x/divide-y), sem card proprio
// por metrica. Compartilhado entre Estatisticas do time e a ficha do
// jogador, que usam o mesmo padrao de cabecalho.
export function HeroMetric({
  label,
  value,
  hint,
  tone,
  destaque = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "bom" | "ruim" | "neutro";
  destaque?: boolean;
}) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="min-w-0 px-4 py-6 sm:px-6">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{label}</p>
      <p
        className={`mt-2 whitespace-nowrap font-bold leading-none tracking-tight tabular-nums ${cor}`}
        style={{ fontSize: destaque ? "clamp(1.375rem, 2.4vw, 2.25rem)" : "clamp(1.125rem, 1.8vw, 1.75rem)" }}
      >
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}
