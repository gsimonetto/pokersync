"use client";

import { useEffect, useRef, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";

// Agrupa varios controles de filtro atras de um unico icone -- usado
// quando os filtros nao cabem numa linha so' (ex: Sessoes recentes na
// Gestao de Banca, com 4 selects) ou quando sao usados com pouca
// frequencia (ex: plataforma). Bolinha no icone acende quando algum
// filtro dentro do painel esta fora do valor padrao, pra nao esconder
// que a lista esta filtrada. `icon` default (lupa) faz sentido quando o
// painel É a busca; call sites com busca de texto separada (ex: Funil)
// devem passar um icone de filtro (SlidersHorizontal) pra nao duplicar
// visualmente o botao de busca.
export function FilterPopover({
  active,
  children,
  label = "Filtros",
  icon: Icon = Search,
}: {
  active?: boolean;
  children: React.ReactNode;
  label?: string;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={label}
        className={`relative grid h-7 w-7 place-items-center rounded-md border transition-colors ${
          open ? "border-training bg-training/15 text-training" : "border-hairline text-muted hover:border-training/50 hover:text-training"
        }`}
      >
        <Icon size={13} />
        {active && !open && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-training" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border border-hairline bg-surface p-3 shadow-lg">
          <div className="flex flex-col gap-2">{children}</div>
        </div>
      )}
    </div>
  );
}
