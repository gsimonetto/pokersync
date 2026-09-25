// O Radar também pergunta "o que importar" -- no primeiro login, mostrando
// quantas mãos e torneios achou no computador (pedido explícito: a escolha
// fica no Radar e no site). É a mesma escolha da tela do Radar no site
// (profiles.radar_import_scope); o corte por data
// (profiles.radar_import_scope_since) é gravado por trigger no banco, ver
// migration 20260926180000_radar_corte_e_sinal_de_vida.
import { authenticateAgentRequest, AgentAuthError } from "@/lib/supabase/agent";
import { RADAR_IMPORT_SCOPES, type RadarImportScope } from "@/lib/supabase/agent-import-scope";
import { fetchRadarLiberadoFor, RADAR_FORA_DO_PLANO } from "@/lib/supabase/agent-radar-access";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(`agent-import-scope:${clientIp(request)}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  let user;
  let supabase;
  try {
    ({ user, supabase } = await authenticateAgentRequest(request));
  } catch (e) {
    if (e instanceof AgentAuthError) {
      return Response.json({ ok: false, error: e.message }, { status: 401 });
    }
    console.error("[agent/import-scope] auth", e);
    return Response.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }

  let body: { scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const scope = body.scope as RadarImportScope;
  if (!RADAR_IMPORT_SCOPES.includes(scope)) {
    return Response.json({ ok: false, error: `Escolha inválida. Esperado um de: ${RADAR_IMPORT_SCOPES.join(", ")}.` }, { status: 400 });
  }

  try {
    if (!(await fetchRadarLiberadoFor(supabase, user.id))) {
      return Response.json(RADAR_FORA_DO_PLANO, { status: 403 });
    }
    const { error } = await supabase.from("profiles").update({ radar_import_scope: scope }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ ok: true, importScope: scope });
  } catch (e) {
    console.error("[agent/import-scope]", e);
    return Response.json({ ok: false, error: "Não foi possível salvar sua escolha agora." }, { status: 500 });
  }
}
