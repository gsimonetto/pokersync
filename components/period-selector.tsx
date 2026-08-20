import { Printer } from "lucide-react";

// Seletor de periodo (7d/30d/90d) reusado nos headers que tem filtro por
// dias — Painel do time e ficha do jogador usavam a mesma marcacao
// copiada em cada arquivo.
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
    <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
      {options.map((op) => (
        <button
          key={op.days}
          onClick={() => onChange(op.days)}
          className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
            value === op.days ? "bg-ink text-void" : "text-muted hover:text-ink"
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
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
