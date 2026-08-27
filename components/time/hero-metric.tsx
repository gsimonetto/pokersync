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
      <p className="text-[10px] font-bold uppercase leading-snug tracking-[0.14em] text-muted/80">{label}</p>
      {/* Nunca corta o valor -- nem com "…" nem vazando por cima da coluna
          vizinha. Sem nowrap/ellipsis: se um numero muito comprido nao
          couber na largura da coluna, ele quebra pra segunda linha
          (leading-tight evita a linha de baixo colar na de cima), mas o
          valor inteiro sempre fica visivel. */}
      <p
        className={`mt-2 break-words font-bold leading-tight tracking-tight tabular-nums ${
          destaque ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
        } ${cor}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}
