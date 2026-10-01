"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { PainelCard } from "@/components/painel/painel-card";
import { COR_ACAO, cellBackground } from "@/lib/poker/grade-gto";
import type { AnalysisHandRow } from "@/types/analysis";
import { DicaGrafico, SeloAmostra } from "./base";

// Matriz 13×13 das mãos iniciais. Cada célula é uma classe de mão:
// diagonal = pares, acima dela = suited (AKs), abaixo = offsuit (AKo).
// A célula mostra O QUE você fez com a mão, nas mesmas cores das grades de
// range do produto (pedido: "venha colorido com as cores de all-in, fold,
// call, 3-bet"): fold cinza, call azul, raise verde, 3-bet laranja --
// empilhadas pela frequência, como a grade do Treino. All-in pré-flop
// ainda não vem no histórico analisado (hand_tags), então fica de fora.
//
// Célula com menos de 3 mãos fica apagada (amostra não diz nada ainda).
// Clique abre essas mãos no Revisor, já filtradas.

const RANKS = "AKQJT98765432";
const MIN_CELULA = 3;

type Celula = { rotulo: string; n: number; vpip: number; pfr: number; call: number; raise: number; tresBet: number; ids: string[] };

const LEGENDA = [
  { cor: COR_ACAO.fold, rotulo: "Fold" },
  { cor: COR_ACAO.call, rotulo: "Call / limp" },
  { cor: COR_ACAO.raise, rotulo: "Raise" },
  { cor: COR_ACAO.threebet, rotulo: "3-bet ou mais" },
];

function rankDe(carta: string): number {
  // "Kd" -> K; "10h" (algumas salas escrevem o dez assim) -> T
  const r = carta.length === 3 ? "T" : carta[0].toUpperCase();
  return RANKS.indexOf(r);
}

function montar(rows: AnalysisHandRow[]): Celula[][] {
  const m: Celula[][] = Array.from({ length: 13 }, (_, i) =>
    Array.from({ length: 13 }, (_, j) => {
      const hi = Math.min(i, j);
      const lo = Math.max(i, j);
      const rotulo = i === j ? `${RANKS[i]}${RANKS[i]}` : i < j ? `${RANKS[hi]}${RANKS[lo]}s` : `${RANKS[hi]}${RANKS[lo]}o`;
      return { rotulo, n: 0, vpip: 0, pfr: 0, call: 0, raise: 0, tresBet: 0, ids: [] };
    }),
  );
  for (const r of rows) {
    if (!r.heroCards) continue;
    const [a, b] = r.heroCards;
    const ia = rankDe(a);
    const ib = rankDe(b);
    if (ia < 0 || ib < 0) continue;
    const hi = Math.min(ia, ib);
    const lo = Math.max(ia, ib);
    const suited = a.slice(-1).toLowerCase() === b.slice(-1).toLowerCase();
    const [li, co] = ia === ib ? [ia, ia] : suited ? [hi, lo] : [lo, hi];
    const c = m[li][co];
    c.n += 1;
    if (r.vpip) c.vpip += 1;
    if (r.pfr) c.pfr += 1;
    // A ação mais forte que você fez pré-flop com a mão.
    if (r.threeBet || r.madeFourBet || r.squeeze) c.tresBet += 1;
    else if (r.pfr) c.raise += 1;
    else if (r.vpip) c.call += 1;
    c.ids.push(r.handReviewId);
  }
  return m;
}

export function MatrizMaos({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  const router = useRouter();
  const [foco, setFoco] = useState<{ c: Celula; x: number; y: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const matriz = useMemo(() => montar(rows), [rows]);
  const comCartas = useMemo(() => rows.filter((r) => r.heroCards).length, [rows]);

  function mostrar(c: Celula, e: React.MouseEvent<HTMLElement>) {
    const box = caixa.current?.getBoundingClientRect();
    const alvo = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!box) return;
    setFoco({ c, x: alvo.left - box.left + alvo.width / 2, y: alvo.top - box.top + alvo.height });
  }

  return (
    <PainelCard
      title="Suas mãos iniciais"
      icon={<Grid3x3 size={15} />}
      ordem={ordem}
      rolagem={false}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">O que você fez com cada mão antes do flop: cada cor é uma ação, na proporção das vezes.</p>
        <SeloAmostra n={comCartas} />
      </div>

      <div ref={caixa} className="@container relative" onMouseLeave={() => setFoco(null)}>
        <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px]">
          {matriz.map((linha, i) =>
            linha.map((c, j) => {
              const pouca = c.n > 0 && c.n < MIN_CELULA;
              const p = (x: number) => (c.n > 0 ? (x / c.n) * 100 : 0);
              const fold = Math.max(0, 100 - p(c.call) - p(c.raise) - p(c.tresBet));
              // Mesmo empilhado da grade do Treino: fold embaixo, depois
              // call, raise e 3-bet.
              const fundo =
                c.n === 0
                  ? "rgba(255,255,255,0.025)"
                  : cellBackground({
                      fold,
                      call: p(c.call),
                      raise: p(c.raise) + p(c.tresBet),
                      raiseMix: [
                        { type: "raise", weight: p(c.raise) },
                        { type: "threebet", weight: p(c.tresBet) },
                      ],
                    });
              return (
                <motion.button
                  key={c.rotulo}
                  type="button"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: pouca ? 0.45 : 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.25 + (i + j) * 0.012 }}
                  disabled={c.n === 0}
                  onMouseEnter={(e) => mostrar(c, e)}
                  onFocus={(e) => mostrar(c, e as unknown as React.MouseEvent<HTMLElement>)}
                  onBlur={() => setFoco(null)}
                  onClick={() => c.n > 0 && router.push(revisorHandsHref(c.ids, `Mão ${c.rotulo}`))}
                  aria-label={`${c.rotulo}: ${c.n} mãos`}
                  className={`grid aspect-square min-w-0 place-items-center rounded-[4px] font-semibold leading-none transition-[transform,box-shadow] hover:z-10 hover:scale-110 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default disabled:hover:scale-100 ${
                    i === j ? "ring-1 ring-inset ring-white/10" : ""
                  }`}
                  style={{
                    background: fundo,
                    color: c.n === 0 ? "rgba(255,255,255,0.18)" : "#FFFFFF",
                    textShadow: c.n === 0 ? undefined : "0 1px 2px rgba(0,0,0,0.8)",
                    fontSize: "clamp(7px, 2.35cqw, 11px)",
                  }}
                >
                  {c.rotulo}
                </motion.button>
              );
            }),
          )}
        </div>

        <DicaGrafico aberta={!!foco} x={foco?.x ?? 0} y={foco?.y ?? 0} largura={caixa.current?.clientWidth ?? 0}>
          {foco && (
            <>
              <p className="font-semibold text-ink">{foco.c.rotulo}</p>
              <p className="text-muted">
                {foco.c.n} {foco.c.n === 1 ? "mão" : "mãos"}
                {foco.c.n > 0 && foco.c.n < MIN_CELULA ? " · amostra pequena" : ""}
              </p>
              {foco.c.n > 0 && (
                <p className="mt-1 tabular-nums text-ink/90">
                  Fold {Math.round(((foco.c.n - foco.c.call - foco.c.raise - foco.c.tresBet) / foco.c.n) * 100)}% · Call {Math.round((foco.c.call / foco.c.n) * 100)}% ·
                  Raise {Math.round((foco.c.raise / foco.c.n) * 100)}% · 3-bet {Math.round((foco.c.tresBet / foco.c.n) * 100)}%
                </p>
              )}
              {foco.c.n > 0 && (
                <p className="tabular-nums text-muted">
                  VPIP {Math.round((foco.c.vpip / foco.c.n) * 100)}% · PFR {Math.round((foco.c.pfr / foco.c.n) * 100)}%
                </p>
              )}
              {foco.c.n > 0 && <p className="mt-1 text-[10.5px] text-[#f1d78a]">Clique pra ver as mãos</p>}
            </>
          )}
        </DicaGrafico>
      </div>

      {/* Legenda: uma cor por ação (a mesma das grades de range). */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {LEGENDA.map((l) => (
          <span key={l.rotulo} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.cor }} />
            {l.rotulo}
          </span>
        ))}
        <span>Acima da diagonal: suited · abaixo: offsuit</span>
        <span className="opacity-70">Apagada: menos de {MIN_CELULA} mãos</span>
      </div>
    </PainelCard>
  );
}
