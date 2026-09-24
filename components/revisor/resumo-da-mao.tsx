"use client";

import { useMemo } from "react";
import { Eye, FileText, Zap } from "lucide-react";
import { Card } from "@/components/drill/card";
import type { ParsedHand } from "@/lib/poker/hand-parser";
import { projectHandAtStep } from "@/lib/poker/hand-replay-projector";
import { resumoDaMao, formatarBb } from "@/lib/poker/hand-summary";
import { CartaTexto, FATIA_BOARD, NOME_RUA, rotuloAcao } from "./linha-do-tempo";

// "Resumo da mão" do Analisar mão: o que antes era só o hand history cru
// (texto em inglês da sala, difícil de ler) vira um resumo em português --
// suas cartas, posição, stack, resultado e as ações rua por rua, com as
// suas destacadas. O texto original continua disponível, recolhido.
// Usa o MESMO cálculo do replayer (projectHandAtStep no último passo),
// então os números batem com a mesa.

export function ResumoDaMao({ hand, historicoBruto }: { hand: ParsedHand; historicoBruto: string | null }) {
  const dados = useMemo(() => {
    try {
      const st = projectHandAtStep(hand, Number.MAX_SAFE_INTEGER);
      const heroSlot = st.seatLayout.find((s) => s.isHero);
      const heroSeat = hand.seats.find((s) => s.playerName === hand.heroName);
      return {
        ruas: st.tableHand.history,
        board: st.tableHand.board,
        heroPos: heroSlot?.posLabel ?? hand.heroPosition ?? null,
        stackBb: heroSeat ? Math.round((heroSeat.startingChips / st.bbUnit) * 10) / 10 : null,
      };
    } catch {
      return null;
    }
  }, [hand]);
  const resumo = useMemo(() => resumoDaMao(hand), [hand]);
  const bb = resumo.resultadoBb;

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-ink">Resumo da mão</h3>
        {bb != null && (
          <span
            className="tnum shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-bold"
            style={{
              color: bb >= 0 ? "#34D399" : "#F87171",
              borderColor: bb >= 0 ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)",
              background: bb >= 0 ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)",
            }}
          >
            {bb >= 0 ? "Você ganhou " : "Você perdeu "}
            {formatarBb(Math.abs(bb)).replace(/^\+/, "")}
          </span>
        )}
      </header>

      {/* Suas cartas + contexto em uma linha. */}
      <div className="mt-3 flex items-center gap-3">
        {hand.heroCards && hand.heroCards.length > 0 && (
          <div className="flex shrink-0 gap-1">
            {hand.heroCards.map((c) => (
              <Card key={c} card={c} size="villain" />
            ))}
          </div>
        )}
        <div className="min-w-0 text-[12.5px] leading-relaxed text-muted">
          <p className="m-0 text-ink">
            Você {dados?.heroPos ? <>no <b>{dados.heroPos}</b></> : "na mesa"}
            {dados?.stackBb != null && <> com <b>{dados.stackBb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bb</b></>}
          </p>
          <p className="m-0">
            Blinds {hand.smallBlind}/{hand.bigBlind} · {hand.seats.length} jogadores
          </p>
          {(resumo.allIn || resumo.showdown) && (
            <p className="m-0 mt-1 flex flex-wrap gap-1.5">
              {resumo.allIn && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#F87171]/35 bg-[#F87171]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#F87171]">
                  <Zap size={10} /> All-in
                </span>
              )}
              {resumo.showdown && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#60A5FA]/35 bg-[#60A5FA]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#60A5FA]">
                  <Eye size={10} /> Cartas mostradas
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Rua por rua -- só as ruas que existiram na mão. */}
      {dados && (
        <ol className="mt-3.5 flex flex-col gap-2">
          {dados.ruas.map((r) => {
            const fatia = FATIA_BOARD[r.street];
            const cartas = fatia ? dados.board.slice(fatia[0], fatia[1]).filter((c): c is string => Boolean(c)) : [];
            if (r.street !== "PREFLOP" && cartas.length === 0 && r.actions.length === 0) return null;
            return (
              <li key={r.street} className="painel-bloco rounded-xl border border-white/5 px-3 py-2">
                <div className="flex items-baseline gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {NOME_RUA[r.street] ?? r.street}
                  {cartas.length > 0 && (
                    <span className="flex gap-1.5 text-[12.5px] normal-case tracking-normal">
                      {cartas.map((c) => (
                        <CartaTexto key={c} card={c} />
                      ))}
                    </span>
                  )}
                </div>
                <p className="m-0 mt-1 text-[12px] leading-relaxed text-ink/85">
                  {r.actions.length === 0
                    ? "Sem ação (já estava all-in)."
                    : r.actions.map((a, i) => {
                        const hero = a.pos === dados.heroPos;
                        return (
                          <span key={i}>
                            {i > 0 && <span className="text-muted"> · </span>}
                            <span className={hero ? "font-semibold text-[#d4af37]" : a.label === "fold" ? "text-muted" : ""}>
                              {hero ? "Você" : a.pos} {rotuloAcao(a.label)}
                            </span>
                          </span>
                        );
                      })}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {historicoBruto && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] text-muted transition-colors hover:text-ink">
            <FileText size={13} /> Ver hand history original
          </summary>
          <pre className="painel-scroll mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-2.5 font-mono text-[11px] text-muted">
            {historicoBruto}
          </pre>
        </details>
      )}
    </section>
  );
}
