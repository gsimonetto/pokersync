-- Torneios ao vivo (BSOP/WSOP) via YouTube.
--
-- Este projeto ainda não tinha pasta de migrations no repositório (o
-- schema é gerenciado direto no dashboard do Supabase) — esta é a
-- primeira. Não havia nenhuma migration existente pra copiar o padrão
-- de RLS, então a policy de leitura abaixo segue o que já é comum no
-- restante do produto: authenticated lê, só service role escreve.

create table if not exists public.live_stream_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  youtube_channel_id text not null unique,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.live_stream_status (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.live_stream_channels(id) on delete cascade,
  is_live boolean not null default false,
  video_id text,
  video_title text,
  thumbnail_url text,
  checked_at timestamptz not null default now()
);

-- Uma linha de status por canal (a Edge Function faz upsert por
-- channel_id) — sem isso, cada rodada do cron iria acumulando uma linha
-- nova em vez de atualizar o estado atual do canal.
create unique index if not exists live_stream_status_channel_id_key
  on public.live_stream_status(channel_id);

alter table public.live_stream_channels enable row level security;
alter table public.live_stream_status enable row level security;

-- Leitura pública pra quem está logado — sem INSERT/UPDATE/DELETE via
-- policy nenhuma: quem escreve é sempre a Edge Function usando a
-- service role key, que ignora RLS.
create policy "live_stream_channels_select_authenticated"
  on public.live_stream_channels
  for select
  to authenticated
  using (true);

create policy "live_stream_status_select_authenticated"
  on public.live_stream_status
  for select
  to authenticated
  using (true);

-- Seed inicial — os youtube_channel_id abaixo são PLACEHOLDERS.
-- Substitua 'REPLACE_ME_BSOP_CHANNEL_ID' e 'REPLACE_ME_WSOP_CHANNEL_ID'
-- pelos IDs reais dos canais oficiais do BSOP e da WSOP no YouTube antes
-- de a Edge Function conseguir encontrar alguma transmissão ao vivo.
insert into public.live_stream_channels (name, youtube_channel_id, active)
values
  ('BSOP', 'REPLACE_ME_BSOP_CHANNEL_ID', true),
  ('WSOP', 'REPLACE_ME_WSOP_CHANNEL_ID', true)
on conflict (youtube_channel_id) do nothing;
