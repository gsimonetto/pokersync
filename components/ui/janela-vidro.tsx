"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";

// Janela por cima da tela no visual de vidro (Chat, Ajuda, Notificações):
// fundo escurecido e desfocado, card de vidro fosco com borda fina e uma
// entrada suave (leve subida + fade). O vidro vem de .painel-vidro, que o
// AppShell define pra todas as telas (components/painel/painel-styles.tsx).
export function JanelaVidro({
  onClose,
  children,
  className = "max-w-md",
  centro = false,
  rotulo,
}: {
  onClose: () => void;
  children: React.ReactNode;
  /** Largura/altura do card (padrão: estreito, max-w-md). */
  className?: string;
  /** true = centralizada na vertical (Chat); false = perto do topo. */
  centro?: boolean;
  rotulo: string;
}) {
  useEscapeToClose(onClose);
  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4 ${
          centro ? "items-center" : "items-start pt-16"
        }`}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={rotulo}
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`painel-vidro relative w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/60 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </div>
    </ModalPortal>
  );
}

/** Cabeçalho padrão das janelas: ícone dourado, título, ações e fechar. */
export function CabecalhoJanela({
  icone,
  titulo,
  subtitulo,
  acoes,
  onClose,
}: {
  icone?: React.ReactNode;
  titulo: string;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
      {icone && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 text-[#d4af37]">
          {icone}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">{titulo}</h2>
        {subtitulo && <p className="truncate text-[11.5px] text-muted">{subtitulo}</p>}
      </div>
      {acoes}
      <BotaoFechar onClose={onClose} />
    </div>
  );
}

export function BotaoFechar({ onClose, className = "" }: { onClose: () => void; className?: string }) {
  return (
    <button
      onClick={onClose}
      className={`grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted transition hover:border-white/20 hover:text-ink ${className}`}
      aria-label="Fechar"
    >
      <X size={15} />
    </button>
  );
}
