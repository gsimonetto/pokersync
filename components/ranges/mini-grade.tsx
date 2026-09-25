"use client";

import { memo } from "react";
import { TODAS_AS_MAOS } from "@/lib/ranges/cartas";
import { pesoDaMao, type Pesos } from "@/lib/ranges/notacao";

// Grade 13x13 em miniatura (cartões da biblioteca): mais dourado = mais peso.
export const MiniGrade = memo(function MiniGrade({ pesos, pesosCombo = {}, largura = 104 }: { pesos: Pesos; pesosCombo?: Pesos; largura?: number }) {
  return (
    <div className="grid shrink-0 gap-px" style={{ gridTemplateColumns: "repeat(13, 1fr)", width: largura }} aria-hidden="true">
      {TODAS_AS_MAOS.map((mao) => {
        const p = pesoDaMao(pesos, pesosCombo, mao);
        return (
          <span
            key={mao}
            className="aspect-square rounded-[1px]"
            style={{ background: p > 0 ? `rgba(212,175,55,${0.2 + (0.72 * p) / 100})` : "rgba(255,255,255,0.06)" }}
          />
        );
      })}
    </div>
  );
});
