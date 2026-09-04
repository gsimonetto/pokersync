"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Lock, Radar as RadarIcon, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { fetchMyPlanState } from "@/lib/services/plan-service";
import { ADDON_PRICES, PLAN_IDS, PLANS, SELF_SERVE_PLAN_IDS, isAddonUnlocked, type PlanId, type ModuleKey } from "@/lib/plans/plans-data";
import { MODULE_COPY, RADAR_COPY } from "@/lib/plans/module-copy";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODULE_ORDER: ModuleKey[] = ["drill", "bankroll", "revisor", "hub", "time", "performance", "ranges"];

// "plan:<PlanId>" ou "addon:radar" -- identifica o que esta em checkout
// no momento (so' um por vez, os botoes desabilitam entre si).
type CheckoutTarget = `plan:${PlanId}` | "addon:radar";

function PlanosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [myPlan, setMyPlan] = useState<PlanId | null>(null);
  const [radarAddon, setRadarAddon] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState<CheckoutTarget | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyPlanState()
      .then((s) => {
        if (!alive) return;
        setMyPlan(s.plan);
        setRadarAddon(s.radarAddon);
      })
      .catch(() => {
        // sem sessao/erro de rede: segue sem destacar nenhum card
      });
    return () => {
      alive = false;
    };
  }, []);

  // Volta do Stripe (success_url/cancel_url em app/api/billing/checkout) --
  // so' um aviso na tela, o plano/addon de verdade so' muda quando o
  // webhook processa o pagamento (ver app/api/billing/webhook/route.ts).
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "sucesso") {
      setCheckoutMsg("Pagamento recebido! Deve atualizar em instantes.");
    } else if (checkout === "cancelado") {
      setCheckoutMsg("Cancelado antes de concluir — nada foi cobrado.");
    }
    if (checkout) router.replace("/planos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckout(target: CheckoutTarget, body: { planId: PlanId } | { addonId: "radar" }) {
    setCheckoutMsg(null);
    setLoadingTarget(target);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setCheckoutMsg(data.message || "Pagamentos ainda não estão disponíveis — em breve!");
    } catch {
      setCheckoutMsg("Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setLoadingTarget(null);
    }
  }

  const radarUnlocked = myPlan !== null && isAddonUnlocked(myPlan, "radar", radarAddon);
  const radarIncludedInPlan = myPlan !== null && PLANS[myPlan].addons.radar;

  return (
    <main className="w-full px-4 py-6 md:px-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Planos PokerSync</h1>
        <p className="mt-1 text-sm text-muted">Escolha o plano que acompanha seu ritmo de evolução.</p>
      </div>

      {checkoutMsg && (
        <p className="mb-6 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink">{checkoutMsg}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const isMine = myPlan === id;
          const selfServe = SELF_SERVE_PLAN_IDS.includes(id);
          const target: CheckoutTarget = `plan:${id}`;
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
                  <span className={plan.addons.radar ? "text-ink" : "text-muted/50 line-through"}>
                    {RADAR_COPY.title}
                    {!plan.addons.radar ? ` (+${BRL.format(ADDON_PRICES.radar / 100)}/mês)` : ""}
                  </span>
                </li>
              </ul>

              {isMine ? (
                <span className="rounded-lg border border-training/40 bg-training/10 px-3 py-1.5 text-center text-xs font-semibold text-training">
                  Seu plano atual
                </span>
              ) : selfServe ? (
                <button
                  onClick={() => handleCheckout(target, { planId: id })}
                  disabled={loadingTarget !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-60"
                >
                  {loadingTarget === target && <Loader2 size={14} className="animate-spin" />}
                  Assinar
                </button>
              ) : plan.priceCents ? (
                <span className="rounded-lg border border-hairline px-3 py-2 text-center text-sm font-semibold text-muted">
                  Contratação por contato direto
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Radar nao e' plano -- e' complemento avulso, comprado a parte por
          quem esta num plano que nao inclui (ver isAddonUnlocked). */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#E8B93C]/30 bg-[#E8B93C]/10 text-[#E8B93C]">
            <RadarIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {RADAR_COPY.title} <span className="font-normal text-muted">— complemento avulso</span>
            </p>
            <p className="text-xs text-muted">{RADAR_COPY.blurb}</p>
          </div>
        </div>

        {radarIncludedInPlan ? (
          <span className="shrink-0 rounded-lg border border-training/40 bg-training/10 px-3 py-1.5 text-center text-xs font-semibold text-training">
            Incluso no seu plano
          </span>
        ) : radarUnlocked ? (
          <span className="shrink-0 rounded-lg border border-training/40 bg-training/10 px-3 py-1.5 text-center text-xs font-semibold text-training">
            Você já tem
          </span>
        ) : (
          <button
            onClick={() => handleCheckout("addon:radar", { addonId: "radar" })}
            disabled={loadingTarget !== null || myPlan === null}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-60"
          >
            {loadingTarget === "addon:radar" && <Loader2 size={14} className="animate-spin" />}
            Comprar — {BRL.format(ADDON_PRICES.radar / 100)}/mês
          </button>
        )}
      </div>

      <p className="mt-8 text-xs text-muted">
        Pagamento via Stripe — em ativação (conta em validação de documentos). Os planos Team são fechados por
        contato direto por enquanto.
      </p>
    </main>
  );
}

export default function PlanosPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <PlanosContent />
      </Suspense>
    </AppShell>
  );
}
