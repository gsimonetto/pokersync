"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { AnalysisHandRow, PreflopMetrics } from "@/types/analysis";
import { COR_UNICA, SeloAmostra } from "./graficos/base";

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
// auditável pra essas frequências.

type Eixo = {
  chave: string;
  curto: string;
  titulo: string;
  oQueE: string;
  comoCalcula: string;
  teto: number;
  valor: number | null;
  vezes: string;
};

const CX = 100;
const CY = 104;
const R = 70;
const r2 = (n: number) => Math.round(n * 100) / 100; // mesmo arredondamento no servidor e no navegador
function ponto(i: number, fracao: number) {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return { x: r2(CX + R * fracao * Math.cos(a)), y: r2(CY + R * fracao * Math.sin(a)) };
}
const poligono = (fracoes: number[]) => fracoes.map((f, i) => `${ponto(i, f).x},${ponto(i, f).y}`).join(" ");
const pctDe = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const fmt = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

function montarEixos(rows: AnalysisHandRow[], preflop: PreflopMetrics): Eixo[] {
  // Base = chances reais (histórico da mão), não todas as mãos do agressor.
  const agressor = rows.filter((r) => r.posflop?.cbet.flop != null);
  const cbet = agressor.filter((r) => r.posflop!.cbet.flop === true);
  const chegouTurn = rows.filter((r) => r.posflop?.cbet.turn != null);
  const segundo = chegouTurn.filter((r) => r.posflop!.cbet.turn === true);
  const chances3bet = rows.filter((r) => r.threeBetOpportunity === true);
  const vpipN = rows.filter((r) => r.vpip).length;
  const pfrN = rows.filter((r) => r.pfr).length;
  return [
    {
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
  const reduzir = useReducedMotion();
  const [crescimento, setCrescimento] = useState(reduzir ? 1 : 0);
  useEffect(() => {
    if (reduzir) {
      setCrescimento(1);
      return;
    }
    const c = animate(0, 1, { duration: 0.9, ease: EASE, delay: 0.45, onUpdate: setCrescimento });
    return () => c.stop();
  }, [reduzir]);

  const temDado = eixos.some((e) => e.valor != null);
  const fracoes = eixos.map((e) => Math.min(1, (e.valor ?? 0) / e.teto));

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

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative aspect-square w-full max-w-[230px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <polygon
                key={f}
                points={poligono([f, f, f, f, f])}
                fill="none"
                stroke={f === 1 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
                strokeWidth={1}
              />
            ))}
            {eixos.map((e, i) => {
              const p = ponto(i, 1);
              return <line key={e.chave} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
            })}
            {temDado && (
              <g opacity={Math.min(1, crescimento * 2)}>
                <polygon
                  points={poligono(fracoes.map((f) => f * crescimento))}
                  fill="rgba(212,175,55,0.16)"
                  stroke={COR_UNICA}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {eixos.map((e, i) => {
                  if (e.valor == null) return null;
                  const pt = ponto(i, fracoes[i] * crescimento);
                  return <circle key={e.chave} cx={pt.x} cy={pt.y} r={4} fill={COR_UNICA} stroke="#161616" strokeWidth={2} />;
                })}
              </g>
            )}
          </svg>

          {eixos.map((e, i) => {
            const a = ((-90 + i * 72) * Math.PI) / 180;
            const x = r2(((CX + (R + 19) * Math.cos(a)) / 200) * 100);
            const y = r2(((CY + (R + 13) * Math.sin(a)) / 200) * 100);
            return (
              <InfoHover
                key={e.chave}
                explicacao={{
                  titulo: e.titulo,
                  oQueE: e.oQueE,
                  itens: [
                    { rotulo: "Você", valor: fmt(e.valor) },
                    { rotulo: "Quantas vezes", valor: e.vezes },
                    { rotulo: "Ponta do gráfico", valor: `0 a ${e.teto}%` },
                  ],
                  origem: i < 3 ? "Performance · pré-flop" : "Performance · pós-flop",
                  comoCalcula: e.comoCalcula,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-1 text-center leading-none"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="block whitespace-nowrap text-[10.5px] text-muted/80">{e.curto}</span>
                <span className="tnum block text-[12px] font-bold text-ink/90">{fmt(e.valor)}</span>
              </InfoHover>
            );
          })}
        </div>
      </div>

      <p className="mt-1 px-1 text-center text-[10.5px] text-muted/60">
        Cada ponta tem sua escala — passe o mouse pra ver o número e de onde vem.
      </p>
    </div>
  );
}
