// Gate compartilhado pelas rotas do agente desktop (/api/agent/sync,
// /api/agent/sync-tournaments, /api/agent/ping) -- pedido explícito: o
// jogador precisa escolher, ANTES de qualquer mão ou torneio ser
// importado, se o Radar deve trazer só o que acontecer a partir de agora
// ("from_now") ou também o histórico já existente no computador
// ("full_history"). Enquanto profiles.radar_import_scope estiver null
// (pergunta ainda não respondida na tela do Radar dentro do Player
// Evolution), os endpoints de sync recusam o corpo inteiro -- nenhuma
// mão/torneio entra parcialmente.
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type RadarImportScope = "from_now" | "full_history";

export async function fetchRadarImportScopeFor(supabase: SupabaseClient, userId: User["id"]): Promise<RadarImportScope | null> {
  const { data, error } = await supabase.from("profiles").select("radar_import_scope").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data?.radar_import_scope as RadarImportScope | null) ?? null;
}
