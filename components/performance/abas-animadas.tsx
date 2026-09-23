"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// Abas da Performance com vida: o sublinhado dourado DESLIZA da aba antiga
// pra nova (layoutId), a aba ativa ganha um fundo sutil e o número do
// atalho aparece ao lado do nome (1, 2, 3...) -- grinder troca de aba sem
// tirar a mão do teclado. No celular a barra rola de lado, sem quebrar
// linha.
export function AbasAnimadas<T extends string>({
  value,
  onChange,
  options,
  rotulo = "Seções da Performance",
}: {
  value: T;
  onChange: (v: T) => void;
  /** badge: contador opcional ao lado do nome (ex.: convites pendentes). */
  options: { value: T; label: string; icon: LucideIcon; badge?: number }[];
  rotulo?: string;
}) {
  // Atalho: teclas 1..N trocam de aba (menos quando o foco está num campo
  // de texto, pra não atrapalhar quem está digitando).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) onChange(options[n - 1].value);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [options, onChange]);

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="painel-scroll -mx-1 flex snap-x items-center gap-1 overflow-x-auto px-1 pb-1"
    >
      {options.map((o, i) => {
        const ativo = o.value === value;
        const Icone = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.value)}
            className={`group relative flex shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-colors active:scale-[0.98] ${
              ativo ? "text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"
            }`}
          >
            {ativo && (
              <motion.span
                layoutId="perf-aba-fundo"
                className="absolute inset-0 rounded-xl bg-white/[0.06]"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            <Icone size={15} className={`relative transition-colors ${ativo ? "text-[#d4af37]" : ""}`} />
            <span className="relative">{o.label}</span>
            {!!o.badge && (
              <span className="relative rounded-full bg-[#d4af37] px-1.5 text-[10px] font-bold leading-4 text-black">{o.badge}</span>
            )}
            <kbd
              className={`relative hidden rounded border px-1 text-[10px] leading-4 transition-opacity sm:inline ${
                ativo ? "border-white/15 text-muted" : "border-white/10 text-muted/60 opacity-0 group-hover:opacity-100"
              }`}
            >
              {i + 1}
            </kbd>
            {ativo && (
              <motion.span
                layoutId="perf-aba-linha"
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[#d4af37]"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
