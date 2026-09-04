import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

// Cancela a assinatura do plano OU do addon Radar (sao independentes,
// ver app/api/billing/checkout) -- consumido pelo botao "Cancelar
// assinatura" em /minha-conta. Cancela AO FIM DO PERIODO ja pago, nunca
// na hora: o usuario continua com acesso ate o ciclo que ja pagou
// terminar, so' nao renova. O plano so' volta pra Free quando o Stripe
// realmente encerra a assinatura no fim do periodo (webhook
// customer.subscription.deleted).
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "STRIPE_NAO_CONFIGURADO", message: "Pagamentos ainda não estão ativos." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "NAO_AUTENTICADO" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const target = body?.target as "plan" | "radar" | undefined;
  if (target !== "plan" && target !== "radar") {
    return NextResponse.json({ error: "ALVO_INVALIDO" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("user_plans")
    .select("stripe_plan_subscription_id, stripe_radar_subscription_id")
    .maybeSingle();
  const subscriptionId = target === "plan" ? row?.stripe_plan_subscription_id : row?.stripe_radar_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json({ error: "SEM_ASSINATURA", message: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
  }

  try {
    const subscription = await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return NextResponse.json({ ok: true, currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? null });
  } catch (e) {
    console.error("Falha ao cancelar assinatura no Stripe:", e);
    return NextResponse.json({ error: "FALHA_CANCELAMENTO", message: "Não foi possível cancelar. Tente novamente." }, { status: 502 });
  }
}
