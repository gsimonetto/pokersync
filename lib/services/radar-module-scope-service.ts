// Escopo do Radar por módulo (Gestão de Banca, Revisor de Mãos,
// Performance) -- ver comentário da migration
// 20260921120000_radar_module_scope.sql pra entender por que isso é
// separado de profiles.radar_import_scope (aquele é global e controla o
// Agente; este é só um filtro de exibição por módulo, aplicado em cima
// do que já foi importado).
import { createClient } from "@/lib/supabase/client";

export type RadarModule = "banca" | "revisor" | "performance";
export type RadarModuleScope = "from_now" | "full_history";

export interface RadarModuleScopeState {
  scope: RadarModuleScope | null;
  since: string | null;
}

const SCOPE_COLUMN: Record<RadarModule, string> = {
  banca: "radar_scope_banca",
  revisor: "radar_scope_revisor",
  performance: "radar_scope_performance",
};
const SINCE_COLUMN: Record<RadarModule, string> = {
  banca: "radar_scope_banca_since",
  revisor: "radar_scope_revisor_since",
  performance: "radar_scope_performance_since",
};

export async function fetchRadarModuleScope(module: RadarModule): Promise<RadarModuleScopeState> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { scope: null, since: null };
  const scopeCol = SCOPE_COLUMN[module];
  const sinceCol = SINCE_COLUMN[module];
  const { data, error } = await supabase
    .from("profiles")
    .select(`${scopeCol}, ${sinceCol}`)
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    scope: (row?.[scopeCol] as RadarModuleScope | null) ?? null,
    since: (row?.[sinceCol] as string | null) ?? null,
  };
}

// "full_history" limpa o corte (mostra tudo já importado); "from_now"
// grava o instante do clique como corte -- só o que foi jogado dali pra
// frente aparece naquele módulo.
export async function setRadarModuleScope(module: RadarModule, scope: RadarModuleScope): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("NAO_AUTENTICADO");
  const { error } = await supabase
    .from("profiles")
    .update({
      [SCOPE_COLUMN[module]]: scope,
      [SINCE_COLUMN[module]]: scope === "from_now" ? new Date().toISOString() : null,
    })
    .eq("id", userData.user.id);
  if (error) throw error;
}

// Volta o módulo pro estado "nunca mexeu" -- usado depois de "zerar
// módulo", pra o botão voltar a perguntar em vez de ficar preso no
// último corte escolhido.
export async function clearRadarModuleScope(module: RadarModule): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("NAO_AUTENTICADO");
  const { error } = await supabase
    .from("profiles")
    .update({ [SCOPE_COLUMN[module]]: null, [SINCE_COLUMN[module]]: null })
    .eq("id", userData.user.id);
  if (error) throw error;
}
