-- Tarefas (missões) e níveis refeitos (2026-09, pedido do jogador):
--
--  * Fácil / Média / Difícil de verdade: a dificuldade agora bate com o
--    esforço da tarefa (antes "emende 5 decisões sem erro" era Expert e
--    valia mais que "complete 50 drills"). Sem "Expert".
--  * Por período: diárias 2 fáceis + 2 médias + 1 difícil; semanais e
--    mensais 2 de cada. XP fixo por dificuldade:
--      diária   15 / 30 / 60
--      semanal  80 / 160 / 300
--      mensal  300 / 600 / 1100
--  * Nível 99 em 5 anos pra quem fizer TUDO: todas as tarefas + o limite
--    diário de XP de treino (150), revisão (150) e banca (100), com o
--    multiplicador máximo de sequência (1,5x). Isso dá ~385 mil XP/ano;
--    a curva 115 × nível^1,3 soma ~1,92 milhão de XP do 1 ao 99 = 5 anos.
--    Quem faz menos que tudo leva mais tempo.
--  * Limite diário vira teto de verdade: passou do limite, o XP daquela
--    atividade para no dia (antes seguia pingando 25%, sem teto). XP de
--    tarefa concluída não entra no limite (antes era cortado pra 25% se
--    o jogador já tinha treinado muito no dia).
--
-- Defeitos corrigidos no caminho:
--  * Treino contava em dobro nas tarefas (register_training e o gatilho
--    on_training_session faziam a mesma coisa).
--  * Sessão de banca contava em dobro (dois gatilhos iguais em
--    bankroll_sessions) e podia dar o XP da tarefa duas vezes.
--  * Tarefas semanais/mensais de treino só avançavam no 1º dia do período
--    (register_training filtrava period_start = hoje).
--  * "Dias ativos" não contava o dia em que a sequência recomeçava.
--  * award_xp aceitava qualquer valor vindo do app; agora o app só pede
--    XP de atividade com teto de 30 por ação, e XP de tarefa só é dado
--    pelo próprio banco (conceder_xp / avancar_missoes, sem acesso de fora).

-- 1) Curva de nível -------------------------------------------------------
create or replace function public.xp_for_next_level(current_level integer)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select round(115 * power(current_level, 1.3))::integer;
$function$;

-- 2) Concessão de XP (interna) ----------------------------------------------
create or replace function public.conceder_xp(
  p_uid uuid,
  p_source text,
  p_category text,
  p_xp_base integer,
  p_reference_id uuid default null,
  p_eh_missao boolean default false
)
returns table(xp_final integer, level_up boolean, new_level integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_progress user_progress%rowtype;
  v_mult_streak numeric := 1.0;
  v_mult_combo numeric := 1.0;
  v_xp integer;
  v_hoje integer;
  v_cap integer;
  v_needed integer;
  v_level integer;
  v_cur integer;
  v_leveled boolean := false;
  v_plan text;
  v_liberado boolean;
begin
  if p_uid is null then raise exception 'NO_SESSION'; end if;

  select plan into v_plan from user_plans where user_id = p_uid;
  select (coalesce(v_plan, 'free') <> 'free')
    or exists (select 1 from team_members where user_id = p_uid and status = 'ativo')
    into v_liberado;

  select * into v_progress from user_progress where user_id = p_uid;
  if not v_liberado or not found then
    xp_final := 0;
    level_up := false;
    new_level := v_progress.level;
    return next;
    return;
  end if;

  v_mult_streak := case
    when v_progress.streak_days >= 30 then 1.50
    when v_progress.streak_days >= 14 then 1.35
    when v_progress.streak_days >= 7 then 1.20
    when v_progress.streak_days >= 3 then 1.10
    else 1.00 end;
  if p_source = 'drill' then
    v_mult_combo := case
      when v_progress.combo_gto >= 10 then 1.35
      when v_progress.combo_gto >= 5 then 1.20
      when v_progress.combo_gto >= 3 then 1.10
      else 1.00 end;
  end if;
  v_xp := round(greatest(coalesce(p_xp_base, 0), 0) * least(1.75, v_mult_streak * v_mult_combo));

  if not p_eh_missao then
    v_cap := case p_category when 'drill' then 150 when 'review' then 150 when 'bankroll' then 100 else 100 end;
    select coalesce(sum(xe.xp_final), 0) into v_hoje
      from xp_events xe
     where xe.user_id = p_uid
       and xe.category = p_category
       and xe.source not like 'mission%'
       and xe.created_at >= date_trunc('day', now());
    v_xp := greatest(0, least(v_xp, v_cap - v_hoje));
  end if;

  -- O gatilho de xp_events (sequência/dias ativos) pode concluir uma tarefa
  -- e dar XP dentro deste mesmo insert -- por isso o saldo abaixo é somado
  -- no banco (xp_total + v_xp), nunca regravado a partir de uma cópia velha.
  insert into xp_events (user_id, source, reference_id, xp_base, mult_streak, mult_combo, xp_final, category)
    values (p_uid, p_source, p_reference_id, coalesce(p_xp_base, 0), v_mult_streak, v_mult_combo, v_xp, p_category);

  update user_progress up
     set xp_total = up.xp_total + v_xp,
         xp_current = up.xp_current + v_xp,
         updated_at = now()
   where up.user_id = p_uid
  returning up.level, up.xp_current into v_level, v_cur;

  loop
    v_needed := xp_for_next_level(v_level);
    exit when v_cur < v_needed or v_level >= 99;
    v_cur := v_cur - v_needed;
    v_level := v_level + 1;
    v_leveled := true;
  end loop;
  if v_leveled then
    update user_progress set level = v_level, xp_current = v_cur where user_id = p_uid;
  end if;

  xp_final := v_xp;
  level_up := v_leveled;
  new_level := v_level;
  return next;
end;
$function$;

revoke execute on function public.conceder_xp(uuid, text, text, integer, uuid, boolean) from public, anon, authenticated;

-- XP pedido pelo app (hoje: sessão registrada na Gestão de Banca). Nunca
-- XP de tarefa, e no máximo 30 por ação.
create or replace function public.award_xp(p_source text, p_category text, p_xp_base integer, p_reference_id uuid default null)
returns table(xp_final integer, level_up boolean, new_level integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_source is null or p_source ilike 'mission%' then
    raise exception 'FONTE_INVALIDA';
  end if;
  return query
    select c.xp_final, c.level_up, c.new_level
      from public.conceder_xp(auth.uid(), p_source, p_category, least(greatest(coalesce(p_xp_base, 0), 0), 30), p_reference_id, false) c;
end;
$function$;

-- 3) Avanço das tarefas (interno, um lugar só) -----------------------------
-- p_inc < 0 zera o progresso (sequências: erro grave no treino, sessão
-- negativa na banca).
create or replace function public.avancar_missoes(p_uid uuid, p_metric text, p_inc integer, p_spot_id text default null)
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
       and (
         m.filter_payload is null
         or (p_spot_id is not null and m.filter_payload ? 'spot_ids'
             and (m.filter_payload->'spot_ids') @> to_jsonb(p_spot_id))
       )
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

revoke execute on function public.avancar_missoes(uuid, text, integer, text) from public, anon, authenticated;

-- Nome antigo, mantido pra quem ainda chama; mesma regra nova.
create or replace function public.update_mission_progress(p_user_id uuid, p_metric text, p_increment integer default 1)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.avancar_missoes(p_user_id, p_metric, p_increment);
end;
$function$;

revoke execute on function public.update_mission_progress(uuid, text, integer) from public, anon, authenticated;

-- 4) Treino ------------------------------------------------------------------
-- O gatilho duplicava o avanço das tarefas de treino; register_training
-- passa a ser o único lugar.
drop trigger if exists on_training_session on public.training_sessions;
drop function if exists public.on_training_session_insert();

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

  -- Sessao diaria retomavel (filtros + progresso do bloco): uma linha por
  -- jogador, reiniciada quando o dia muda.
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

    v_completed := v_completed || public.avancar_missoes(v_uid, 'drills_completed', 1, p_spot_id);
    if p_verdict = 'PERFECT' then
      v_completed := v_completed || public.avancar_missoes(v_uid, 'perfect_drills', 1, p_spot_id);
    end if;
    if p_verdict in ('PERFECT', 'OK') then
      v_completed := v_completed || public.avancar_missoes(v_uid, 'gto_ok_or_better', 1, p_spot_id);
    end if;
    v_completed := v_completed || public.avancar_missoes(
      v_uid, 'clean_streak', case when p_verdict = 'BLUNDER' then -1 else 1 end, p_spot_id
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

-- 5) Gestão de Banca ---------------------------------------------------------
drop trigger if exists trg_bankroll_session_missions on public.bankroll_sessions;

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

  return new;
end;
$function$;

-- 6) Revisor de Mãos ---------------------------------------------------------
-- Vira SECURITY DEFINER pra poder chamar as funções internas (o jogador
-- não tem acesso direto a elas); a dona da mão continua conferida abaixo.
create or replace function public.register_review_event(p_event_type text, p_review_id uuid)
returns table(xp_final integer, level_up boolean, new_level integer, missions_completed jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_xp_base int;
  v_metric text;
  v_source text;
  v_award record;
  v_completed jsonb;
  v_level int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform 1 from public.hand_reviews where id = p_review_id and user_id = v_user_id;
  if not found then
    raise exception 'review_not_found_or_forbidden';
  end if;

  -- Mesmo evento na mesma mão só pontua 1x.
  if exists (
    select 1 from public.xp_events
     where user_id = v_user_id and reference_id = p_review_id and source = 'review_' || p_event_type
  ) then
    return query select 0::int, false, null::int, '[]'::jsonb;
    return;
  end if;

  case p_event_type
    when 'registered'             then v_xp_base := 8;  v_metric := 'reviews_registered';
    when 'concluded'              then v_xp_base := 20; v_metric := 'reviews_concluded';
    when 'full_self_eval'         then v_xp_base := 15; v_metric := 'reviews_full_self_eval';
    when 'all_questions_answered' then v_xp_base := 10; v_metric := 'reviews_all_questions_answered';
    else raise exception 'invalid_event_type';
  end case;
  v_source := 'review_' || p_event_type;

  select * into v_award from public.conceder_xp(v_user_id, v_source, 'review', v_xp_base, p_review_id, false);
  v_completed := public.avancar_missoes(v_user_id, v_metric, 1);

  select up.level into v_level from public.user_progress up where up.user_id = v_user_id;
  return query select v_award.xp_final,
                      v_award.level_up or coalesce(v_level, 0) > coalesce(v_award.new_level, 0),
                      v_level,
                      v_completed;
end;
$function$;

-- 7) Sequência e dias ativos -------------------------------------------------
-- "Dia ativo" = primeiro XP do dia (UTC), com ou sem sequência em curso.
-- Antes só contava quando a sequência crescia, então o dia em que ela
-- recomeçava do 1 ficava de fora.
drop trigger if exists on_streak_update on public.user_progress;
drop function if exists public.on_streak_incremented();

create or replace function public.update_streak_on_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_last date;
  v_today date := (now() at time zone 'utc')::date;
  v_novo_dia boolean;
begin
  select (last_activity_at at time zone 'utc')::date into v_last from user_progress where user_id = new.user_id;
  v_novo_dia := v_last is null or v_last < v_today;

  if v_last is null or v_last < v_today - 1 then
    update user_progress
       set streak_days = 1, streak_best = greatest(streak_best, 1), last_activity_at = now()
     where user_id = new.user_id;
  elsif v_last = v_today - 1 then
    update user_progress
       set streak_days = streak_days + 1,
           streak_best = greatest(streak_best, streak_days + 1),
           last_activity_at = now()
     where user_id = new.user_id;
  else
    update user_progress set last_activity_at = now() where user_id = new.user_id;
  end if;

  -- Depois de gravar last_activity_at: se esta tarefa der XP, o gatilho
  -- roda de novo e já não conta o mesmo dia duas vezes.
  if v_novo_dia then
    perform public.avancar_missoes(new.user_id, 'active_days', 1);
  end if;
  return new;
end;
$function$;

-- 8) Distribuição por período ------------------------------------------------
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

-- 9) Catálogo novo -----------------------------------------------------------
update public.user_missions um
   set status = 'expired'
  from public.missions m
 where m.id = um.mission_id
   and um.status = 'active'
   and m.code not like 'v2\_%';

update public.missions
   set active_until = now()
 where code not like 'v2\_%'
   and (active_until is null or active_until > now());

insert into public.missions (code, title, description, kind, category, goal_metric, goal_base, goal_scale, xp_reward, icon, difficulty)
select v.code, v.title, v.description, v.kind, v.category, v.goal_metric, v.goal_base, 0, v.xp_reward, v.icon, v.difficulty
  from (values
    -- Diárias: fácil 15 / média 30 / difícil 60
    ('v2_d_drills_10',     'Aquecimento',            'Complete 10 drills no Treino hoje.',                                   'daily', 'drill',    'drills_completed',               10, 15, 'target',        'facil'),
    ('v2_d_registrar_1',   'Mão do dia',             'Registre 1 mão no Revisor hoje.',                                      'daily', 'review',   'reviews_registered',              1, 15, 'book-open',     'facil'),
    ('v2_d_autoaval_1',    'Auto-avaliação',         'Marque acertei/errei/dúvida nas 4 ruas de 1 mão.',                     'daily', 'review',   'reviews_full_self_eval',          1, 15, 'scale',         'facil'),
    ('v2_d_sessao_1',      'Sessão registrada',      'Registre 1 sessão de jogo na Gestão de Banca hoje.',                   'daily', 'bankroll', 'bankroll_sessions',               1, 15, 'notebook',      'facil'),
    ('v2_d_drills_30',     'Sessão de treino',       'Complete 30 drills no Treino hoje.',                                   'daily', 'drill',    'drills_completed',               30, 30, 'target',        'media'),
    ('v2_d_perfeitos_8',   'Precisão GTO',           'Acerte 8 drills como PERFECT hoje.',                                   'daily', 'drill',    'perfect_drills',                  8, 30, 'check-circle',  'media'),
    ('v2_d_perguntas_1',   'Pensar antes de decidir','Responda todas as perguntas guiadas de 1 mão.',                        'daily', 'review',   'reviews_all_questions_answered',  1, 30, 'help-circle',   'media'),
    ('v2_d_limpa_8',       'Sequência limpa',        'Emende 8 decisões seguidas sem erro grave no Treino.',                 'daily', 'drill',    'clean_streak',                    8, 30, 'shield',        'media'),
    ('v2_d_perfeitos_20',  'Precisão total',         'Acerte 20 drills como PERFECT hoje.',                                  'daily', 'drill',    'perfect_drills',                 20, 60, 'check-circle',  'dificil'),
    ('v2_d_limpa_20',      'Sem tropeço',            'Emende 20 decisões seguidas sem erro grave no Treino.',                'daily', 'drill',    'clean_streak',                   20, 60, 'shield',        'dificil'),
    ('v2_d_concluir_2',    'Revisão a fundo',        'Conclua a revisão de 2 mãos (com o Registro de aprendizado).',         'daily', 'review',   'reviews_concluded',               2, 60, 'check-circle',  'dificil'),
    ('v2_d_verde_1',       'Fechou no verde',        'Encerre 1 sessão hoje com cashout maior que o investido.',             'daily', 'bankroll', 'bankroll_positive_sessions',      1, 60, 'trending-up',   'dificil'),
    -- Semanais: fácil 80 / média 160 / difícil 300
    ('v2_w_ativo_3',       'Presença',               'Fique ativo em 3 dias diferentes nesta semana.',                       'weekly', 'habit',    'active_days',                    3, 80, 'calendar',      'facil'),
    ('v2_w_drills_60',     'Treino da semana',       'Complete 60 drills nesta semana.',                                     'weekly', 'drill',    'drills_completed',              60, 80, 'target',        'facil'),
    ('v2_w_registrar_5',   'Semana de registro',     'Registre 5 mãos no Revisor nesta semana.',                             'weekly', 'review',   'reviews_registered',             5, 80, 'notebook',      'facil'),
    ('v2_w_sessoes_3',     'Banca em dia',           'Registre 3 sessões de jogo nesta semana.',                             'weekly', 'bankroll', 'bankroll_sessions',              3, 80, 'clipboard-list','facil'),
    ('v2_w_ativo_5',       'Consistência',           'Fique ativo em 5 dias diferentes nesta semana.',                       'weekly', 'habit',    'active_days',                    5, 160, 'calendar',     'media'),
    ('v2_w_drills_150',    'Semana produtiva',       'Complete 150 drills nesta semana.',                                    'weekly', 'drill',    'drills_completed',             150, 160, 'flame',        'media'),
    ('v2_w_concluir_4',    'Semana de revisão',      'Conclua 4 revisões de mão nesta semana.',                              'weekly', 'review',   'reviews_concluded',              4, 160, 'check-circle', 'media'),
    ('v2_w_dias_jogo_4',   'Semana ativa na mesa',   'Registre sessões em 4 dias diferentes nesta semana.',                  'weekly', 'bankroll', 'bankroll_active_days',           4, 160, 'calendar',     'media'),
    ('v2_w_horas_8',       'Volume da semana',       'Acumule 8 horas de jogo nesta semana.',                                'weekly', 'bankroll', 'bankroll_hours',                 8, 160, 'clock',        'media'),
    ('v2_w_ativo_7',       'Semana cheia',           'Fique ativo em todos os 7 dias da semana.',                            'weekly', 'habit',    'active_days',                    7, 300, 'flame',        'dificil'),
    ('v2_w_perfeitos_80',  'Precisão da semana',     'Acerte 80 drills como PERFECT nesta semana.',                          'weekly', 'drill',    'perfect_drills',                80, 300, 'check-circle', 'dificil'),
    ('v2_w_limpa_35',      'Sequência de ferro',     'Emende 35 decisões seguidas sem erro grave no Treino.',                'weekly', 'drill',    'clean_streak',                  35, 300, 'shield',       'dificil'),
    ('v2_w_concluir_10',   'Revisor dedicado',       'Conclua 10 revisões de mão nesta semana.',                             'weekly', 'review',   'reviews_concluded',             10, 300, 'book-open',    'dificil'),
    ('v2_w_horas_20',      'Grind da semana',        'Acumule 20 horas de jogo nesta semana.',                               'weekly', 'bankroll', 'bankroll_hours',                20, 300, 'clock',        'dificil'),
    ('v2_w_verde_3',       'Sequência positiva',     'Feche 3 sessões positivas seguidas.',                                  'weekly', 'bankroll', 'bankroll_positive_streak',       3, 300, 'flame',        'dificil'),
    -- Mensais: fácil 300 / média 600 / difícil 1100
    ('v2_m_ativo_10',      'Mês presente',           'Fique ativo em 10 dias do mês.',                                       'monthly', 'habit',    'active_days',                  10, 300, 'calendar',     'facil'),
    ('v2_m_drills_250',    'Treino do mês',          'Complete 250 drills no mês.',                                          'monthly', 'drill',    'drills_completed',            250, 300, 'target',       'facil'),
    ('v2_m_registrar_15',  'Mês de registro',        'Registre 15 mãos no Revisor no mês.',                                  'monthly', 'review',   'reviews_registered',           15, 300, 'notebook',     'facil'),
    ('v2_m_sessoes_10',    'Mês de banca',           'Registre 10 sessões de jogo no mês.',                                  'monthly', 'bankroll', 'bankroll_sessions',            10, 300, 'clipboard-list','facil'),
    ('v2_m_ativo_20',      'Consistência mensal',    'Fique ativo em 20 dias do mês.',                                       'monthly', 'habit',    'active_days',                  20, 600, 'calendar',     'media'),
    ('v2_m_drills_600',    'Grind mensal',           'Complete 600 drills no mês.',                                          'monthly', 'drill',    'drills_completed',            600, 600, 'flame',        'media'),
    ('v2_m_concluir_15',   'Mês de revisão',         'Conclua 15 revisões de mão no mês.',                                   'monthly', 'review',   'reviews_concluded',            15, 600, 'book-open',    'media'),
    ('v2_m_horas_40',      'Volume do mês',          'Jogue 40 horas no mês.',                                               'monthly', 'bankroll', 'bankroll_hours',               40, 600, 'clock',        'media'),
    ('v2_m_ativo_28',      'Mês impecável',          'Fique ativo em 28 dias do mês.',                                       'monthly', 'habit',    'active_days',                  28, 1100, 'flame',       'dificil'),
    ('v2_m_perfeitos_350', 'Precisão mensal',        'Acerte 350 drills como PERFECT no mês.',                               'monthly', 'drill',    'perfect_drills',              350, 1100, 'check-circle','dificil'),
    ('v2_m_limpa_60',      'Mente blindada',         'Emende 60 decisões seguidas sem erro grave no Treino.',                'monthly', 'drill',    'clean_streak',                 60, 1100, 'shield',      'dificil'),
    ('v2_m_concluir_40',   'Estudo sério',           'Conclua 40 revisões de mão no mês.',                                   'monthly', 'review',   'reviews_concluded',            40, 1100, 'book-open',   'dificil'),
    ('v2_m_horas_80',      'Maratona do mês',        'Jogue 80 horas no mês.',                                               'monthly', 'bankroll', 'bankroll_hours',               80, 1100, 'clock',       'dificil'),
    ('v2_m_verde_7',       'Mês em alta',            'Emende 7 sessões positivas seguidas.',                                 'monthly', 'bankroll', 'bankroll_positive_streak',      7, 1100, 'trending-up', 'dificil')
  ) as v(code, title, description, kind, category, goal_metric, goal_base, xp_reward, icon, difficulty)
 where not exists (select 1 from public.missions m where m.code = v.code);

-- 10) Nível de quem já joga, recalculado pela curva nova ------------------------
-- O XP acumulado (xp_total) não muda; só em que nível ele cai.
do $$
declare
  r record;
  v_level integer;
  v_resto bigint;
  v_need integer;
begin
  for r in select user_id, xp_total from public.user_progress loop
    v_level := 1;
    v_resto := greatest(coalesce(r.xp_total, 0), 0);
    loop
      v_need := public.xp_for_next_level(v_level);
      exit when v_resto < v_need or v_level >= 99;
      v_resto := v_resto - v_need;
      v_level := v_level + 1;
    end loop;
    update public.user_progress
       set level = v_level, xp_current = least(v_resto, 2147483647)::integer
     where user_id = r.user_id;
  end loop;
end $$;

-- 11) Tarefas novas já valendo pra todo mundo --------------------------------
select public.assign_missions_for_all();
