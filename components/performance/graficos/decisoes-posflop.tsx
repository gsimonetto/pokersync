"use client";

import { Shuffle } from "lucide-react";
import type { AnalysisHandRow, RuaPosflop } from "@/types/analysis";
import { COR_PFR, COR_VPIP } from "./base";
import { CartaoDecisoes, COR_FOLD, type Grupo, type Situacao } from "./decisoes";

// "O que você faz depois do flop": mesma leitura do card de pré-flop
// (desiste | paga | aumenta), agora nas situações de pós-flop. Tudo
// medido nas vezes em que a situação ACONTECEU, lido do histórico da mão.
// Sem faixa de referência (não temos fonte confiável pra elas).

const NOME_RUA: Record<RuaPosflop, { nome: string; detalhe: string }> = {
  flop: { nome: "C-bet no flop", detalhe: "o agressor pré-flop apostou no flop" },
  turn: { nome: "2º tiro no turn", detalhe: "ele apostou de novo no turn" },
  river: { nome: "3º tiro no river", detalhe: "e de novo no river" },
};

function contraCbet(rows: AnalysisHandRow[], rua: RuaPosflop): Situacao {
  const base = rows.filter((r) => r.posflop?.respostaCbet[rua] != null);
  const conta = (v: string) => base.filter((r) => r.posflop!.respostaCbet[rua] === v).length;
  return {
    ...NOME_RUA[rua],
    base,
    fatias: [
      { rotulo: "Desiste", n: conta("fold"), cor: COR_FOLD },
      { rotulo: "Paga", n: conta("call"), cor: COR_VPIP },
      { rotulo: "Aumenta", n: conta("raise"), cor: COR_PFR },
    ],
  };
}

function montar(rows: AnalysisHandRow[]): Grupo[] {
  const chanceDonk = rows.filter((r) => r.posflop?.donk != null);
  const donks = chanceDonk.filter((r) => r.posflop!.donk === true).length;
  const chanceCr = rows.filter((r) => r.posflop?.checkRaise.flop != null);
  const crs = chanceCr.filter((r) => r.posflop!.checkRaise.flop === true).length;
  return [
    {
      titulo: "Quando apostam em você",
      situacoes: (["flop", "turn", "river"] as const).map((rua) => contraCbet(rows, rua)),
    },
    {
      titulo: "Sem a iniciativa",
      situacoes: [
        {
          nome: "Donk bet no flop",
          detalhe: "você age antes do agressor pré-flop",
          base: chanceDonk,
          fatias: [
            { rotulo: "Dá check", n: chanceDonk.length - donks, cor: COR_FOLD },
            { rotulo: "Aposta primeiro", n: donks, cor: COR_PFR },
          ],
        },
        {
          nome: "Check-raise no flop",
          detalhe: "você deu check e apostaram",
          base: chanceCr,
          fatias: [
            { rotulo: "Não aumenta", n: chanceCr.length - crs, cor: COR_FOLD },
            { rotulo: "Check-raise", n: crs, cor: COR_PFR },
          ],
        },
      ],
    },
  ];
}

export function DecisoesPosflop({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  return <CartaoDecisoes title="O que você faz depois do flop" icon={<Shuffle size={15} />} grupos={montar(rows)} ordem={ordem} larguraColunas={760} />;
}
