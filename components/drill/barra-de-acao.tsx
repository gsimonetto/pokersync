"use client";

import { F, num } from "@/lib/poker/drill-theme";

// Botões de ação do Modo Treino no padrão das salas (PokerStars /
// GGPoker):
// - ORDEM fixa pelo tipo da jogada, da mais passiva pra mais agressiva
//   (Fold → Call → Raise → All-in), da esquerda pra direita. Antes a
//   ordem dependia do papel do botão no exercício (resposta do solver
//   sempre no meio, jogada "errada" sempre na direita).
// - Duas linhas: a jogada em cima e o VALOR embaixo ("Raise" / "2,2 BB"),
//   como nas salas. Call mostra quanto falta pagar; Raise e All-in
//   mostram o total da aposta.
// - COR pelo tipo da jogada, a mesma da grade de range ao lado da mesa
//   (Fold cinza, Call azul, Raise verde, All-in vermelho) -- o jogador
//   liga a cor do botão à cor da grade.
// - Atalho pela POSIÇÃO: Q é sempre o botão da esquerda (Fold), W o do
//   meio e E o da direita -- a tecla segue o botão, igual hotkey de sala.

export type TipoAcao = "fold" | "check" | "call" | "raise" | "allin";

export interface OpcaoAcao<Id extends string = string> {
  id: Id;
  tipo: TipoAcao;
  /** Texto de cima: "Fold", "Call", "Raise", "All-in". */
  verbo: string;
  /** Texto de baixo, em BB. Ausente no Fold/Check. */
  valorBb?: number | null;
}

// Paleta = a da grade de range (components/ranges/range-grid.tsx), um
// tom mais fechado pra texto branco ter contraste em cima.
export const COR_ACAO: Record<TipoAcao, { base: string; topo: string; borda: string }> = {
  fold: { base: "#2B3038", topo: "#3A404A", borda: "rgba(255,255,255,0.14)" },
  check: { base: "#1D4ED8", topo: "#2F64EA", borda: "rgba(147,197,253,0.35)" },
  call: { base: "#1D4ED8", topo: "#2F64EA", borda: "rgba(147,197,253,0.35)" },
  raise: { base: "#15803D", topo: "#1C9A4B", borda: "rgba(134,239,172,0.35)" },
  allin: { base: "#C62828", topo: "#DE3A3A", borda: "rgba(252,165,165,0.35)" },
};

const PESO: Record<TipoAcao, number> = { fold: 0, check: 1, call: 1, raise: 2, allin: 3 };
export const TECLAS = ["Q", "W", "E"] as const;

/** Ordena da jogada mais passiva pra mais agressiva (ordem das salas). */
export function ordenarOpcoes<T extends OpcaoAcao>(opcoes: T[]): T[] {
  return [...opcoes].sort((a, b) => PESO[a.tipo] - PESO[b.tipo] || (a.valorBb ?? 0) - (b.valorBb ?? 0));
}

/** "2,2 BB" -- vírgula decimal, BB maiúsculo, no máximo 1 casa. */
export function fmtBB(v: number): string {
  return `${(Math.round(v * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} BB`;
}

/** Nome curto da jogada com valor, pra frases ("Raise 2,2 BB"). */
export function nomeComValor(o: OpcaoAcao): string {
  return o.valorBb != null ? `${o.verbo} ${fmtBB(o.valorBb)}` : o.verbo;
}

export function BotaoAcao({
  opcao,
  tecla,
  onClick,
  compacto = false,
}: {
  opcao: OpcaoAcao;
  /** Tecla de atalho mostrada no canto (só no computador). */
  tecla?: string;
  onClick: () => void;
  /** Celular: botão mais estreito, sem tecla. */
  compacto?: boolean;
}) {
  const cor = COR_ACAO[opcao.tipo];
  return (
    <button
      type="button"
      onClick={onClick}
      className="ps-botao-acao"
      style={{
        position: "relative",
        fontFamily: F,
        width: compacto ? 92 : 148,
        minHeight: compacto ? 50 : 58,
        padding: compacto ? "7px 6px" : "8px 12px",
        borderRadius: compacto ? 12 : 12,
        border: `1px solid ${cor.borda}`,
        background: `linear-gradient(180deg, ${cor.topo} 0%, ${cor.base} 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 6px 16px rgba(0,0,0,0.45)",
        color: "#FFFFFF",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
      }}
    >
      <span style={{ fontSize: compacto ? 13.5 : 15.5, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.01em" }}>{opcao.verbo}</span>
      {opcao.valorBb != null && (
        <span style={{ fontSize: compacto ? 11.5 : 12.5, fontWeight: 600, lineHeight: 1.2, opacity: 0.88, ...num }}>{fmtBB(opcao.valorBb)}</span>
      )}
      {tecla && !compacto && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 5,
            right: 6,
            minWidth: 15,
            height: 15,
            padding: "0 3px",
            borderRadius: 4,
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.75)",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {tecla}
        </span>
      )}
    </button>
  );
}

// Selo pequeno com a jogada escolhida ("Você jogou [Raise 2,2 BB]"),
// na mesma cor do botão.
export function SeloAcao({ opcao }: { opcao: OpcaoAcao }) {
  const cor = COR_ACAO[opcao.tipo];
  return (
    <span
      style={{
        fontFamily: F,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: "#FFFFFF",
        background: cor.base,
        border: `1px solid ${cor.borda}`,
        whiteSpace: "nowrap",
        ...num,
      }}
    >
      {nomeComValor(opcao)}
    </span>
  );
}
