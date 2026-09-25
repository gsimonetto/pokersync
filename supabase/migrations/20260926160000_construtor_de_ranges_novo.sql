-- Construtor de Ranges novo (base Flopzilla).
--
-- 1) Cada range agora é um grupo de mãos com PESO (0 a 100) -- igual ao
--    Flopzilla -- em vez de fold/call/raise por mão:
--      hands           = {"AKs": 100, "A5s": 50, ...}
--      combo_overrides = {"AsKs": 100, ...} (peso de um combo específico)
--    A tabela estava vazia (nenhum range salvo), então nada precisa ser
--    convertido. Ganha o "spot" do range pra agrupar e achar: posição,
--    contra quem, stack e a ação (abrir, pagar, 3-bet...).
alter table public.ranges
  add column if not exists posicao text,
  add column if not exists vs_posicao text,
  add column if not exists stack_bb integer,
  add column if not exists acao text;

alter table public.ranges drop constraint if exists ranges_stack_bb_valido;
alter table public.ranges
  add constraint ranges_stack_bb_valido check (stack_bb is null or stack_bb between 1 and 1000);

comment on column public.ranges.hands is 'Peso de cada mão da grade, 0 a 100 ({"AKs": 100}). Mão ausente = fora do range.';
comment on column public.ranges.combo_overrides is 'Peso de combos específicos ({"AsKs": 100}); vence o peso da mão.';

-- 2) Brecha: inserir/editar não conferia o team_id -- dava pra "publicar"
--    um range num time do qual a pessoa não faz parte.
drop policy if exists ranges_insert_own on public.ranges;
create policy ranges_insert_own on public.ranges
  for insert with check (
    (select auth.uid()) = user_id
    and (team_id is null or public.is_active_team_member(team_id))
  );

drop policy if exists ranges_update_own on public.ranges;
create policy ranges_update_own on public.ranges
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (team_id is null or public.is_active_team_member(team_id))
  );

-- 3) "Seu range de verdade": o que a pessoa realmente fez com cada mão,
--    por posição, a partir das mãos importadas (hand_reviews.parsed_data).
--    Olha a primeira ação dela no pré-flop:
--      abrir -> ninguém aumentou nem pagou antes; "fez" = aumentou;
--      pagar -> exatamente um aumento antes; "fez" = pagou;
--      3bet  -> exatamente um aumento antes; "fez" = aumentou.
--    Devolve, por posição e mão, quantas vezes fez e quantas vezes teve a
--    chance -- o peso da mão no range é vezes / oportunidades.
create or replace function public.range_real(p_acao text default 'abrir', p_limite integer default 5000)
returns table (posicao text, mao text, vezes integer, oportunidades integer)
language sql
stable
security invoker
set search_path = public
as $$
  with maos as (
    select h.id, h.parsed_data as pd
    from public.hand_reviews h
    where h.user_id = (select auth.uid())
      and h.parsed_data->>'kind' = 'parsed'
      and case when jsonb_typeof(h.parsed_data->'heroCards') = 'array' then jsonb_array_length(h.parsed_data->'heroCards') else 0 end = 2
    order by h.created_at desc
    limit least(greatest(coalesce(p_limite, 5000), 1), 20000)
  ),
  acoes as (
    select m.id, m.pd->>'heroName' as heroi, upper(m.pd->>'heroPosition') as posicao, a.value as acao, a.ordinality as ord
    from maos m
    cross join lateral jsonb_array_elements(
      coalesce(
        (select s.value->'actions' from jsonb_array_elements(case when jsonb_typeof(m.pd->'streets') = 'array' then m.pd->'streets' else '[]'::jsonb end) s
         where lower(s.value->>'name') = 'preflop' and jsonb_typeof(s.value->'actions') = 'array' limit 1),
        '[]'::jsonb
      )
    ) with ordinality a
  ),
  primeira as (
    select distinct on (id) id, posicao, ord, acao->>'action' as tipo
    from acoes
    where acao->>'player' = heroi and acao->>'action' not in ('posts', 'uncalled_return', 'shows', 'mucks')
    order by id, ord
  ),
  contexto as (
    select p.id, p.posicao, p.tipo,
      count(*) filter (where a.acao->>'action' in ('raises', 'bets') and a.ord < p.ord) as aumentos,
      count(*) filter (where a.acao->>'action' = 'calls' and a.ord < p.ord) as pagos
    from primeira p
    join acoes a on a.id = p.id
    group by p.id, p.posicao, p.tipo
  ),
  cartas as (
    select m.id,
      upper(substr(m.pd->'heroCards'->>0, 1, 1)) as r1, lower(substr(m.pd->'heroCards'->>0, 2, 1)) as n1,
      upper(substr(m.pd->'heroCards'->>1, 1, 1)) as r2, lower(substr(m.pd->'heroCards'->>1, 2, 1)) as n2
    from maos m
  ),
  rotulo as (
    select id,
      case
        when r1 = r2 then r1 || r2
        when strpos('23456789TJQKA', r1) > strpos('23456789TJQKA', r2) then r1 || r2 || case when n1 = n2 then 's' else 'o' end
        else r2 || r1 || case when n1 = n2 then 's' else 'o' end
      end as mao
    from cartas
    where strpos('23456789TJQKA', r1) > 0 and strpos('23456789TJQKA', r2) > 0
  )
  select c.posicao, r.mao,
    (count(*) filter (where
      case p_acao
        when 'pagar' then c.tipo = 'calls'
        else c.tipo = 'raises'
      end))::integer as vezes,
    count(*)::integer as oportunidades
  from contexto c
  join rotulo r on r.id = c.id
  where c.posicao is not null
    and case p_acao
      when 'abrir' then c.aumentos = 0 and c.pagos = 0
      when 'pagar' then c.aumentos = 1
      when '3bet' then c.aumentos = 1
      else false
    end
  group by c.posicao, r.mao;
$$;

revoke all on function public.range_real(text, integer) from public, anon;
grant execute on function public.range_real(text, integer) to authenticated;

-- 4) Árvores e histórico de versões saíram do produto junto com o
--    Construtor antigo (as duas tabelas estavam vazias). Antes de apagar,
--    tira as duas das funções que ainda falavam delas -- excluir conta e
--    excluir time --, senão elas passariam a dar erro. O resto das duas
--    funções fica igual ao que está no banco hoje.
create or replace function public.delete_team(p_team_id uuid, p_confirmacao text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_team public.teams%rowtype;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;

  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'TIME_INEXISTENTE'; end if;

  if not (v_team.owner_id = auth.uid() or public.is_platform_admin()) then
    raise exception 'SEM_PERMISSAO';
  end if;

  if lower(btrim(coalesce(p_confirmacao, ''))) <> lower(btrim(v_team.name)) then
    raise exception 'CONFIRMACAO_INVALIDA';
  end if;

  insert into public.notifications (user_id, title, body, kind, category)
  select m.user_id,
         'Time encerrado',
         format('O time %s foi excluído pelo dono. Seus treinos, mãos e resultados continuam na sua conta.', v_team.name),
         'info',
         'team'
    from public.team_members m
   where m.team_id = p_team_id and m.status = 'ativo' and m.user_id <> auth.uid();

  delete from public.team_members where team_id = p_team_id;

  update public.team_member_history
     set left_at = coalesce(left_at, now()), team_id = null
   where team_id = p_team_id;

  update public.ranges set team_id = null where team_id = p_team_id;

  delete from public.teams where id = p_team_id;
end;
$function$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sem sessão.';
  end if;

  delete from public.friend_messages where sender_id = uid or recipient_id = uid;
  delete from public.friendships where requester_id = uid or recipient_id = uid;
  delete from public.team_messages where sender_id = uid or recipient_id = uid;
  delete from public.hand_review_share_comments where author_id = uid;
  delete from public.team_card_comments where author_id = uid;
  delete from public.hand_review_shares where shared_by = uid or shared_with = uid;

  delete from public.hand_review_answers where user_id = uid;
  delete from public.hand_review_images where user_id = uid;
  delete from public.hand_review_street_evals where user_id = uid;
  delete from public.hand_review_tag_links where user_id = uid;
  delete from public.hand_review_tags where user_id = uid;
  delete from public.hand_opponent_tags where user_id = uid;
  delete from public.hand_ev_results where user_id = uid;
  delete from public.hand_tags where user_id = uid;
  delete from public.hand_reviews where user_id = uid;
  delete from public.hand_sessions where user_id = uid;
  delete from public.hand_import_batches where user_id = uid;
  delete from public.hand_sync_batches where user_id = uid;
  delete from public.hand_sync_devices where user_id = uid;
  delete from public.tournament_payouts where user_id = uid;

  delete from public.bankroll_annotations where user_id = uid;
  delete from public.bankroll_brm_thresholds where user_id = uid;
  delete from public.bankroll_goals where user_id = uid;
  delete from public.bankroll_sessions where user_id = uid;
  delete from public.bankroll_settings where user_id = uid;
  delete from public.bankroll_study_logs where user_id = uid;
  delete from public.bankroll_transactions where user_id = uid;

  delete from public.range_adherence_runs where user_id = uid;
  delete from public.range_drill_answers where user_id = uid;
  delete from public.ranges where user_id = uid;

  delete from public.drill_results where user_id = uid;
  delete from public.training_sessions where user_id = uid;
  delete from public.user_achievements where user_id = uid;
  delete from public.user_missions where user_id = uid;
  delete from public.user_progress where user_id = uid;
  delete from public.xp_events where user_id = uid;
  delete from public.leaderboard_season_winners where user_id = uid;
  delete from public.player_postflop_stats where user_id = uid;
  delete from public.player_preflop_stats where user_id = uid;
  delete from public.player_stats where user_id = uid;
  delete from public.product_tags where user_id = uid;

  delete from public.marketplace_applications where user_id = uid;
  delete from public.marketplace_favorites where user_id = uid;

  delete from public.team_alerts where player_id = uid;
  delete from public.team_event_participants where player_id = uid;
  delete from public.team_player_card_history where player_id = uid;
  delete from public.team_player_goals where player_id = uid;
  delete from public.team_training_assignments where player_id = uid;
  delete from public.team_player_score_snapshots where player_id = uid;
  delete from public.team_membership_history where user_id = uid;
  delete from public.team_members where user_id = uid;

  delete from public.notifications where user_id = uid;
  delete from public.user_plans where user_id = uid;

  delete from public.profiles where id = uid;
end;
$function$;

drop table if exists public.range_versions;
drop table if exists public.strategy_trees;
