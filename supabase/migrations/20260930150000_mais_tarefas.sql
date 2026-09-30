-- Mais tarefas (2026-09, pedido do jogador: "só 41? precisamos de mais
-- pra não virar algo comum"). Catálogo vai de 41 pra 128, com tipos novos:
--
--  * Treino por situação: abrindo o pote (RFI), respondendo a uma abertura,
--    contra all-in, stack curto (<=15bb) ou fundo (>=40bb), decidindo no
--    SB/BTN/BB (as posições que existem nos spots hoje).
--  * Treino rápido de Ranges (range_drill_answers) -- passa a dar XP de
--    treino (mesmo limite diário do Treino) e conta nas tarefas.
--  * Estudo registrado (bankroll_study_logs), no máximo 4h por dia contando
--    pras tarefas (apagar e lançar de novo não conta duas vezes).
--  * Diário pós-sessão (humor ou anotação), 1 vez por sessão.
--  * Mãos revistas na mesa do Revisor (viewed_in_replayer_at, 1 vez por mão).
--  * Radar: mãos importadas pelo agente e torneios jogados -- só sorteadas
--    pra quem já conectou o Radar.
--
-- O ritmo de 5 anos até o 99 não muda: a quantidade de tarefas por período
-- (5/6/6) e o XP de cada dificuldade continuam iguais; o catálogo maior só
-- deixa o sorteio mais variado.

-- 1) Filtro das tarefas de treino por situação -------------------------------
create or replace function public.missao_bate_filtro(f jsonb, p_spot_id text, p_ctx jsonb)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select
    (not (f ? 'spot_ids') or (p_spot_id is not null and (f->'spot_ids') @> to_jsonb(p_spot_id)))
    and (not (f ? 'fase') or coalesce(p_ctx->>'fase', '') = f->>'fase')
    and (not (f ? 'posicao') or coalesce(p_ctx->>'posicao', '') = f->>'posicao')
    and (not (f ? 'stack_max') or case
           when coalesce(p_ctx->>'stack', '') ~ '^[0-9]+(\.[0-9]+)?$'
             then (p_ctx->>'stack')::numeric <= (f->>'stack_max')::numeric
           else false end)
    and (not (f ? 'stack_min') or case
           when coalesce(p_ctx->>'stack', '') ~ '^[0-9]+(\.[0-9]+)?$'
             then (p_ctx->>'stack')::numeric >= (f->>'stack_min')::numeric
           else false end);
$function$;

drop function if exists public.avancar_missoes(uuid, text, integer, text);

create function public.avancar_missoes(p_uid uuid, p_metric text, p_inc integer, p_spot_id text default null, p_ctx jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_m record;
  v_novo integer;
  v_feitas jsonb := '[]'::jsonb;
begin
  if p_uid is null or coalesce(p_inc, 0) = 0 then
    return v_feitas;
  end if;

  for v_m in
    select um.id as um_id, um.progress, um.goal_value,
           m.id as mission_id, m.code, m.title, m.category, m.xp_reward
      from user_missions um
      join missions m on m.id = um.mission_id
     where um.user_id = p_uid
       and um.status = 'active'
       and m.goal_metric = p_metric
       and (m.filter_payload is null or public.missao_bate_filtro(m.filter_payload, p_spot_id, p_ctx))
     for update of um
  loop
    v_novo := case when p_inc < 0 then 0 else least(v_m.goal_value, v_m.progress + p_inc) end;
    continue when v_novo = v_m.progress;

    update user_missions
       set progress = v_novo,
           status = case when v_novo >= v_m.goal_value then 'completed' else status end,
           completed_at = case when v_novo >= v_m.goal_value then now() else completed_at end
     where id = v_m.um_id;

    if v_novo >= v_m.goal_value then
      perform public.conceder_xp(p_uid, 'mission', coalesce(v_m.category, 'other'), v_m.xp_reward, v_m.mission_id, true);
      insert into notifications (user_id, title, body, kind)
        values (p_uid, 'Missão concluída', v_m.title || ' — +' || v_m.xp_reward || ' XP', 'success');
      v_feitas := v_feitas || jsonb_build_object(
        'mission_id', v_m.mission_id, 'code', v_m.code, 'title', v_m.title, 'xp_reward', v_m.xp_reward
      );
    end if;
  end loop;

  return v_feitas;
end;
$function$;

revoke execute on function public.avancar_missoes(uuid, text, integer, text, jsonb) from public, anon, authenticated;

-- 2) Treino: manda a situação da mão (fase, quem decide, stack) ------------
-- Na fase "bbJam" quem decide é o defensor (villainPos), igual à mesa do
-- Treino (activeHeroSeat em rfi-jam-drill.tsx).
create or replace function public.register_training(
  p_spot_id text, p_verdict text, p_ev_loss numeric, p_user_action text, p_user_sizing numeric, p_filters jsonb default null
)
returns table(xp_final integer, level_up boolean, new_level integer, combo_gto integer, missions_completed jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_base integer;
  v_session_id uuid;
  v_new_combo integer;
  v_result record;
  v_completed jsonb := '[]'::jsonb;
  v_plan text;
  v_hub_unlocked boolean;
  v_xp_final integer := 0;
  v_level_up boolean := false;
  v_new_level integer;
  v_state record;
  v_hit integer;
  v_ctx jsonb;
begin
  if v_uid is null then raise exception 'NO_SESSION'; end if;

  v_base := case p_verdict when 'PERFECT' then 25 when 'OK' then 15 else 10 end;

  if p_verdict = 'PERFECT' then
    update user_progress up set combo_gto = up.combo_gto + 1
      where up.user_id = v_uid returning up.combo_gto into v_new_combo;
  elsif p_verdict = 'BLUNDER' then
    update user_progress set combo_gto = 0 where user_id = v_uid;
    v_new_combo := 0;
  else
    select up.combo_gto into v_new_combo from user_progress up where up.user_id = v_uid;
  end if;

  insert into training_sessions (user_id, spot_id, verdict, ev_loss, user_action, user_sizing, combo_at_time)
    values (v_uid, p_spot_id, p_verdict, p_ev_loss, p_user_action, p_user_sizing, coalesce(v_new_combo, 0))
    returning id into v_session_id;

  v_hit := case when p_verdict = 'PERFECT' then 1 else 0 end;
  select * into v_state from training_session_state where user_id = v_uid for update;
  if v_state is null or v_state.day <> current_date then
    insert into training_session_state (user_id, day, filters, hands_played, hits, updated_at)
      values (v_uid, current_date, coalesce(p_filters, '{}'::jsonb), 1, v_hit, now())
      on conflict (user_id) do update set
        day = excluded.day, filters = excluded.filters, hands_played = excluded.hands_played,
        hits = excluded.hits, updated_at = excluded.updated_at;
  else
    update training_session_state
      set filters = coalesce(p_filters, filters),
          hands_played = hands_played + 1,
          hits = hits + v_hit,
          updated_at = now()
      where user_id = v_uid;
  end if;

  select plan into v_plan from public.user_plans where user_id = v_uid;
  select (coalesce(v_plan, 'free') <> 'free')
    or exists (select 1 from public.team_members where user_id = v_uid and status = 'ativo')
    into v_hub_unlocked;

  if v_hub_unlocked then
    select * into v_result from public.conceder_xp(v_uid, 'drill', 'drill', v_base, v_session_id, false);
    v_xp_final := v_result.xp_final;
    v_level_up := v_result.level_up;
    v_new_level := v_result.new_level;
    update training_sessions set xp_awarded = v_xp_final where id = v_session_id;

    v_ctx := jsonb_build_object(
      'fase', p_filters->>'phaseKey',
      'posicao', case when p_filters->>'phaseKey' = 'bbJam' then p_filters->>'villainPos' else p_filters->>'heroPos' end,
      'stack', p_filters->>'stackBb'
    );

    v_completed := v_completed || public.avancar_missoes(v_uid, 'drills_completed', 1, p_spot_id, v_ctx);
    if p_verdict = 'PERFECT' then
      v_completed := v_completed || public.avancar_missoes(v_uid, 'perfect_drills', 1, p_spot_id, v_ctx);
    end if;
    if p_verdict in ('PERFECT', 'OK') then
      v_completed := v_completed || public.avancar_missoes(v_uid, 'gto_ok_or_better', 1, p_spot_id, v_ctx);
    end if;
    v_completed := v_completed || public.avancar_missoes(
      v_uid, 'clean_streak', case when p_verdict = 'BLUNDER' then -1 else 1 end, p_spot_id, v_ctx
    );

    if jsonb_array_length(v_completed) > 0 then
      select up.level into v_new_level from user_progress up where up.user_id = v_uid;
      v_level_up := v_level_up or coalesce(v_new_level, 0) > coalesce(v_result.new_level, 0);
    end if;
  end if;

  xp_final := v_xp_final;
  level_up := v_level_up;
  new_level := v_new_level;
  combo_gto := coalesce(v_new_combo, 0);
  missions_completed := v_completed;
  return next;
end;
$function$;

-- 3) Treino rápido de Ranges -------------------------------------------------
create or replace function public.on_range_drill_answer_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.conceder_xp(new.user_id, 'range_drill', 'drill', case when new.hit then 15 else 8 end, new.id, false);
  perform public.avancar_missoes(new.user_id, 'range_drills', 1);
  if new.hit then
    perform public.avancar_missoes(new.user_id, 'range_hits', 1);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_range_drill_missoes on public.range_drill_answers;
create trigger trg_range_drill_missoes
  after insert on public.range_drill_answers
  for each row execute function public.on_range_drill_answer_insert();

-- 4) Estudo registrado -------------------------------------------------------
-- Conta pelo dia em que foi LANÇADO (não pela data informada) e no máximo
-- 240 min por dia; o contador nunca desce, então apagar e lançar de novo
-- não rende minutos extras.
create table if not exists public.missao_estudo_dia (
  user_id uuid not null,
  dia date not null,
  minutos integer not null default 0,
  primary key (user_id, dia)
);
alter table public.missao_estudo_dia enable row level security;

create or replace function public.on_study_log_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ja integer;
  v_inc integer;
begin
  insert into missao_estudo_dia (user_id, dia) values (new.user_id, current_date) on conflict do nothing;
  select minutos into v_ja from missao_estudo_dia where user_id = new.user_id and dia = current_date for update;
  v_inc := greatest(0, least(coalesce(new.minutes, 0), 240 - v_ja));
  if v_inc > 0 then
    update missao_estudo_dia set minutos = minutos + v_inc where user_id = new.user_id and dia = current_date;
    perform public.avancar_missoes(new.user_id, 'study_minutes', v_inc);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_study_log_missoes on public.bankroll_study_logs;
create trigger trg_study_log_missoes
  after insert on public.bankroll_study_logs
  for each row execute function public.on_study_log_insert();

-- 5) Diário pós-sessão -------------------------------------------------------
alter table public.bankroll_sessions
  add column if not exists diario_contado boolean not null default false;

-- Sessões que já têm diário não contam de novo numa edição qualquer.
update public.bankroll_sessions
   set diario_contado = true
 where not diario_contado
   and (nullif(btrim(coalesce(diary_note, '')), '') is not null or nullif(btrim(coalesce(mood, '')), '') is not null);

create or replace function public.conta_diario_sessao(p_id uuid, p_uid uuid, p_mood text, p_nota text, p_ja_contado boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_ja_contado then return; end if;
  if nullif(btrim(coalesce(p_nota, '')), '') is null and nullif(btrim(coalesce(p_mood, '')), '') is null then return; end if;
  update bankroll_sessions set diario_contado = true where id = p_id;
  perform public.avancar_missoes(p_uid, 'session_diary', 1);
end;
$function$;

revoke execute on function public.conta_diario_sessao(uuid, uuid, text, text, boolean) from public, anon, authenticated;

create or replace function public.on_bankroll_session_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := new.user_id;
  v_investido numeric := coalesce(new.buy_in, 0) * (1 + coalesce(new.reentries, 0));
  v_positiva boolean := coalesce(new.cashout, 0) > v_investido;
  v_primeira_do_dia boolean;
begin
  select not exists (
    select 1 from bankroll_sessions
     where user_id = v_uid and date = new.date and id <> new.id
  ) into v_primeira_do_dia;

  perform public.avancar_missoes(v_uid, 'bankroll_sessions', 1);
  if v_positiva then
    perform public.avancar_missoes(v_uid, 'bankroll_positive_sessions', 1);
  end if;
  if v_primeira_do_dia then
    perform public.avancar_missoes(v_uid, 'bankroll_active_days', 1);
  end if;
  if round(coalesce(new.hours, 0)) > 0 then
    perform public.avancar_missoes(v_uid, 'bankroll_hours', round(new.hours)::integer);
  end if;
  perform public.avancar_missoes(v_uid, 'bankroll_positive_streak', case when v_positiva then 1 else -1 end);
  perform public.conta_diario_sessao(new.id, v_uid, new.mood, new.diary_note, new.diario_contado);

  return new;
end;
$function$;

create or replace function public.on_bankroll_session_diary_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.conta_diario_sessao(new.id, new.user_id, new.mood, new.diary_note, new.diario_contado);
  return new;
end;
$function$;

drop trigger if exists trg_bankroll_diario_missoes on public.bankroll_sessions;
create trigger trg_bankroll_diario_missoes
  after update of mood, diary_note on public.bankroll_sessions
  for each row execute function public.on_bankroll_session_diary_update();

-- 6) Revisor: mão revista na mesa (1 vez por mão) ----------------------------
create or replace function public.on_hand_review_replayed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.viewed_in_replayer_at is null and new.viewed_in_replayer_at is not null then
    perform public.avancar_missoes(new.user_id, 'hands_replayed', 1);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_hand_review_replay_missoes on public.hand_reviews;
create trigger trg_hand_review_replay_missoes
  after update of viewed_in_replayer_at on public.hand_reviews
  for each row execute function public.on_hand_review_replayed();

-- 7) Radar: mãos importadas pelo agente (em lote) e torneios jogados ---------
-- Só source = 'agent' (o agente não repete mão já importada); colar o mesmo
-- arquivo de novo não conta.
create or replace function public.on_hand_reviews_agent_import()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  for r in select user_id, count(*)::integer as n from novas where source = 'agent' group by user_id loop
    perform public.avancar_missoes(r.user_id, 'hands_imported', r.n);
  end loop;
  return null;
end;
$function$;

drop trigger if exists trg_hand_reviews_import_missoes on public.hand_reviews;
create trigger trg_hand_reviews_import_missoes
  after insert on public.hand_reviews
  referencing new table as novas
  for each statement execute function public.on_hand_reviews_agent_import();

create or replace function public.on_hand_session_tournament_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kind = 'tournament' then
    perform public.avancar_missoes(new.user_id, 'tournaments_played', 1);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_hand_session_torneio_missoes on public.hand_sessions;
create trigger trg_hand_session_torneio_missoes
  after insert on public.hand_sessions
  for each row execute function public.on_hand_session_tournament_insert();

-- 8) Sorteio: tarefas do Radar só pra quem já conectou o Radar ---------------
create or replace function public.assign_missions_for_all()
returns table(inserted_count integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
  v_month_start date := date_trunc('month', current_date)::date;
  v_count integer := 0;
begin
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_today
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'daily');
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_week_start
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'weekly');
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_month_start
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'monthly');

  insert into user_missions (user_id, mission_id, progress, goal_value, status, period_start)
  select s.user_id, s.mission_id, 0, s.goal_value, 'active', s.inicio
    from (
      select up.user_id,
             m.id as mission_id,
             greatest(1, m.goal_base) as goal_value,
             p.inicio,
             q.cota,
             row_number() over (partition by up.user_id, m.kind, m.difficulty order by random()) as rn,
             (select count(*)
                from user_missions um2
                join missions m2 on m2.id = um2.mission_id
               where um2.user_id = up.user_id
                 and m2.kind = m.kind
                 and m2.difficulty = m.difficulty
                 and um2.status in ('active', 'completed')
                 and um2.period_start = p.inicio
                 and (m2.active_until is null or m2.active_until > now())) as ja_tem
        from user_progress up
        cross join missions m
        join (values
               ('daily', 'facil', 2), ('daily', 'media', 2), ('daily', 'dificil', 1),
               ('weekly', 'facil', 2), ('weekly', 'media', 2), ('weekly', 'dificil', 2),
               ('monthly', 'facil', 2), ('monthly', 'media', 2), ('monthly', 'dificil', 2)
             ) as q(kind, dificuldade, cota)
          on q.kind = m.kind and q.dificuldade = m.difficulty
        cross join lateral (
          select case m.kind when 'daily' then v_today when 'weekly' then v_week_start else v_month_start end as inicio
        ) p
       where (m.active_from is null or m.active_from <= now())
         and (m.active_until is null or m.active_until > now())
         and (m.category <> 'radar' or exists (select 1 from hand_sync_devices d where d.user_id = up.user_id))
         and not exists (
           select 1 from user_missions um
            where um.user_id = up.user_id and um.mission_id = m.id and um.period_start = p.inicio
         )
    ) s
   where s.rn <= s.cota - s.ja_tem;
  get diagnostics v_count = row_count;

  inserted_count := v_count;
  return next;
end;
$function$;

-- 9) Catálogo: +87 tarefas ---------------------------------------------------
-- XP fixo por dificuldade (igual à leva anterior):
--   diária 15 / 30 / 60 · semanal 80 / 160 / 300 · mensal 300 / 600 / 1100
insert into public.missions (code, title, description, kind, category, goal_metric, goal_base, goal_scale, xp_reward, icon, difficulty, filter_payload)
select v.code, v.title, v.description, v.kind, v.category, v.goal_metric, v.goal_base, 0,
       case v.kind
         when 'daily'   then case v.difficulty when 'facil' then 15  when 'media' then 30  else 60 end
         when 'weekly'  then case v.difficulty when 'facil' then 80  when 'media' then 160 else 300 end
         else                case v.difficulty when 'facil' then 300 when 'media' then 600 else 1100 end
       end,
       v.icon, v.difficulty, v.filtro::jsonb
  from (values
    -- ===== Diárias =====
    ('v2_d_rfi_10',          'Abrindo o pote',          'Complete 10 drills abrindo o pote (RFI).',                         'daily', 'drill',  'drills_completed',            10, 'target',        'facil',   '{"fase":"sbOpen"}'),
    ('v2_d_vsrfi_10',        'Defesa do pote',          'Complete 10 drills respondendo a uma abertura.',                   'daily', 'drill',  'drills_completed',            10, 'shield',        'facil',   '{"fase":"bbJam"}'),
    ('v2_d_vsjam_10',        'Pagar ou largar',         'Complete 10 drills contra all-in.',                                'daily', 'drill',  'drills_completed',            10, 'flame',         'facil',   '{"fase":"sbCallJam"}'),
    ('v2_d_curto_10',        'Stack curto',             'Complete 10 drills com 15bb ou menos.',                            'daily', 'drill',  'drills_completed',            10, 'target',        'facil',   '{"stack_max":15}'),
    ('v2_d_ok_15',           'Jogadas sólidas',         'Faça 15 jogadas boas ou perfeitas no Treino.',                     'daily', 'drill',  'gto_ok_or_better',            15, 'check-circle',  'facil',   null),
    ('v2_d_range_10',        'Treino de range',         'Responda 10 mãos no treino rápido de Ranges.',                     'daily', 'range',  'range_drills',                10, 'spade',         'facil',   null),
    ('v2_d_estudo_20',       'Estudo do dia',           'Registre 20 minutos de estudo.',                                   'daily', 'study',  'study_minutes',               20, 'book-open',     'facil',   null),
    ('v2_d_diario_1',        'Diário da sessão',        'Preencha o diário (humor ou anotação) de 1 sessão.',               'daily', 'bankroll','session_diary',               1, 'notebook',      'facil',   null),
    ('v2_d_replay_3',        'De volta à mesa',         'Reveja 3 mãos na mesa do Revisor.',                                'daily', 'review', 'hands_replayed',               3, 'book-open',     'facil',   null),
    ('v2_d_rfi_perf_8',      'RFI afiado',              'Acerte 8 drills PERFECT abrindo o pote.',                          'daily', 'drill',  'perfect_drills',               8, 'check-circle',  'media',   '{"fase":"sbOpen"}'),
    ('v2_d_vsrfi_perf_8',    'Defesa afiada',           'Acerte 8 drills PERFECT respondendo a uma abertura.',              'daily', 'drill',  'perfect_drills',               8, 'shield',        'media',   '{"fase":"bbJam"}'),
    ('v2_d_vsjam_perf_6',    'Call certeiro',           'Acerte 6 drills PERFECT contra all-in.',                           'daily', 'drill',  'perfect_drills',               6, 'flame',         'media',   '{"fase":"sbCallJam"}'),
    ('v2_d_fundo_15',        'Stack fundo',             'Complete 15 drills com 40bb ou mais.',                             'daily', 'drill',  'drills_completed',            15, 'target',        'media',   '{"stack_min":40}'),
    ('v2_d_ok_35',           'Consistência GTO',        'Faça 35 jogadas boas ou perfeitas no Treino.',                     'daily', 'drill',  'gto_ok_or_better',            35, 'check-circle',  'media',   null),
    ('v2_d_range_acertos_15','Range na ponta da língua','Acerte 15 mãos no treino rápido de Ranges.',                       'daily', 'range',  'range_hits',                  15, 'spade',         'media',   null),
    ('v2_d_estudo_45',       'Estudo focado',           'Registre 45 minutos de estudo.',                                   'daily', 'study',  'study_minutes',               45, 'book-open',     'media',   null),
    ('v2_d_replay_8',        'Revisão na mesa',         'Reveja 8 mãos na mesa do Revisor.',                                'daily', 'review', 'hands_replayed',               8, 'book-open',     'media',   null),
    ('v2_d_autoaval_3',      'Três mãos avaliadas',     'Marque acertei/errei/dúvida nas 4 ruas de 3 mãos.',                'daily', 'review', 'reviews_full_self_eval',       3, 'scale',         'media',   null),
    ('v2_d_importar_50',     'Volume do dia',           'Tenha 50 mãos novas importadas pelo Radar hoje.',                  'daily', 'radar',  'hands_imported',              50, 'clipboard-list','media',   null),
    ('v2_d_limpa_rfi_15',    'RFI sem erro',            'Emende 15 decisões seguidas sem erro grave abrindo o pote.',       'daily', 'drill',  'clean_streak',                15, 'shield',        'dificil', '{"fase":"sbOpen"}'),
    ('v2_d_curto_perf_12',   'Mestre do push/fold',     'Acerte 12 drills PERFECT com 15bb ou menos.',                      'daily', 'drill',  'perfect_drills',              12, 'check-circle',  'dificil', '{"stack_max":15}'),
    ('v2_d_ok_80',           'Dia de volume GTO',       'Faça 80 jogadas boas ou perfeitas no Treino.',                     'daily', 'drill',  'gto_ok_or_better',            80, 'flame',         'dificil', null),
    ('v2_d_range_acertos_40','Range decorado',          'Acerte 40 mãos no treino rápido de Ranges.',                       'daily', 'range',  'range_hits',                  40, 'spade',         'dificil', null),
    ('v2_d_estudo_90',       'Maratona de estudo',      'Registre 90 minutos de estudo.',                                   'daily', 'study',  'study_minutes',               90, 'book-open',     'dificil', null),
    ('v2_d_torneios_3',      'Dia de grind',            'Jogue 3 torneios (trazidos pelo Radar) hoje.',                     'daily', 'radar',  'tournaments_played',           3, 'trending-up',   'dificil', null),
    -- ===== Semanais =====
    ('v2_w_rfi_40',          'Semana abrindo pote',     'Complete 40 drills abrindo o pote (RFI).',                         'weekly', 'drill',  'drills_completed',           40, 'target',        'facil',   '{"fase":"sbOpen"}'),
    ('v2_w_vsrfi_40',        'Semana de defesa',        'Complete 40 drills respondendo a uma abertura.',                   'weekly', 'drill',  'drills_completed',           40, 'shield',        'facil',   '{"fase":"bbJam"}'),
    ('v2_w_vsjam_30',        'Semana contra all-in',    'Complete 30 drills contra all-in.',                                'weekly', 'drill',  'drills_completed',           30, 'flame',         'facil',   '{"fase":"sbCallJam"}'),
    ('v2_w_sb_30',           'Small blind em foco',     'Complete 30 drills decidindo no SB.',                              'weekly', 'drill',  'drills_completed',           30, 'target',        'facil',   '{"posicao":"SB"}'),
    ('v2_w_range_40',        'Ranges da semana',        'Responda 40 mãos no treino rápido de Ranges.',                     'weekly', 'range',  'range_drills',               40, 'spade',         'facil',   null),
    ('v2_w_estudo_60',       'Uma hora de estudo',      'Registre 60 minutos de estudo nesta semana.',                      'weekly', 'study',  'study_minutes',              60, 'book-open',     'facil',   null),
    ('v2_w_diario_2',        'Diário em dia',           'Preencha o diário de 2 sessões nesta semana.',                     'weekly', 'bankroll','session_diary',               2, 'notebook',      'facil',   null),
    ('v2_w_replay_10',       'Semana na mesa',          'Reveja 10 mãos na mesa do Revisor.',                               'weekly', 'review', 'hands_replayed',             10, 'book-open',     'facil',   null),
    ('v2_w_autoaval_3',      'Auto-avaliação semanal',  'Marque acertei/errei/dúvida nas 4 ruas de 3 mãos.',                'weekly', 'review', 'reviews_full_self_eval',      3, 'scale',         'facil',   null),
    ('v2_w_torneios_5',      'Semana de torneios',      'Jogue 5 torneios (trazidos pelo Radar).',                          'weekly', 'radar',  'tournaments_played',          5, 'trending-up',   'facil',   null),
    ('v2_w_rfi_perf_30',     'RFI da semana',           'Acerte 30 drills PERFECT abrindo o pote.',                         'weekly', 'drill',  'perfect_drills',             30, 'check-circle',  'media',   '{"fase":"sbOpen"}'),
    ('v2_w_vsrfi_perf_30',   'Defesa da semana',        'Acerte 30 drills PERFECT respondendo a uma abertura.',             'weekly', 'drill',  'perfect_drills',             30, 'shield',        'media',   '{"fase":"bbJam"}'),
    ('v2_w_curto_60',        'Semana de stack curto',   'Complete 60 drills com 15bb ou menos.',                            'weekly', 'drill',  'drills_completed',           60, 'target',        'media',   '{"stack_max":15}'),
    ('v2_w_fundo_60',        'Semana de stack fundo',   'Complete 60 drills com 40bb ou mais.',                             'weekly', 'drill',  'drills_completed',           60, 'target',        'media',   '{"stack_min":40}'),
    ('v2_w_bb_40',           'Big blind em foco',       'Complete 40 drills decidindo no BB.',                              'weekly', 'drill',  'drills_completed',           40, 'shield',        'media',   '{"posicao":"BB"}'),
    ('v2_w_btn_40',          'Botão em foco',           'Complete 40 drills decidindo no BTN.',                             'weekly', 'drill',  'drills_completed',           40, 'target',        'media',   '{"posicao":"BTN"}'),
    ('v2_w_range_acertos_80','Ranges afiados',          'Acerte 80 mãos no treino rápido de Ranges.',                       'weekly', 'range',  'range_hits',                 80, 'spade',         'media',   null),
    ('v2_w_estudo_180',      'Três horas de estudo',    'Registre 180 minutos de estudo nesta semana.',                     'weekly', 'study',  'study_minutes',             180, 'book-open',     'media',   null),
    ('v2_w_diario_4',        'Diário da semana',        'Preencha o diário de 4 sessões nesta semana.',                     'weekly', 'bankroll','session_diary',               4, 'notebook',      'media',   null),
    ('v2_w_perguntas_4',     'Perguntas da semana',     'Responda todas as perguntas guiadas de 4 mãos.',                   'weekly', 'review', 'reviews_all_questions_answered', 4, 'help-circle', 'media',   null),
    ('v2_w_replay_30',       'Replayer da semana',      'Reveja 30 mãos na mesa do Revisor.',                               'weekly', 'review', 'hands_replayed',             30, 'book-open',     'media',   null),
    ('v2_w_importar_600',    'Volume da semana',        'Tenha 600 mãos novas importadas pelo Radar.',                      'weekly', 'radar',  'hands_imported',            600, 'clipboard-list','media',   null),
    ('v2_w_vsjam_perf_40',   'Contra all-in, sem medo', 'Acerte 40 drills PERFECT contra all-in.',                          'weekly', 'drill',  'perfect_drills',             40, 'flame',         'dificil', '{"fase":"sbCallJam"}'),
    ('v2_w_curto_perf_60',   'Push/fold de elite',      'Acerte 60 drills PERFECT com 15bb ou menos.',                      'weekly', 'drill',  'perfect_drills',             60, 'check-circle',  'dificil', '{"stack_max":15}'),
    ('v2_w_limpa_bb_25',     'BB blindado',             'Emende 25 decisões seguidas sem erro grave decidindo no BB.',      'weekly', 'drill',  'clean_streak',               25, 'shield',        'dificil', '{"posicao":"BB"}'),
    ('v2_w_ok_300',          'Semana GTO',              'Faça 300 jogadas boas ou perfeitas no Treino.',                    'weekly', 'drill',  'gto_ok_or_better',          300, 'flame',         'dificil', null),
    ('v2_w_range_acertos_200','Range de cor',           'Acerte 200 mãos no treino rápido de Ranges.',                      'weekly', 'range',  'range_hits',                200, 'spade',         'dificil', null),
    ('v2_w_estudo_360',      'Seis horas de estudo',    'Registre 360 minutos de estudo nesta semana.',                     'weekly', 'study',  'study_minutes',             360, 'book-open',     'dificil', null),
    ('v2_w_diario_7',        'Diário completo',         'Preencha o diário de 7 sessões nesta semana.',                     'weekly', 'bankroll','session_diary',               7, 'notebook',      'dificil', null),
    ('v2_w_autoaval_10',     'Avaliação a fundo',       'Marque acertei/errei/dúvida nas 4 ruas de 10 mãos.',               'weekly', 'review', 'reviews_full_self_eval',     10, 'scale',         'dificil', null),
    ('v2_w_torneios_20',     'Semana de grind',         'Jogue 20 torneios (trazidos pelo Radar).',                         'weekly', 'radar',  'tournaments_played',         20, 'trending-up',   'dificil', null),
    ('v2_w_importar_2000',   'Volume pesado',           'Tenha 2.000 mãos novas importadas pelo Radar.',                    'weekly', 'radar',  'hands_imported',           2000, 'clipboard-list','dificil', null),
    -- ===== Mensais =====
    ('v2_m_rfi_150',         'Mês abrindo pote',        'Complete 150 drills abrindo o pote (RFI).',                        'monthly', 'drill',  'drills_completed',         150, 'target',        'facil',   '{"fase":"sbOpen"}'),
    ('v2_m_vsrfi_150',       'Mês de defesa',           'Complete 150 drills respondendo a uma abertura.',                  'monthly', 'drill',  'drills_completed',         150, 'shield',        'facil',   '{"fase":"bbJam"}'),
    ('v2_m_range_150',       'Ranges do mês',           'Responda 150 mãos no treino rápido de Ranges.',                    'monthly', 'range',  'range_drills',             150, 'spade',         'facil',   null),
    ('v2_m_estudo_300',      'Cinco horas de estudo',   'Registre 300 minutos de estudo no mês.',                           'monthly', 'study',  'study_minutes',            300, 'book-open',     'facil',   null),
    ('v2_m_diario_6',        'Diário do mês',           'Preencha o diário de 6 sessões no mês.',                           'monthly', 'bankroll','session_diary',              6, 'notebook',      'facil',   null),
    ('v2_m_replay_40',       'Mês na mesa',             'Reveja 40 mãos na mesa do Revisor.',                               'monthly', 'review', 'hands_replayed',            40, 'book-open',     'facil',   null),
    ('v2_m_autoaval_8',      'Auto-avaliação do mês',   'Marque acertei/errei/dúvida nas 4 ruas de 8 mãos.',                'monthly', 'review', 'reviews_full_self_eval',     8, 'scale',         'facil',   null),
    ('v2_m_torneios_20',     'Mês de torneios',         'Jogue 20 torneios (trazidos pelo Radar).',                         'monthly', 'radar',  'tournaments_played',        20, 'trending-up',   'facil',   null),
    ('v2_m_importar_1000',   'Mil mãos',                'Tenha 1.000 mãos novas importadas pelo Radar.',                    'monthly', 'radar',  'hands_imported',          1000, 'clipboard-list','facil',   null),
    ('v2_m_curto_250',       'Mês de stack curto',      'Complete 250 drills com 15bb ou menos.',                           'monthly', 'drill',  'drills_completed',         250, 'target',        'media',   '{"stack_max":15}'),
    ('v2_m_fundo_250',       'Mês de stack fundo',      'Complete 250 drills com 40bb ou mais.',                            'monthly', 'drill',  'drills_completed',         250, 'target',        'media',   '{"stack_min":40}'),
    ('v2_m_btn_150',         'Dono do botão',           'Complete 150 drills decidindo no BTN.',                            'monthly', 'drill',  'drills_completed',         150, 'target',        'media',   '{"posicao":"BTN"}'),
    ('v2_m_ok_800',          'Mês de jogadas sólidas',  'Faça 800 jogadas boas ou perfeitas no Treino.',                    'monthly', 'drill',  'gto_ok_or_better',         800, 'check-circle',  'media',   null),
    ('v2_m_range_acertos_300','Ranges do mês, certeiro','Acerte 300 mãos no treino rápido de Ranges.',                      'monthly', 'range',  'range_hits',               300, 'spade',         'media',   null),
    ('v2_m_estudo_720',      'Doze horas de estudo',    'Registre 720 minutos de estudo no mês.',                           'monthly', 'study',  'study_minutes',            720, 'book-open',     'media',   null),
    ('v2_m_diario_15',       'Diário constante',        'Preencha o diário de 15 sessões no mês.',                          'monthly', 'bankroll','session_diary',             15, 'notebook',      'media',   null),
    ('v2_m_perguntas_12',    'Mês de reflexão',         'Responda todas as perguntas guiadas de 12 mãos.',                  'monthly', 'review', 'reviews_all_questions_answered', 12, 'help-circle', 'media', null),
    ('v2_m_replay_120',      'Replayer do mês',         'Reveja 120 mãos na mesa do Revisor.',                              'monthly', 'review', 'hands_replayed',           120, 'book-open',     'media',   null),
    ('v2_m_sessoes_20',      'Vinte sessões',           'Registre 20 sessões de jogo no mês.',                              'monthly', 'bankroll','bankroll_sessions',          20, 'clipboard-list','media',   null),
    ('v2_m_torneios_60',     'Grind do mês',            'Jogue 60 torneios (trazidos pelo Radar).',                         'monthly', 'radar',  'tournaments_played',        60, 'trending-up',   'media',   null),
    ('v2_m_rfi_perf_200',    'RFI de mestre',           'Acerte 200 drills PERFECT abrindo o pote.',                        'monthly', 'drill',  'perfect_drills',           200, 'check-circle',  'dificil', '{"fase":"sbOpen"}'),
    ('v2_m_vsrfi_perf_200',  'Defesa de mestre',        'Acerte 200 drills PERFECT respondendo a uma abertura.',            'monthly', 'drill',  'perfect_drills',           200, 'shield',        'dificil', '{"fase":"bbJam"}'),
    ('v2_m_vsjam_perf_150',  'Leitor de all-in',        'Acerte 150 drills PERFECT contra all-in.',                         'monthly', 'drill',  'perfect_drills',           150, 'flame',         'dificil', '{"fase":"sbCallJam"}'),
    ('v2_m_limpa_curto_40',  'Stack curto sem erro',    'Emende 40 decisões seguidas sem erro grave com 15bb ou menos.',    'monthly', 'drill',  'clean_streak',              40, 'shield',        'dificil', '{"stack_max":15}'),
    ('v2_m_range_acertos_800','Enciclopédia de ranges', 'Acerte 800 mãos no treino rápido de Ranges.',                      'monthly', 'range',  'range_hits',               800, 'spade',         'dificil', null),
    ('v2_m_estudo_1500',     'Vinte e cinco horas',     'Registre 1.500 minutos de estudo no mês.',                         'monthly', 'study',  'study_minutes',           1500, 'book-open',     'dificil', null),
    ('v2_m_diario_25',       'Diário de profissional',  'Preencha o diário de 25 sessões no mês.',                          'monthly', 'bankroll','session_diary',             25, 'notebook',      'dificil', null),
    ('v2_m_autoaval_30',     'Trinta mãos avaliadas',   'Marque acertei/errei/dúvida nas 4 ruas de 30 mãos.',               'monthly', 'review', 'reviews_full_self_eval',    30, 'scale',         'dificil', null),
    ('v2_m_torneios_150',    'Maratona de torneios',    'Jogue 150 torneios (trazidos pelo Radar).',                        'monthly', 'radar',  'tournaments_played',       150, 'trending-up',   'dificil', null),
    ('v2_m_importar_8000',   'Oito mil mãos',           'Tenha 8.000 mãos novas importadas pelo Radar.',                    'monthly', 'radar',  'hands_imported',          8000, 'clipboard-list','dificil', null)
  ) as v(code, title, description, kind, category, goal_metric, goal_base, icon, difficulty, filtro)
 where not exists (select 1 from public.missions m where m.code = v.code);
