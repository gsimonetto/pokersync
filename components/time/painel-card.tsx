"use client";

import { usePainelVidro } from "@/components/dashboard/kit";

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
  const vidro = usePainelVidro();
  // Dentro do painel do Time (PainelVisual="vidro") o card segue o visual
  // da tela inicial e da Performance: vidro fosco, cantos maiores e
  // título em frase, com o ícone numa pastilha.
  if (vidro) {
    return (
      <section className={`painel-vidro rounded-3xl border border-white/10 p-4 sm:p-5 print:break-inside-avoid ${className ?? ""}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-muted">{icone}</span>
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">{titulo}</h2>
          </div>
          {acao}
        </div>
        {children}
      </section>
    );
  }
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
