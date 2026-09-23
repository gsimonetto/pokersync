"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { EASE } from "./painel-card";

// Explicação de um número ao passar o mouse (ou focar pelo teclado):
// "o que é" e "de onde vem". Pedido explícito pros indicadores da tela
// inicial. Abre num portal com posição fixa porque os cards do Painel
// cortam o que passa da borda (overflow hidden) -- dentro do card a
// caixinha sairia pela metade.

export type Explicacao = {
  titulo: string;
  oQueE: string;
  /** Módulo de origem, ex.: "Modo Treino". */
  origem: string;
  /** Como o número é calculado lá (uma frase). */
  comoCalcula?: string;
  /** Lista opcional (ex.: componentes do Score com o peso). */
  itens?: { rotulo: string; valor: string }[];
};

const LARGURA = 260;
const MARGEM = 10;

export function InfoHover({
  explicacao,
  children,
  className = "",
  style,
}: {
  explicacao: Explicacao;
  children: ReactNode;
  className?: string;
  /** Posição do gatilho (ex.: rótulos do pentágono, em % do quadro). */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; acima: boolean } | null>(null);
  const [montado, setMontado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMontado(true), []);

  function calcular() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Centraliza no card e respeita as bordas da janela.
    const x = Math.min(Math.max(MARGEM, r.left + r.width / 2 - LARGURA / 2), window.innerWidth - LARGURA - MARGEM);
    // Abre embaixo se tiver espaço; senão, em cima.
    // (em cima: ancora pela base da caixinha, via `bottom`)
    const acima = window.innerHeight - r.bottom < 220;
    setPos({ x, y: acima ? window.innerHeight - r.top + MARGEM : r.bottom + MARGEM, acima });
  }

  function abrir() {
    if (timer.current) clearTimeout(timer.current);
    // Pequena espera: passar o mouse de relance por cima não abre nada.
    timer.current = setTimeout(() => {
      calcular();
      setAberto(true);
    }, 180);
  }
  function fechar() {
    if (timer.current) clearTimeout(timer.current);
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const sair = () => setAberto(false);
    window.addEventListener("scroll", sair, true);
    window.addEventListener("resize", sair);
    return () => {
      window.removeEventListener("scroll", sair, true);
      window.removeEventListener("resize", sair);
    };
  }, [aberto]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={0}
      aria-describedby={aberto ? id : undefined}
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onFocus={abrir}
      onBlur={fechar}
      className={`cursor-help rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60 ${className}`}
      style={style}
    >
      {children}
      {montado &&
        createPortal(
          <AnimatePresence>
            {aberto && pos && (
              <motion.div
                id={id}
                role="tooltip"
                initial={{ opacity: 0, y: pos.acima ? 6 : -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.acima ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: EASE }}
                className={`pointer-events-none fixed z-[70] rounded-xl border border-white/10 bg-[#141414]/95 p-3.5 text-left shadow-2xl shadow-black/60 backdrop-blur-md`}
                style={pos.acima ? { left: pos.x, bottom: pos.y, width: LARGURA } : { left: pos.x, top: pos.y, width: LARGURA }}
              >
                <p className="text-[13px] font-semibold text-ink">{explicacao.titulo}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{explicacao.oQueE}</p>
                {explicacao.itens && (
                  <ul className="mt-2 space-y-1">
                    {explicacao.itens.map((it) => (
                      <li key={it.rotulo} className="flex items-center justify-between gap-3 text-[11.5px]">
                        <span className="text-muted">{it.rotulo}</span>
                        <span className="tnum font-medium text-ink/90">{it.valor}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2.5 border-t border-white/[0.08] pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/70">De onde vem</p>
                  <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#f1d78a]">
                    <ArrowUpRight size={12} aria-hidden />
                    {explicacao.origem}
                  </p>
                  {explicacao.comoCalcula && (
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted/90">{explicacao.comoCalcula}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
