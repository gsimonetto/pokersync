"use client";

import { useMemo } from "react";
import { PentagonoHolograma, type EixoPentagono } from "@/components/painel/pentagono-holograma";
import type { AnalysisHandRow, PreflopMetrics } from "@/types/analysis";
import { SeloAmostra } from "./graficos/base";

// Pentágono do PERFIL DE JOGO: como você joga (estilo), não se está
// indo bem -- isso é o Score, que fica na tela de início. Três pontas de
// pré-flop e duas de pós-flop, no sentido horário a partir do topo.
//
// As frequências vivem em escalas muito diferentes (3-Bet ~5%, c-bet
// ~60%), então cada ponta vai de 0 até o SEU teto (escrito no hover). Com
// o valor puro, o 3-Bet viraria um pontinho no centro. O número de
// verdade fica escrito em cada ponta -- a forma é só a leitura rápida.
//
// Sem faixa "ideal" desenhada de propósito: não temos referência
// auditável pra essas frequências. Desenho: o mesmo pentágono em
// holograma do Score e da ficha do jogador.

const pctDe = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const fmt = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

function montarEixos(rows: AnalysisHandRow[], preflop: PreflopMetrics): EixoPentagono[] {
  // Base = chances reais (histórico da mão), não todas as mãos do agressor.
  const agressor = rows.filter((r) => r.posflop?.cbet.flop != null);
  const cbet = agressor.filter((r) => r.posflop!.cbet.flop === true);
  const chegouTurn = rows.filter((r) => r.posflop?.cbet.turn != null);
  const segundo = chegouTurn.filter((r) => r.posflop!.cbet.turn === true);
  const chances3bet = rows.filter((r) => r.threeBetOpportunity === true);
  const vpipN = rows.filter((r) => r.vpip).length;
  const pfrN = rows.filter((r) => r.pfr).length;
  const PRE = "Performance · pré-flop";
  const POS = "Performance · pós-flop";
  return [
    {
      origem: PRE,
      chave: "vpip",
      curto: "Entra no pote",
      titulo: "Entra no pote (VPIP)",
      oQueE: "Em quantas mãos você coloca dinheiro por vontade própria antes do flop. Mais alto = jogo mais solto.",
      comoCalcula: "Mãos com call ou raise voluntário ÷ mãos jogadas.",
      teto: 50,
      valor: preflop.vpip_pct,
      vezes: `${vpipN} de ${rows.length} mãos`,
    },
    {
      origem: PRE,
      chave: "agressao",
      curto: "Agressão pré",
      titulo: "Agressão pré-flop",
      oQueE: "Das mãos em que você entra, quantas são com raise (e não só pagando). Mais alto = mais agressivo.",
      comoCalcula: "PFR ÷ VPIP.",
      teto: 100,
      valor: pctDe(pfrN, vpipN),
      vezes: `${pfrN} de ${vpipN} mãos jogadas`,
    },
    {
      origem: PRE,
      chave: "3bet",
      curto: "3-Bet",
      titulo: "3-Bet",
      oQueE: "Das vezes em que alguém abriu o pote antes de você, quantas você re-aumentou.",
      comoCalcula: "Re-aumentos ÷ vezes com exatamente 1 raise na mesa na sua vez (mesma conta do número 3-Bet ao lado).",
      teto: 25,
      valor: preflop.three_bet_pct,
      vezes: `${chances3bet.filter((r) => r.threeBet).length} de ${chances3bet.length} chances`,
    },
    {
      origem: POS,
      chave: "cbet",
      curto: "C-bet flop",
      titulo: "C-bet no flop",
      oQueE: "Quando você foi o último a aumentar antes do flop, quantas vezes apostou no flop.",
      comoCalcula: "C-bets ÷ flops vistos como agressor pré-flop.",
      teto: 100,
      valor: pctDe(cbet.length, agressor.length),
      vezes: `${cbet.length} de ${agressor.length} flops`,
    },
    {
      origem: POS,
      chave: "barrel",
      curto: "2º tiro",
      titulo: "2º tiro no turn",
      oQueE: "Depois de apostar no flop e chegar ao turn, quantas vezes você apostou de novo.",
      comoCalcula: "2º tiro ÷ vezes que deu c-bet e chegou ao turn.",
      teto: 100,
      valor: pctDe(segundo.length, chegouTurn.length),
      vezes: `${segundo.length} de ${chegouTurn.length} turns`,
    },
  ];
}

export function PerfilJogo({ rows, preflop }: { rows: AnalysisHandRow[]; preflop: PreflopMetrics }) {
  const eixos = useMemo(() => montarEixos(rows, preflop), [rows, preflop]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-[12px] leading-tight text-muted/80">Perfil de jogo</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-[#d4af37]">
            pré e pós-flop
          </p>
        </div>
        <SeloAmostra n={rows.length} />
      </div>

      {/* px-8: os rótulos das pontas ficam fora do pentágono e o da direita
          ("Agressão pré") encostava na borda do card. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <PentagonoHolograma
          eixos={eixos}
          amostra={rows.length}
          formatar={fmt}
          rotuloValor="Você"
          vazio="Sem mãos no período — o perfil aparece assim que você importar o histórico."
        />
      </div>

      <p className="mt-1 px-1 text-center text-[10.5px] text-muted/60">
        Cada ponta tem sua escala — passe o mouse pra ver o número e de onde vem.
      </p>
    </div>
  );
}
