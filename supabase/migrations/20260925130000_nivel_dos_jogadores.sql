-- Nível de uma lista de jogadores, pro anel em volta da foto.
--
-- Toda foto de jogador no app ganha um anel na cor da patente
-- (levelColor) preenchido com o progresso até o próximo nível
-- (xp_current / xp_for_next_level). As telas que mostram outros
-- jogadores (time, conversas, vagas, convites...) não recebiam esse dado
-- -- user_progress só deixa cada um ler a própria linha. Esta função
-- devolve só nível e XP do nível atual, que já são públicos no ranking.
--
-- Só leitura; até 500 ids por chamada; ids desconhecidos simplesmente
-- não voltam.

create or replace function public.get_players_level(p_ids uuid[])
returns table (user_id uuid, level int, xp_current int)
language sql
stable
security definer
set search_path = public
as $$
  select up.user_id, up.level::int, up.xp_current::int
    from public.user_progress up
   where auth.uid() is not null
     and up.user_id = any (p_ids[1:500]);
$$;

revoke all on function public.get_players_level(uuid[]) from public, anon;
grant execute on function public.get_players_level(uuid[]) to authenticated, service_role;
