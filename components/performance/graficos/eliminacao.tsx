"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import type { TournamentPayout } from "@/lib/services/tournament-payout-service";
import { SeloAmostra } from "./base";

// Onde você cai nos torneios: início do field, meio, dentro da premiação
// ou mesa final. Diagnóstico direto de MTT -- quem cai muito cedo tem um
// problema diferente de quem chega na bolha e não converte. Vem das
// premiações importadas (sua colocação, inscritos e lugares pagos).
//
// É ORDINAL (a ordem das faixas importa), então uma cor só em tons
// crescentes -- não cores diferentes por faixa (regra da skill de dataviz).

type Faixa = { nome: string; detalhe: string; n: number };

function classificar(payouts: TournamentPayout[]): Faixa[] {
  const f: Faixa[] = [
    { nome: "Início", detalhe: "fora da metade de cima", n: 0 },
    { nome: "Meio", detalhe: "metade de cima, sem prêmio", n: 0 },
    { nome: "Premiação", detalhe: "no dinheiro", n: 0 },
    { nome: "Mesa final", detalhe: "top 9", n: 0 },
  ];
  for (const p of payouts) {
    const lugar = p.heroFinishPlace;
    const total = p.totalEntrants;
    if (lugar == null || total == null || total <= 0) continue;
    const pagos = p.places.length > 0 ? Math.max(...p.places.map((x) => x.place)) : null;
    const premiado = (p.heroPayoutAmount ?? 0) > 0 || (pagos != null && lugar <= pagos);
    if (lugar <= 9 && premiado) f[3].n += 1;
    else if (premiado) f[2].n += 1;
    else if (lugar <= total / 2) f[1].n += 1;
    else f[0].n += 1;
  }
  return f;
}

const TONS = [0.35, 0.55, 0.78, 1];

export function Eliminacao({ payouts, ordem = 0 }: { payouts: TournamentPayout[]; ordem?: number }) {
  const faixas = useMemo(() => classificar(payouts), [payouts]);
  const total = faixas.reduce((a, f) => a + f.n, 0);
  const maior = Math.max(1, ...faixas.map((f) => f.n));

  return (
    <PainelCard
      title="Onde você cai nos torneios"
      icon={<Flag size={15} />}
      ordem={ordem}
      rolagem={false}
      action={<SeloAmostra n={total} minimo={30} unidade="torneios" />}
    >
      {total === 0 ? (
        <p className="text-sm text-muted">
          Aparece quando houver torneios com colocação e número de inscritos importados (Radar ou premiação colada).
        </p>
      ) : (
        <div className="grid h-[200px] grid-cols-4 sm:h-[236px] items-end gap-3">
          {faixas.map((f, i) => {
            const pct = Math.round((f.n / total) * 100);
            return (
              <div key={f.nome} className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5 text-center">
                <span className="text-[18px] font-bold leading-none tabular-nums text-ink">{pct}%</span>
                <span className="text-[10.5px] tabular-nums text-muted/70">{f.n}</span>
                <motion.span
                  className="w-full max-w-[64px] rounded-t-lg"
                  style={{ background: `rgba(212,175,55,${TONS[i]})` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(3, (f.n / maior) * 120)}px` }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.1 }}
                />
                <span className="text-[12px] font-medium leading-tight text-ink/90">{f.nome}</span>
                <span className="hidden text-[10.5px] leading-tight text-muted/70 sm:block">{f.detalhe}</span>
              </div>
            );
          })}
        </div>
      )}
    </PainelCard>
  );
}
