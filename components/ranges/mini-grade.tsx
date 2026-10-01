"use client";

import { memo } from "react";
import { TODAS_AS_MAOS } from "@/lib/ranges/cartas";
import { pesoDaMao, type Pesos } from "@/lib/ranges/notacao";
import { COR_ACAO } from "@/lib/poker/grade-gto";
import { corDaAcao } from "@/lib/ranges/prontos";

// "#rrggbb" + transparência 0..1 -> "rgba(...)".
function comAlfa(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

// Grade 13x13 em miniatura (cartões da biblioteca): a mão no range ganha a
// cor da ação (raise vermelho, call verde, 3-bet vermelho escuro, all-in
// laranja; sem ação, dourado) -- mais forte = mais peso. Fora do range: cinza.
export const MiniGrade = memo(function MiniGrade({
  pesos,
  pesosCombo = {},
  largura = 104,
  acao = null,
}: {
  pesos: Pesos;
  pesosCombo?: Pesos;
  largura?: number;
  acao?: string | null;
}) {
  const cor = corDaAcao(acao);
  return (
    <div className="grid shrink-0 gap-px" style={{ gridTemplateColumns: "repeat(13, 1fr)", width: largura }} aria-hidden="true">
      {TODAS_AS_MAOS.map((mao) => {
        const p = pesoDaMao(pesos, pesosCombo, mao);
        return (
          <span
            key={mao}
            className="aspect-square rounded-[1px]"
            style={{ background: p > 0 ? comAlfa(cor, 0.25 + (0.7 * p) / 100) : comAlfa(COR_ACAO.fora, 0.1) }}
          />
        );
      })}
    </div>
  );
});
