import { createClient } from "@/lib/supabase/client";
import { toPlanId, type PlanId } from "@/lib/plans/plans-data";

// Ausencia de linha em user_plans == free (nao exige trigger de signup,
// mesmo padrao de fetchProfile em lib/services/profile-service.ts).
export async function fetchMyPlanId(): Promise<PlanId> {
  const supabase = createClient();
  const { data } = await supabase.from("user_plans").select("plan").maybeSingle();
  return toPlanId(data?.plan);
}
