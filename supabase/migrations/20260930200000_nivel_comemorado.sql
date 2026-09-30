-- Comemoração de subida de nível uma vez só, por conta.
--
-- Antes o Hub guardava o "último nível visto" no navegador: trocar de
-- aparelho, limpar o navegador ou usar duas contas no mesmo navegador
-- fazia a animação aparecer de novo. Agora o último nível comemorado
-- fica em user_progress e só sobe.

alter table public.user_progress add column if not exists nivel_comemorado integer;

-- Quem já joga não ganha uma comemoração surpresa no primeiro acesso.
update public.user_progress set nivel_comemorado = level where nivel_comemorado is null;

create or replace function public.marcar_nivel_comemorado(p_nivel integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_progress
     set nivel_comemorado = greatest(coalesce(nivel_comemorado, 0), least(p_nivel, level))
   where user_id = auth.uid();
$$;

revoke all on function public.marcar_nivel_comemorado(integer) from public, anon;
grant execute on function public.marcar_nivel_comemorado(integer) to authenticated;
