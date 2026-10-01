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

// Nome do raise no pré-flop, do jeito que quem joga fala: o 1º é a
// abertura, depois 3-bet, 4-bet... (pedido: "tomei 4bet" -- a faixa
// dizia "HJ raise 15", sem deixar claro que era a 4-bet).
function nomeDoRaisePreflop(ordem: number): string {
  return ordem <= 1 ? "abre" : `${ordem + 1}-bet`;
}

/** Nome de cada raise da rua (mesma ordem das ações); fora do pré-flop, nada muda. */
export function nomesDosRaises(street: string, acoes: { label: string }[]): (string | undefined)[] {
  let raises = 0;
  return acoes.map((a) => (street.toUpperCase() === "PREFLOP" && a.label.startsWith("raise to") ? nomeDoRaisePreflop(++raises) : undefined));
}

// "raise to 8.25bb" -> "raise 8,3" (o "bb" fica implícito na faixa toda).
// `nomeRaise` troca o "raise" pelo nome no pré-flop (ex.: "4-bet 15").
export function rotuloAcao(label: string, nomeRaise?: string): string {
  const m = label.match(/^(raise to|bet|call|posts|all-in) ([\d.]+)bb$/);
  if (!m) return label;
  const verbo = m[1] === "raise to" ? nomeRaise ?? "raise" : m[1];
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

/** Carta do board em miniatura (fundo escuro, número + naipe na cor do baralho). */
function MiniCarta({ card }: { card: string }) {
  return (
    <span
      style={{
        display: "inline-grid",
        placeItems: "center",
        minWidth: 22,
        height: 18,
        padding: "0 3px",
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1,
        background: "rgba(255,255,255,0.08)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
      }}
    >
      <CartaTexto card={card} />
    </span>
  );
}

type ItemAcao = { pos: string | null; texto: string; hero: boolean; folds: boolean };

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
        gap: 10,
        height: 96,
        flexShrink: 0,
        // Direita maior: o botao flutuante de ajuda (canto inferior
        // direito da tela) ficava por cima do resultado.
        padding: "8px 72px 8px 8px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Cada rua num quadro próprio (pedido explícito: "separe melhor
          essa parte, está bagunçado demais"): cabeçalho com o nome e as
          cartas da rua, e embaixo uma ação por linha, com a posição
          alinhada -- antes eram pílulas soltas uma atrás da outra. O
          pré-flop é mais largo (é a rua com mais ação) e, quando passa de
          3 linhas, as ações continuam numa segunda coluna. */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))", gap: 6, minWidth: 0 }}>
        {ruas.map((r) => {
          const fatia = FATIA_BOARD[r.street];
          const cartas = fatia ? board.slice(fatia[0], fatia[1]).filter((c): c is string => Boolean(c)) : [];
          const alcancada = r.street === "PREFLOP" || cartas.length > 0 || r.actions.length > 0;
          // Folds seguidos de outros jogadores viram um contador só
          // ("4 folds") -- a mão real de 8 jogadores tem mais fold do que
          // qualquer outra coisa, e isso escondia as ações que importam.
          const itens: ItemAcao[] = [];
          let folds = 0;
          const nomes = nomesDosRaises(r.street, r.actions);
          const soltarFolds = () => {
            if (folds > 0) itens.push({ pos: null, texto: folds === 1 ? "1 fold" : `${folds} folds`, hero: false, folds: true });
            folds = 0;
          };
          for (const [i, a] of r.actions.entries()) {
            const hero = a.pos === heroPos;
            if (a.label === "fold" && !hero) {
              folds++;
              continue;
            }
            soltarFolds();
            itens.push({ pos: hero ? "Você" : a.pos, texto: rotuloAcao(a.label, nomes[i]), hero, folds: false });
          }
          soltarFolds();
          return (
            <div
              key={r.street}
              style={{
                minWidth: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 5,
                padding: "6px 9px",
                borderRadius: 10,
                background: r.current ? "rgba(212,175,55,0.06)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${r.current ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.06)"}`,
                opacity: alcancada ? 1 : 0.35,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 18 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: r.current ? "#FFFFFF" : "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
                  {NOME_RUA[r.street] ?? r.street}
                </span>
                {cartas.length > 0 && (
                  <span style={{ display: "flex", gap: 3 }}>
                    {cartas.map((c) => (
                      <MiniCarta key={c} card={c} />
                    ))}
                  </span>
                )}
              </div>
              {itens.length === 0 ? (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>—</span>
              ) : (
                <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(3, 16px)", gridAutoColumns: "max-content", justifyContent: "start", columnGap: 18, rowGap: 1 }}>
                  {itens.map((it, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                        fontSize: 11,
                        lineHeight: "16px",
                        whiteSpace: "nowrap",
                        ...num,
                      }}
                    >
                      {it.folds ? (
                        <span style={{ color: "rgba(255,255,255,0.32)", fontStyle: "italic" }}>{it.texto}</span>
                      ) : (
                        <>
                          <span
                            style={{
                              width: 34,
                              flexShrink: 0,
                              fontSize: 10,
                              fontWeight: 700,
                              color: it.hero ? "#d4af37" : "rgba(255,255,255,0.45)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {it.pos}
                          </span>
                          <span style={{ color: it.hero ? "#F3D77A" : "rgba(255,255,255,0.85)", fontWeight: it.hero ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {it.texto}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
