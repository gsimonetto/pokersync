"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { F, SUITS, num } from "@/lib/poker/drill-theme";
import { formatarBb } from "@/lib/poker/hand-summary";
import type { HistoryStep } from "@/components/drill/poker-table";
import { usePreferenciasMesa } from "@/lib/hooks/use-preferencias-mesa";

// Linha do tempo da mão, embaixo da mesa: as 4 ruas lado a lado com as
// ações que JÁ aconteceram até o passo atual (o replayer continua
// revelando passo a passo -- ações futuras não aparecem). O projector já
// montava esse histórico (tableHand.history), mas nada mostrava na tela:
// pra entender a mão era preciso clicar passo a passo e decorar.
//
// Altura FIXA de propósito: a mesa acima mede o espaço que sobra
// (ResizeObserver), e uma faixa que cresce a cada ação faria a mesa
// "piscar" redimensionando.

export const NOME_RUA: Record<string, string> = { PREFLOP: "Pré-flop", FLOP: "Flop", TURN: "Turn", RIVER: "River" };
// Quantas cartas do board cada rua revela (flop 3, turn 1, river 1).
export const FATIA_BOARD: Record<string, [number, number]> = { FLOP: [0, 3], TURN: [3, 4], RIVER: [4, 5] };

// "raise to 8.25bb" -> "raise 8,3" (o "bb" fica implícito na faixa toda).
export function rotuloAcao(label: string): string {
  const m = label.match(/^(raise to|bet|call|posts|all-in) ([\d.]+)bb$/);
  if (!m) return label;
  const verbo = m[1] === "raise to" ? "raise" : m[1];
  const valor = Number(m[2]).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${verbo} ${valor}`;
}

export function CartaTexto({ card }: { card: string }) {
  const { baralho } = usePreferenciasMesa();
  const rank = card.slice(0, -1).replace("T", "10");
  // Baralho de 2 cores (Configurações): ouros com a cor de copas e paus
  // com a de espadas, igual às cartas da mesa.
  const naipe = baralho === "2cores" ? ({ d: "h", c: "s" } as Record<string, string>)[card.slice(-1)] ?? card.slice(-1) : card.slice(-1);
  const s = SUITS[card.slice(-1)];
  // Espadas: a cor do baralho é quase preta (feita pra carta branca) --
  // sobre o fundo escuro vira cinza claro.
  const cor = naipe === "s" ? "#E5E7EB" : SUITS[naipe]?.c ?? "#E5E7EB";
  return (
    <span style={{ color: cor, fontWeight: 700 }}>
      {rank}
      {s?.g ?? ""}
    </span>
  );
}

export function LinhaDoTempo({
  ruas,
  board,
  heroPos,
  resultadoBb,
  emFichas = false,
  trainHref,
}: {
  ruas: HistoryStep[];
  /** 5 posições; carta ainda não revelada = null. */
  board: (string | null)[];
  heroPos: string | null;
  /** Só no último passo da mão: lucro/prejuízo do herói em bb (ou em fichas, com emFichas). */
  resultadoBb: number | null;
  /** Mesa em fichas (opção BB/Fichas): ações e resultado já chegam em fichas. */
  emFichas?: boolean;
  trainHref: string | null;
}) {
  return (
    <div
      className="painel-vidro"
      style={{
        fontFamily: F,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "stretch",
        gap: 12,
        height: 96,
        flexShrink: 0,
        // Direita maior: o botao flutuante de ajuda (canto inferior
        // direito da tela) ficava por cima do resultado.
        padding: "9px 72px 9px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Pre-flop mais largo: e' a rua com mais acao (8 jogadores). */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))", gap: 12, minWidth: 0 }}>
        {ruas.map((r) => {
          const fatia = FATIA_BOARD[r.street];
          const cartas = fatia ? board.slice(fatia[0], fatia[1]).filter((c): c is string => Boolean(c)) : [];
          const alcancada = r.street === "PREFLOP" || cartas.length > 0 || r.actions.length > 0;
          // Folds seguidos de outros jogadores viram um contador só
          // ("4 folds") -- a mão real de 8 jogadores tem mais fold do que
          // qualquer outra coisa, e isso escondia as ações que importam.
          const itens: { texto: string; hero: boolean; fraco: boolean }[] = [];
          let folds = 0;
          const soltarFolds = () => {
            if (folds > 0) itens.push({ texto: folds === 1 ? "1 fold" : `${folds} folds`, hero: false, fraco: true });
            folds = 0;
          };
          for (const a of r.actions) {
            const hero = a.pos === heroPos;
            if (a.label === "fold" && !hero) {
              folds++;
              continue;
            }
            soltarFolds();
            itens.push({ texto: `${hero ? "Você" : a.pos} ${rotuloAcao(a.label)}`, hero, fraco: false });
          }
          soltarFolds();
          return (
            <div key={r.street} style={{ minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 4, opacity: alcancada ? 1 : 0.35 }}>
              {/* flexWrap: com a faixa estreita (tela de ~1024) as cartas
                  da rua passavam por cima da coluna do lado -- agora
                  descem pra linha de baixo. */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <span style={{ color: r.current ? "#FFFFFF" : "rgba(255,255,255,0.45)" }}>{NOME_RUA[r.street] ?? r.street}</span>
                {cartas.length > 0 && (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 3, fontSize: 11, letterSpacing: 0, textTransform: "none" }}>
                    {cartas.map((c) => (
                      <CartaTexto key={c} card={c} />
                    ))}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 3, overflow: "hidden", maxHeight: 60 }}>
                {itens.length === 0 ? (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>—</span>
                ) : (
                  itens.map((it, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 10.5,
                        lineHeight: "18px",
                        padding: "0 6px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                        ...num,
                        color: it.hero ? "#111111" : it.fraco ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.82)",
                        background: it.hero ? "#d4af37" : it.fraco ? "transparent" : "rgba(255,255,255,0.07)",
                        fontWeight: it.hero ? 700 : 500,
                      }}
                    >
                      {it.texto}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Direita: resultado da mão (no último passo) e o atalho pro
          Treino quando existe drill pra esse spot. Sem drill, fica vazio
          -- antes aparecia um "Sem drill correspondente" solto. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 6, minWidth: 0 }}>
        {resultadoBb != null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              ...num,
              color: resultadoBb >= 0 ? "#34D399" : "#F87171",
              background: resultadoBb >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              border: `1px solid ${resultadoBb >= 0 ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
            }}
          >
            {resultadoBb >= 0 ? "Você ganhou " : "Você perdeu "}
            {emFichas
              ? `${Math.abs(resultadoBb).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} fichas`
              : formatarBb(Math.abs(resultadoBb)).replace(/^\+/, "")}
          </span>
        )}
        {trainHref && (
          <Link
            href={trainHref}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)",
              color: "#FFFFFF", borderRadius: 10, padding: "6px 12px",
              fontSize: 12, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            <Target size={13} /> Treinar esse spot
          </Link>
        )}
      </div>
    </div>
  );
}
