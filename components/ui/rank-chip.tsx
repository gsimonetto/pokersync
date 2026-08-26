import { levelColor } from "@/lib/services/xp-service";

// Emblema compacto de nivel -- so' o numero, colorido pela faixa
// (pedido explicito: "retire a palavra 'nivel'... mostre apenas o
// ranking com a cor que o jogador se encontra... apenas os numeros do
// ranking, como e' hoje na gamersclub"). Reusa o mesmo tema visual dos
// chips ja existentes no produto (borda + fundo na cor, texto colorido).
export function RankChip({ level, className = "" }: { level: number; className?: string }) {
  const color = levelColor(level);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${className}`}
      style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
    >
      {level}
    </span>
  );
}
