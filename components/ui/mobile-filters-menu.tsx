"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";

// Colapsa os filtros principais de uma tela atras do icone de menu
// (sanduiche) so' em telas pequenas -- pedido explicito pra nao
// amontoar select/chips/busca numa fileira que quebra em varias linhas
// no mobile. O caller e' responsavel por esconder a fileira normal de
// filtros com `hidden sm:flex` e renderizar este componente dentro de
// um wrapper `sm:hidden`; os mesmos controles (mesmo estado) entram
// como children aqui dentro, so' que empilhados num menu.
//
// Mesmo padrao visual dos outros menus do produto (Notificacoes/Ajuda/
// Perfil/Filtrar por categoria da Biblioteca): backdrop + card, fecha
// no backdrop, no X ou com Esc.
export function MobileFiltersMenu({
  title = "Filtros",
  active,
  children,
}: {
  title?: string;
  /** true quando algum filtro esta fora do padrao "todos" -- da destaque no botao. */
  active?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEscapeToClose(() => setOpen(false), open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors ${
          active ? "border-ink/40 bg-elevated text-ink" : "border-hairline bg-elevated text-muted hover:border-ink/40 hover:text-ink"
        }`}
      >
        <Menu size={16} />
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface/[0.98] shadow-2xl shadow-black/60 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                <span className="text-sm font-bold text-ink">{title}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="grid size-6 place-items-center rounded-lg text-muted hover:text-ink"
                  aria-label="Fechar"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="p-4">{children}</div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
