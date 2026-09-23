"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import type { Session } from "@/lib/bankroll/types";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import { COR_NEGATIVO, COR_POSITIVO } from "./base";
import { formatadorMoeda, invested, net, torneiosNumaMoeda } from "./torneios";

// ROI por faixa de buy-in: responde "em que buy-in eu ganho?". Barras que
// saem do zero pra direita (lucro, verde) ou pra esquerda (prejuízo,
// vermelho) -- é POLARIDADE, então duas cores opostas em volta de um zero
// neutro (regra da skill). Cada barra traz o % e quantos torneios, pra
// ninguém confiar num ROI de 3 torneios.

const FAIXAS = [
  { ate: 10, rotulo: (f: (n: number) => string) => `até ${f(10)}` },
  { ate: 50, rotulo: (f: (n: number) => string) => `${f(10)}–${f(50)}` },
  { ate: 200, rotulo: (f: (n: number) => string) => `${f(50)}–${f(200)}` },
  { ate: Infinity, rotulo: (f: (n: number) => string) => `acima de ${f(200)}` },
];
const MIN_FAIXA = 10;

export function RoiBuyin({ sessoes, ordem = 0 }: { sessoes: Session[]; ordem?: number }) {
  const { lista, moeda } = useMemo(() => torneiosNumaMoeda(sessoes), [sessoes]);
  const fmt = useMemo(() => formatadorMoeda(moeda, true), [moeda]);
  const linhas = useMemo(() => {
    const g = FAIXAS.map(() => ({ n: 0, lucro: 0, investido: 0 }));
    for (const s of lista) {
      const i = FAIXAS.findIndex((f) => (Number(s.buyIn) || 0) <= f.ate);
      if (i < 0) continue;
      g[i].n += 1;
      g[i].lucro += net(s);
      g[i].investido += invested(s);
    }
    return FAIXAS.map((f, i) => ({
      rotulo: f.rotulo(fmt),
      n: g[i].n,
      roi: g[i].investido > 0 ? (g[i].lucro / g[i].investido) * 100 : null,
    })).filter((l) => l.n > 0);
  }, [lista, fmt]);
  const escala = Math.max(20, ...linhas.map((l) => Math.abs(l.roi ?? 0)));

  return (
    <PainelCard title="ROI por faixa de buy-in" icon={<Coins size={15} />} ordem={ordem} rolagem={false}>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted">Sem torneios com buy-in registrado na Gestão de Banca ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {linhas.map((l, i) => {
            const v = l.roi ?? 0;
            const cor = v >= 0 ? COR_POSITIVO : COR_NEGATIVO;
            const metade = Math.min(50, (Math.abs(v) / escala) * 50);
            const pouca = l.n < MIN_FAIXA;
            return (
              <li key={l.rotulo} className={pouca ? "opacity-60" : ""} title={pouca ? `Só ${l.n} torneios nessa faixa -- amostra pequena` : undefined}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-ink/90">{l.rotulo}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-[16px] font-bold tabular-nums" style={{ color: cor }}>
                      {l.roi == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted/70">{l.n} torneios</span>
                  </span>
                </div>
                {/* Zero no meio: lucro cresce pra direita, prejuízo pra esquerda. */}
                <div className="relative h-2.5 rounded-full bg-white/[0.04]">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-white/25" />
                  <motion.span
                    className="absolute inset-y-0 rounded-full"
                    style={{ background: cor, [v >= 0 ? "left" : "right"]: "50%" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${metade}%` }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.08 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted/70">
        Sessões de torneio da Gestão de Banca em {moeda}. Faixa apagada: menos de {MIN_FAIXA} torneios.
      </p>
    </PainelCard>
  );
}
