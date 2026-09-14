// Endpoint leve para o agente desktop validar token + conectividade antes
// de varrer o disco (botão "Testar conexão" na UI do agente).
import { authenticateAgentRequest, AgentAuthError } from "@/lib/supabase/agent";
import { fetchRadarImportScopeFor } from "@/lib/supabase/agent-import-scope";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(`agent-ping:${clientIp(request)}`, 30, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  try {
    const { user, supabase } = await authenticateAgentRequest(request);
    // importScope null = jogador ainda não respondeu, na tela do Radar, se
    // quer só o que acontecer a partir de agora ou também o histórico já
    // existente no computador -- o agente deve esperar essa resposta antes
    // de varrer o disco (os endpoints de sync recusam o corpo enquanto
    // isso não acontece, mas expor aqui evita a varredura de arquivos à
    // toa).
    const importScope = await fetchRadarImportScopeFor(supabase, user.id);
    return Response.json({ ok: true, userId: user.id, email: user.email, importScope });
  } catch (e) {
    if (e instanceof AgentAuthError) {
      return Response.json({ ok: false, error: e.message }, { status: 401 });
    }
    console.error("[agent/ping]", e);
    return Response.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
