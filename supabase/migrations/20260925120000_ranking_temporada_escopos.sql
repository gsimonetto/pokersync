-- Ranking da temporada com recortes (geral / amigos / time) e movimento.
--
-- Substitui, na tela do Hub, a dupla get_leaderboard_period('season') +
-- get_my_leaderboard_rank('season'). Essas duas continuam existindo (sem
-- mudança) pra quem ainda chama.
--
-- O que esta função entrega a mais, numa chamada só:
--   * foto (avatar_id / avatar_url) de cada jogador e o XP do nível
--     atual (xp_nivel), pro anel de nível em volta da foto;
--   * xp_7d  -- XP ganho nos últimos 7 dias dentro da temporada (ritmo);
--   * rank_7d -- posição que o jogador tinha 7 dias atrás, no MESMO
--     recorte. A tela compara com a posição de hoje pra mostrar
--     "subiu / caiu". Nulo quando ele ainda não tinha pontos na época;
--   * a linha do próprio usuário e a dos vizinhos (logo acima e logo
--     abaixo) mesmo fora do top N -- é o que alimenta "faltam X XP
--     pra passar Fulano" pra quem está lá embaixo;
--   * total -- quantos jogadores pontuaram no recorte.
--
-- Recortes (p_scope):
--   'global' -- todo mundo que pontuou na temporada;
--   'amigos' -- você + amizades aceitas (inclusive quem ainda está
--               zerado, que aparece sem posição no fim da lista);
--   'time'   -- você + membros ativos do seu time (mesma regra).
-- Sem temporada ativa (ou 'time' sem time) volta vazio.
--
-- Só leitura. Expõe o mesmo que o ranking atual já expõe (apelido,
-- nível, streak, títulos) mais a foto, que já é pública no app.

create or replace function public.get_season_ranking(
  p_scope text default 'global',
  p_limit int default 50
)
returns table (
  user_id uuid,
  name text,
  avatar_id int,
  avatar_url text,
  level int,
  xp_nivel int,
  xp int,
  xp_7d int,
  rank int,
  rank_7d int,
  streak_days int,
  champion_seasons int[],
  is_me boolean,
  total int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_desde timestamptz;
  v_ate timestamptz;
  v_corte timestamptz := now() - interval '7 days';
  v_team uuid;
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if v_uid is null then
    raise exception 'NAO_AUTENTICADO';
  end if;
  if p_scope is null or p_scope not in ('global', 'amigos', 'time') then
    raise exception 'ESCOPO_INVALIDO';
  end if;

  select s.starts_at::timestamptz, (s.ends_at + 1)::timestamptz
    into v_desde, v_ate
    from public.get_active_season() s;
  if v_desde is null then
    return;
  end if;

  if p_scope = 'time' then
    select tm.team_id into v_team
      from public.team_members tm
     where tm.user_id = v_uid and tm.status = 'ativo'
     limit 1;
    if v_team is null then
      return;
    end if;
  end if;

  return query
  with pontos as (
    select xe.user_id as uid,
           sum(xe.xp_final)::int as xp,
           coalesce(sum(xe.xp_final) filter (where xe.created_at >= v_corte), 0)::int as xp_7d,
           coalesce(sum(xe.xp_final) filter (where xe.created_at < v_corte), 0)::int as xp_antes
      from public.xp_events xe
     where xe.created_at >= v_desde
       and xe.created_at < v_ate
     group by xe.user_id
  ),
  populacao as (
    select v_uid as uid
    union
    select case when f.requester_id = v_uid then f.recipient_id else f.requester_id end
      from public.friendships f
     where p_scope = 'amigos'
       and f.status = 'aceito'
       and v_uid in (f.requester_id, f.recipient_id)
    union
    select tm.user_id
      from public.team_members tm
     where p_scope = 'time'
       and tm.team_id = v_team
       and tm.status = 'ativo'
    union
    select pt.uid from pontos pt where p_scope = 'global' and pt.xp > 0
  ),
  base as (
    select po.uid,
           coalesce(pt.xp, 0) as xp,
           coalesce(pt.xp_7d, 0) as xp_7d,
           coalesce(pt.xp_antes, 0) as xp_antes,
           coalesce(up.level, 1) as level,
           coalesce(up.xp_current, 0) as xp_nivel,
           coalesce(up.streak_days, 0) as streak_days
      from populacao po
      left join pontos pt on pt.uid = po.uid
      left join public.user_progress up on up.user_id = po.uid
  ),
  ranqueado as (
    select b.*,
           case when b.xp > 0 then
             (row_number() over (order by (b.xp > 0) desc, b.xp desc, b.level desc, b.uid))::int
           end as rk,
           case when b.xp_antes > 0 then
             (row_number() over (order by (b.xp_antes > 0) desc, b.xp_antes desc, b.level desc, b.uid))::int
           end as rk7,
           (count(*) filter (where b.xp > 0) over ())::int as tot
      from base b
  ),
  eu as (
    select r.rk from ranqueado r where r.uid = v_uid
  ),
  campeoes as (
    select w.user_id as uid,
           array_agg(sn.season_number::int order by sn.season_number) as seasons
      from public.leaderboard_season_winners w
      join public.leaderboard_seasons_numbered sn on sn.id = w.season_id
     group by w.user_id
  )
  select r.uid,
         coalesce(nullif(p.apelido, ''), nullif(p.nome, ''), 'Jogador'),
         p.avatar_id::int,
         p.avatar_url,
         r.level::int,
         r.xp_nivel::int,
         r.xp,
         r.xp_7d,
         r.rk,
         r.rk7,
         r.streak_days::int,
         coalesce(c.seasons, '{}'::int[]),
         r.uid = v_uid,
         r.tot
    from ranqueado r
    left join public.profiles p on p.id = r.uid
    left join campeoes c on c.uid = r.uid
   where r.rk <= v_limit
      or r.uid = v_uid
      -- vizinhos do usuário, pra "faltam X pra passar Fulano"
      or r.rk between (select eu.rk from eu) - 1 and (select eu.rk from eu) + 1
      -- amigos/time: lista é curta, mostra todo mundo (zerados no fim)
      or (p_scope <> 'global' and r.rk is null)
   order by r.rk nulls last, 2;
end;
$$;

revoke all on function public.get_season_ranking(text, int) from public, anon;
grant execute on function public.get_season_ranking(text, int) to authenticated, service_role;
