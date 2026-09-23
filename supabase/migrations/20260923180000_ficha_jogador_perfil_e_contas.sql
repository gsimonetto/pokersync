-- Ficha do jogador (visão do coach): perfil de treino com consentimento e
-- contas técnicas corrigidas.
--
-- 1) hand_contexto(parsed_data): lê o histórico da mão e devolve as BASES
--    certas de cada estatística (mesmas regras de lib/services/
--    analysis-service.ts -- contextoPreflop/contextoPosflop). hand_tags
--    grava false (e não null) quando a situação nem aconteceu, então a base
--    tem que vir do histórico. Conferido contra o cálculo do app nas mãos
--    reais: 3-bet 31/321, c-bet 19/45, fold to c-bet 21/38, WTSD 54/154.
--
-- 2) team_player_evolution_stats e o 3-Bet/VPIP/PFR do funil passam a usar
--    essas bases e só mãos importadas (agent/import), igual à Performance.
--
-- 3) LGPD -- perfil de treino visível ao coach:
--    profiles.perfil_visivel_time: null = o jogador ainda não viu o aviso
--    (tratado como OCULTO), true/false = escolha dele, com a data em
--    perfil_visivel_time_em. Só apelido, experiência, turno, horas/dia e
--    dias de treino -- nunca data de nascimento nem contato. Finalidade:
--    orientação/agenda do coach dentro do time; o jogador pode ocultar a
--    qualquer momento (set_perfil_visivel_time).
--
-- 4) Banner do perfil (profiles.banner_url): imagem que o próprio jogador
--    escolhe no menu de perfil (bucket avatars, pasta dele). Mostrado na
--    capa da ficha.
--
-- 5) Histórico de times (team_member_history): team_members guarda só o
--    time ATUAL (chave = user_id) e apaga a linha quando o jogador sai --
--    então não havia como mostrar por onde ele passou. Um gatilho passa a
--    registrar entrada/saída; os membros ativos de hoje entram como ponto
--    de partida (times anteriores a esta migração não têm registro). Só
--    time, função e período -- nada de resultado financeiro de times
--    antigos.

-- ---------------------------------------------------------------------
-- 1) Contexto da mão
-- ---------------------------------------------------------------------
create or replace function public.hand_contexto(p jsonb)
returns table(ctx_3bet_chance boolean, ctx_viu_flop boolean, ctx_cbet_flop boolean, ctx_resposta_cbet text)
language sql
immutable
set search_path = public
as $fn$
  with
  heroi as (select p->>'heroName' as nome),
  pre as (
    select a.ord, a.v->>'player' as jogador, a.v->>'action' as acao
    from jsonb_array_elements(coalesce(p->'streets', '[]'::jsonb)) s
    cross join lateral jsonb_array_elements(coalesce(s->'actions', '[]'::jsonb)) with ordinality a(v, ord)
    where s->>'name' = 'preflop' and a.v->>'action' not in ('posts', 'uncalled_return')
  ),
  flop as (
    select a.ord, a.v->>'player' as jogador, a.v->>'action' as acao
    from jsonb_array_elements(coalesce(p->'streets', '[]'::jsonb)) s
    cross join lateral jsonb_array_elements(coalesce(s->'actions', '[]'::jsonb)) with ordinality a(v, ord)
    where s->>'name' = 'flop' and a.v->>'action' not in ('posts', 'uncalled_return')
  ),
  base as (
    select
      h.nome,
      (select min(ord) from pre where jogador = h.nome) as i_heroi,
      (select min(ord) from pre where acao = 'raises') as i_raise,
      (select count(*) from pre where acao = 'raises' and ord < (select min(ord) from pre where jogador = h.nome)) as raises_antes,
      (select jogador from pre where acao in ('bets', 'raises', 'allin') order by ord desc limit 1) as agressor,
      exists (select 1 from pre where jogador = h.nome and acao = 'folds') as foldou,
      exists (select 1 from jsonb_array_elements(coalesce(p->'streets', '[]'::jsonb)) s where s->>'name' = 'flop') as tem_flop,
      (select min(ord) from flop where jogador = h.nome) as f_heroi,
      (select min(ord) from flop where acao in ('bets', 'raises', 'allin')) as f_aposta
    from heroi h
  ),
  calc as (
    select b.*,
      (select jogador from pre where ord = b.i_raise) as jogador_raise,
      (select acao from flop where ord = b.f_heroi) as acao_f_heroi,
      (select jogador from flop where ord = b.f_aposta) as jogador_f_aposta,
      (select min(ord) from flop where jogador = b.nome and ord > b.f_aposta) as f_resp
    from base b
  )
  select
    case when c.nome is null then null
         else (c.i_heroi is not null and c.raises_antes = 1 and c.i_raise < c.i_heroi and c.jogador_raise <> c.nome) end,
    case when c.nome is null then null else (c.tem_flop and not c.foldou) end,
    case when c.nome is not null and c.tem_flop and not c.foldou and c.agressor = c.nome and c.f_heroi is not null
              and (c.f_aposta is null or c.f_aposta >= c.f_heroi)
         then c.acao_f_heroi in ('bets', 'raises', 'allin') end,
    case when c.nome is not null and c.tem_flop and not c.foldou and c.agressor is not null and c.agressor <> c.nome
              and c.f_aposta is not null and c.jogador_f_aposta = c.agressor and c.f_resp is not null
              and not exists (select 1 from flop where ord > c.f_aposta and ord < c.f_resp and acao in ('bets', 'raises', 'allin'))
         then (select case acao when 'folds' then 'fold' when 'calls' then 'call' when 'bets' then 'raise' when 'raises' then 'raise' when 'allin' then 'raise' end
               from flop where ord = c.f_resp) end
  from calc c
$fn$;

-- ---------------------------------------------------------------------
-- 2a) Estatísticas do jogador na ficha (visão do coach)
-- ---------------------------------------------------------------------
create or replace function public.team_player_evolution_stats(p_player uuid, p_days integer default 30)
returns table(hands integer, vpip_pct numeric, pfr_pct numeric, three_bet_pct numeric, fold_to_3bet_pct numeric,
              cbet_flop_pct numeric, fold_to_cbet_flop_pct numeric, aggression_factor numeric,
              aggression_frequency_pct numeric, wsd_pct numeric, wsd_won_pct numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_desde timestamptz;
begin
  if not public.can_view_player(p_player) then raise exception 'SEM_PERMISSAO'; end if;
  v_desde := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  with m as (
    select ht.*, x.*
    from public.hand_tags ht
    join public.hand_reviews hr on hr.id = ht.hand_review_id
    cross join lateral public.hand_contexto(hr.parsed_data) x
    where ht.user_id = p_player
      and hr.source in ('agent', 'import')
      and hr.created_at >= v_desde
  )
  select
    count(*)::int,
    round(100.0 * count(*) filter (where m.vpip) / nullif(count(*), 0), 1),
    round(100.0 * count(*) filter (where m.pfr) / nullif(count(*), 0), 1),
    -- 3-Bet: re-aumentos ÷ chances (1 raise na mesa na vez do jogador).
    round(100.0 * count(*) filter (where m.ctx_3bet_chance and m.three_bet)
      / nullif(count(*) filter (where m.ctx_3bet_chance), 0), 1),
    round(100.0 * count(*) filter (where m.hero_faced_3bet and m.hero_fold_to_3bet)
      / nullif(count(*) filter (where m.hero_faced_3bet), 0), 1),
    -- C-bet: das vezes que viu o flop como agressor e teve a chance.
    round(100.0 * count(*) filter (where m.ctx_cbet_flop)
      / nullif(count(*) filter (where m.ctx_cbet_flop is not null), 0), 1),
    -- Fold to c-bet: das vezes que enfrentou a c-bet do agressor.
    round(100.0 * count(*) filter (where m.ctx_resposta_cbet = 'fold')
      / nullif(count(*) filter (where m.ctx_resposta_cbet is not null), 0), 1),
    case when sum(m.postflop_call_count) > 0
      then round(sum(m.postflop_bet_count + m.postflop_raise_count)::numeric / sum(m.postflop_call_count), 2)
      else null end,
    round(100.0 * sum(m.postflop_bet_count + m.postflop_raise_count)
      / nullif(sum(m.postflop_bet_count + m.postflop_raise_count + m.postflop_call_count + m.postflop_fold_count), 0), 1),
    -- WTSD: dos flops vistos, quantos foram ao showdown.
    round(100.0 * count(*) filter (where m.ctx_viu_flop and m.went_to_showdown)
      / nullif(count(*) filter (where m.ctx_viu_flop), 0), 1),
    round(100.0 * count(*) filter (where m.ctx_viu_flop and m.went_to_showdown and m.won_showdown)
      / nullif(count(*) filter (where m.ctx_viu_flop and m.went_to_showdown), 0), 1)
  from m;
end;
$function$;

-- ---------------------------------------------------------------------
-- 2b) VPIP/PFR/3-Bet do jogador (todas as mãos importadas) pro funil
-- ---------------------------------------------------------------------
create or replace function public.player_pre_stats(p_player uuid)
returns table(vpip_pct numeric, pfr_pct numeric, three_bet_pct numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    round(100.0 * count(*) filter (where ht.vpip) / nullif(count(*), 0), 1),
    round(100.0 * count(*) filter (where ht.pfr) / nullif(count(*), 0), 1),
    round(100.0 * count(*) filter (where x.ctx_3bet_chance and ht.three_bet)
      / nullif(count(*) filter (where x.ctx_3bet_chance), 0), 1)
  from public.hand_tags ht
  join public.hand_reviews hr on hr.id = ht.hand_review_id
  cross join lateral public.hand_contexto(hr.parsed_data) x
  where ht.user_id = p_player and hr.source in ('agent', 'import')
$function$;

-- Uso interno (chamada de dentro de team_funnel_cards, que já checa
-- can_view_player); ninguém chama direto.
revoke all on function public.player_pre_stats(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2c) Funil: meta de VPIP/PFR/3-Bet compara com a conta certa
--     (antes: player_stats, com 3-Bet ÷ total de mãos e mãos coladas à mão)
-- ---------------------------------------------------------------------
create or replace function public.team_funnel_cards()
returns table(card_id uuid, player_id uuid, phase_id uuid, phase_name text, phase_color text, phase_sort_order integer,
              drills_target integer, reviews_target integer, stat_metric text, stat_target numeric, notes text,
              moved_at timestamp with time zone, drills_done integer, reviews_done integer, stat_value numeric,
              eventos_total integer, eventos_presente integer, eventos_ausente integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_team uuid;
begin
  select team_id into v_team from public.team_members where user_id = auth.uid() and status = 'ativo';
  if v_team is null then raise exception 'SEM_TIME'; end if;

  return query
  select
    c.id, c.player_id, c.phase_id, ph.name, ph.color, ph.sort_order,
    coalesce(c.drills_target_override, ph.default_drills_target),
    coalesce(c.reviews_target_override, ph.default_reviews_target),
    coalesce(c.stat_metric_override, ph.default_stat_metric),
    coalesce(c.stat_target_override, ph.default_stat_target),
    c.notes, c.moved_at,
    (select count(*)::int from public.training_sessions ts where ts.user_id = c.player_id and ts.created_at >= c.moved_at),
    (select count(*)::int from public.hand_reviews hr where hr.user_id = c.player_id and hr.status = 'concluida' and hr.updated_at >= c.moved_at),
    (
      select case coalesce(c.stat_metric_override, ph.default_stat_metric)
        when 'vpip' then ps.vpip_pct
        when 'pfr' then ps.pfr_pct
        when 'three_bet' then ps.three_bet_pct
        else null
      end
      from public.player_pre_stats(c.player_id) ps
    ),
    (select count(*)::int from public.team_event_participants p join public.team_events e on e.id = p.event_id
      where p.player_id = c.player_id and e.starts_at >= c.moved_at and e.starts_at < now() and p.attended is not null),
    (select count(*)::int from public.team_event_participants p join public.team_events e on e.id = p.event_id
      where p.player_id = c.player_id and e.starts_at >= c.moved_at and e.starts_at < now() and p.attended = true),
    (select count(*)::int from public.team_event_participants p join public.team_events e on e.id = p.event_id
      where p.player_id = c.player_id and e.starts_at >= c.moved_at and e.starts_at < now() and p.attended = false)
  from public.team_player_cards c
  join public.team_funnel_phases ph on ph.id = c.phase_id
  where c.team_id = v_team and c.archived_at is null and public.can_view_player(c.player_id)
  order by ph.sort_order asc, c.moved_at asc;
end;
$function$;

-- ---------------------------------------------------------------------
-- 3) LGPD: perfil de treino visível ao coach
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists perfil_visivel_time boolean,
  add column if not exists perfil_visivel_time_em timestamptz,
  add column if not exists banner_url text;

comment on column public.profiles.perfil_visivel_time is
  'null = ainda não viu o aviso (tratado como oculto); true/false = escolha do jogador sobre mostrar o perfil de treino ao coach/admin do time.';

-- O próprio jogador registra (ou muda) a escolha. Data guardada como
-- registro de quando decidiu.
create or replace function public.set_perfil_visivel_time(p_visivel boolean)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.profiles
     set perfil_visivel_time = p_visivel,
         perfil_visivel_time_em = now()
   where id = auth.uid();
$function$;

revoke all on function public.set_perfil_visivel_time(boolean) from public, anon;
grant execute on function public.set_perfil_visivel_time(boolean) to authenticated;

-- Ficha: o que o coach/admin vê do perfil. Campos de treino SÓ se o
-- jogador liberou (perfil_visivel_time = true); apelido sempre (já é
-- público dentro do app, compõe a tag de amigos). Nunca nascimento.
create or replace function public.team_player_profile(p_player uuid)
returns table(apelido text, visivel boolean, tempo_experiencia text, horario_treino text,
              horas_treino_dia smallint, dias_treino_semana text[], banner_url text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_view_player(p_player) then raise exception 'SEM_PERMISSAO'; end if;
  return query
  select
    p.apelido,
    coalesce(p.perfil_visivel_time, false),
    case when p.perfil_visivel_time then p.tempo_experiencia end,
    case when p.perfil_visivel_time then p.horario_treino end,
    case when p.perfil_visivel_time then p.horas_treino_dia end,
    case when p.perfil_visivel_time then p.dias_treino_semana end,
    p.banner_url
  from public.profiles p
  where p.id = p_player;
end;
$function$;

revoke all on function public.team_player_profile(uuid) from public, anon;
grant execute on function public.team_player_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Histórico de times
-- ---------------------------------------------------------------------
create table if not exists public.team_member_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- set null: o time pode ser apagado, o histórico do jogador continua
  -- (com o nome/cor/logo guardados abaixo).
  team_id uuid references public.teams(id) on delete set null,
  team_name text not null,
  team_accent text,
  team_logo_url text,
  role text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index if not exists team_member_history_user_idx on public.team_member_history (user_id, joined_at desc);

alter table public.team_member_history enable row level security;

drop policy if exists team_member_history_own_read on public.team_member_history;
create policy team_member_history_own_read on public.team_member_history
  for select to authenticated using (user_id = auth.uid());

-- Entrada (ao virar ativo), troca de função e saída. Um jogador só está
-- em um time por vez (team_members.user_id é a chave), então a linha
-- "aberta" (left_at nulo) é sempre a do time atual.
create or replace function public.team_member_history_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    update public.team_member_history
       set left_at = now()
     where user_id = old.user_id and left_at is null;
    return old;
  end if;

  if new.status = 'ativo' then
    if not exists (select 1 from public.team_member_history h
                    where h.user_id = new.user_id and h.team_id = new.team_id and h.left_at is null) then
      update public.team_member_history set left_at = now()
       where user_id = new.user_id and left_at is null;
      insert into public.team_member_history (user_id, team_id, team_name, team_accent, team_logo_url, role, joined_at)
      select new.user_id, t.id, t.name, t.accent, t.logo_url, new.role, coalesce(new.joined_at, now())
        from public.teams t where t.id = new.team_id;
    else
      update public.team_member_history set role = new.role
       where user_id = new.user_id and team_id = new.team_id and left_at is null and role <> new.role;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists team_member_history_sync on public.team_members;
create trigger team_member_history_sync
  after insert or update of status, role, team_id or delete on public.team_members
  for each row execute function public.team_member_history_sync();

-- Ponto de partida: quem já está ativo hoje.
insert into public.team_member_history (user_id, team_id, team_name, team_accent, team_logo_url, role, joined_at)
select m.user_id, t.id, t.name, t.accent, t.logo_url, m.role, m.joined_at
  from public.team_members m
  join public.teams t on t.id = m.team_id
 where m.status = 'ativo'
   and not exists (select 1 from public.team_member_history h where h.user_id = m.user_id and h.team_id = m.team_id);

-- Leitura pela ficha (coach/admin do time atual, ou o próprio jogador).
-- Nome/cor/logo atuais quando o time ainda existe; senão, o que foi
-- guardado na época.
create or replace function public.team_player_history(p_player uuid)
returns table(team_name text, team_accent text, team_logo_url text, role text,
              joined_at timestamptz, left_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_view_player(p_player) then raise exception 'SEM_PERMISSAO'; end if;
  return query
  select coalesce(t.name, h.team_name), coalesce(t.accent, h.team_accent), coalesce(t.logo_url, h.team_logo_url),
         h.role, h.joined_at, h.left_at
    from public.team_member_history h
    left join public.teams t on t.id = h.team_id
   where h.user_id = p_player
   order by h.left_at is not null, h.joined_at desc;
end;
$function$;

revoke all on function public.team_player_history(uuid) from public, anon;
grant execute on function public.team_player_history(uuid) to authenticated;
