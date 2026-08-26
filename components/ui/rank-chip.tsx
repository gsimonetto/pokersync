import { levelColor } from "@/lib/services/xp-service";

// Emblema compacto de nivel -- so' o numero, colorido pela faixa
// (pedido explicito: "retire a palavra 'nivel'... mostre apenas o
// ranking com a cor que o jogador se encontra... apenas os numeros do
// ranking, como e' hoje na gamersclub"). Reusa o mesmo tema visual dos
// chips ja existentes no produto (borda + fundo na cor, texto colorido).
// Redondo e com tamanho fixo (pedido explicito: "padronize") -- nao
// estica com nivel de 1 vs 2 digitos, sempre o mesmo circulo.
export function RankChip({ level, className = "" }: { level: number; className?: string }) {
  const color = levelColor(level);
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-black tabular-nums ${className}`}
      style={{ color, background: `${color}22`, border: `2px solid ${color}` }}
    >
      {level}
    </span>
  );
}
