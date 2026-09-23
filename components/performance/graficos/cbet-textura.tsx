"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Layers } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import type { AnalysisHandRow } from "@/types/analysis";
import { COR_UNICA, SeloAmostra } from "./base";

// Seu c-bet por TIPO DE FLOP -- responde "em que flop eu desisto de
// apostar?". A classificação vem só das 3 cartas do flop (regra fixa, sem
// estimativa): naipes (monocromático / dois do mesmo naipe / arco-íris),
// altura (tem A, K ou Q / maior carta 9 ou menos) e forma (pareado /
// conectado). Um flop pode cair em mais de um tipo.
//
// Uma série só (dourado, sem legenda); a linha tracejada em cada barra é o
// seu c-bet em TODOS os flops, pra comparar de relance.

const ORDEM = "23456789TJQKA";
const MIN_TIPO = 10;

const valorCarta = (c: string) => ORDEM.indexOf(c.slice(0, -1).replace("10", "T").toUpperCase()) + 2;
const naipe = (c: string) => c.slice(-1).toLowerCase();

type Tipo = { chave: string; grupo: string; nome: string; detalhe: string; testa: (flop: string[]) => boolean };

const TIPOS: Tipo[] = [
  { chave: "mono", grupo: "Naipes", nome: "Monocromático", detalhe: "3 cartas do mesmo naipe", testa: (f) => new Set(f.map(naipe)).size === 1 },
  { chave: "dois", grupo: "Naipes", nome: "Dois do mesmo naipe", detalhe: "tem projeto de flush", testa: (f) => new Set(f.map(naipe)).size === 2 },
  { chave: "arco", grupo: "Naipes", nome: "Arco-íris", detalhe: "3 naipes diferentes", testa: (f) => new Set(f.map(naipe)).size === 3 },
  { chave: "alto", grupo: "Altura", nome: "Alto", detalhe: "tem A, K ou Q", testa: (f) => Math.max(...f.map(valorCarta)) >= 12 },
  { chave: "baixo", grupo: "Altura", nome: "Baixo", detalhe: "maior carta 9 ou menos", testa: (f) => Math.max(...f.map(valorCarta)) <= 9 },
  { chave: "par", grupo: "Forma", nome: "Pareado", detalhe: "duas cartas do mesmo valor", testa: (f) => new Set(f.map(valorCarta)).size < 3 },
  {
    chave: "conectado",
    grupo: "Forma",
    nome: "Conectado",
    detalhe: "as 3 cabem numa sequência",
    testa: (f) => {
      const v = f.map(valorCarta);
      if (new Set(v).size < 3) return false;
      const alcance = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
      // Ás também vale 1 (A-2-3, A-4-5...).
      return alcance(v) <= 4 || (v.includes(14) && alcance(v.map((x) => (x === 14 ? 1 : x))) <= 4);
    },
  },
];

export function CbetTextura({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  const router = useRouter();
  const { geral, linhas, total } = useMemo(() => {
    const chances = rows.filter((r) => r.posflop?.cbet.flop != null && r.posflop.flop?.length === 3);
    const fez = chances.filter((r) => r.posflop!.cbet.flop === true).length;
    return {
      total: chances.length,
      geral: chances.length ? (fez / chances.length) * 100 : null,
      linhas: TIPOS.map((t) => {
        const base = chances.filter((r) => t.testa(r.posflop!.flop!));
        const sim = base.filter((r) => r.posflop!.cbet.flop === true).length;
        return { ...t, base, sim, pct: base.length ? (sim / base.length) * 100 : null };
      }),
    };
  }, [rows]);

  let grupoAnterior = "";
  return (
    <PainelCard
      title="Seu c-bet por tipo de flop"
      icon={<Layers size={15} />}
      ordem={ordem}
      rolagem={false}
      action={<SeloAmostra n={total} minimo={50} unidade="flops como agressor" />}
    >
      {total === 0 ? (
        <p className="text-sm text-muted">Aparece quando houver flops em que você foi o agressor pré-flop.</p>
      ) : (
        <>
          <p className="mb-2 flex items-baseline gap-2 text-[11.5px] text-muted">
            Em todos os flops
            <b className="text-[15px] font-bold tabular-nums text-ink">{Math.round(geral ?? 0)}%</b>
            <span className="text-muted/70">· linha tracejada em cada barra</span>
          </p>
          <ul className="flex flex-col">
            {linhas.map((l, i) => {
              const novoGrupo = l.grupo !== grupoAnterior;
              grupoAnterior = l.grupo;
              const pouca = l.base.length > 0 && l.base.length < MIN_TIPO;
              return (
                <li key={l.chave}>
                  {novoGrupo && (
                    <p className={`px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted/60 ${i > 0 ? "mt-2" : ""}`}>{l.grupo}</p>
                  )}
                  <button
                    type="button"
                    disabled={l.base.length === 0}
                    onClick={() => router.push(revisorHandsHref(l.base.map((r) => r.handReviewId), `Flop ${l.nome.toLowerCase()}`))}
                    className={`group grid w-full grid-cols-[6.25rem_minmax(0,1fr)_4.5rem] items-center gap-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_5.5rem] sm:gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent ${
                      pouca ? "opacity-60" : ""
                    }`}
                    title={pouca ? `Só ${l.base.length} flops desse tipo -- use como pista` : l.detalhe}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] text-ink/90">{l.nome}</span>
                      <span className="hidden truncate text-[10.5px] text-muted/60 sm:block">{l.detalhe}</span>
                    </span>
                    <span className="relative h-2.5 rounded-full bg-white/[0.05]">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: COR_UNICA }}
                        initial={{ width: 0 }}
                        animate={{ width: `${l.pct ?? 0}%` }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.05 }}
                      />
                      {geral != null && (
                        <span className="absolute -inset-y-1 w-0 border-l border-dashed border-white/50" style={{ left: `${geral}%` }} aria-hidden />
                      )}
                    </span>
                    <span className="flex items-center justify-end gap-1 text-right tabular-nums">
                      <b className="text-[13px] font-bold text-ink">{l.pct == null ? "—" : `${Math.round(l.pct)}%`}</b>
                      <span className="text-[10.5px] text-muted/70">
                        {l.sim}/{l.base.length}
                      </span>
                      {l.base.length > 0 && <ArrowUpRight size={11} className="hidden text-muted/40 transition-colors group-hover:text-[#d4af37] sm:block" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PainelCard>
  );
}
