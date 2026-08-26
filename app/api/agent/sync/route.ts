// Endpoint consumido pelo agente desktop (Tauri). Recebe o texto bruto dos
// arquivos de hand history encontrados no computador do usuário e grava as
// mãos via lib/services/agent-sync-service.ts.
import { authenticateAgentRequest, AgentAuthError } from "@/lib/supabase/agent";
import { processAgentSync, type AgentSyncInput } from "@/lib/services/agent-sync-service";

const MAX_FILES_PER_REQUEST = 200;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB de texto por arquivo é generoso p/ hand history

function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

function isValidInput(body: unknown): body is AgentSyncInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const device = b.device as Record<string, unknown> | undefined;
  if (!device) return false;
  if (
    typeof device.deviceId !== "string" ||
    typeof device.deviceName !== "string" ||
    typeof device.platform !== "string" ||
    typeof device.agentVersion !== "string"
  ) {
    return false;
  }
  if (typeof b.pokerRoom !== "string" || !b.pokerRoom) return false;
  if (!Array.isArray(b.files)) return false;
  return b.files.every(
    (f) => f && typeof f === "object" && typeof (f as { rawText?: unknown }).rawText === "string"
  );
}

export async function POST(request: Request) {
  let user;
  let supabase;
  try {
    ({ user, supabase } = await authenticateAgentRequest(request));
  } catch (e) {
    if (e instanceof AgentAuthError) {
      return Response.json({ ok: false, error: e.message }, { status: 401 });
    }
    console.error("[agent/sync] auth", e);
    return Response.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido.");
  }

  if (!isValidInput(body)) {
    return badRequest(
      "Corpo inválido. Esperado { device: { deviceId, deviceName, platform, agentVersion }, pokerRoom, files: [{ rawText, capturedAt? }] }."
    );
  }

  if (body.files.length === 0) {
    return badRequest("Nenhum arquivo enviado.");
  }
  if (body.files.length > MAX_FILES_PER_REQUEST) {
    return badRequest(`No máximo ${MAX_FILES_PER_REQUEST} arquivos por requisição — envie em lotes menores.`);
  }
  for (const f of body.files) {
    if (f.rawText.length > MAX_FILE_SIZE) {
      return badRequest("Arquivo excede o tamanho máximo suportado por sync.");
    }
  }

  try {
    const result = await processAgentSync(supabase, user.id, body);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[agent/sync] process", e);
    return Response.json({ ok: false, error: "Falha ao processar sync." }, { status: 500 });
  }
}
