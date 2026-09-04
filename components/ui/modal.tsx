"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // Conteudo mais denso (ex: lista + form + abas) precisa de mais largura
  // que os modais simples de 1 campo -- opcional pra nao mudar os
  // existentes.
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 px-4 pb-8 pt-16 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative w-full animate-[modalIn_.16s_ease-out] rounded-xl border border-hairline bg-surface p-5 shadow-2xl ${wide ? "max-w-xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
