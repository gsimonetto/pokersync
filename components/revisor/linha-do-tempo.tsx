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

type ItemAcao = { pos: string | null; texto: string; hero: boolean; folds: boolean };

/** Ações da rua prontas pra mostrar: folds seguidos dos outros viram um
 *  contador só ("4 folds") -- a mão real de 8 jogadores tem mais fold do
 *  que qualquer outra coisa, e isso escondia as ações que importam. */
function itensDaRua(r: HistoryStep, heroPos: string | null): ItemAcao[] {
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
  return itens;
}

function ruaAlcancada(r: HistoryStep, board: (string | null)[]): boolean {
  const fatia = FATIA_BOARD[r.street];
  const cartas = fatia ? board.slice(fatia[0], fatia[1]).filter(Boolean) : [];
  return r.street === "PREFLOP" || cartas.length > 0 || r.actions.length > 0;
}

function PilulaResultado({ resultadoBb, emFichas }: { resultadoBb: number; emFichas: boolean }) {
  return (
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
      {emFichas ? `${Math.abs(resultadoBb).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} fichas` : formatarBb(Math.abs(resultadoBb)).replace(/^\+/, "")}
    </span>
  );
}

function LinkTreinar({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.25)",
        color: "#FFFFFF",
        borderRadius: 10,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 500,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <Target size={13} /> Treinar esse spot
    </Link>
  );
}

/** Ações da mão em pé, numa coluna ao lado da mesa (pedido explícito: usar
 *  o espaço vazio do lado da mesa). Uma rua embaixo da outra, uma ação por
 *  linha com a posição alinhada; no fim, o resultado e o Treinar. */
export function LinhaDoTempoLateral({
  ruas,
  board,
  heroPos,
  resultadoBb,
  emFichas = false,
  trainHref,
}: {
  ruas: HistoryStep[];
  board: (string | null)[];
  heroPos: string | null;
  resultadoBb: number | null;
  emFichas?: boolean;
  trainHref: string | null;
}) {
  return (
    <aside style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 10, minHeight: 0, height: "100%" }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Ações da mão</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
        {ruas.map((r) => {
          const itens = itensDaRua(r, heroPos);
          return (
            <section
              key={r.street}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                background: r.current ? "rgba(212,175,55,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${r.current ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.06)"}`,
                opacity: ruaAlcancada(r, board) ? 1 : 0.3,
              }}
            >
              <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: r.current ? "#d4af37" : "rgba(255,255,255,0.5)" }}>
                {NOME_RUA[r.street] ?? r.street}
              </p>
              {itens.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.3)" }}>—</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                  {itens.map((it, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12, lineHeight: "17px", ...num }}>
                      {it.folds ? (
                        <span style={{ color: "rgba(255,255,255,0.32)" }}>{it.texto}</span>
                      ) : (
                        <>
                          <span style={{ width: 38, flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: it.hero ? "#d4af37" : "rgba(255,255,255,0.45)" }}>{it.pos}</span>
                          <span style={{ fontWeight: it.hero ? 700 : 500, color: it.hero ? "#F3D77A" : "rgba(255,255,255,0.88)" }}>{it.texto}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {(resultadoBb != null || trainHref) && (
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, paddingTop: 4 }}>
          {resultadoBb != null && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <PilulaResultado resultadoBb={resultadoBb} emFichas={emFichas} />
            </div>
          )}
          {trainHref && <LinkTreinar href={trainHref} />}
        </div>
      )}
    </aside>
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
        gap: 10,
        height: 96,
        flexShrink: 0,
        // Direita maior: o botao flutuante de ajuda (canto inferior
        // direito da tela) ficava por cima do resultado.
        padding: "6px 72px 6px 6px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Uma linha por rua (pedido explícito: "não precisa trazer as
          cartas, já estão no board; quero as ações, mas separadas, numa
          linha que não fique confusa"): o nome da rua numa coluna fixa e
          as ações em sequência, separadas por setas -- as suas em
          dourado, os folds dos outros agrupados e apagados. A rua em que
          o replay está fica marcada; as que ainda não chegaram, apagadas. */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minWidth: 0 }}>
        {ruas.map((r) => {
          const alcancada = ruaAlcancada(r, board);
          const itens = itensDaRua(r, heroPos);
          return (
            <div
              key={r.street}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
                height: 19,
                padding: "0 8px",
                borderRadius: 6,
                background: r.current ? "rgba(212,175,55,0.08)" : "transparent",
                opacity: alcancada ? 1 : 0.3,
              }}
            >
              <span
                style={{
                  width: 62,
                  flexShrink: 0,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: r.current ? "#d4af37" : "rgba(255,255,255,0.45)",
                  borderRight: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {NOME_RUA[r.street] ?? r.street}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", fontSize: 11.5, ...num }}>
                {itens.length === 0 ? (
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>
                ) : (
                  itens.map((it, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      {i > 0 && <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 11 }}>›</span>}
                      {it.folds ? (
                        <span style={{ color: "rgba(255,255,255,0.32)" }}>{it.texto}</span>
                      ) : (
                        <span>
                          <b style={{ fontWeight: 700, color: it.hero ? "#d4af37" : "rgba(255,255,255,0.55)" }}>{it.pos}</b>{" "}
                          <span style={{ fontWeight: it.hero ? 700 : 500, color: it.hero ? "#F3D77A" : "rgba(255,255,255,0.88)" }}>{it.texto}</span>
                        </span>
                      )}
                    </span>
                  ))
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Direita: resultado da mão (no último passo) e o atalho pro
          Treino quando existe drill pra esse spot. Sem drill, fica vazio
          -- antes aparecia um "Sem drill correspondente" solto. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 6, minWidth: 0 }}>
        {resultadoBb != null && <PilulaResultado resultadoBb={resultadoBb} emFichas={emFichas} />}
        {trainHref && <LinkTreinar href={trainHref} />}
      </div>
    </div>
  );
}
