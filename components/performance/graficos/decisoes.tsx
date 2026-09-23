"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, GitFork } from "lucide-react";
import { revisorHandsHref } from "@/components/dashboard/kit";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import type { AnalysisHandRow } from "@/types/analysis";
import { COR_PFR, COR_VPIP, Legenda } from "./base";

// "O que você faz" em cada situação de pré-flop, no lugar da grade de
// cards soltos com faixa de referência (as faixas não tinham fonte
// confiável). Cada linha é UMA situação e a barra dividida mostra a sua
// resposta: desiste (cinza) | paga (azul) | aumenta (dourado). Sempre com
// "x de y vezes" -- sem referência, o que vale é o comportamento real e o
// tamanho da amostra. Clique abre essas mãos no Revisor.
//
// Cores: fold é neutro (ausência de ação), call e raise reaproveitam o
// par azul/dourado já validado pro VPIP/PFR (call = entrar pagando,
// raise = entrar aumentando -- mesma leitura).

const COR_FOLD = "rgba(255,255,255,0.22)";
const POUCAS_VEZES = 20;

type Fatia = { rotulo: string; n: number; cor: string };
type Situacao = { nome: string; detalhe: string; base: AnalysisHandRow[]; fatias: Fatia[] };
type Grupo = { titulo: string; situacoes: Situacao[] };

const quantas = (rows: AnalysisHandRow[], f: (r: AnalysisHandRow) => boolean | null | undefined) => rows.filter((r) => f(r)).length;

function montar(rows: AnalysisHandRow[]): Grupo[] {
  const levou3bet = rows.filter((r) => r.facedThreeBet === true);
  const levou4bet = rows.filter((r) => r.facedFourBet === true);
  const roubo = (heroi: string, ladrao: string) =>
    rows.filter((r) => r.heroPosition === heroi && r.openerPosition === ladrao && r.rouboLimpo === true && r.blindDefenseOpportunity === true);
  const defesa = (nome: string, base: AnalysisHandRow[]): Situacao => {
    const aumentou = quantas(base, (r) => r.threeBet);
    const defendeu = quantas(base, (r) => r.blindDefended);
    return {
      nome,
      detalhe: "roubo chegou direto em você",
      base,
      fatias: [
        { rotulo: "Desiste", n: base.length - defendeu, cor: COR_FOLD },
        { rotulo: "Paga", n: Math.max(0, defendeu - aumentou), cor: COR_VPIP },
        { rotulo: "3-bet", n: aumentou, cor: COR_PFR },
      ],
    };
  };
  const chanceRoubo = rows.filter((r) => r.stealOpportunity === true);
  const chanceSqueeze = rows.filter((r) => r.squeezeOpportunity === true);

  return [
    {
      titulo: "Você abriu e levou 3-bet",
      situacoes: [
        {
          nome: "Contra 3-bet",
          detalhe: "o que você fez depois do seu open",
          base: levou3bet,
          fatias: [
            { rotulo: "Desiste", n: quantas(levou3bet, (r) => r.foldToThreeBet), cor: COR_FOLD },
            { rotulo: "Paga", n: quantas(levou3bet, (r) => r.callThreeBet), cor: COR_VPIP },
            { rotulo: "4-bet", n: quantas(levou3bet, (r) => r.madeFourBet), cor: COR_PFR },
          ],
        },
        {
          nome: "Contra 4-bet",
          detalhe: "depois do seu 3-bet",
          base: levou4bet,
          fatias: [
            { rotulo: "Desiste", n: quantas(levou4bet, (r) => r.foldToFourBet), cor: COR_FOLD },
            { rotulo: "Continua", n: levou4bet.length - quantas(levou4bet, (r) => r.foldToFourBet), cor: COR_PFR },
          ],
        },
      ],
    },
    {
      titulo: "Defendendo os blinds",
      situacoes: [defesa("SB contra BTN", roubo("SB", "BTN")), defesa("BB contra BTN", roubo("BB", "BTN")), defesa("BB contra SB", roubo("BB", "SB"))],
    },
    {
      titulo: "Agressão extra",
      situacoes: [
        {
          nome: "Roubo de blinds",
          detalhe: "foldaram até você no CO, BTN ou SB",
          base: chanceRoubo,
          fatias: [
            { rotulo: "Não abre", n: chanceRoubo.length - quantas(chanceRoubo, (r) => r.stealAttempt), cor: COR_FOLD },
            { rotulo: "Abre", n: quantas(chanceRoubo, (r) => r.stealAttempt), cor: COR_PFR },
          ],
        },
        {
          nome: "Squeeze",
          detalhe: "teve open e call antes de você",
          base: chanceSqueeze,
          fatias: [
            { rotulo: "Não aumenta", n: chanceSqueeze.length - quantas(chanceSqueeze, (r) => r.squeeze), cor: COR_FOLD },
            { rotulo: "Squeeze", n: quantas(chanceSqueeze, (r) => r.squeeze), cor: COR_PFR },
          ],
        },
      ],
    },
  ];
}

export function Decisoes({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  const router = useRouter();
  const grupos = montar(rows);
  let k = 0;

  return (
    <PainelCard
      title="O que você faz em cada situação"
      icon={<GitFork size={15} />}
      ordem={ordem}
      rolagem={false}
      // No celular a legenda sai (o título precisa do espaço); cada barra já
      // escreve embaixo o que é cada cor.
      action={
        <Legenda
          className="hidden sm:flex"
          itens={[
            { rotulo: "Desiste", cor: "rgba(255,255,255,0.45)" },
            { rotulo: "Paga", cor: COR_VPIP },
            { rotulo: "Aumenta", cor: COR_PFR },
          ]}
        />
      }
    >
      {/* Ao lado da matriz (estreito): grupos empilhados. Largo (tablet,
          ou sozinho na linha): três colunas. Mede o contêiner de fora. */}
      <div className="@container">
      <div className="grid gap-x-6 gap-y-4 [@container(min-width:1100px)]:grid-cols-3">
        {grupos.map((g) => (
          <section key={g.titulo} className="min-w-0">
            <h3 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted/70">{g.titulo}</h3>
            <ul className="flex flex-col">
              {g.situacoes.map((s, i) => {
                const total = s.base.length;
                const pouca = total > 0 && total < POUCAS_VEZES;
                const atraso = 0.3 + k++ * 0.06;
                return (
                  <li key={s.nome} className={i > 0 ? "border-t border-white/[0.05]" : ""}>
                    <button
                      type="button"
                      disabled={total === 0}
                      onClick={() => router.push(revisorHandsHref(s.base.map((r) => r.handReviewId), s.nome))}
                      className="group w-full rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                      title={pouca ? `Só ${total} vezes -- use como pista, não como conclusão` : undefined}
                    >
                      <span className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{s.nome}</span>
                          <span className="block truncate text-[11px] text-muted/70">{s.detalhe}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted">
                          {pouca && <span className="rounded-full bg-[#f59e0b]/10 px-1.5 text-[10px] font-semibold text-[#f59e0b]">poucas</span>}
                          {total} {total === 1 ? "vez" : "vezes"}
                          {total > 0 && <ArrowUpRight size={11} className="text-muted/40 transition-colors group-hover:text-[#d4af37]" />}
                        </span>
                      </span>
                      {total === 0 ? (
                        <span className="block h-2.5 rounded-full bg-white/[0.04]" />
                      ) : (
                        <>
                          {/* Barra dividida; 2px de fundo entre as fatias. */}
                          <span className={`flex h-2.5 gap-[2px] overflow-hidden rounded-full ${pouca ? "opacity-60" : ""}`}>
                            {s.fatias.map((f) =>
                              f.n > 0 ? (
                                <motion.span
                                  key={f.rotulo}
                                  className="h-full first:rounded-l-full last:rounded-r-full"
                                  style={{ background: f.cor }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(f.n / total) * 100}%` }}
                                  transition={{ duration: 0.8, ease: EASE, delay: atraso }}
                                />
                              ) : null,
                            )}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                            {s.fatias.map((f) => (
                              <span key={f.rotulo} className="text-muted">
                                {f.rotulo} <b className="font-semibold text-ink/90">{Math.round((f.n / total) * 100)}%</b>
                              </span>
                            ))}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      </div>
    </PainelCard>
  );
}
