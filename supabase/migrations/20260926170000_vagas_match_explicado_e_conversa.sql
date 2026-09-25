-- Vagas: conserto do match, moeda por vaga, match explicado, cartão do
-- jogador, nome do time visível e conversa com o candidato antes de
-- aceitar.

-- 1) Moeda da vaga: o time escolhe R$ ou US$ ao publicar. Pra comparar
--    com o buy-in médio do jogador -- que a Gestão de Banca guarda em
--    reais -- a vaga em dólar guarda a cotação do dia em que foi
--    publicada. De quebra, buy-in não pode ser negativo nem ter o mínimo
--    maior que o máximo.
alter table public.marketplace_listings
  add column if not exists moeda text not null default 'BRL',
  add column if not exists cotacao_usd_brl numeric;

alter table public.marketplace_listings drop constraint if exists marketplace_listings_moeda_valida;
alter table public.marketplace_listings
  add constraint marketplace_listings_moeda_valida check (
    moeda = 'BRL' or (moeda = 'USD' and cotacao_usd_brl is not null and cotacao_usd_brl between 1 and 50)
  );

alter table public.marketplace_listings drop constraint if exists marketplace_listings_buyin_valido;
alter table public.marketplace_listings
  add constraint marketplace_listings_buyin_valido check (
    coalesce(buy_in_min, 0) >= 0 and coalesce(buy_in_max, 0) >= 0
    and (buy_in_min is null or buy_in_max is null or buy_in_min <= buy_in_max)
  );

-- 2) A conta do match, num lugar só. Cada requisito que a vaga pede vira
--    uma "parte" com o número do jogador, o pedido, se ele bate e quantos
--    pontos (0 a 100) ele faz nessa parte:
--      ROI (pesa 30%)          50 pontos no mínimo pedido; cada ponto de
--                              ROI acima ou abaixo vale 2 pontos;
--      volume (25%)            sessões por mês / pedido (100 ao bater);
--      evolução (25%)          a nota geral do jogador (0 a 100);
--      buy-in médio (20%)      100 dentro da faixa, menos quanto mais
--                              longe dela.
--    O que a vaga não pede -- ou o jogador ainda não tem dado -- fica
--    neutro (50). Antes, a conta nunca chegava a usar os números do
--    jogador (o teste "tem dado?" falhava sempre) e todo mundo ficava
--    com 50; e a evolução contava mesmo quando a vaga não pedia.
create or replace function public.marketplace_match_partes(
  p_min_roi numeric, p_min_volume integer, p_min_score numeric,
  p_buyin_min numeric, p_buyin_max numeric, p_cotacao numeric,
  p_roi numeric, p_sessoes_semana numeric, p_score numeric, p_abi numeric
)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_partes jsonb := '[]'::jsonb;
  v_roi numeric := round(p_roi, 1);
  v_mes numeric := round(p_sessoes_semana * 4.33, 1);
  v_score numeric := round(p_score);
  v_min numeric := p_buyin_min * p_cotacao;
  v_max numeric := p_buyin_max * p_cotacao;
  v_pontos numeric;
begin
  if p_min_roi is not null then
    v_pontos := case when v_roi is null then null else least(100, greatest(0, 50 + (v_roi - p_min_roi) * 2)) end;
    v_partes := v_partes || jsonb_build_array(jsonb_build_object(
      'chave', 'roi', 'peso', 30, 'pedido_min', p_min_roi, 'meu', v_roi,
      'ok', v_roi >= p_min_roi, 'pontos', round(v_pontos, 2),
      'pontos_se_bater', case when v_pontos is null then null else round(greatest(v_pontos, 50), 2) end));
  end if;

  if p_min_volume > 0 then
    v_pontos := case when v_mes is null then null else least(100, 100.0 * v_mes / p_min_volume) end;
    v_partes := v_partes || jsonb_build_array(jsonb_build_object(
      'chave', 'volume', 'peso', 25, 'pedido_min', p_min_volume, 'meu', v_mes,
      'ok', v_mes >= p_min_volume, 'pontos', round(v_pontos, 2),
      'pontos_se_bater', case when v_pontos is null then null else 100 end));
  end if;

  if p_min_score is not null then
    v_pontos := case when v_score is null then null else least(100, greatest(0, v_score)) end;
    v_partes := v_partes || jsonb_build_array(jsonb_build_object(
      'chave', 'evolucao', 'peso', 25, 'pedido_min', p_min_score, 'meu', v_score,
      'ok', v_score >= p_min_score, 'pontos', v_pontos,
      'pontos_se_bater', case when v_pontos is null then null else greatest(v_pontos, least(100, p_min_score)) end));
  end if;

  if p_buyin_min is not null and p_buyin_max is not null then
    v_pontos := case
      when p_abi is null or p_cotacao is null then null
      when p_abi between v_min and v_max then 100
      else greatest(0, 100 - 100 * abs(p_abi - (v_min + v_max) / 2) / greatest(v_max - v_min, v_min, 1))
    end;
    v_partes := v_partes || jsonb_build_array(jsonb_build_object(
      'chave', 'buyin', 'peso', 20, 'pedido_min', p_buyin_min, 'pedido_max', p_buyin_max,
      'meu', round(p_abi, 2), 'meu_na_moeda', round(p_abi / p_cotacao, 2),
      'ok', p_abi between v_min and v_max, 'pontos', round(v_pontos, 2),
      'pontos_se_bater', case when v_pontos is null then null else 100 end));
  end if;

  return v_partes;
end;
$function$;

-- A nota final: 50 + o quanto cada parte avaliada fica acima ou abaixo
-- do neutro, pelo peso dela (é a mesma média ponderada de antes).
create or replace function public.marketplace_match_nota(p_partes jsonb)
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select round(50 + coalesce(sum((p->>'peso')::numeric * ((p->>'pontos')::numeric - 50) / 100), 0))
  from jsonb_array_elements(coalesce(p_partes, '[]'::jsonb)) p
  where p->>'pontos' is not null;
$$;

create or replace function public.marketplace_match_score(p_listing_id uuid, p_user uuid default auth.uid())
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_listing record;
  v_perf record;
begin
  select * into v_listing from public.marketplace_listings where id = p_listing_id;
  if not found then raise exception 'VAGA_INEXISTENTE'; end if;

  if not (p_user = auth.uid() or (v_listing.team_id = public.my_team_id() and public.is_team_manager())) then
    raise exception 'SEM_PERMISSAO';
  end if;

  -- Jogador sem nenhum dado: os campos ficam vazios e cada parte, neutra.
  select * into v_perf from public.player_performance_snapshot where user_id = p_user;

  return public.marketplace_match_nota(public.marketplace_match_partes(
    v_listing.min_roi_pct, v_listing.min_volume_sessions_month, v_listing.min_score_geral,
    v_listing.buy_in_min, v_listing.buy_in_max,
    case when v_listing.moeda = 'USD' then v_listing.cotacao_usd_brl else 1 end,
    v_perf.roi_pct, v_perf.frequencia_semanal_sessoes, v_perf.score_geral, v_perf.abi_torneio));
end;
$function$;

-- O aviso de "vaga compatível" (pra quem ligou Procurando time) passa a
-- usar a mesma conta direto: antes ele ia pela função acima, que confere
-- quem está pedindo -- e com o match sempre em 50 o aviso nunca saía.
create or replace function public.notify_high_match_candidates()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_candidato record;
  v_score numeric;
  v_team_name text;
begin
  if new.status <> 'aberta' then return new; end if;
  select name into v_team_name from public.teams where id = new.team_id;

  for v_candidato in
    select pp.*
    from public.profiles p
    join public.player_performance_snapshot pp on pp.user_id = p.id
    where p.procurando_vaga
      and coalesce(pp.num_sessoes, 0) > 0
      and not exists (select 1 from public.team_members tm where tm.user_id = p.id)
  loop
    v_score := public.marketplace_match_nota(public.marketplace_match_partes(
      new.min_roi_pct, new.min_volume_sessions_month, new.min_score_geral,
      new.buy_in_min, new.buy_in_max, case when new.moeda = 'USD' then new.cotacao_usd_brl else 1 end,
      v_candidato.roi_pct, v_candidato.frequencia_semanal_sessoes, v_candidato.score_geral, v_candidato.abi_torneio));
    if v_score >= 75 then
      perform public.notify_system(
        v_candidato.user_id, 'Vaga compatível com seu perfil',
        '"' || new.title || '" (' || coalesce(v_team_name, 'um time') || ') combina com o seu jogo — match de ' || v_score::text || '.',
        'success', '/marketplace/' || new.id, 'sistema');
    end if;
  end loop;
  return new;
end;
$function$;

-- 3) Quem se candidatou continua vendo a vaga depois que o time fecha
--    (antes ela sumia e "Minhas candidaturas" quebrava). Função à parte
--    pra política de vagas não consultar a de candidaturas, que por sua
--    vez consulta a de vagas.
create or replace function public.marketplace_me_candidatei(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.marketplace_applications a
    where a.listing_id = p_listing_id and a.user_id = (select auth.uid())
  );
$$;

drop policy if exists listings_select_candidato on public.marketplace_listings;
create policy listings_select_candidato on public.marketplace_listings
  for select to authenticated using (public.marketplace_me_candidatei(id));

-- 4) Match explicado: pra cada vaga (as abertas, ou as pedidas que a
--    pessoa enxerga), o match do jogador logado, cada requisito com o
--    número dele e quantos se candidataram. Uma chamada só pra lista.
create or replace function public.marketplace_meus_matches(p_listing_ids uuid[] default null)
returns table (listing_id uuid, match_score numeric, requisitos jsonb, candidatos integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_perf record;
  l record;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select * into v_perf from public.player_performance_snapshot pp where pp.user_id = v_uid;

  for l in
    select ml.* from public.marketplace_listings ml
    where case
      when p_listing_ids is null then ml.status = 'aberta' and (ml.expires_at is null or ml.expires_at > now())
      else ml.id = any(p_listing_ids)
        and (ml.status = 'aberta' or ml.team_id = public.my_team_id() or public.marketplace_me_candidatei(ml.id))
    end
  loop
    listing_id := l.id;
    requisitos := public.marketplace_match_partes(
      l.min_roi_pct, l.min_volume_sessions_month, l.min_score_geral,
      l.buy_in_min, l.buy_in_max, case when l.moeda = 'USD' then l.cotacao_usd_brl else 1 end,
      v_perf.roi_pct, v_perf.frequencia_semanal_sessoes, v_perf.score_geral, v_perf.abi_torneio);
    match_score := public.marketplace_match_nota(requisitos);
    select count(*)::int into candidatos
      from public.marketplace_applications a
      where a.listing_id = l.id and a.status <> 'retirada';
    return next;
  end loop;
end;
$function$;

-- 5) "Como os times te veem": o cartão do próprio jogador (os mesmos
--    números que o time vê na candidatura) e o que falta preencher.
create or replace function public.marketplace_meu_cartao()
returns table (
  user_id uuid, nome text, apelido text, avatar_id smallint, avatar_url text,
  hands integer, roi_pct numeric, abi_torneio numeric, num_sessoes integer, lucro_acumulado numeric,
  frequencia_semanal_sessoes numeric, score_geral numeric, num_drills integer, taxa_acerto_treino_pct numeric,
  tempo_experiencia text, horario_treino text, dias_treino_semana text[], procurando_vaga boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    pr.id, pr.nome, pr.apelido, pr.avatar_id, pr.avatar_url,
    coalesce((select count(*) from public.hand_tags ht where ht.user_id = pr.id), 0)::int,
    pp.roi_pct, pp.abi_torneio, pp.num_sessoes::int, pp.lucro_acumulado,
    pp.frequencia_semanal_sessoes, pp.score_geral, pp.num_drills::int, pp.taxa_acerto_treino_pct,
    pr.tempo_experiencia, pr.horario_treino, pr.dias_treino_semana, coalesce(pr.procurando_vaga, false)
  from public.profiles pr
  left join public.player_performance_snapshot pp on pp.user_id = pr.id
  where pr.id = (select auth.uid());
$$;

-- 6) O time de cada vaga: nome, cor, logo e descrição -- antes o jogador
--    via só "Time", porque os dados do time são fechados pra quem não é
--    do time -- e os números dele nas Vagas, agora com quantos jogadores
--    tem (a lista de membros continua fechada; o número, não). Só pra
--    time que tem vaga que a pessoa enxerga. Substitui a
--    marketplace_team_stats, que era de um time por vez.
drop function if exists public.marketplace_team_stats(uuid);
create or replace function public.marketplace_times(p_team_ids uuid[])
returns table (
  team_id uuid, nome text, cor text, logo_url text, banner_url text, descricao text, jogadores integer,
  total_vagas integer, vagas_abertas integer, total_candidaturas integer, aceitas integer,
  taxa_aceite_pct numeric, tempo_medio_resposta_dias numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    t.id, t.name, t.accent, t.logo_url, t.banner_url, t.description,
    (select count(*) from public.team_members tm where tm.team_id = t.id and tm.status = 'ativo')::int,
    count(distinct l.id)::int,
    (count(distinct l.id) filter (where l.status = 'aberta'))::int,
    count(a.id)::int,
    (count(a.id) filter (where a.status = 'aceita'))::int,
    round(100.0 * count(a.id) filter (where a.status = 'aceita')
      / nullif(count(a.id) filter (where a.status in ('aceita', 'recusada')), 0), 1),
    round(avg(extract(epoch from (a.updated_at - a.created_at)) / 86400.0)
      filter (where a.status in ('aceita', 'recusada')), 1)
  from public.teams t
  left join public.marketplace_listings l on l.team_id = t.id
  left join public.marketplace_applications a on a.listing_id = l.id
  where t.id = any(p_team_ids)
    and exists (
      select 1 from public.marketplace_listings v
      where v.team_id = t.id
        and (v.status = 'aberta' or v.team_id = public.my_team_id() or public.marketplace_me_candidatei(v.id))
    )
  group by t.id;
$$;

-- 7) Conversa da candidatura: o admin/coach do time conversa com quem se
--    candidatou (e o jogador responde) antes de decidir. Vale enquanto a
--    candidatura está em análise ou foi aceita. A tabela fica fechada:
--    ler, escrever e marcar como lida só pelas funções abaixo.
create table if not exists public.marketplace_application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.marketplace_applications(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  -- clock_timestamp: mensagens seguidas na mesma transação ficam na ordem.
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  constraint marketplace_application_messages_body_valido check (char_length(btrim(body)) between 1 and 2000)
);
create index if not exists marketplace_application_messages_app_idx
  on public.marketplace_application_messages (application_id, created_at);
alter table public.marketplace_application_messages enable row level security;
revoke all on public.marketplace_application_messages from anon, authenticated;

-- De que lado da conversa a pessoa está: 'candidato', 'time' (admin ou
-- coach ativo do time da vaga) ou nenhum (null).
create or replace function public.marketplace_lado_na_conversa(p_application_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when a.user_id = (select auth.uid()) then 'candidato'
    when exists (
      select 1 from public.team_members tm
      where tm.team_id = l.team_id and tm.user_id = (select auth.uid())
        and tm.status = 'ativo' and tm.role in ('admin', 'coach')
    ) then 'time'
  end
  from public.marketplace_applications a
  join public.marketplace_listings l on l.id = a.listing_id
  where a.id = p_application_id;
$$;

create or replace function public.marketplace_mensagens(p_application_id uuid)
returns table (
  id uuid, do_time boolean, minha boolean, autor text, avatar_id smallint, avatar_url text,
  body text, created_at timestamptz, read_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_candidato uuid;
begin
  if public.marketplace_lado_na_conversa(p_application_id) is null then raise exception 'SEM_PERMISSAO'; end if;
  select a.user_id into v_candidato from public.marketplace_applications a where a.id = p_application_id;

  return query
    select m.id, m.sender_id <> v_candidato, m.sender_id = auth.uid(),
      coalesce(nullif(btrim(p.apelido), ''), nullif(btrim(p.nome), ''), 'Alguém'),
      p.avatar_id, p.avatar_url, m.body, m.created_at, m.read_at
    from public.marketplace_application_messages m
    left join public.profiles p on p.id = m.sender_id
    where m.application_id = p_application_id
    order by m.created_at, m.id;
end;
$function$;

create or replace function public.marketplace_enviar_mensagem(p_application_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lado text;
  v_app record;
  v_listing record;
  v_id uuid;
  v_nome text;
  v_texto text := btrim(coalesce(p_body, ''));
  v_ja_avisado boolean;
  m record;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if char_length(v_texto) = 0 then raise exception 'MENSAGEM_VAZIA'; end if;
  if char_length(v_texto) > 2000 then raise exception 'MENSAGEM_LONGA'; end if;
  v_lado := public.marketplace_lado_na_conversa(p_application_id);
  if v_lado is null then raise exception 'SEM_PERMISSAO'; end if;

  select * into v_app from public.marketplace_applications where id = p_application_id;
  if v_app.status not in ('pendente', 'aceita') then raise exception 'CONVERSA_ENCERRADA'; end if;
  select * into v_listing from public.marketplace_listings where id = v_app.listing_id;

  if (select count(*) from public.marketplace_application_messages mm
      where mm.application_id = p_application_id and mm.sender_id = auth.uid()
        and mm.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'MUITAS_MENSAGENS';
  end if;

  -- Um aviso por vez: se o outro lado ainda não leu a mensagem anterior
  -- deste lado, não avisa de novo.
  select exists (
    select 1 from public.marketplace_application_messages mm
    where mm.application_id = p_application_id and mm.read_at is null
      and case when v_lado = 'candidato' then mm.sender_id = v_app.user_id else mm.sender_id <> v_app.user_id end
  ) into v_ja_avisado;

  insert into public.marketplace_application_messages (application_id, sender_id, body)
  values (p_application_id, auth.uid(), v_texto)
  returning id into v_id;

  if not v_ja_avisado then
    select coalesce(nullif(btrim(p.apelido), ''), nullif(btrim(p.nome), ''))
      into v_nome from public.profiles p where p.id = auth.uid();
    v_nome := coalesce(v_nome, 'Alguém');
    if v_lado = 'candidato' then
      for m in
        select tm.user_id from public.team_members tm
        where tm.team_id = v_listing.team_id and tm.status = 'ativo' and tm.role in ('admin', 'coach')
      loop
        perform public.notify_system(m.user_id, 'Mensagem de candidato',
          v_nome || ' escreveu sobre a vaga "' || v_listing.title || '".',
          'info', '/marketplace/' || v_listing.id || '?candidato=' || p_application_id, 'team');
      end loop;
    else
      perform public.notify_system(v_app.user_id, 'Mensagem do time',
        v_nome || ' escreveu sobre a sua candidatura pra "' || v_listing.title || '".',
        'info', '/marketplace/' || v_listing.id || '?conversa=1', 'team');
    end if;
  end if;

  return v_id;
end;
$function$;

-- Marca como lidas as mensagens do outro lado.
create or replace function public.marketplace_marcar_mensagens_lidas(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lado text := public.marketplace_lado_na_conversa(p_application_id);
  v_candidato uuid;
begin
  if v_lado is null then raise exception 'SEM_PERMISSAO'; end if;
  select a.user_id into v_candidato from public.marketplace_applications a where a.id = p_application_id;
  update public.marketplace_application_messages m
     set read_at = now()
   where m.application_id = p_application_id and m.read_at is null
     and case when v_lado = 'candidato' then m.sender_id <> v_candidato else m.sender_id = v_candidato end;
end;
$function$;

-- Mensagens ainda não lidas, por candidatura: as do time pra quem se
-- candidatou (sou_candidato) e as dos candidatos pra quem gerencia o time.
create or replace function public.marketplace_nao_lidas()
returns table (application_id uuid, nao_lidas integer, sou_candidato boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.application_id, count(*)::int, a.user_id = (select auth.uid())
  from public.marketplace_application_messages m
  join public.marketplace_applications a on a.id = m.application_id
  join public.marketplace_listings l on l.id = a.listing_id
  where m.read_at is null
    and (
      (a.user_id = (select auth.uid()) and m.sender_id <> a.user_id)
      or (m.sender_id = a.user_id and exists (
        select 1 from public.team_members tm
        where tm.team_id = l.team_id and tm.user_id = (select auth.uid())
          and tm.status = 'ativo' and tm.role in ('admin', 'coach')))
    )
  group by m.application_id, a.user_id;
$$;

-- 8) Limpeza: a versão antiga de decidir (sem o motivo da recusa) ficou
--    esquecida no banco.
drop function if exists public.marketplace_decide_application(uuid, text);

-- 9) Funções das Vagas só pra quem está logado; as de uso interno (a
--    conta do match e o lado da conversa) nem isso.
revoke all on function public.marketplace_apply(uuid, text) from public, anon;
revoke all on function public.marketplace_decide_application(uuid, text, text) from public, anon;
revoke all on function public.marketplace_match_score(uuid, uuid) from public, anon;
revoke all on function public.marketplace_withdraw_application(uuid) from public, anon;
revoke all on function public.marketplace_candidate_snapshot(uuid) from public, anon;
revoke all on function public.marketplace_me_candidatei(uuid) from public, anon;
revoke all on function public.marketplace_meus_matches(uuid[]) from public, anon;
revoke all on function public.marketplace_meu_cartao() from public, anon;
revoke all on function public.marketplace_times(uuid[]) from public, anon;
revoke all on function public.marketplace_mensagens(uuid) from public, anon;
revoke all on function public.marketplace_enviar_mensagem(uuid, text) from public, anon;
revoke all on function public.marketplace_marcar_mensagens_lidas(uuid) from public, anon;
revoke all on function public.marketplace_nao_lidas() from public, anon;
grant execute on function public.marketplace_apply(uuid, text) to authenticated;
grant execute on function public.marketplace_decide_application(uuid, text, text) to authenticated;
grant execute on function public.marketplace_match_score(uuid, uuid) to authenticated;
grant execute on function public.marketplace_withdraw_application(uuid) to authenticated;
grant execute on function public.marketplace_candidate_snapshot(uuid) to authenticated;
grant execute on function public.marketplace_me_candidatei(uuid) to authenticated;
grant execute on function public.marketplace_meus_matches(uuid[]) to authenticated;
grant execute on function public.marketplace_meu_cartao() to authenticated;
grant execute on function public.marketplace_times(uuid[]) to authenticated;
grant execute on function public.marketplace_mensagens(uuid) to authenticated;
grant execute on function public.marketplace_enviar_mensagem(uuid, text) to authenticated;
grant execute on function public.marketplace_marcar_mensagens_lidas(uuid) to authenticated;
grant execute on function public.marketplace_nao_lidas() to authenticated;

revoke all on function public.marketplace_match_partes(numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.marketplace_match_nota(jsonb) from public, anon, authenticated;
revoke all on function public.marketplace_lado_na_conversa(uuid) from public, anon, authenticated;
