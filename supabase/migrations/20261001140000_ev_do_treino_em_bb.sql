-- EV do Treino em bb (pedido: "revise como o EV dentro do modo treino é
-- gerado, melhore as informações dos detalhes, queria que fosse bb/100").
--
-- training_sessions.ev_loss guarda a perda na escala do motor (equity de
-- premiação ICM do spot) -- não dá pra comparar nem somar entre stacks
-- diferentes. ev_loss_bb guarda a mesma perda em bb equivalentes, com a
-- conta explicada em lib/poker/ev-em-bb.ts (valorDoBb). Com ela o Treino
-- mostra a perda de cada mão em bb e o ritmo em bb/100.

alter table public.training_sessions add column if not exists ev_loss_bb numeric;

-- Valor de 1 bb na escala do motor, perto do stack do spot: diferença
-- entre o fold de quem abre (stack − blind dele) e o fold do BB
-- (stack − 1 bb), dividida pela diferença de fichas. Mesma conta de
-- valorDoBb() no app.
create or replace function public.icm_por_bb(p_spot_id text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select case when x.fichas > 0 and x.fold_abre - x.fold_bb > 0 then (x.fold_abre - x.fold_bb) / x.fichas end
    from (
      select (d.gto_nodes -> 'sb_open' ->> 'ev_fold')::numeric as fold_abre,
             (d.gto_nodes -> 'bb_jam' ->> 'ev_fold')::numeric as fold_bb,
             case when d.position like 'sb\_%' then 0.5 else 1 end as fichas
        from drills d
       where d.spot_id = p_spot_id
       limit 1
    ) x;
$function$;

-- Preenche ev_loss_bb em toda mão nova. Sem perda = 0 bb em qualquer
-- spot; com perda, só quando o spot tem a régua (senão fica vazio e a
-- mão não entra no bb/100).
create or replace function public.training_sessions_ev_em_bb()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_valor numeric;
begin
  if new.ev_loss is null then
    new.ev_loss_bb := null;
  elsif new.ev_loss = 0 then
    new.ev_loss_bb := 0;
  else
    v_valor := public.icm_por_bb(new.spot_id);
    new.ev_loss_bb := case when v_valor > 0 then round(new.ev_loss / v_valor, 4) end;
  end if;
  return new;
end;
$function$;

drop trigger if exists training_sessions_ev_em_bb on public.training_sessions;
create trigger training_sessions_ev_em_bb
  before insert on public.training_sessions
  for each row execute function public.training_sessions_ev_em_bb();

-- Histórico: mesma conta nas mãos já jogadas. Treinos de julho/agosto
-- sem spot do motor atual ficam vazios (não tem como converter).
update public.training_sessions ts
   set ev_loss_bb = case
         when ts.ev_loss = 0 then 0
         when public.icm_por_bb(ts.spot_id) > 0 then round(ts.ev_loss / public.icm_por_bb(ts.spot_id), 4)
       end
 where ts.ev_loss is not null
   and ts.ev_loss_bb is null;

-- Resumo pro Treino: mãos com perda em bb e a soma, no total e hoje
-- (dia de Brasília). bb/100 = perda ÷ mãos × 100, feito no app.
create or replace function public.resumo_ev_treino()
 returns table(maos integer, perda_bb numeric, maos_hoje integer, perda_bb_hoje numeric)
 language sql
 stable
 set search_path to 'public'
as $function$
  select count(*)::int,
         coalesce(sum(ts.ev_loss_bb), 0),
         (count(*) filter (where (ts.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date))::int,
         coalesce(sum(ts.ev_loss_bb) filter (where (ts.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date), 0)
    from training_sessions ts
   where ts.user_id = auth.uid()
     and ts.ev_loss_bb is not null;
$function$;

revoke all on function public.resumo_ev_treino() from public, anon;
grant execute on function public.resumo_ev_treino() to authenticated;
