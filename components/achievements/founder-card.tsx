"use client";

import { useEffect } from "react";
import { CalendarDays, Crown, Trophy, X } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

// Card de detalhe da conquista Founder -- aberto ao clicar no selo
// pequeno em app/modulos/page.tsx. Layout proprio (nao usa o <Modal>
// generico de components/ui/modal.tsx) porque o design pedido tem um
// cabecalho custom (logo + "FOUNDER"/"POKERSYNC") bem diferente do
// padrao "titulo + X" dos outros modais do app -- mesmo assim repete o
// comportamento de sempre (Esc fecha, clique fora fecha).
export function FounderCard({
  open,
  onClose,
  description,
  unlockedAt,
}: {
  open: boolean;
  onClose: () => void;
  description: string;
  unlockedAt: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm animate-[modalIn_.16s_ease-out] overflow-hidden rounded-2xl border border-evolution/25 bg-gradient-to-b from-elevated/90 to-void/95 p-6 shadow-[0_0_70px_-18px_rgba(245,158,11,0.4)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:text-ink"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div
            className="grid size-11 shrink-0 place-items-center border border-evolution/40 bg-evolution/10 text-evolution"
            style={{ clipPath: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)" }}
          >
            <Trophy size={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Conquista</p>
            <p className="text-lg font-extrabold leading-tight tracking-tight text-ink">Founder</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/50">PokerSync</p>
          </div>
        </div>

        <div className="relative my-6 flex h-44 items-center justify-center" style={{ perspective: "700px" }}>
          <div className="orbit-spin-slow absolute size-36 rounded-full border border-evolution/20" />
          <div className="orbit-spin-slow-reverse absolute size-44 rounded-full border border-evolution/10" />
          <div className="absolute bottom-1 h-4 w-28 rounded-full bg-evolution/15 blur-md" />

          <div className="trophy-float-3d relative text-evolution drop-shadow-[0_0_18px_rgba(245,158,11,0.55)]">
            <Crown size={26} strokeWidth={1.75} className="absolute -top-4 left-1/2 -translate-x-1/2" />
            <Trophy size={72} strokeWidth={1.25} />
          </div>
        </div>

        <h3 className="text-lg font-bold text-ink">Você é um dos pioneiros</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>

        <div className="mt-5 flex items-center gap-2 border-t border-hairline pt-4">
          <CalendarDays size={14} className="shrink-0 text-muted/70" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Concedido em</p>
            <p className="text-sm font-semibold text-ink">{dateFmt.format(new Date(unlockedAt))}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
