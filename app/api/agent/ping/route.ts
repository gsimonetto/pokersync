// Endpoint leve para o agente desktop validar token + conectividade antes
// de varrer o disco (botão "Testar conexão" na UI do agente).
import { authenticateAgentRequest, AgentAuthError } from "@/lib/supabase/agent";

export async function GET(request: Request) {
  try {
    const { user } = await authenticateAgentRequest(request);
    return Response.json({ ok: true, userId: user.id, email: user.email });
  } catch (e) {
    if (e instanceof AgentAuthError) {
      return Response.json({ ok: false, error: e.message }, { status: 401 });
    }
    console.error("[agent/ping]", e);
    return Response.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
