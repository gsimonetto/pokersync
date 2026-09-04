import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";

// Lista as faturas (pagas ou nao) do customer do Stripe do usuario --
// consumido pelo painel "Minha Conta" (botao "Minhas Faturas"). Sem
// STRIPE_SECRET_KEY ou sem stripe_customer_id gravado ainda (usuario
// nunca pagou nada, ou Stripe nem esta ativo), devolve lista vazia em
// vez de erro -- tela normal, so' sem nada pra mostrar.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "NAO_AUTENTICADO" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ invoices: [] });
  }

  const { data: row } = await supabase.from("user_plans").select("stripe_customer_id").maybeSingle();
  if (!row?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const list = await getStripe().invoices.list({ customer: row.stripe_customer_id, limit: 24 });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountPaidCents: inv.amount_paid,
      currency: inv.currency,
      createdAt: inv.created,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));
    return NextResponse.json({ invoices });
  } catch (e) {
    console.error("Falha ao listar faturas do Stripe:", e);
    return NextResponse.json({ error: "FALHA_FATURAS", message: "Não foi possível carregar suas faturas." }, { status: 502 });
  }
}
