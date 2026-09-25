// Gate compartilhado pelas rotas do agente desktop (/api/agent/sync,
// /api/agent/sync-tournaments, /api/agent/ping) -- pedido explícito: o
// jogador precisa escolher, ANTES de qualquer mão ou torneio ser
// importado, se o Radar deve trazer só o que acontecer a partir de agora
// ("from_now"), os últimos 3 meses ("last_3_months") ou também todo o
// histórico já existente no computador ("full_history"). Enquanto
// profiles.radar_import_scope estiver null (pergunta ainda não respondida,
// nem na tela do Radar no site nem no próprio Radar), os endpoints de sync
// recusam o corpo inteiro -- nenhuma mão/torneio entra parcialmente.
//
// O corte vale de verdade desde a migration
// 20260926180000_radar_corte_e_sinal_de_vida: fica em
// profiles.radar_import_scope_since (gravado por trigger no banco -- o
// instante da escolha, ou esse instante menos 3 meses) e as rotas de sync
// descartam o que foi jogado antes dele (ver `jogadoAntesDoCorte`). Antes
// a escolha só destravava o envio -- o histórico inteiro do computador
// entrava do mesmo jeito.
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type RadarImportScope = "from_now" | "last_3_months" | "full_history";

export const RADAR_IMPORT_SCOPES: RadarImportScope[] = ["from_now", "last_3_months", "full_history"];

export interface RadarImportConfig {
  scope: RadarImportScope | null;
  /** Com "from_now"/"last_3_months": a partir de quando importar. */
  since: Date | null;
}

export async function fetchRadarImportConfigFor(
  supabase: SupabaseClient,
  userId: User["id"]
): Promise<RadarImportConfig> {
  const { data, error } = await supabase
    .from("profiles")
    .select("radar_import_scope, radar_import_scope_since")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const scope = (data?.radar_import_scope as RadarImportScope | null) ?? null;
  const since = scope && scope !== "full_history" && data?.radar_import_scope_since ? new Date(data.radar_import_scope_since) : null;
  return { scope, since };
}

export async function fetchRadarImportScopeFor(supabase: SupabaseClient, userId: User["id"]): Promise<RadarImportScope | null> {
  return (await fetchRadarImportConfigFor(supabase, userId)).scope;
}

// Folga do corte: a data da hand history vem no fuso do jogador/sala (ex.:
// "2026/09/20 20:30:00 BRT") e é lida sem fuso (ver handDateToISO em
// lib/poker/hand-parser.ts) -- pode errar em até 14 horas, a maior
// diferença de fuso que existe. Sem folga, a mão jogada logo depois da
// escolha podia cair "antes" do corte e sumir; com ela, o que fica de fora
// é o histórico de verdade (dias, meses, anos antes).
const FOLGA_DE_FUSO_MS = 14 * 60 * 60 * 1000;

/** `true` quando `jogadoEm` (ISO) é claramente anterior ao corte. Sem data = não dá pra saber, entra. */
export function jogadoAntesDoCorte(jogadoEm: string | null, corte: Date | null): boolean {
  if (!corte || !jogadoEm) return false;
  const quando = new Date(jogadoEm).getTime();
  if (Number.isNaN(quando)) return false;
  return quando < corte.getTime() - FOLGA_DE_FUSO_MS;
}
