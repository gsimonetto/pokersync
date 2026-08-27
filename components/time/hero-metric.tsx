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
      {/* overflow-hidden + ellipsis: rede de seguranca -- se algum dia o
          valor nao couber (moeda com muitos digitos numa coluna estreita),
          trunca com "…" em vez de vazar visualmente por cima da coluna
          vizinha, como acontecia antes com so' whitespace-nowrap. */}
      <p
        className={`mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-none tracking-tight tabular-nums ${
          destaque ? "text-[1.75rem] sm:text-[2.25rem]" : "text-[1.375rem] sm:text-[1.75rem]"
        } ${cor}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2.5 truncate text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}
