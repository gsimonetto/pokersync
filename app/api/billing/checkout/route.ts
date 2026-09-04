import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, priceIdForPlan } from "@/lib/billing/stripe";
import { SELF_SERVE_PLAN_IDS, type PlanId } from "@/lib/plans/plans-data";

// Cria uma Stripe Checkout Session pro plano pedido e devolve a URL pra
// o client redirecionar. Chamado por /planos (botao "Assinar"). Enquanto
// a conta Stripe nao estiver liberada (aguardando validacao de
// documentos), devolve 503 com uma mensagem amigavel em vez de quebrar --
// o botao ja existe, so' fica "desligado" ate a chave existir.
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "STRIPE_NAO_CONFIGURADO", message: "Pagamentos ainda não estão ativos — em breve!" },
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
  const planId = body?.planId as PlanId | undefined;
  if (!planId || !SELF_SERVE_PLAN_IDS.includes(planId)) {
    return NextResponse.json({ error: "PLANO_INVALIDO" }, { status: 400 });
  }

  const priceId = priceIdForPlan(planId);
  if (!priceId) {
    return NextResponse.json(
      { error: "PRECO_NAO_CONFIGURADO", message: "Esse plano ainda não tem preço configurado no Stripe." },
      { status: 503 }
    );
  }

  const origin = request.nextUrl.origin;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      // Metadata na sessao (checkout.session.completed) E na subscription
      // (customer.subscription.* futuros, ex: cancelamento) -- o webhook
      // precisa do user_id nos dois eventos, e metadata da sessao nao
      // propaga sozinha pra subscription criada a partir dela.
      metadata: { user_id: user.id, plan_id: planId },
      subscription_data: { metadata: { user_id: user.id, plan_id: planId } },
      success_url: `${origin}/planos?checkout=sucesso`,
      cancel_url: `${origin}/planos?checkout=cancelado`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Falha ao criar Stripe Checkout Session:", e);
    return NextResponse.json({ error: "FALHA_CHECKOUT", message: "Não foi possível iniciar o pagamento." }, { status: 502 });
  }
}
