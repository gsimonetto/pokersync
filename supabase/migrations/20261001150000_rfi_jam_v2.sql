-- Motor RFI/Jam v2 (pokersync-solver, engine/rfi_jam_v2.py, 2026-10):
-- ante de 1 bb, BB pode pagar o raise (com realização de equity) e quem
-- abre pode ir all-in direto. Pedido: "Essas mãos são all in e não raise"
-- (BTN vs BB com 10 bb, o motor antigo só comparava fold com raise 2,2).
--
-- Os spots (mesmos spot_id dos antigos, rfi_jam_<matchup>_<stack>bb) estão
-- em supabase/seed/rfi_jam_v2.json e entram no banco pelo carregamento no
-- fim deste arquivo (lê o JSON publicado no GitHub com pg_net).
--
-- Régua de bb: com ante a conta antiga (diferença entre os folds) não vale
-- mais; o motor v2 grava o valor de 1 bb em gto_nodes.icm_por_bb. A função
-- usa esse valor quando existe (mesma regra de valorDoBb no app).

create or replace function public.icm_por_bb(p_spot_id text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(
           nullif((d.gto_nodes ->> 'icm_por_bb')::numeric, 0),
           case when x.fichas > 0 and x.fold_abre - x.fold_bb > 0 then (x.fold_abre - x.fold_bb) / x.fichas end
         )
    from drills d
    cross join lateral (
      select (d.gto_nodes -> 'sb_open' ->> 'ev_fold')::numeric as fold_abre,
             (d.gto_nodes -> 'bb_jam' ->> 'ev_fold')::numeric as fold_bb,
             case when d.position like 'sb\_%' then 0.5 else 1 end as fichas
    ) x
   where d.spot_id = p_spot_id
   limit 1;
$function$;

-- Carrega os spots v2 a partir do JSON (upsert por spot_id). Chamada uma
-- vez depois do merge, com o conteúdo de supabase/seed/rfi_jam_v2.json.
create or replace function public.carregar_spots_rfi_jam(p_rows jsonb)
 returns integer
 language sql
 set search_path to 'public'
as $function$
  with dados as (
    select r from jsonb_array_elements(p_rows) r
  ), up as (
    insert into drills (spot_id, board, pot, effective_stack, gto_nodes, solution, format, stack_bb, position,
                        street, action, engine_version, exploitability, solver_job_id, generated_at)
    select r ->> 'spot_id', array(select jsonb_array_elements_text(coalesce(r -> 'board', '[]'::jsonb))),
           (r ->> 'pot')::numeric, (r ->> 'effective_stack')::numeric, r -> 'gto_nodes',
           r ->> 'solution', r ->> 'format', (r ->> 'stack_bb')::int, r ->> 'position', r ->> 'street', r ->> 'action',
           r ->> 'engine_version', (r ->> 'exploitability')::numeric, (r ->> 'solver_job_id')::uuid,
           (r ->> 'generated_at')::timestamptz
      from dados
    on conflict (spot_id) do update
       set pot = excluded.pot, effective_stack = excluded.effective_stack, gto_nodes = excluded.gto_nodes,
           stack_bb = excluded.stack_bb, position = excluded.position, action = excluded.action,
           engine_version = excluded.engine_version, exploitability = excluded.exploitability,
           generated_at = excluded.generated_at
    returning 1
  )
  select count(*)::int from up;
$function$;

revoke all on function public.carregar_spots_rfi_jam(jsonb) from public, anon, authenticated;
