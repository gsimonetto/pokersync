"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from "lucide-react";

/* Peças de interface em volta da mesa (Revisor e Treino) no visual atual
   do PokerSync: vidro fosco, borda fina branca, cantos rounded-xl e o
   dourado (#d4af37) como destaque -- o mesmo de BOTAO_VIDRO/BOTAO_OURO
   (components/banca/util.ts) e das janelas de vidro. Antes cada botão
   tinha o próprio estilo inline (quadrado aqui, redondo ali, pílula
   branca no "Treinar"). */

const BASE_ICONE =
  "grid shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-ink/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-ink active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35";

/** Botão só com ícone (voltar, lista, salvar...). "md" = 32px, "lg" = 38px (celular). */
export function classeIconeMesa(tamanho: "md" | "lg" = "md"): string {
  return `${BASE_ICONE} ${tamanho === "lg" ? "size-[38px]" : "size-8"}`;
}

/** Botão com ícone e texto, neutro. */
export const CHIP_MESA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-ink/80 no-underline transition hover:border-white/20 hover:bg-white/[0.08] hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

/** Informação fixa (torneio, blinds) -- mesmo desenho, sem hover. */
export const INFO_MESA =
  "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-ink/70";

/** Ação principal em dourado (ex.: "Treinar"). */
export const OURO_MESA =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#d4af37] px-3 py-2 text-[12px] font-semibold text-black no-underline shadow-lg shadow-black/40 transition hover:bg-[#e2c35a] active:scale-[0.97]";

/** Caixa de vidro que agrupa controles (navegação, avaliação). */
export const GRUPO_MESA = "painel-vidro flex items-center rounded-2xl border border-white/10 shadow-lg shadow-black/40";

/** Seletor de duas ou mais opções no mesmo vidro (ex.: BB | Fichas). */
export function SegmentoMesa<T extends string>({
  valor,
  opcoes,
  onChange,
  rotulo,
  title,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
  rotulo: string;
  title?: string;
}) {
  return (
    <div role="group" aria-label={rotulo} title={title} className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => !ativo && onChange(o.valor)}
            className={`rounded-[9px] px-2.5 py-1 text-[11px] font-semibold transition ${
              ativo ? "bg-white/[0.12] text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Navegação do replay: mão anterior, passo anterior, play, próximo passo, próxima mão. */
export function ControlesReplay({
  tamanho,
  onMaoAnterior,
  onPassoAnterior,
  onPlay,
  onProximoPasso,
  onProximaMao,
  tocando,
  noInicio,
  noFim,
  passo,
  totalPassos,
}: {
  /** "compacto" no cabeçalho do computador, "grande" no celular (dedo). */
  tamanho: "compacto" | "grande";
  onMaoAnterior?: () => void;
  onPassoAnterior: () => void;
  onPlay: () => void;
  onProximoPasso: () => void;
  onProximaMao?: () => void;
  tocando: boolean;
  noInicio: boolean;
  noFim: boolean;
  /** Mostra "3/11" no fim (só no compacto, onde há espaço). */
  passo?: number;
  totalPassos?: number;
}) {
  const grande = tamanho === "grande";
  const lado = grande ? "size-10" : "size-7";
  const icone = grande ? 17 : 14;
  const botao = `grid ${lado} shrink-0 place-items-center rounded-xl text-ink/80 transition hover:bg-white/[0.08] hover:text-ink active:scale-[0.94] disabled:pointer-events-none disabled:opacity-25`;
  return (
    <div className={`${GRUPO_MESA} ${grande ? "gap-0.5 p-1" : "gap-0.5 p-0.5"}`}>
      <button type="button" onClick={onMaoAnterior} disabled={!onMaoAnterior} aria-label="Mão anterior" title="Mão anterior" className={botao}>
        <ChevronsLeft size={icone} />
      </button>
      <button type="button" onClick={onPassoAnterior} disabled={noInicio} aria-label="Passo anterior" title="Anterior (←)" className={botao}>
        <ChevronLeft size={icone} />
      </button>
      <button
        type="button"
        onClick={onPlay}
        disabled={noFim}
        aria-label={tocando ? "Pausar" : "Reproduzir"}
        title={tocando ? "Pausar (espaço)" : "Reproduzir (espaço)"}
        className={`${botao} ${tocando ? "bg-[#d4af37]/15 text-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#e2c35a]" : ""}`}
      >
        {tocando ? <Pause size={icone - 2} /> : <Play size={icone - 2} />}
      </button>
      {/* Próximo passo é o botão mais usado -- em dourado. */}
      <button
        type="button"
        onClick={onProximoPasso}
        disabled={noFim}
        aria-label="Próximo passo"
        title="Próximo (→)"
        className={`grid ${lado} shrink-0 place-items-center rounded-xl bg-[#d4af37] text-black transition hover:bg-[#e2c35a] active:scale-[0.94] disabled:pointer-events-none disabled:bg-white/[0.06] disabled:text-ink/25`}
      >
        <ChevronRight size={icone} strokeWidth={2.4} />
      </button>
      <button type="button" onClick={onProximaMao} disabled={!onProximaMao} aria-label="Próxima mão" title="Próxima mão" className={botao}>
        <ChevronsRight size={icone} />
      </button>
      {passo != null && totalPassos != null && (
        <span className="ml-0.5 mr-1.5 text-[10.5px] tabular-nums text-muted">
          {passo}/{totalPassos}
        </span>
      )}
    </div>
  );
}
