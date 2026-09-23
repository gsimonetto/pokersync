"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import type { AnalysisHandRow, PostflopMetrics } from "@/types/analysis";
import { COR_UNICA, SeloAmostra } from "./base";

// Funil da agressão por rua: das mãos em que você foi o agressor pré-flop
// e viu o flop, quantas viraram c-bet, quantas seguiram com o 2º tiro no
// turn e quantas com o 3º no river. Mostra ONDE você desiste da agressão
// -- o número solto de c-bet não mostra isso.
//
// Largura da barra = quantas mãos chegaram àquela etapa em relação ao
// começo do funil (afina a cada rua); o % escrito é a conversão DA ETAPA
// ("de quem deu c-bet no flop, X% deu o 2º tiro"). Clique abre as mãos.
//
// Embaixo, o outro lado: quando você LEVA c-bet, quanto desiste por rua.

type Etapa = { nome: string; detalhe: string; feitas: string[]; base: number };

function montar(rows: AnalysisHandRow[]): { inicio: number; etapas: Etapa[] } {
  const viuFlopComoAgressor = rows.filter((r) => r.isPreflopAggressor === true && r.cbetFlop !== null);
  const cbet = viuFlopComoAgressor.filter((r) => r.cbetFlop === true);
  const chegouTurn = cbet.filter((r) => r.doubleBarrel !== null);
  const segundo = chegouTurn.filter((r) => r.doubleBarrel === true);
  const chegouRiver = segundo.filter((r) => r.tripleBarrel !== null);
  const terceiro = chegouRiver.filter((r) => r.tripleBarrel === true);
  return {
    inicio: viuFlopComoAgressor.length,
    etapas: [
      { nome: "C-bet no flop", detalhe: "das vezes que viu o flop como agressor", feitas: cbet.map((r) => r.handReviewId), base: viuFlopComoAgressor.length },
      { nome: "2º tiro no turn", detalhe: "de quem deu c-bet e chegou ao turn", feitas: segundo.map((r) => r.handReviewId), base: chegouTurn.length },
      { nome: "3º tiro no river", detalhe: "de quem deu 2 tiros e chegou ao river", feitas: terceiro.map((r) => r.handReviewId), base: chegouRiver.length },
    ],
  };
}

export function FunilRuas({ rows, metrics, ordem = 0 }: { rows: AnalysisHandRow[]; metrics: PostflopMetrics; ordem?: number }) {
  const router = useRouter();
  const { inicio, etapas } = useMemo(() => montar(rows), [rows]);
  const defesa = [
    { rua: "Flop", v: metrics.fold_to_cbet_flop_pct },
    { rua: "Turn", v: metrics.fold_to_cbet_turn_pct },
    { rua: "River", v: metrics.fold_to_cbet_river_pct },
  ];

  return (
    <PainelCard
      title="Funil da agressão"
      icon={<Filter size={15} />}
      ordem={ordem}
      rolagem={false}
      action={<SeloAmostra n={inicio} minimo={50} unidade="flops como agressor" />}
    >
      {inicio === 0 ? (
        <p className="text-sm text-muted">Sem mãos em que você foi o agressor pré-flop e viu o flop ainda.</p>
      ) : (
        // Card largo (aba inteira): as 3 etapas lado a lado; estreito:
        // empilhadas. A regra mede o contêiner de FORA (o elemento não
        // consegue medir a si mesmo).
        <div className="@container">
        <ul className="grid gap-2.5 [@container(min-width:720px)]:grid-cols-3">
          {etapas.map((e, i) => {
            const conv = e.base > 0 ? Math.round((e.feitas.length / e.base) * 100) : null;
            const largura = inicio > 0 ? Math.max(4, (e.feitas.length / inicio) * 100) : 0;
            return (
              <li key={e.nome}>
                <button
                  type="button"
                  disabled={e.feitas.length === 0}
                  onClick={() => router.push(revisorHandsHref(e.feitas, e.nome))}
                  className="group w-full rounded-xl p-2 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default"
                >
                  <span className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{e.nome}</span>
                      <span className="block truncate text-[11px] text-muted/70">{e.detalhe}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[20px] font-bold leading-none tabular-nums" style={{ color: COR_UNICA }}>
                        {conv == null ? "—" : `${conv}%`}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted/70">
                        {e.feitas.length} de {e.base}
                      </span>
                    </span>
                  </span>
                  {/* Barra centralizada (formato de funil), afinando a cada rua. */}
                  <span className="flex h-3 w-full justify-center overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.span
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${COR_UNICA}99, ${COR_UNICA}, ${COR_UNICA}99)` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${largura}%` }}
                      transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.15 }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        </div>
      )}

      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <p className="mb-2 text-[12px] font-medium text-ink/90">Quando você leva c-bet, desiste…</p>
        <div className="grid grid-cols-3 gap-2">
          {defesa.map((d, i) => (
            <div key={d.rua} className="rounded-xl bg-white/[0.03] p-2.5 text-center">
              <p className="text-[11px] text-muted">{d.rua}</p>
              <p className="mt-1 text-[20px] font-bold leading-none tabular-nums text-ink">{d.v == null ? "—" : `${Math.round(d.v)}%`}</p>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: COR_UNICA }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.v ?? 0}%` }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.5 + i * 0.1 }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </PainelCard>
  );
}
