import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { PLAN_IDS, type PlanId } from "@/lib/plans/plans-data";

function isPlanId(value: string | undefined): value is PlanId {
  return !!value && (PLAN_IDS as string[]).includes(value);
}

async function setUserPlan(userId: string, planId: PlanId) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("user_plans").upsert({ user_id: userId, plan: planId });
  if (error) console.error("Falha ao gravar plano vindo do Stripe:", error);
}

async function setRadarAddon(userId: string, active: boolean) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("user_plans").upsert({ user_id: userId, radar_addon: active });
  if (error) console.error("Falha ao gravar addon Radar vindo do Stripe:", error);
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
    const { userId, planId, addonId } = metadataOf(event.data.object as Stripe.Checkout.Session);
    if (userId && isPlanId(planId)) {
      await setUserPlan(userId, planId);
    } else if (userId && addonId === "radar") {
      await setRadarAddon(userId, true);
    } else {
      console.error("checkout.session.completed sem user_id/plan_id/addon_id valido:", (event.data.object as Stripe.Checkout.Session).id);
    }
  }

  // Assinatura cancelada/expirada -- plano volta pra Free (nunca deixa o
  // usuario preso num plano pago que parou de ser cobrado); addon so'
  // desliga o proprio addon, sem mexer no plano base.
  if (event.type === "customer.subscription.deleted") {
    const { userId, planId, addonId } = metadataOf(event.data.object as Stripe.Subscription);
    if (userId && isPlanId(planId)) {
      await setUserPlan(userId, "free");
    } else if (userId && addonId === "radar") {
      await setRadarAddon(userId, false);
    }
  }

  return NextResponse.json({ received: true });
}
