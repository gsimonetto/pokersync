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
    const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
    const planId = session.metadata?.plan_id;
    if (userId && isPlanId(planId)) {
      await setUserPlan(userId, planId);
    } else {
      console.error("checkout.session.completed sem user_id/plan_id valido:", session.id);
    }
  }

  // Assinatura cancelada/expirada -- rebaixa pra Free em vez de deixar o
  // usuario preso num plano pago que parou de ser cobrado.
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    if (userId) {
      await setUserPlan(userId, "free");
    }
  }

  return NextResponse.json({ received: true });
}
