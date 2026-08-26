"use client";

// Controle de 2-4 opcoes MUTUAMENTE EXCLUSIVAS (ex: Missões/Ranking no
// Hub, Fila/Salvos/Aderência no Revisor, 7d/30d/90d no seletor de
// periodo, Board/Arquivados no Funil). Padrao unico pro produto inteiro
// -- pill container (border-hairline bg-elevated p-1) com a opcao ativa
// em bg-ink text-void, reusado em vez de cada tela montar a propria
// versao com pequenas diferencas de raio/padding/cor.
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
      {options.map((op) => (
        <button
          key={String(op.value)}
          type="button"
          onClick={() => onChange(op.value)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-all ${
            value === op.value ? "bg-ink text-void" : "text-muted hover:text-ink"
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
