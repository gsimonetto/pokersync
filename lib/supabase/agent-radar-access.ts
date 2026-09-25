// O plano da conta inclui o Radar PokerSync? Mesma regra que o middleware
// aplica à rota /radar (lib/supabase/middleware.ts): plano que traz o Radar
// (Individual, Team Pro, Team Elite), Radar comprado avulso
// (user_plans.radar_addon) ou jogador ATIVO num time (acesso em cascata,
// ver isAddonUnlockedFor em lib/plans/plans-data.ts). As rotas
// /api/agent/* não passam pelo middleware de página (o Radar é um app
// nativo) -- sem esta checagem, quem cancelava o plano continuava
// importando pelo Radar normalmente.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAddonUnlocked, toPlanId } from "@/lib/plans/plans-data";

export const RADAR_FORA_DO_PLANO = {
  ok: false,
  error: "RADAR_FORA_DO_PLANO",
  message: "Seu plano não inclui o Radar PokerSync. Veja os planos em pokersync.com.br/planos.",
} as const;

export async function fetchRadarLiberadoFor(supabase: SupabaseClient, userId: User["id"]): Promise<boolean> {
  const { data: planRow, error } = await supabase
    .from("user_plans")
    .select("plan, radar_addon")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (isAddonUnlocked(toPlanId(planRow?.plan), "radar", Boolean(planRow?.radar_addon))) return true;

  const { data: membership, error: eTeam } = await supabase
    .from("team_members")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (eTeam) throw eTeam;
  return membership?.status === "ativo";
}
