"use client";

// Mesmo "Painel" do Gestor de Banca (app/banca/page.tsx): titulo pequeno
// em caixa alta + icone, com uma faixa de acao (filtros, botoes) alinhada
// a direita — em vez de filtro solto boiando no topo da tela, cada bloco
// carrega os proprios controles dentro do card.
export function PainelCard({
  titulo,
  icone,
  acao,
  className,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-hairline bg-surface p-5 ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icone}
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}
