import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { PLAN_IDS, type PlanId } from "@/lib/plans/plans-data";

function isPlanId(value: string | undefined): value is PlanId {
  return !!value && (PLAN_IDS as string[]).includes(value);
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

// Grava plano/addon + os IDs do Stripe que o painel "Minha Conta"
// precisa pra listar faturas e cancelar (ver app/api/billing/invoices e
// app/api/billing/cancel). customerId e' o mesmo nas duas assinaturas
// (plano e Radar sao Checkout Sessions separadas, mas do mesmo customer);
// subscriptionId e' guardado em coluna diferente pra cada uma, porque
// cancelar uma nao pode mexer na outra.
async function applyCheckout(userId: string, patch: Record<string, unknown>) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("user_plans").upsert({ user_id: userId, ...patch });
  if (error) console.error("Falha ao gravar dado vindo do Stripe:", error);
}

// Resolve o que um evento de assinatura (session ou subscription) esta
// tratando -- plano base OU addon avulso. Sao duas Checkout Sessions (e
// duas subscriptions no Stripe) distintas: comprar Radar nao mexe no
// plano, trocar de plano nao mexe no Radar. Ver app/api/billing/checkout.
function metadataOf(obj: Stripe.Checkout.Session | Stripe.Subscription): { userId?: string; planId?: string; addonId?: string } {
  const userId = obj.metadata?.user_id ?? ("client_reference_id" in obj ? (obj.client_reference_id ?? undefined) : undefined);
  return { userId, planId: obj.metadata?.plan_id, addonId: obj.metadata?.addon_id };
}

// Webhook do Stripe -- fonte de verdade de quem realmente pagou. Enquanto
// STRIPE_WEBHOOK_SECRET nao existir (conta em validacao), devolve 503:
// nenhum evento chega mesmo, o endpoint so' precisa estar pronto pra
// quando o Stripe começar a mandar.
//
// Configurar no Dashboard do Stripe: endpoint https://<dominio>/api/billing/webhook,
// eventos "checkout.session.completed" e "customer.subscription.deleted".
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_NAO_CONFIGURADO" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "ASSINATURA_AUSENTE" }, { status: 400 });
  }

  // Corpo BRUTO, sem passar por request.json() -- a verificacao de
  // assinatura do Stripe precisa dos bytes exatos que ele enviou.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error("Assinatura invalida no webhook do Stripe:", e);
    return NextResponse.json({ error: "ASSINATURA_INVALIDA" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, planId, addonId } = metadataOf(session);
    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);

    if (userId && isPlanId(planId)) {
      await applyCheckout(userId, {
        plan: planId,
        stripe_customer_id: customerId,
        stripe_plan_subscription_id: subscriptionId,
      });
    } else if (userId && addonId === "radar") {
      await applyCheckout(userId, {
        radar_addon: true,
        stripe_customer_id: customerId,
        stripe_radar_subscription_id: subscriptionId,
      });
    } else {
      console.error("checkout.session.completed sem user_id/plan_id/addon_id valido:", session.id);
    }
  }

  // Assinatura cancelada/expirada -- plano volta pra Free (nunca deixa o
  // usuario preso num plano pago que parou de ser cobrado); addon so'
  // desliga o proprio addon, sem mexer no plano base. Limpa o
  // subscription_id correspondente (customer_id fica, e' reutilizado se
  // ele assinar de novo).
  if (event.type === "customer.subscription.deleted") {
    const { userId, planId, addonId } = metadataOf(event.data.object as Stripe.Subscription);
    if (userId && isPlanId(planId)) {
      await applyCheckout(userId, { plan: "free", stripe_plan_subscription_id: null });
    } else if (userId && addonId === "radar") {
      await applyCheckout(userId, { radar_addon: false, stripe_radar_subscription_id: null });
    }
  }

  return NextResponse.json({ received: true });
}
