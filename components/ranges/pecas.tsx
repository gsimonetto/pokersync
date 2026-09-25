"use client";

import type { ReactNode } from "react";
import { usePreferenciasMesa } from "@/lib/hooks/use-preferencias-mesa";
import type { Feita, Projeto } from "@/lib/ranges/acertos";

// Peças pequenas do Construtor de Ranges: cores, números e chips.

export const OURO = "#d4af37";
export const OURO_CLARO = "#e8cb6a";
export const VERDE = "#34D399";
export const AZUL = "#3B82F6";
export const AZUL_CLARO = "#60A5FA";
export const VERMELHO = "#F87171";

export const COR_FEITA: Record<Feita, string> = {
  sf: VERDE,
  quadra: VERDE,
  full: VERDE,
  flush: VERDE,
  seq: VERDE,
  trinca: VERDE,
  doispares: VERDE,
  overpair: OURO,
  topo: OURO,
  meio: "#e2b867",
  fraco: "#b89a6a",
  asalto: "#9ca3af",
  nada: "#6b7280",
};
export const COR_PROJETO: Record<Projeto, string> = { fd: AZUL_CLARO, oesd: AZUL_CLARO, gut: "#93C5FD", bdfd: "#93C5FD", over: "#93C5FD" };

/** Total de combos do baralho (todas as mãos possíveis). */
export const TOTAL_COMBOS = 1326;

/** 0..1 -> "12,3%". */
export function pct(x: number, casas = 1): string {
  return `${(x * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Combos contados com peso: "638" ou "527,5". */
export function numCombos(x: number): string {
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const SIMBOLO: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const simboloNaipe = (n: string) => SIMBOLO[n] ?? "";

// Mesmas cores das cartas da mesa (4 cores, ou 2 cores se a pessoa trocou
// nas Configurações): fundo da carta e tom claro pro texto em fundo escuro.
const FUNDO_4: Record<string, string> = { s: "#1A1A1A", h: "#B91C1C", d: "#1D4E89", c: "#1E6B45" };
const TEXTO_4: Record<string, string> = { s: "rgba(255,255,255,0.88)", h: "#F87171", d: "#60A5FA", c: "#34D399" };

export function useCoresNaipe(): { fundo: (n: string) => string; texto: (n: string) => string } {
  const { baralho } = usePreferenciasMesa();
  const mapa = (n: string) => (baralho === "2cores" ? ({ d: "h", c: "s" } as Record<string, string>)[n] ?? n : n);
  return { fundo: (n) => FUNDO_4[mapa(n)] ?? FUNDO_4.s, texto: (n) => TEXTO_4[mapa(n)] ?? TEXTO_4.s };
}

/** "Kh" -> K♥ colorido (texto corrido). */
export function CartaTexto({ carta }: { carta: string }) {
  const cores = useCoresNaipe();
  return (
    <span className="whitespace-nowrap font-semibold" style={{ color: cores.texto(carta[1]) }}>
      {carta[0] === "T" ? "10" : carta[0]}
      {simboloNaipe(carta[1])}
    </span>
  );
}

export function CartasTexto({ cartas }: { cartas: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {cartas.map((c) => (
        <CartaTexto key={c} carta={c} />
      ))}
    </span>
  );
}

/** Carta pequena (seletor de cartas): fundo na cor do naipe. */
export function CartaMini({ carta, className = "", style }: { carta: string; className?: string; style?: React.CSSProperties }) {
  const cores = useCoresNaipe();
  return (
    <span
      className={`grid place-items-center rounded-[5px] font-bold leading-none text-white ${className}`}
      style={{ background: cores.fundo(carta[1]), ...style }}
    >
      <span className="flex flex-col items-center gap-[1px]">
        <span>{carta[0] === "T" ? "10" : carta[0]}</span>
        <span className="text-[0.85em]">{simboloNaipe(carta[1])}</span>
      </span>
    </span>
  );
}

export function Chip({
  children,
  ativo = false,
  cor,
  onClick,
  title,
}: {
  children: ReactNode;
  ativo?: boolean;
  cor?: string;
  onClick?: () => void;
  title?: string;
}) {
  const estilo = {
    borderColor: ativo ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.12)",
    background: ativo ? "rgba(212,175,55,0.14)" : "rgba(255,255,255,0.03)",
    color: cor ?? (ativo ? OURO_CLARO : "rgba(255,255,255,0.72)"),
  };
  const classe = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-medium";
  if (!onClick)
    return (
      <span className={classe} style={estilo} title={title}>
        {children}
      </span>
    );
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={ativo} className={`${classe} transition hover:border-white/25 active:scale-[0.97]`} style={estilo}>
      {children}
    </button>
  );
}

export function Rotulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted ${className}`}>{children}</div>;
}

/** Segmentos (tipo abas pequenas) dentro de um painel. */
export function Segmentos<T extends string>({
  valor,
  opcoes,
  onChange,
  cheio = false,
  rotulo,
}: {
  valor: T;
  opcoes: { v: T; t: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  cheio?: boolean;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={`rounded-xl border border-white/10 bg-white/[0.03] p-[3px] ${cheio ? "flex w-full" : "inline-flex"}`}>
      {opcoes.map((o) => {
        const ativo = o.v === valor;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={o.title}
            onClick={() => onChange(o.v)}
            className={`rounded-lg px-2.5 py-1.5 text-center text-[12px] font-semibold transition-colors ${cheio ? "flex-1" : ""} ${
              ativo ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white/80"
            }`}
          >
            {o.t}
          </button>
        );
      })}
    </div>
  );
}

// Equidade 30% (vermelho) -> 50% (âmbar) -> 70%+ (verde).
export function corEquidade(e: number): string {
  const t = Math.max(0, Math.min(1, (e - 30) / 40));
  const r = Math.round(t < 0.5 ? 239 : 239 - (t - 0.5) * 2 * (239 - 52));
  const g = Math.round(t < 0.5 ? 68 + t * 2 * (179 - 68) : 179 + (t - 0.5) * 2 * (211 - 179));
  const b = Math.round(t < 0.5 ? 68 - t * 2 * 40 : 28 + (t - 0.5) * 2 * (153 - 28));
  return `rgb(${r},${g},${b})`;
}

/** "há 5 min", "ontem"... */
export function haQuanto(iso: string | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
