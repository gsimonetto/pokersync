// Label + conteudo de formulario, reutilizado em Kanban, Calendario e
// Convites (mesmo bloco visual repetido nos tres).
export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</label>
      {children}
    </div>
  );
}
