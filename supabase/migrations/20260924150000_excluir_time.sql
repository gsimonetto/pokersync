-- Excluir time (Gestão do time > Zona de perigo > Excluir time).
--
-- Um DELETE direto em teams até funciona (o resto sai por cascata e o
-- histórico/ranges/árvores ficam com team_id nulo), mas não confere quem
-- pede nem avisa ninguém, e o histórico do Marketplace grava "Time
-- removido" em vez do nome. Esta função faz a exclusão na ordem certa,
-- numa transação só:
--   1) confere que quem pede é o DONO do time (mesma regra da policy
--      teams_delete_owner) e que digitou o nome do time;
--   2) avisa os membros por notificação;
--   3) tira os membros -- os gatilhos de team_members gravam a saída no
--      histórico com o nome do time enquanto ele ainda existe;
--   4) solta o vínculo do histórico (o nome do time fica guardado nele,
--      a ficha já mostra "time antigo" assim) e descompartilha ranges e
--      árvores (continuam com os donos, só deixam de ser do time);
--   5) apaga o time -- o resto (convites, etiquetas, metas, mensagens,
--      eventos, funil, vagas do Marketplace...) sai junto por cascata.
--
-- A assinatura do plano Team é da CONTA (user_plans), não do time: nada
-- de cobrança muda aqui.

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
  update public.strategy_trees set team_id = null where team_id = p_team_id;

  delete from public.teams where id = p_team_id;
end;
$function$;

revoke all on function public.delete_team(uuid, text) from public, anon;
grant execute on function public.delete_team(uuid, text) to authenticated, service_role;
