// Cliente Supabase para requisições vindas do agente desktop: autenticação
// via Authorization: Bearer <access_token> (não cookie de navegador). O
// client usa a anon key com o token do usuário no header — RLS continua
// valendo, cada request só enxerga os dados do próprio usuário.
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class AgentAuthError extends Error {}

export async function authenticateAgentRequest(
  request: Request
): Promise<{ supabase: SupabaseClient; user: User }> {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AgentAuthError("Header Authorization: Bearer <token> ausente.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const supabase = createSupabaseClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AgentAuthError("Token inválido ou expirado.");

  return { supabase, user: data.user };
}
