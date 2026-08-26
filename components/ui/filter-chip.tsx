"use client";

// Pill de filtro/segmentacao padrao do produto (pedido explicito: "os
// filtros formem um padrao... ja vi em modulos diferentes visor de
// filtros diferentes"). Antes cada tela reinventava a propria pill --
// Revisor usava uma cor especial so' pra "Campeão", Biblioteca de Ranges
// usava outro raio de borda, o Construtor de Ranges usava caixinhas
// quadradas com fundo branco no ativo. Um componente so', reusado em
// toda tela que tem filtro por chip (nao confundir com SegmentedControl,
// que e' pra 2-4 opcoes MUTUAMENTE EXCLUSIVAS tipo abas).
export function FilterChip({
  label,
  active,
  disabled,
  disabledReason,
  icon,
  onClick,
  style,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  /** Tooltip explicando por que esta desabilitado (ex: sem dados pra essa combinacao). */
  disabledReason?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Escape hatch pra telas que usam inline style em vez de Tailwind (ex: fontFamily do Modo Treino). */
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      style={style}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
        active
          ? "border-ink bg-ink text-void"
          : disabled
            ? "border-dashed border-hairline text-muted/40"
            : "border-hairline bg-transparent text-muted hover:border-ink/40 hover:text-ink"
      } ${disabled ? "cursor-not-allowed line-through" : "cursor-pointer"}`}
    >
      {icon}
      {label}
    </button>
  );
}
