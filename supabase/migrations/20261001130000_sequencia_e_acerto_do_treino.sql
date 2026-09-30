-- Tela inicial com números que não batiam (pedido: "revise cada uma
-- delas pois tem informações que não está batendo / sequência precisa
-- resetar se ficar mais de um dia de inatividade, drills errados").
--
-- 1) Sequência que não zerava. O trigger update_streak_on_event só mexe
--    em streak_days quando entra um evento de XP novo -- quem para de
--    jogar fica com a sequência antiga pra sempre (tela inicial, Hub,
--    ranking, time e a Disciplina do Score). E o "dia" era contado em
--    UTC: quem joga às 22h de Brasília já está no dia seguinte.
--    Agora: dia de Brasília no trigger, uma rotina às 00:01 que zera
--    quem ficou um dia inteiro sem atividade, e a view do Score só
--    considera a sequência se ela ainda estiver viva.
--
-- 2) Acerto do treino em 0%. Desde setembro o Treino grava o veredito
--    com os nomes da RPC register_training ('PERFECT'/'OK'/'MEDIOCRE'/
--    'BLUNDER'), mas a view do Score e as telas do Time ainda contavam
--    só os nomes antigos ('OTIMA'/'ACEITAVEL'/'ERRO_GRAVE'). Resultado:
--    "Acerto GTO 0%" e Conhecimento 0 no pentágono. Acerto passa a ser
--    ótima nos dois vocabulários -- a mesma conta do placar do Treino
--    ("X de Y mãos ótimas") e da register_training (v_hit).
--
-- 3) Consistência (sessões por semana) media só entre a primeira e a
--    última sessão: quem parou de registrar há meses mantinha a nota.
--    Agora mede da primeira sessão até hoje.

-- ---------------------------------------------------------------------
-- 1a) Trigger da sequência no dia de Brasília
-- ---------------------------------------------------------------------
create or replace function public.update_streak_on_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_last date;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_novo_dia boolean;
begin
  select (last_activity_at at time zone 'America/Sao_Paulo')::date into v_last from user_progress where user_id = new.user_id;
  v_novo_dia := v_last is null or v_last < v_today;

  -- streak_days = 0 (zerada pela rotina diária) também recomeça em 1.
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
    update user_progress
       set streak_days = greatest(streak_days, 1), last_activity_at = now()
     where user_id = new.user_id;
  end if;

  if v_novo_dia then
    perform public.avancar_missoes(new.user_id, 'active_days', 1);
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- 1b) Zera quem passou um dia inteiro (de Brasília) sem atividade
-- ---------------------------------------------------------------------
create or replace function public.zerar_sequencias_paradas()
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with zeradas as (
    update user_progress
       set streak_days = 0
     where streak_days > 0
       and (last_activity_at is null
            or (last_activity_at at time zone 'America/Sao_Paulo')::date
               < (now() at time zone 'America/Sao_Paulo')::date - 1)
    returning 1
  )
  select count(*)::int from zeradas;
$function$;

revoke all on function public.zerar_sequencias_paradas() from public, anon, authenticated;

-- 00:01 em Brasília (03:01 UTC).
select cron.unschedule('zerar-sequencias-paradas')
 where exists (select 1 from cron.job where jobname = 'zerar-sequencias-paradas');
select cron.schedule('zerar-sequencias-paradas', '1 3 * * *', 'select public.zerar_sequencias_paradas();');

-- Acerta agora quem já está parado (ex.: sequência 7 com o último
-- treino anteontem).
select public.zerar_sequencias_paradas();

-- ---------------------------------------------------------------------
-- 2) Funções do Time e linha do tempo com os dois vocabulários
-- ---------------------------------------------------------------------
-- Troca só o trecho do veredito dentro da definição atual de cada
-- função (o resto fica idêntico). Rodar de novo não muda nada: depois da
-- troca o texto antigo não existe mais.
do $$
declare
  r record;
  v text;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('team_dashboard', 'team_period_comparison', 'team_player_detail', 'snapshot_team_scores', 'get_player_timeline')
  loop
    v := pg_get_functiondef(r.oid);
    v := replace(v, 'ts.verdict = ''OTIMA''', 'ts.verdict in (''OTIMA'', ''PERFECT'')');
    v := replace(v, 'ts.verdict=''OTIMA''', 'ts.verdict in (''OTIMA'', ''PERFECT'')');
    v := replace(v, 'ts.verdict = ''ERRO_GRAVE''', 'ts.verdict in (''ERRO_GRAVE'', ''BLUNDER'')');
    v := replace(v, 'ts.verdict IN (''OTIMA'',''ACEITAVEL'')', 'ts.verdict IN (''OTIMA'',''ACEITAVEL'',''PERFECT'',''OK'')');
    execute v;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Score de Evolução (view materializada da Performance/tela inicial)
-- ---------------------------------------------------------------------
-- View materializada não aceita "create or replace": derruba e recria,
-- junto com a view por jogador que lê dela, o índice único (a rotina
-- de 15 em 15 min usa REFRESH CONCURRENTLY) e as permissões.
drop view if exists public.player_performance;
drop materialized view if exists public.player_performance_snapshot;

create materialized view public.player_performance_snapshot as
 with session_profit as (
         select bankroll_sessions.user_id,
            bankroll_sessions.date,
            bankroll_sessions.created_at,
            bankroll_sessions.format,
            bankroll_sessions.cashout,
            bankroll_sessions.hours,
            bankroll_sessions.cashout - bankroll_sessions.buy_in * (1 + coalesce(bankroll_sessions.reentries, 0))::numeric as lucro,
            bankroll_sessions.buy_in * (1 + coalesce(bankroll_sessions.reentries, 0))::numeric as investido
           from bankroll_sessions
        ), bankroll_agg as (
         select session_profit.user_id,
            count(*) as num_sessoes,
            sum(session_profit.hours) as horas_jogadas,
            sum(session_profit.lucro) as lucro_acumulado,
            sum(session_profit.investido) as total_investido,
                case
                    when sum(session_profit.investido) > 0::numeric then round(sum(session_profit.lucro) / sum(session_profit.investido) * 100::numeric, 2)
                    else null::numeric
                end as roi_pct,
                case
                    when sum(session_profit.hours) > 0::numeric then round(sum(session_profit.lucro) / sum(session_profit.hours), 2)
                    else null::numeric
                end as lucro_por_hora,
            max(session_profit.lucro) as maior_sessao_positiva,
            min(session_profit.lucro) as maior_sessao_negativa,
            count(*) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text])) as num_torneios,
            count(*) filter (where session_profit.format = 'Cash'::text) as num_cash,
                case
                    when count(*) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text])) > 0 then round(count(*) filter (where (session_profit.format = any (array['Torneio'::text, 'MTT'::text])) and session_profit.cashout > 0::numeric)::numeric / count(*) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text]))::numeric * 100::numeric, 2)
                    else null::numeric
                end as itm_pct_aproximado,
                case
                    when count(*) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text])) > 0 then round(sum(session_profit.investido) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text])) / count(*) filter (where session_profit.format = any (array['Torneio'::text, 'MTT'::text]))::numeric, 2)
                    else null::numeric
                end as abi_torneio,
                -- Sessões por semana da primeira sessão até HOJE (antes:
                -- até a última sessão, então parar de jogar não baixava).
                case
                    when (greatest(current_date, max(session_profit.date)) - min(session_profit.date)) >= 7 then round(count(*)::numeric / ((greatest(current_date, max(session_profit.date)) - min(session_profit.date))::numeric / 7::numeric), 2)
                    else null::numeric
                end as frequencia_semanal_sessoes
           from session_profit
          group by session_profit.user_id
        ), session_cum as (
         select session_profit.user_id,
            session_profit.date,
            session_profit.created_at,
            session_profit.lucro,
            sum(session_profit.lucro) over (partition by session_profit.user_id order by session_profit.date, session_profit.created_at) as cum_lucro
           from session_profit
        ), session_peak as (
         select session_cum.user_id,
            session_cum.date,
            session_cum.created_at,
            session_cum.cum_lucro,
            max(session_cum.cum_lucro) over (partition by session_cum.user_id order by session_cum.date, session_cum.created_at) as peak_lucro
           from session_cum
        ), downswing_agg as (
         select distinct on (session_peak.user_id) session_peak.user_id,
            greatest(session_peak.peak_lucro - session_peak.cum_lucro, 0::numeric) as downswing_atual
           from session_peak
          order by session_peak.user_id, session_peak.date desc, session_peak.created_at desc
        ), review_agg as (
         select hand_reviews.user_id,
            count(*) as maos_revisadas
           from hand_reviews
          group by hand_reviews.user_id
        ), training_agg as (
         -- Acerto = mão ótima, nos dois vocabulários (ver topo do arquivo).
         select training_sessions.user_id,
            count(*) as num_drills,
            round(count(*) filter (where training_sessions.verdict = any (array['OTIMA'::text, 'PERFECT'::text]))::numeric / nullif(count(*), 0)::numeric * 100::numeric, 2) as taxa_acerto_treino_pct
           from training_sessions
          group by training_sessions.user_id
        ), leak_agg as (
         select e.user_id,
            jsonb_agg(jsonb_build_object('code', e.reason_code, 'label', r.label, 'category', r.category, 'ocorrencias', e.n) order by e.n desc) as top_leaks
           from ( select hand_review_street_evals.user_id,
                    hand_review_street_evals.reason_code,
                    count(*) as n
                   from hand_review_street_evals
                  where hand_review_street_evals.self_rating = 'errei'::text and hand_review_street_evals.reason_code is not null
                  group by hand_review_street_evals.user_id, hand_review_street_evals.reason_code) e
             left join hand_eval_reasons r on r.code = e.reason_code
          group by e.user_id
        ), leak_top3 as (
         select leak_agg.user_id,
            ( select jsonb_agg(x.*) as jsonb_agg
                   from ( select jsonb_array_elements.value
                           from jsonb_array_elements(leak_agg.top_leaks) jsonb_array_elements(value)
                         limit 3) x) as top_leaks
           from leak_agg
        ), freq_agg as (
         select player_stats.user_id,
                case
                    when player_stats.hands_count > 0 then round(player_stats.vpip_count::numeric / player_stats.hands_count::numeric * 100::numeric, 2)
                    else null::numeric
                end as vpip_pct,
                case
                    when player_stats.hands_count > 0 then round(player_stats.pfr_count::numeric / player_stats.hands_count::numeric * 100::numeric, 2)
                    else null::numeric
                end as pfr_pct,
                case
                    when player_stats.hands_count > 0 then round(player_stats.three_bet_count::numeric / player_stats.hands_count::numeric * 100::numeric, 2)
                    else null::numeric
                end as three_bet_pct,
            player_stats.hands_count as maos_com_dados_frequencia
           from player_stats
          where player_stats.dimension = 'overall'::text and player_stats.value = 'all'::text
        ), self_eval_agg as (
         select hand_review_street_evals.user_id,
            round(count(*) filter (where hand_review_street_evals.self_rating = 'acertei'::text)::numeric / nullif(count(*) filter (where hand_review_street_evals.self_rating = any (array['acertei'::text, 'errei'::text])), 0)::numeric * 100::numeric, 2) as taxa_acerto_review_pct,
            count(*) filter (where hand_review_street_evals.self_rating = any (array['acertei'::text, 'errei'::text])) as avaliacoes_com_veredito
           from hand_review_street_evals
          group by hand_review_street_evals.user_id
        ), streak_viva as (
         -- Sequência só vale se o último dia ativo (Brasília) foi hoje ou
         -- ontem -- não depende da rotina das 00:01 ter rodado.
         select user_progress.user_id,
                case
                    when (user_progress.last_activity_at at time zone 'America/Sao_Paulo')::date >= (now() at time zone 'America/Sao_Paulo')::date - 1 then coalesce(user_progress.streak_days, 0)
                    else 0
                end as streak_days
           from user_progress
        ), score_base as (
         select up_1.user_id,
            coalesce(se.taxa_acerto_review_pct, 50::numeric) as score_tecnica,
            coalesce(ta_1.taxa_acerto_treino_pct, 50::numeric) as score_conhecimento,
            least(100::numeric, greatest(0::numeric, round(sv_1.streak_days::numeric / 14::numeric * 100::numeric))) as score_disciplina,
                case
                    when ba_1.roi_pct is null then 50::numeric
                    else least(100::numeric, greatest(0::numeric, round((ba_1.roi_pct + 20::numeric) / 50::numeric * 100::numeric)))
                end as score_performance,
                case
                    when ba_1.frequencia_semanal_sessoes is null then 50::numeric
                    else least(100::numeric, greatest(0::numeric, round(ba_1.frequencia_semanal_sessoes / 3::numeric * 100::numeric)))
                end as score_consistencia
           from user_progress up_1
             join streak_viva sv_1 on sv_1.user_id = up_1.user_id
             left join bankroll_agg ba_1 on ba_1.user_id = up_1.user_id
             left join training_agg ta_1 on ta_1.user_id = up_1.user_id
             left join self_eval_agg se on se.user_id = up_1.user_id
        )
 select up.user_id,
    ba.num_sessoes,
    ba.horas_jogadas,
    ba.lucro_acumulado,
    ba.total_investido,
    ba.roi_pct,
    ba.lucro_por_hora as dolar_hora,
    ba.abi_torneio,
    ba.maior_sessao_positiva,
    ba.maior_sessao_negativa,
    coalesce(ds.downswing_atual, 0::numeric) as downswing_atual,
    ba.num_torneios,
    ba.num_cash,
    ba.itm_pct_aproximado,
    ba.frequencia_semanal_sessoes,
    ra.maos_revisadas,
    ta.num_drills,
    ta.taxa_acerto_treino_pct,
    sv.streak_days as streak_atual,
    up.streak_best,
    up.xp_total,
    lt.top_leaks,
    fa.vpip_pct,
    fa.pfr_pct,
    fa.three_bet_pct,
    fa.maos_com_dados_frequencia,
    null::numeric as bb_100,
    null::numeric as itm_pct_real,
    sb.score_tecnica,
    sb.score_conhecimento,
    sb.score_disciplina,
    sb.score_performance,
    sb.score_consistencia,
    round(sb.score_tecnica * 0.25 + sb.score_conhecimento * 0.20 + sb.score_disciplina * 0.20 + sb.score_performance * 0.20 + sb.score_consistencia * 0.15) as score_geral,
    now() as updated_at
   from user_progress up
     join streak_viva sv on sv.user_id = up.user_id
     left join bankroll_agg ba on ba.user_id = up.user_id
     left join downswing_agg ds on ds.user_id = up.user_id
     left join review_agg ra on ra.user_id = up.user_id
     left join training_agg ta on ta.user_id = up.user_id
     left join leak_top3 lt on lt.user_id = up.user_id
     left join freq_agg fa on fa.user_id = up.user_id
     left join score_base sb on sb.user_id = up.user_id;

create unique index player_performance_snapshot_user_id_idx on public.player_performance_snapshot using btree (user_id);

revoke all on public.player_performance_snapshot from public, anon, authenticated;
grant all on public.player_performance_snapshot to service_role;

create view public.player_performance as
 select user_id, num_sessoes, horas_jogadas, lucro_acumulado, total_investido, roi_pct, dolar_hora, abi_torneio,
    maior_sessao_positiva, maior_sessao_negativa, downswing_atual, num_torneios, num_cash, itm_pct_aproximado,
    frequencia_semanal_sessoes, maos_revisadas, num_drills, taxa_acerto_treino_pct, streak_atual, streak_best, xp_total,
    top_leaks, vpip_pct, pfr_pct, three_bet_pct, maos_com_dados_frequencia, bb_100, itm_pct_real, score_tecnica,
    score_conhecimento, score_disciplina, score_performance, score_consistencia, score_geral, updated_at
   from public.player_performance_snapshot
  where user_id = auth.uid();

revoke all on public.player_performance from public, anon, authenticated;
grant select on public.player_performance to authenticated;
grant all on public.player_performance to service_role;
