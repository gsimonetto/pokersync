-- Nível nunca baixa.
--
-- A migration 20260930120000 recalculou o nível de todo mundo pela curva
-- nova (mais difícil) e quem já jogava caiu de nível (ex.: 13 -> 10, de
-- Prata pra Bronze). Aqui:
--   1) devolve o nível que cada um tinha pela curva antiga (60 * L^1.3),
--      mantendo a mesma fração de progresso até o próximo nível, sem
--      disparar a comemoração (é devolução, não conquista);
--   2) trava no banco: nenhum UPDATE consegue baixar o nível, em nenhuma
--      hipótese (nem virada de temporada, nem prestígio);
--   3) tarefas nunca dependem do nível: a meta é a mesma pra todo mundo
--      (goal_scale sempre 0), senão quem está no nível 88 teria tarefas
--      mais pesadas que um iniciante a cada temporada nova.

do $$
declare
  r record;
  v_level integer;
  v_resto bigint;
  v_need integer;
begin
  for r in select user_id, level, xp_total from public.user_progress loop
    v_level := 1;
    v_resto := greatest(coalesce(r.xp_total, 0), 0);
    loop
      v_need := round(60 * power(v_level, 1.3))::integer;
      exit when v_resto < v_need or v_level >= 99;
      v_resto := v_resto - v_need;
      v_level := v_level + 1;
    end loop;
    if v_level > r.level then
      update public.user_progress
         set level = v_level,
             xp_current = floor(v_resto::numeric / v_need * public.xp_for_next_level(v_level))::integer,
             nivel_comemorado = v_level
       where user_id = r.user_id;
    end if;
  end loop;
end $$;

create or replace function public.nivel_nunca_baixa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.level < old.level then
    new.level := old.level;
    new.xp_current := old.xp_current;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nivel_nunca_baixa on public.user_progress;
create trigger trg_nivel_nunca_baixa
  before update of level on public.user_progress
  for each row execute function public.nivel_nunca_baixa();

update public.missions set goal_scale = 0 where goal_scale <> 0;
alter table public.missions drop constraint if exists missions_meta_igual_pra_todos;
alter table public.missions add constraint missions_meta_igual_pra_todos check (goal_scale = 0);
