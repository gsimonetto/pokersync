// Status real do PokerSync Agent (app desktop) pro jogador conectado —
// usado pelo card "Importação automática" na Gestão de Banca. Não há
// canal ao vivo entre o navegador e o agente (são processos separados);
// o que dá pra mostrar de verdade é o que o próprio agente já grava no
// banco a cada sync (hand_sync_devices.last_sync_at, ver upsertDevice em
// agent-sync-service.ts) — nada inventado, só o dado que já existe.
import { createClient } from "@/lib/supabase/client";

export interface AgentDeviceStatus {
  deviceName: string;
  platform: string;
  lastSyncAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStatus(r: any): AgentDeviceStatus {
  return {
    deviceName: r.device_name,
    platform: r.platform,
    lastSyncAt: r.last_sync_at,
  };
}

export async function fetchMostRecentAgentDevice(): Promise<AgentDeviceStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sync_devices")
    .select("device_name, platform, last_sync_at")
    .eq("active", true)
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStatus(data) : null;
}
