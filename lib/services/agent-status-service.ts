// Status real do Radar PokerSync (app desktop) pro jogador conectado —
// usado pelo card "Importação automática" na Gestão de Banca. Não há
// canal ao vivo entre o navegador e o agente (são processos separados);
// o que dá pra mostrar de verdade é o que o próprio agente já grava no
// banco a cada sync (hand_sync_devices.last_sync_at, ver upsertDevice em
// agent-sync-service.ts) — nada inventado, só o dado que já existe.
import { createClient } from "@/lib/supabase/client";
import type { RadarImportScope } from "@/lib/supabase/agent-import-scope";

export interface AgentDeviceStatus {
  deviceName: string;
  platform: string;
  /** Última vez que chegou mão/torneio (null = só mandou sinal de vida até agora). */
  lastSyncAt: string | null;
  /** Último sinal de vida do Radar (a cada ~5 min enquanto o computador está ligado). */
  lastSeenAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStatus(r: any): AgentDeviceStatus {
  return {
    deviceName: r.device_name,
    platform: r.platform,
    lastSyncAt: r.last_sync_at,
    lastSeenAt: r.last_seen_at ?? r.last_sync_at,
  };
}

// Sinal de vida vem a cada ~5 min; 15 min sem nada = computador desligado
// ou Radar parado (fechado, sem internet, sessão vencida).
const RADAR_LIGADO_MS = 15 * 60 * 1000;

export function radarLigadoAgora(status: AgentDeviceStatus | null): boolean {
  if (!status?.lastSeenAt) return false;
  return Date.now() - new Date(status.lastSeenAt).getTime() < RADAR_LIGADO_MS;
}

export async function fetchMostRecentAgentDevice(): Promise<AgentDeviceStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sync_devices")
    .select("device_name, platform, last_sync_at, last_seen_at")
    .eq("active", true)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStatus(data) : null;
}

// ============================================================
// Escopo de importação do Radar -- pedido explícito: antes de o agente
// importar QUALQUER mão ou torneio, o jogador precisa escolher se quer
// só o que acontecer a partir de agora ("from_now"), os últimos 3 meses
// ("last_3_months") ou também todo o histórico que já existe no
// computador ("full_history"). Dá pra escolher aqui no site ou no próprio
// Radar (app/api/agent/import-scope) -- é a mesma escolha. Afeta Gestão
// de Banca, Revisor de Mãos e Player Evolution por igual, já que os três
// só enxergam mão importada pelo agente (fonte única: hand_reviews com
// source="agent"). Null = ainda não respondeu; os endpoints
// /api/agent/sync* recusam qualquer import nesse estado (ver
// requireRadarImportScope em cada route.ts).
// ============================================================
export type { RadarImportScope };

export async function fetchRadarImportScope(): Promise<RadarImportScope | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("radar_import_scope")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.radar_import_scope as RadarImportScope | null) ?? null;
}

export async function setRadarImportScope(scope: RadarImportScope): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("NAO_AUTENTICADO");
  const { error } = await supabase.from("profiles").update({ radar_import_scope: scope }).eq("id", userData.user.id);
  if (error) throw error;
}
