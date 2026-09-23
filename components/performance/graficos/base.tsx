"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

// Peças comuns dos gráficos da Performance.
//
// Cores validadas com o script da skill de dataviz (modo escuro, fundo dos
// cards): azul e dourado passam em faixa de luminosidade, croma,
// separação pra daltonismo (ΔE 24) e contraste. Mudou uma cor aqui? Rode o
// validador de novo.
export const COR_VPIP = "#4a90d9";
export const COR_PFR = "#B08A2A";
// Uma série só (funil, matriz, curva): o dourado do produto.
export const COR_UNICA = "#d4af37";
export const COR_POSITIVO = "#22c55e";
export const COR_NEGATIVO = "#e0555a";

// Abaixo disso o número ainda oscila demais pra decidir alguma coisa.
export const AMOSTRA_MINIMA_MAOS = 100;

export function SeloAmostra({ n, minimo = AMOSTRA_MINIMA_MAOS, unidade = "mãos" }: { n: number; minimo?: number; unidade?: string }) {
  if (n >= minimo) {
    // No celular some (o espaço é do título); a contagem só importa
    // quando é pouca, e aí vira o selo abaixo.
    return <span className="hidden whitespace-nowrap text-[11px] tabular-nums text-muted/70 sm:inline">{n.toLocaleString("pt-BR")} {unidade}</span>;
  }
  return (
    <span
      title={`Com menos de ${minimo} ${unidade} o número ainda oscila bastante -- use como pista, não como conclusão.`}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#f59e0b]"
    >
      Amostra pequena · {n.toLocaleString("pt-BR")} {unidade}
    </span>
  );
}

// Caixinha que aparece ao passar o mouse numa barra/ponto/célula. Fica
// DENTRO do gráfico (posição em px relativa a ele) e troca de lado quando
// chega perto da borda direita, pra não sair do card.
export function DicaGrafico({
  aberta,
  x,
  y,
  largura,
  children,
}: {
  aberta: boolean;
  x: number;
  y: number;
  /** Largura do gráfico, pra virar a caixinha antes da borda. */
  largura: number;
  children: ReactNode;
}) {
  const praEsquerda = x > largura - 170;
  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none absolute z-20 min-w-[140px] max-w-[220px] rounded-lg border border-white/10 bg-[#141414]/95 px-2.5 py-2 text-[11.5px] shadow-xl shadow-black/50 backdrop-blur"
          style={{
            left: praEsquerda ? undefined : x + 12,
            right: praEsquerda ? largura - x + 12 : undefined,
            top: Math.max(0, y - 10),
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Linha da legenda (≥ 2 séries sempre têm legenda -- regra da skill).
export function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}
