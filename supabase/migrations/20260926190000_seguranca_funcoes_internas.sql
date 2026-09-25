-- Segurança: funções do banco que qualquer pessoa conseguia chamar pela
-- API pública (/rest/v1/rpc/...), inclusive SEM login, e que rodam com
-- poder de administrador (SECURITY DEFINER) sem conferir quem pediu.
--
-- 1) Funções internas, só usadas por gatilhos (triggers) do próprio banco.
--    Ninguém de fora deveria chamar. Antes, qualquer um podia:
--    - update_mission_progress: completar missões e dar XP pra qualquer
--      jogador (ranking manipulável);
--    - bump_player_stat / bump_postflop_stat / apply_hand_tags_delta:
--      bagunçar as estatísticas (VPIP, PFR, c-bet...) de qualquer jogador;
--    - sync_hand_opponent_tags: apagar/recalcular as marcações de
--      adversários da mão de outra pessoa.
--    Os gatilhos continuam funcionando: eles rodam como dono da função, e
--    o dono não perde a permissão.
revoke execute on function public.update_mission_progress(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.bump_player_stat(uuid, text, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.bump_postflop_stat(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.apply_hand_tags_delta(public.hand_tags, integer) from public, anon, authenticated;
revoke execute on function public.sync_hand_opponent_tags(uuid) from public, anon, authenticated;

-- 2) list_hand_sessions_with_count: a fila do Revisor usa, mas a função
--    devolvia os torneios/sessões (buy-in, stakes, colocação) de QUALQUER
--    jogador cujo id fosse passado -- até sem login. Agora só devolve os
--    do próprio jogador logado; pedido pelo id de outra pessoa volta vazio.
create or replace function public.list_hand_sessions_with_count(p_user_id uuid)
returns table(
  id uuid, user_id uuid, kind text, label text, tournament_id_ps text, format_type text,
  bounty_current numeric, buyin numeric, stakes text, created_at timestamptz, updated_at timestamptz,
  champion boolean, final_place smallint, reached_ft boolean, hand_count bigint, last_hand_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    s.id, s.user_id, s.kind, s.label, s.tournament_id_ps, s.format_type,
    s.bounty_current, s.buyin, s.stakes, s.created_at, s.updated_at,
    s.champion, s.final_place, s.reached_ft,
    coalesce(count(r.id), 0) as hand_count,
    max(r.created_at) as last_hand_at
  from public.hand_sessions s
  left join public.hand_reviews r on r.hand_session_id = s.id
  where s.user_id = p_user_id
    and p_user_id = auth.uid()
  group by s.id
  order by s.updated_at desc
$function$;

revoke execute on function public.list_hand_sessions_with_count(uuid) from public, anon;
grant execute on function public.list_hand_sessions_with_count(uuid) to authenticated;
