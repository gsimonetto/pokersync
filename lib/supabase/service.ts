import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente com a service role key -- ignora RLS por completo. Só pra uso em
// contexto de servidor de confiança (webhook do Stripe, ver
// app/api/billing/webhook/route.ts): é assim que o webhook grava
// `user_plans` sem depender da policy `user_plans_admin_write`, que hoje
// só libera escrita pro e-mail do admin (writes manuais via SQL). NUNCA
// importar isto num Client Component nem devolver essa chave pro browser.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service role nao configurada. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
