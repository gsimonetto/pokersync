"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { PainelCard } from "@/components/painel/painel-card";
import type { AnalysisHandRow } from "@/types/analysis";
import { COR_UNICA, DicaGrafico, SeloAmostra } from "./base";

// Matriz 13×13 das mãos iniciais -- vendida na página de planos ("Matriz
// 13×13 de preflop com heatmap") e que não existia. Cada célula é uma
// classe de mão: diagonal = pares, acima dela = suited (AKs), abaixo =
// offsuit (AKo). A cor é a frequência (VPIP ou PFR) com que você jogou
// aquela mão -- sequencial de uma cor só (dourado), mais forte = mais
// frequente, como pede a skill de dataviz pra magnitude.
//
// Célula com menos de 3 mãos fica apagada (amostra não diz nada ainda).
// Clique abre essas mãos no Revisor, já filtradas.

const RANKS = "AKQJT98765432";
const MIN_CELULA = 3;

type Celula = { rotulo: string; n: number; vpip: number; pfr: number; ids: string[] };

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
      return { rotulo, n: 0, vpip: 0, pfr: 0, ids: [] };
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
    c.ids.push(r.handReviewId);
  }
  return m;
}

export function MatrizMaos({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  const router = useRouter();
  const [metrica, setMetrica] = useState<"vpip" | "pfr">("vpip");
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
      action={
        // VPIP ou PFR: mesmo mapa, duas leituras.
        <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Métrica da matriz">
          {(["vpip", "pfr"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetrica(m)}
              aria-pressed={metrica === m}
              className={`relative rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                metrica === m ? "text-black" : "text-muted hover:text-ink"
              }`}
            >
              {metrica === m && (
                <motion.span layoutId="matriz-metrica" className="absolute inset-0 rounded-md bg-[#d4af37]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className="relative">{m === "vpip" ? "VPIP" : "PFR"}</span>
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          Quanto mais forte o dourado, mais você {metrica === "vpip" ? "entra no pote" : "aumenta"} com aquela mão.
        </p>
        <SeloAmostra n={comCartas} />
      </div>

      <div ref={caixa} className="@container relative" onMouseLeave={() => setFoco(null)}>
        <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px]">
          {matriz.map((linha, i) =>
            linha.map((c, j) => {
              const pct = c.n > 0 ? (metrica === "vpip" ? c.vpip : c.pfr) / c.n : 0;
              const pouca = c.n > 0 && c.n < MIN_CELULA;
              // Sequencial: transparência do dourado sobe com a frequência.
              const fundo = c.n === 0 ? "rgba(255,255,255,0.025)" : `rgba(212,175,55,${(0.1 + pct * 0.85).toFixed(3)})`;
              const escuro = c.n > 0 && pct >= 0.55;
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
                    color: c.n === 0 ? "rgba(255,255,255,0.18)" : escuro ? "#141414" : "rgba(255,255,255,0.85)",
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
                  VPIP {Math.round((foco.c.vpip / foco.c.n) * 100)}% · PFR {Math.round((foco.c.pfr / foco.c.n) * 100)}%
                </p>
              )}
              {foco.c.n > 0 && <p className="mt-1 text-[10.5px] text-[#f1d78a]">Clique pra ver as mãos</p>}
            </>
          )}
        </DicaGrafico>
      </div>

      {/* Legenda sequencial: de "nunca" a "sempre". */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          0%
          <span
            className="h-2 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, rgba(212,175,55,0.1), ${COR_UNICA})` }}
          />
          100%
        </span>
        <span>Acima da diagonal: suited · abaixo: offsuit</span>
        <span className="opacity-70">Apagada: menos de {MIN_CELULA} mãos</span>
      </div>
    </PainelCard>
  );
}
