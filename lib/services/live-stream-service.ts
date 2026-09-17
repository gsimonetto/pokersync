import { createClient } from "@/lib/supabase/client";

// ============================================================
// Torneios ao vivo (BSOP/WSOP) via YouTube — leitura do lado do
// browser, mesmo padrão dos demais services (client-side, RLS cuida da
// permissão). Quem escreve em live_stream_status é a Edge Function
// check-live-tournaments (service role), ver supabase/functions/ e a
// migration em supabase/migrations/ — este arquivo só lê.
// ============================================================

export interface LiveStreamChannel {
  channelId: string;
  name: string;
  logoUrl: string | null;
  videoId: string;
  videoTitle: string | null;
  thumbnailUrl: string | null;
  checkedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToChannel(r: any): LiveStreamChannel | null {
  const channel = r.live_stream_channels;
  if (!channel || !r.video_id) return null;
  return {
    channelId: r.channel_id,
    name: channel.name,
    logoUrl: channel.logo_url ?? null,
    videoId: r.video_id,
    videoTitle: r.video_title ?? null,
    thumbnailUrl: r.thumbnail_url ?? null,
    checkedAt: r.checked_at,
  };
}

// Só devolve canais ativos que estão AO VIVO agora — nada de "ao vivo ==
// false" aparecendo em lugar nenhum da UI. Se a Edge Function nunca
// rodou ainda (sem YOUTUBE_API_KEY configurada), a tabela fica vazia e
// isso aqui simplesmente devolve [] — sem inventar estado intermediário.
export async function fetchLiveTournaments(): Promise<LiveStreamChannel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("live_stream_status")
    .select("channel_id, is_live, video_id, video_title, thumbnail_url, checked_at, live_stream_channels!inner(name, logo_url, active)")
    .eq("is_live", true)
    .eq("live_stream_channels.active", true);
  if (error) throw error;
  return (data ?? []).map(rowToChannel).filter((c): c is LiveStreamChannel => c !== null);
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://youtube.com/watch?v=${videoId}`;
}
