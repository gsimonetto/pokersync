import { Printer } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";

// Seletor de periodo (7d/30d/90d) reusado nos headers que tem filtro por
// dias — Painel do time e ficha do jogador usavam a mesma marcacao
// copiada em cada arquivo. Fininho sobre o SegmentedControl padrao do
// produto (mesmo container/estado ativo de qualquer outra segmentacao
// de 2-4 opcoes).
export function PeriodSelector<T extends number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (dias: T) => void;
  options: { label: string; days: T }[];
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      options={options.map((op) => ({
        value: op.days,
        label: <span className="uppercase tracking-[0.08em]">{op.label}</span>,
      }))}
    />
  );
}

// Botao de exportar PDF (window.print) — mesmo icone/estilo em toda
// tela que oferece impressao (Painel do time, ficha do jogador).
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
      aria-label="Exportar PDF"
    >
      <Printer size={15} />
    </button>
  );
}
