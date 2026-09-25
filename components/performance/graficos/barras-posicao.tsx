"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Grid3x3, MapPin } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import { HERO_POSITION_ORDER, type AnalysisHandRow, type PreflopMetricsByPosition } from "@/types/analysis";
import { COR_PFR, COR_VPIP, Legenda } from "./base";

// Por posição em BARRAS no lugar da tabela: comparar comprimento é
// imediato, comparar números numa tabela exige ler linha por linha. Ordem
// da mesa (UTG -> BB), que é como o jogador pensa a posição; duas séries
// (VPIP e PFR) com legenda E o valor escrito na ponta de cada barra, pra
// cor nunca ser a única pista. Linha inteira é clicável e abre essas mãos
// no Revisor.
//
// Sem faixa ideal desenhada aqui de propósito: a referência que o app tem
// é uma só pra mesa toda, e cada posição tem a sua (UTG bem mais fechado
// que BTN) -- desenhar a geral em cada linha ensinaria errado.

const MIN_POSICAO = 30;

export function BarrasPosicao({
  rows,
  byPosition,
  ordem = 0,
}: {
  rows: AnalysisHandRow[];
  byPosition: PreflopMetricsByPosition[];
  ordem?: number;
}) {
  const router = useRouter();
  const lista = HERO_POSITION_ORDER.map((p) => byPosition.find((b) => b.position === p)).filter(
    (b): b is PreflopMetricsByPosition => !!b,
  );
  const escala = Math.max(40, ...lista.map((b) => b.vpip_pct ?? 0)) * 1.08;

  return (
    <PainelCard
      title="VPIP e PFR por posição"
      icon={<MapPin size={15} />}
      ordem={ordem}
      rolagem={false}
      action={<Legenda itens={[{ rotulo: "VPIP", cor: COR_VPIP }, { rotulo: "PFR", cor: COR_PFR }]} />}
    >
      {lista.length === 0 ? (
        <p className="text-sm text-muted">Sem mãos com posição identificada ainda.</p>
      ) : (
        // Card largo: duas colunas (UTG→HJ | CO→BB), senão as barras ficam
        // compridas demais pra comparar. Estreito: uma coluna.
        <ul className="grid grid-flow-col grid-rows-8 gap-x-8 lg:grid-rows-4">
          {lista.map((p, i) => {
            const pouca = p.hands < MIN_POSICAO;
            const pfrDoVpip = p.vpip_pct && p.vpip_pct > 0 && p.pfr_pct != null ? Math.round((p.pfr_pct / p.vpip_pct) * 100) : null;
            return (
              <li key={p.position}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      revisorHandsHref(
                        rows.filter((r) => r.heroPosition === p.position).map((r) => r.handReviewId),
                        `Posição ${p.position}`,
                      ),
                    )
                  }
                  className={`group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04] ${
                    // Fio entre as linhas; no layout de 2 colunas (lg) a 5ª posição
                    // abre a 2ª coluna e não leva fio em cima.
                    i > 0 ? `border-t border-white/[0.05] ${i === 4 ? "lg:border-t-0" : ""}` : ""
                  } ${pouca ? "opacity-60" : ""}`}
                  title={pouca ? `Só ${p.hands} mãos nessa posição -- amostra pequena` : undefined}
                >
                  <span className="grid h-7 place-items-center rounded-lg bg-white/[0.06] text-[11px] font-bold text-ink">{p.position}</span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    {(
                      [
                        { v: p.vpip_pct, cor: COR_VPIP, nome: "VPIP" },
                        { v: p.pfr_pct, cor: COR_PFR, nome: "PFR" },
                      ] as const
                    ).map((b, k) => (
                      <span key={b.nome} className="flex items-center gap-2">
                        <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <motion.span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ background: b.cor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, ((b.v ?? 0) / escala) * 100)}%` }}
                            transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.05 + k * 0.08 }}
                          />
                        </span>
                        <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-ink/90">
                          {b.v == null ? "—" : `${b.v.toFixed(0)}%`}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="flex flex-col items-end gap-0.5 text-right">
                    <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted">
                      {p.hands} mãos
                      <ArrowUpRight size={11} className="text-muted/40 transition-colors group-hover:text-[#d4af37]" />
                    </span>
                    {pfrDoVpip != null && (
                      <span className="text-[10.5px] tabular-nums text-muted/70" title="Quanto do seu VPIP virou raise">
                        raise {pfrDoVpip}%
                      </span>
                    )}
                    {/* 3-Bet e Steal da antiga tabela, discretos. */}
                    <span className="hidden text-[10.5px] tabular-nums text-muted/60 sm:block">
                      3B {p.three_bet_pct == null ? "—" : `${p.three_bet_pct.toFixed(0)}%`} · steal{" "}
                      {p.steal_pct == null ? "—" : `${p.steal_pct.toFixed(0)}%`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted/70">
        &quot;raise&quot; = quanto do seu VPIP naquela posição foi aumento (perto de 100% = você quase não entra só de call).
        Posição apagada: menos de {MIN_POSICAO} mãos. Clique pra ver as mãos no Revisor.
      </p>
      {/* A mesma leitura, mão por mão: o range de verdade de cada posição na
          grade do Construtor (e dá pra comparar com o GTO de lá). */}
      {lista.length > 0 && (
        <Link
          href="/ranges?aba=meus"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#e8cb6a] transition-colors hover:text-[#f0d67a]"
        >
          <Grid3x3 size={13} /> Ver mão por mão o que você joga em cada posição, no Construtor de Ranges
          <ArrowUpRight size={12} />
        </Link>
      )}
    </PainelCard>
  );
}
