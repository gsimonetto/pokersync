import { createClient } from "@/lib/supabase/client";
import { toPlanId, type PlanId } from "@/lib/plans/plans-data";

export interface MyPlanState {
  plan: PlanId;
  // Radar comprado avulso (user_plans.radar_addon) -- independente do
  // plano, ver isAddonUnlocked em lib/plans/plans-data.ts. false pra
  // quem nao tem linha em user_plans ainda (== free, sem addon).
  radarAddon: boolean;
}

// Uma linha so', usada por quem precisa dos dois (AppShell, middleware,
// /planos, /radar) -- evita duas idas ao banco pra ler a mesma linha.
export async function fetchMyPlanState(): Promise<MyPlanState> {
  const supabase = createClient();
  const { data } = await supabase.from("user_plans").select("plan, radar_addon").maybeSingle();
  return { plan: toPlanId(data?.plan), radarAddon: Boolean(data?.radar_addon) };
}

// Ausencia de linha em user_plans == free (nao exige trigger de signup,
// mesmo padrao de fetchProfile em lib/services/profile-service.ts).
export async function fetchMyPlanId(): Promise<PlanId> {
  const { plan } = await fetchMyPlanState();
  return plan;
}
