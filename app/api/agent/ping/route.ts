// Endpoint leve do agente desktop: valida o token e conta pro Radar o que
// ele precisa saber antes de varrer o disco -- o que o jogador escolheu
// importar (importScope) e se o plano da conta inclui o Radar
// (radarLiberado). GET é o "Testar conexão" das versões antigas; POST com
// { device } é o sinal de vida que o Radar 0.2.0+ manda a cada ciclo (~5
// min): grava hand_sync_devices.last_seen_at, e a Gestão de Banca passa a
// saber se o Radar está ligado agora ou parou (antes só existia "última
// vez que chegou mão", e o selo ficava verde com o Radar parado havia dias).
import { authenticateAgentRequest, AgentAuthError } from "@/lib/supabase/agent";
import { fetchRadarImportScopeFor } from "@/lib/supabase/agent-import-scope";
import { fetchRadarLiberadoFor } from "@/lib/supabase/agent-radar-access";
import { upsertDevice, type AgentDeviceInfo } from "@/lib/services/agent-sync-service";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

function deviceValido(device: unknown): device is AgentDeviceInfo {
  if (!device || typeof device !== "object") return false;
  const d = device as Record<string, unknown>;
  return (
    typeof d.deviceId === "string" &&
    d.deviceId.length > 0 &&
    d.deviceId.length <= 200 &&
    typeof d.deviceName === "string" &&
    d.deviceName.length <= 200 &&
    typeof d.platform === "string" &&
    d.platform.length <= 50 &&
    typeof d.agentVersion === "string" &&
    d.agentVersion.length <= 50
  );
}

async function responder(request: Request, device: AgentDeviceInfo | null) {
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
    const [importScope, radarLiberado] = await Promise.all([
      fetchRadarImportScopeFor(supabase, user.id),
      fetchRadarLiberadoFor(supabase, user.id),
    ]);
    if (device) await upsertDevice(supabase, user.id, device, { sincronizou: false });
    return Response.json({ ok: true, userId: user.id, email: user.email, importScope, radarLiberado });
  } catch (e) {
    if (e instanceof AgentAuthError) {
      return Response.json({ ok: false, error: e.message }, { status: 401 });
    }
    console.error("[agent/ping]", e);
    return Response.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return responder(request, null);
}

export async function POST(request: Request) {
  let body: { device?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!deviceValido(body.device)) {
    return Response.json({ ok: false, error: "Corpo inválido. Esperado { device: { deviceId, deviceName, platform, agentVersion } }." }, { status: 400 });
  }
  return responder(request, body.device);
}
