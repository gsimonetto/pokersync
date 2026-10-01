-- "Seu range de verdade" separado por tipo de aumento e por stack (pedido
-- do jogador, 2026-10: uma mão em que o SB aumentou normal e o BB pagou
-- abria no Construtor o range "BB paga all-in vs SB" -- "não pode trazer
-- nada errado aqui"; "precisa ser verificado o stack pra buscar o range").
--
-- range_real ganha p_contra (só em pagar e 3-bet, com um aumento só antes
-- do herói e ninguém pagando entre o aumento e ele):
--   'aumento'  o aumento foi normal
--   'allin'    o aumento foi all-in
--   null       os dois (o de antes, usado nas outras telas)
-- e p_stack (BB): só as mãos com stack efetivo parecido -- o maior até 25%
-- acima do menor, a mesma folga do Construtor (lib/ranges/link-da-mao.ts).
-- Stack efetivo: o menor entre o herói e quem aumentou; sem aumento, o
-- maior stack de quem ainda não tinha foldado.
-- A versão antiga (2 parâmetros) sai pra chamada sem p_contra não ficar
-- ambígua; a nova aceita as mesmas chamadas de antes.
drop function if exists public.range_real(text, integer);

create or replace function public.range_real(p_acao text default 'abrir', p_limite integer default 5000, p_contra text default null, p_stack numeric default null)
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
      count(*) filter (where a.acao->>'action' = 'calls' and a.ord < p.ord) as pagos,
      -- o aumento antes do herói (com um só): foi all-in? e alguém pagou
      -- entre ele e o herói?
      bool_or(a.acao->>'action' in ('raises', 'bets') and a.ord < p.ord and coalesce(a.acao->>'isAllIn', 'false') = 'true') as aumento_allin,
      min(a.ord) filter (where a.acao->>'action' in ('raises', 'bets') and a.ord < p.ord) as ord_aumento,
      p.ord as ord_heroi,
      (array_agg(a.acao->>'player' order by a.ord) filter (where a.acao->>'action' in ('raises', 'bets') and a.ord < p.ord))[1] as agressor,
      coalesce(array_agg(a.acao->>'player') filter (where a.acao->>'action' = 'folds' and a.ord < p.ord), '{}') as foldaram
    from primeira p
    join acoes a on a.id = p.id
    group by p.id, p.posicao, p.tipo, p.ord
  ),
  pagos_depois as (
    select c.id, count(a.*) filter (where a.acao->>'action' = 'calls' and a.ord > c.ord_aumento and a.ord < c.ord_heroi) as n
    from contexto c
    join acoes a on a.id = c.id
    group by c.id
  ),
  stacks as (
    select c.id,
      nullif((m.pd->>'bigBlind')::numeric, 0) as bb,
      (select (st.value->>'startingChips')::numeric from jsonb_array_elements(case when jsonb_typeof(m.pd->'seats') = 'array' then m.pd->'seats' else '[]'::jsonb end) st
       where st.value->>'isHero' = 'true' limit 1) as heroi,
      case when c.agressor is not null then
        (select (st.value->>'startingChips')::numeric from jsonb_array_elements(case when jsonb_typeof(m.pd->'seats') = 'array' then m.pd->'seats' else '[]'::jsonb end) st
         where st.value->>'playerName' = c.agressor limit 1)
      else
        (select max((st.value->>'startingChips')::numeric) from jsonb_array_elements(case when jsonb_typeof(m.pd->'seats') = 'array' then m.pd->'seats' else '[]'::jsonb end) st
         where st.value->>'isHero' is distinct from 'true' and not (st.value->>'playerName' = any (c.foldaram)))
      end as rival
    from contexto c
    join maos m on m.id = c.id
  ),
  efetivo as (
    select id, least(heroi, coalesce(nullif(rival, 0), heroi)) / bb as bb_efetivo
    from stacks
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
  join pagos_depois pd on pd.id = c.id
  join efetivo e on e.id = c.id
  where c.posicao is not null
    and (p_stack is null or (
      e.bb_efetivo > 0 and p_stack > 0
      and greatest(e.bb_efetivo, p_stack) / least(e.bb_efetivo, p_stack) <= 1.25
    ))
    and case p_contra
      when 'aumento' then not coalesce(c.aumento_allin, false) and pd.n = 0
      when 'allin' then coalesce(c.aumento_allin, false) and pd.n = 0
      else true
    end
    and case p_acao
      when 'abrir' then c.aumentos = 0 and c.pagos = 0
      when 'pagar' then c.aumentos = 1
      when '3bet' then c.aumentos = 1
      else false
    end
  group by c.posicao, r.mao;
$$;

revoke all on function public.range_real(text, integer, text, numeric) from public, anon;
grant execute on function public.range_real(text, integer, text, numeric) to authenticated;
