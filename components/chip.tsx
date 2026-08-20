// Chip padrao do PokerSync — pill com brilho na cor (borda + fundo
// translucido + glow leve), mesmo visual do plano/time no hero de
// boas-vindas dos Modulos. Usar em qualquer lugar que hoje tem uma
// "etiqueta"/badge colorida (etiqueta de jogador, tipo de evento,
// papel, etc.) em vez de reinventar o estilo por tela.
export function Chip({
  children,
  color,
  size = "md",
  className,
}: {
  children: React.ReactNode;
  color: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tamanho = size === "sm" ? "px-2 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-[10.5px]";
  return (
    <span
      className={`inline-flex cursor-default items-center gap-1 rounded-full border font-bold uppercase tracking-wide transition duration-200 hover:scale-[1.04] hover:brightness-125 ${tamanho} ${className ?? ""}`}
      style={{
        color,
        borderColor: `${color}55`,
        background: `${color}1A`,
        boxShadow: `0 0 10px ${color}80, 0 0 2px ${color}`,
      }}
    >
      {children}
    </span>
  );
}
