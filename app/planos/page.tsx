"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { fetchMyPlanId } from "@/lib/services/plan-service";
import { PLAN_IDS, PLANS, type PlanId, type ModuleKey } from "@/lib/plans/plans-data";
import { MODULE_COPY, RADAR_COPY } from "@/lib/plans/module-copy";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODULE_ORDER: ModuleKey[] = ["drill", "bankroll", "revisor", "hub", "time", "performance", "ranges"];

export default function PlanosPage() {
  const [myPlan, setMyPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyPlanId()
      .then((p) => {
        if (alive) setMyPlan(p);
      })
      .catch(() => {
        // sem sessao/erro de rede: segue sem destacar nenhum card
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="w-full px-4 py-6 md:px-6 md:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Planos PokerSync</h1>
          <p className="mt-1 text-sm text-muted">Escolha o plano que acompanha seu ritmo de evolução.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PLAN_IDS.map((id) => {
            const plan = PLANS[id];
            const isMine = myPlan === id;
            return (
              <div
                key={id}
                className={`flex flex-col gap-4 rounded-xl border p-5 ${
                  isMine ? "border-training bg-training/5" : "border-hairline bg-surface"
                }`}
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted/60">{plan.name}</p>
                  <p className="mt-1 text-2xl font-bold text-ink">
                    {plan.priceCents === 0 ? "Grátis" : BRL.format((plan.priceCents ?? 0) / 100)}
                    {plan.priceCents ? <span className="text-sm font-normal text-muted"> /mês</span> : null}
                  </p>
                  {plan.seats && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Users size={12} /> até {plan.seats} jogadores
                    </p>
                  )}
                </div>

                <ul className="flex flex-1 flex-col gap-2">
                  {MODULE_ORDER.map((key) => {
                    const access = plan.modules[key];
                    return (
                      <li key={key} className="flex items-center gap-2 text-xs">
                        {access.unlocked ? (
                          <Check size={13} className="shrink-0 text-positive" />
                        ) : (
                          <Lock size={12} className="shrink-0 text-muted/50" />
                        )}
                        <span className={access.unlocked ? "text-ink" : "text-muted/50 line-through"}>
                          {MODULE_COPY[key].title}
                          {access.limit ? ` (${access.limit.amount}/${access.limit.period === "day" ? "dia" : "mês"})` : ""}
                        </span>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 text-xs">
                    {plan.addons.radar ? (
                      <Check size={13} className="shrink-0 text-positive" />
                    ) : (
                      <Lock size={12} className="shrink-0 text-muted/50" />
                    )}
                    <span className={plan.addons.radar ? "text-ink" : "text-muted/50 line-through"}>{RADAR_COPY.title}</span>
                  </li>
                </ul>

                {isMine && (
                  <span className="rounded-lg border border-training/40 bg-training/10 px-3 py-1.5 text-center text-xs font-semibold text-training">
                    Seu plano atual
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-muted">
          Contratação e upgrade de plano ainda são feitos manualmente pelo time PokerSync — em breve essa tela vai
          liberar assinatura direta por aqui.
        </p>
      </main>
    </AppShell>
  );
}
