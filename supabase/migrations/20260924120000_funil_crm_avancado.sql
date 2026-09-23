-- Funil do time em nível de CRM (modo Time).
--
-- O funil já tinha fases, cartões, checklist, etiquetas, interações e
-- histórico. Esta migração acrescenta o que separa um CRM de um quadro de
-- post-its, adaptado a poker. Tudo é ACRÉSCIMO: nenhuma coluna existente
-- muda de nome ou de tipo, nenhum dado é apagado.
--
-- 1) Fase (team_funnel_phases), todos opcionais:
--    - descricao ............ para que serve a fase (aparece no quadro)
--    - buyin_min/buyin_max .. faixa de buy-in da fase (fase = nível de limite)
--    - wip_limit ............ capacidade: quantos jogadores cabem na fase
--    - sla_dias ............. após quantos dias parado o cartão "esfria"
--    - req_sessoes .......... requisito de subida: sessões jogadas na fase
--    - req_roi_pct .......... requisito de subida: ROI mínimo (carreira)
--    - req_score ............ requisito de subida: score de evolução mínimo
--    - req_presenca_pct ..... requisito de subida: presença mínima em eventos
--    - playbook ............. itens de checklist criados sozinhos quando o
--                             jogador ENTRA na fase
--    Drills e reviews continuam nos campos que já existiam
--    (default_drills_target/default_reviews_target).
--
-- 2) Cartão (team_player_cards):
--    - next_step/next_step_at . próximo passo combinado e quando (a regra de
--                               ouro de CRM: nenhum cartão sem próximo passo)
--    - prioridade ............. alta/normal/baixa
--    (a coluna deadline já existia e passa a ser lida pelo app.)
--
-- 3) team_funnel_cards(): mesmas colunas de antes + as novas no FIM (o app
--    lê por nome, então quem ainda usa a versão antiga não quebra). Números
--    de jogo vêm de player_performance_snapshot (ROI e buy-in médio de
--    carreira, a mesma fonte das vagas do Marketplace) e de
--    bankroll_sessions (sessões e resultado desde que entrou na fase).
--
-- 4) move_player_card(): aplica o playbook da fase ao entrar nela.
--
-- 5) team_funnel_flow(p_days): relatório de fluxo por fase (entradas,
--    promovidos, regressos, tempo médio) a partir do histórico que já existe.
--
-- 6) team_dashboard(): ganha abi_torneio, roi_pct e num_sessoes (carreira)
--    no FIM, para o crachá do jogador mostrar volume, buy-in e ROI.
--
-- 7) marketplace_candidate_snapshot(): ganha num_drills e
--    taxa_acerto_treino_pct no FIM, para o crachá do candidato nas vagas
--    mostrar o bloco de estudo igual ao crachá de quem já é do time.
--
-- 8) teams.funil_sla_dias: prazo padrão (em dias) até o cartão esfriar,
--    usado quando a fase não define o próprio. Configurável pelo admin
--    em Configurações do funil (mesma regra de edição do time).

-- ---------------------------------------------------------------------
-- 1) e 2) Colunas novas
-- ---------------------------------------------------------------------
alter table public.team_funnel_phases
  add column if not exists descricao text,
  add column if not exists buyin_min numeric,
  add column if not exists buyin_max numeric,
  add column if not exists wip_limit integer,
  add column if not exists sla_dias integer,
  add column if not exists req_sessoes integer,
  add column if not exists req_roi_pct numeric,
  add column if not exists req_score integer,
  add column if not exists req_presenca_pct integer,
  add column if not exists playbook text[];

alter table public.team_funnel_phases
  drop constraint if exists team_funnel_phases_wip_limit_chk,
  add constraint team_funnel_phases_wip_limit_chk check (wip_limit is null or wip_limit > 0),
  drop constraint if exists team_funnel_phases_sla_chk,
  add constraint team_funnel_phases_sla_chk check (sla_dias is null or sla_dias > 0),
  drop constraint if exists team_funnel_phases_buyin_chk,
  add constraint team_funnel_phases_buyin_chk check (
    (buyin_min is null or buyin_min >= 0) and (buyin_max is null or buyin_max >= 0)
    and (buyin_min is null or buyin_max is null or buyin_min <= buyin_max)),
  drop constraint if exists team_funnel_phases_presenca_chk,
  add constraint team_funnel_phases_presenca_chk check (req_presenca_pct is null or req_presenca_pct between 0 and 100),
  drop constraint if exists team_funnel_phases_score_chk,
  add constraint team_funnel_phases_score_chk check (req_score is null or req_score between 0 and 100);

alter table public.team_player_cards
  add column if not exists next_step text,
  add column if not exists next_step_at timestamptz,
  add column if not exists prioridade text not null default 'normal';

alter table public.team_player_cards
  drop constraint if exists team_player_cards_prioridade_chk,
  add constraint team_player_cards_prioridade_chk check (prioridade in ('alta', 'normal', 'baixa')),
  drop constraint if exists team_player_cards_next_step_len_chk,
  add constraint team_player_cards_next_step_len_chk check (next_step is null or char_length(next_step) <= 140);

-- ---------------------------------------------------------------------
-- 3) Cartões do funil
-- Mudar as colunas de retorno exige recriar a função.
-- ---------------------------------------------------------------------
drop function if exists public.team_funnel_cards();

create function public.team_funnel_cards()
returns table(
  card_id uuid, player_id uuid, phase_id uuid, phase_name text, phase_color text, phase_sort_order integer,
  drills_target integer, reviews_target integer, stat_metric text, stat_target numeric, notes text,
  moved_at timestamptz, drills_done integer, reviews_done integer, stat_value numeric,
  eventos_total integer, eventos_presente integer, eventos_ausente integer,
  -- novas
  deadline date, next_step text, next_step_at timestamptz, prioridade text,
  sessoes_fase integer, lucro_fase numeric, roi_pct numeric, abi_torneio numeric
)
language plpgsql
stable
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
      where p.player_id = c.player_id and e.starts_at >= c.moved_at and e.starts_at < now() and p.attended = false),
    c.deadline, c.next_step, c.next_step_at, c.prioridade,
    (select count(*)::int from public.bankroll_sessions bs
      where bs.user_id = c.player_id and bs.date >= c.moved_at::date),
    (select coalesce(sum(public.bankroll_session_net(bs)), 0)::numeric from public.bankroll_sessions bs
      where bs.user_id = c.player_id and bs.date >= c.moved_at::date),
    pp.roi_pct, pp.abi_torneio
  from public.team_player_cards c
  join public.team_funnel_phases ph on ph.id = c.phase_id
  left join public.player_performance_snapshot pp on pp.user_id = c.player_id
  where c.team_id = v_team and c.archived_at is null and public.can_view_player(c.player_id)
  order by ph.sort_order asc, c.moved_at asc;
end;
$function$;

revoke all on function public.team_funnel_cards() from public, anon;
grant execute on function public.team_funnel_cards() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) Mover cartão + playbook da fase
-- Mesma assinatura e mesma regra de histórico de antes; o bloco novo é só
-- o do playbook, que roda apenas quando o jogador de fato ENTRA na fase.
-- ---------------------------------------------------------------------
create or replace function public.move_player_card(p_player uuid, p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_team uuid;
  v_fase_atual uuid;
  v_estava_arquivado boolean;
  v_card uuid;
  v_playbook text[];
  v_proxima_ordem integer;
begin
  if not public.can_view_player(p_player) then raise exception 'SEM_PERMISSAO'; end if;
  select team_id from public.team_members where user_id = auth.uid() and status = 'ativo' into v_team;

  -- A fase precisa ser do mesmo time de quem está movendo.
  if not exists (select 1 from public.team_funnel_phases where id = p_phase_id and team_id = v_team) then
    raise exception 'SEM_PERMISSAO';
  end if;

  select phase_id, archived_at is not null into v_fase_atual, v_estava_arquivado
    from public.team_player_cards where player_id = p_player;

  insert into public.team_player_cards (team_id, player_id, phase_id, created_by)
  values (v_team, p_player, p_phase_id, auth.uid())
  on conflict (team_id, player_id) do update
    set phase_id = excluded.phase_id, moved_at = now(), updated_at = now(),
        archived_at = null, archived_reason = null
    where public.team_player_cards.phase_id <> excluded.phase_id
       or public.team_player_cards.archived_at is not null;

  if v_fase_atual is null or v_fase_atual <> p_phase_id or v_estava_arquivado then
    update public.team_player_card_history
      set left_at = now()
      where player_id = p_player and left_at is null;

    insert into public.team_player_card_history (team_id, player_id, phase_id)
    select v_team, p_player, p_phase_id
    where not exists (
      select 1 from public.team_player_card_history
      where player_id = p_player and phase_id = p_phase_id and left_at is null
    );

    -- Playbook: itens padrão da fase viram checklist do cartão. Não
    -- duplica item igual que ainda esteja em aberto.
    select playbook into v_playbook from public.team_funnel_phases where id = p_phase_id;
    if v_playbook is not null and array_length(v_playbook, 1) > 0 then
      select id into v_card from public.team_player_cards where team_id = v_team and player_id = p_player;
      select coalesce(max(sort_order) + 1, 0) into v_proxima_ordem
        from public.team_card_checklist_items where card_id = v_card;

      insert into public.team_card_checklist_items (card_id, text, sort_order, created_by)
      select v_card, btrim(t.txt), v_proxima_ordem + t.ord::int - 1, auth.uid()
        from unnest(v_playbook) with ordinality as t(txt, ord)
       where btrim(t.txt) <> ''
         and not exists (
           select 1 from public.team_card_checklist_items i
            where i.card_id = v_card and i.done = false and i.text = btrim(t.txt)
         );
    end if;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------
-- 5) Fluxo por fase (relatório)
-- Para cada passagem de um jogador por uma fase, olha a PRÓXIMA passagem
-- dele: se foi para uma fase mais à frente, é promoção; mais atrás,
-- regresso; se não houve próxima e a passagem terminou, saiu do funil.
-- Arquivar o cartão não fecha a passagem no histórico (só marca o
-- cartão), então a última passagem de um cartão arquivado termina na
-- data do arquivamento.
-- ---------------------------------------------------------------------
create or replace function public.team_funnel_flow(p_days integer default 90)
returns table(
  phase_id uuid, phase_name text, phase_color text, sort_order integer,
  ativos integer, entradas integer, promovidos integer, regressos integer, sairam integer,
  tempo_medio_dias numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_team uuid; v_desde timestamptz;
begin
  select team_id into v_team from public.team_members where user_id = auth.uid() and status = 'ativo';
  if v_team is null then raise exception 'SEM_TIME'; end if;
  if not public.is_team_manager() then raise exception 'SEM_PERMISSAO'; end if;
  v_desde := now() - make_interval(days => greatest(coalesce(p_days, 90), 1));

  return query
  with brutas as (
    select h.player_id, h.phase_id, h.entered_at, h.left_at, ph.sort_order as ordem,
           (select ph2.sort_order
              from public.team_player_card_history h2
              join public.team_funnel_phases ph2 on ph2.id = h2.phase_id
             where h2.player_id = h.player_id and h2.team_id = v_team and h2.entered_at > h.entered_at
             order by h2.entered_at asc limit 1) as ordem_seguinte
      from public.team_player_card_history h
      join public.team_funnel_phases ph on ph.id = h.phase_id
     where h.team_id = v_team and h.entered_at >= v_desde
  ),
  passagens as (
    select b.player_id, b.phase_id, b.entered_at, b.ordem, b.ordem_seguinte,
           coalesce(
             b.left_at,
             case when b.ordem_seguinte is null and c.archived_at is not null and c.archived_at >= b.entered_at
                  then c.archived_at end
           ) as left_at
      from brutas b
      left join public.team_player_cards c on c.team_id = v_team and c.player_id = b.player_id
  )
  select
    f.id, f.name, f.color, f.sort_order,
    (select count(*)::int from public.team_player_cards c
      where c.team_id = v_team and c.phase_id = f.id and c.archived_at is null),
    count(p.player_id)::int,
    count(*) filter (where p.left_at is not null and p.ordem_seguinte > p.ordem)::int,
    count(*) filter (where p.left_at is not null and p.ordem_seguinte < p.ordem)::int,
    count(*) filter (where p.left_at is not null and p.ordem_seguinte is null)::int,
    round(avg(extract(epoch from (coalesce(p.left_at, now()) - p.entered_at)) / 86400.0)::numeric, 1)
  from public.team_funnel_phases f
  left join passagens p on p.phase_id = f.id
  where f.team_id = v_team
  group by f.id, f.name, f.color, f.sort_order
  order by f.sort_order;
end;
$function$;

revoke all on function public.team_funnel_flow(integer) from public, anon;
grant execute on function public.team_funnel_flow(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) team_dashboard com números de carreira para o crachá
-- Corpo idêntico ao anterior; só entram o left join no snapshot e 3
-- colunas no fim.
-- ---------------------------------------------------------------------
drop function if exists public.team_dashboard(integer);

create function public.team_dashboard(p_days integer default 30)
returns table(
  user_id uuid, nome text, avatar_id smallint, avatar_url text, role text, is_coach boolean, coach_id uuid,
  joined_at timestamptz, label_id uuid, label_name text, label_color text, level integer, streak_days integer,
  last_activity_at timestamptz, treinos integer, acertos_gto integer, maos_revisadas integer,
  maos_compartilhadas integer, xp_periodo integer, jogos_no_time integer, lucro_no_time numeric,
  -- novas
  abi_torneio numeric, roi_pct numeric, num_sessoes integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_team uuid; v_role text; v_desde timestamptz;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  v_desde := now() - make_interval(days => greatest(coalesce(p_days,30), 1));

  select tm.team_id, tm.role into v_team, v_role
  from public.team_members tm where tm.user_id = v_uid and tm.status = 'ativo';
  if v_team is null then raise exception 'SEM_TIME'; end if;
  if v_role not in ('admin','coach') then raise exception 'SEM_PERMISSAO'; end if;

  return query
  select
    m.user_id,
    coalesce(nullif(btrim(p.apelido),''), nullif(btrim(p.nome),''), 'Jogador'),
    p.avatar_id, p.avatar_url,
    m.role, m.is_coach, m.coach_id, m.joined_at,
    m.label_id, l.name, l.color,
    up.level, up.streak_days, up.last_activity_at,
    (select count(*)::int from public.training_sessions ts
       where ts.user_id = m.user_id and ts.created_at >= v_desde),
    (select count(*)::int from public.training_sessions ts
       where ts.user_id = m.user_id and ts.created_at >= v_desde and ts.verdict = 'OTIMA'),
    (select count(*)::int from public.hand_reviews hr
       where hr.user_id = m.user_id and hr.status = 'concluida' and hr.updated_at >= v_desde),
    (select count(*)::int from public.hand_review_shares s
       where s.shared_by = m.user_id and s.created_at >= v_desde),
    (select coalesce(sum(x.xp_final),0)::int from public.xp_events x
       where x.user_id = m.user_id and x.created_at >= v_desde),
    (select count(*)::int from public.bankroll_sessions bs
       where bs.user_id = m.user_id and bs.date >= m.joined_at::date),
    (select coalesce(sum(public.bankroll_session_net(bs)),0)::numeric from public.bankroll_sessions bs
       where bs.user_id = m.user_id and bs.date >= m.joined_at::date),
    pp.abi_torneio, pp.roi_pct, pp.num_sessoes::int
  from public.team_members m
  left join public.profiles p on p.id = m.user_id
  left join public.user_progress up on up.user_id = m.user_id
  left join public.team_labels l on l.id = m.label_id
  left join public.player_performance_snapshot pp on pp.user_id = m.user_id
  where m.team_id = v_team and m.status = 'ativo'
    and (v_role = 'admin' or m.user_id = v_uid or m.coach_id = v_uid)
  order by m.role, 2;
end;
$function$;

revoke all on function public.team_dashboard(integer) from public, anon;
grant execute on function public.team_dashboard(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) Snapshot do candidato com números de estudo para o crachá
-- Corpo idêntico ao anterior; só entram 2 colunas no fim.
-- ---------------------------------------------------------------------
drop function if exists public.marketplace_candidate_snapshot(uuid);

create function public.marketplace_candidate_snapshot(p_application_id uuid)
returns table(
  application_id uuid, user_id uuid, nome text, apelido text, avatar_id smallint, avatar_url text,
  match_score numeric, hands integer, roi_pct numeric, abi_torneio numeric, num_torneios integer,
  num_cash integer, num_sessoes integer, lucro_acumulado numeric, frequencia_semanal_sessoes numeric,
  score_geral numeric, vpip_pct numeric, pfr_pct numeric, three_bet_pct numeric, aggression_factor numeric,
  cbet_flop_pct numeric, tempo_experiencia text, horario_treino text, dias_treino_semana text[],
  status text, message text, applied_at timestamptz, historico_times jsonb,
  -- novas
  num_drills integer, taxa_acerto_treino_pct numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app record;
  v_listing record;
begin
  select * into v_app from public.marketplace_applications where id = p_application_id;
  if v_app is null then raise exception 'CANDIDATURA_INEXISTENTE'; end if;

  select * into v_listing from public.marketplace_listings where id = v_app.listing_id;

  if not (v_app.user_id = auth.uid() or (v_listing.team_id = public.my_team_id() and public.is_team_manager())) then
    raise exception 'SEM_PERMISSAO';
  end if;

  return query
  select
    v_app.id, pr.id, pr.nome, pr.apelido, pr.avatar_id, pr.avatar_url,
    public.marketplace_match_score(v_listing.id, v_app.user_id),
    coalesce(ht_count.hands, 0)::int,
    pp.roi_pct, pp.abi_torneio,
    pp.num_torneios::int, pp.num_cash::int, pp.num_sessoes::int,
    pp.lucro_acumulado,
    pp.frequencia_semanal_sessoes, pp.score_geral,
    pp.vpip_pct, pp.pfr_pct, pp.three_bet_pct,
    ht_agg.aggression_factor, ht_agg.cbet_flop_pct,
    pr.tempo_experiencia, pr.horario_treino, pr.dias_treino_semana,
    v_app.status, v_app.message, v_app.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamName', h.team_name,
        'role', h.role,
        'months', greatest(1, round(extract(epoch from (h.left_at - h.joined_at)) / 2629800)::int),
        'endedMonthsAgo', round(extract(epoch from (now() - h.left_at)) / 2629800)::int
      ) order by h.left_at desc)
      from public.team_membership_history h where h.user_id = v_app.user_id
    ), '[]'::jsonb),
    pp.num_drills::int, pp.taxa_acerto_treino_pct
  from public.profiles pr
  left join public.player_performance_snapshot pp on pp.user_id = pr.id
  left join (select hand_tags.user_id, count(*) hands from public.hand_tags group by hand_tags.user_id) ht_count
    on ht_count.user_id = pr.id
  left join (
    select
      ht.user_id,
      case when sum(ht.postflop_call_count) > 0
        then round(sum(ht.postflop_bet_count + ht.postflop_raise_count)::numeric / sum(ht.postflop_call_count), 2)
        else null end as aggression_factor,
      round(100.0 * count(*) filter (where ht.is_preflop_aggressor and ht.cbet_flop)
        / nullif(count(*) filter (where ht.is_preflop_aggressor), 0), 1) as cbet_flop_pct
    from public.hand_tags ht
    group by ht.user_id
  ) ht_agg on ht_agg.user_id = pr.id
  where pr.id = v_app.user_id;
end;
$function$;

revoke all on function public.marketplace_candidate_snapshot(uuid) from public, anon;
grant execute on function public.marketplace_candidate_snapshot(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8) Prazo padrão do funil
-- ---------------------------------------------------------------------
alter table public.teams
  add column if not exists funil_sla_dias integer not null default 14;

alter table public.teams
  drop constraint if exists teams_funil_sla_dias_chk,
  add constraint teams_funil_sla_dias_chk check (funil_sla_dias between 1 and 365);
