// check-live-tournaments
//
// Pra cada canal ativo em `live_stream_channels`, consulta a YouTube
// Data API v3 (search.list, eventType=live) e faz upsert do resultado em
// `live_stream_status`.
//
// AGENDAMENTO: esta function NÃO se auto-agenda. Configure um Supabase
// Cron Job pra chamá-la a cada ~30 minutos, via Database > Cron Jobs no
// dashboard do Supabase (extensão pg_cron + pg_net, chamando esta URL
// com o header de autorização da service role) ou, se o projeto usar o
// Supabase CLI, declarando o schedule em `supabase/config.toml`
// (seção [edge_runtime] / cron do arquivo de config, ver docs do CLI).
// Não crie o agendamento aqui dentro — isso é configuração de infra,
// feita uma vez fora do código da function.
//
// COTA: cada chamada de search.list custa 100 unidades da cota gratuita
// da YouTube Data API (10.000 unidades/dia). A cada 30 minutos, checar 2
// canais gasta 2*100*48 = 9.600 unidades/dia — dá pra rodar com folga
// pra BSOP + WSOP, mas não escale o número de canais sem revisar essa
// conta (ou trocar a estratégia por webhooks do PubSubHubbub, fora do
// escopo desta function).
//
// Requer os secrets (Project Settings > Edge Functions > Secrets):
//   YOUTUBE_API_KEY       — chave da YouTube Data API v3
//   SUPABASE_URL          — já injetada automaticamente pelo runtime
//   SUPABASE_SERVICE_ROLE_KEY — já injetada automaticamente pelo runtime
//
// Sem YOUTUBE_API_KEY configurada, a function responde 500 cedo, sem
// tentar nada — não temos a chave real ainda, isso é esperado até
// alguém configurar o secret.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface Channel {
  id: string;
  youtube_channel_id: string;
}

interface YoutubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
}

interface YoutubeSearchResponse {
  items?: YoutubeSearchItem[];
  error?: { message: string };
}

Deno.serve(async () => {
  const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!youtubeApiKey) {
    return new Response(
      JSON.stringify({ error: "YOUTUBE_API_KEY não configurada nos secrets da Edge Function." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente da function." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Service role: só esta function escreve em live_stream_status, RLS
  // não se aplica a essa key.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: channels, error: channelsError } = await supabase
    .from("live_stream_channels")
    .select("id, youtube_channel_id")
    .eq("active", true);

  if (channelsError) {
    return new Response(JSON.stringify({ error: channelsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { channelId: string; ok: boolean; isLive?: boolean; error?: string }[] = [];

  for (const channel of (channels ?? []) as Channel[]) {
    // Erro de rede/quota num canal não pode derrubar os demais — segue
    // pro próximo em qualquer falha.
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("channelId", channel.youtube_channel_id);
      url.searchParams.set("eventType", "live");
      url.searchParams.set("type", "video");
      url.searchParams.set("key", youtubeApiKey);

      const res = await fetch(url.toString());
      const body = (await res.json()) as YoutubeSearchResponse;

      if (!res.ok) {
        throw new Error(body.error?.message ?? `YouTube API respondeu ${res.status}`);
      }

      const live = body.items?.[0] ?? null;
      const thumb =
        live?.snippet.thumbnails?.high?.url ??
        live?.snippet.thumbnails?.medium?.url ??
        live?.snippet.thumbnails?.default?.url ??
        null;

      const { error: upsertError } = await supabase
        .from("live_stream_status")
        .upsert(
          {
            channel_id: channel.id,
            is_live: !!live,
            video_id: live?.id.videoId ?? null,
            video_title: live?.snippet.title ?? null,
            thumbnail_url: thumb,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "channel_id" }
        );

      if (upsertError) throw upsertError;

      results.push({ channelId: channel.id, ok: true, isLive: !!live });
    } catch (err) {
      results.push({ channelId: channel.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
