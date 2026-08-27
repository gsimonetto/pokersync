"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";

// `href` pra abas que sao rota propria (Link, navegacao de verdade) --
// `onSelect` pra abas que so trocam um estado local (ex: Painel do
// Time, que atualiza ?tab= via replaceState em vez de navegar).
type MobileTabItemBase = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};
export type MobileTabItem =
  | (MobileTabItemBase & { href: string; onSelect?: never })
  | (MobileTabItemBase & { href?: never; onSelect: () => void });

function hasHref(item: MobileTabItem): item is MobileTabItemBase & { href: string } {
  return typeof item.href === "string";
}

// Colapsa a navegacao principal de um modulo (as abas do topo, tipo
// Ranges/Arvores/Biblioteca/... ou Perfil/Jogadores/Calendario/...)
// atras de um icone de menu (sanduiche) so' em telas pequenas -- pedido
// explicito pra parar de amontoar/rolar uma barra com 6-7 abas no
// mobile. O caller esconde a nav normal com `hidden sm:flex` e
// renderiza isto dentro de um wrapper `sm:hidden`.
export function MobileTabsMenu({
  title,
  items,
  activeKey,
}: {
  title: string;
  items: MobileTabItem[];
  activeKey: string;
}) {
  const [open, setOpen] = useState(false);
  useEscapeToClose(() => setOpen(false), open);
  const current = items.find((i) => i.key === activeKey) ?? items[0];
  const CurrentIcon = current.icon;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <CurrentIcon size={15} />
        {current.label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${title}`}
        title={title}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
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
              <nav className="flex flex-col gap-0.5 p-2">
                {items.map((it) => {
                  const Icon = it.icon;
                  const isActive = it.key === activeKey;
                  const className = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive ? "bg-elevated text-ink" : "text-muted hover:text-ink"
                  }`;
                  const content = (
                    <>
                      <Icon size={16} />
                      {it.label}
                      {it.badge != null && it.badge > 0 && (
                        <span className="ml-auto rounded-full bg-evolution px-1.5 text-[10px] font-bold leading-4 text-void">
                          {it.badge}
                        </span>
                      )}
                    </>
                  );
                  return hasHref(it) ? (
                    <Link key={it.key} href={it.href} onClick={() => setOpen(false)} className={className}>
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => {
                        it.onSelect();
                        setOpen(false);
                      }}
                      className={className}
                    >
                      {content}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
