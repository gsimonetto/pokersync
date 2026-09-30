-- Correções pedidas pelo jogador (2026-09):
--
-- 1) Rebuys: hand_sessions não guardava quantos rebuys/re-entries o
--    jogador fez num torneio (o buy-in do hand history é só o da entrada
--    inicial). Agora o número é detectado sozinho a partir das mãos -- o
--    herói perde todas as fichas e volta a aparecer no mesmo torneio (ver
--    lib/poker/rebuy-detector.ts) -- e usado no custo do torneio no
--    Performance e na Gestão de Banca. reentries_checked_at marca os
--    torneios que já passaram pelo detector; os antigos (null) são
--    calculados uma vez na próxima vez que aparecerem na tela.
--
-- 2) Spin & Go: table_size guarda o tamanho da mesa declarado nas mãos
--    ("3-max" = Spin & Go). Preenchido pras sessões que já existem a
--    partir das mãos salvas.
--
-- 3) Performance: performance_reset_at guarda quando o jogador usou
--    "Apagar" no Performance. Tudo jogado antes disso (mãos, torneios,
--    prêmios, sessões) deixa de contar lá -- antes só as estatísticas de
--    mão zeravam e os torneios continuavam somando.
--
-- 4) Bounty gravado 100x maior em mãos em português (ver bloco no fim).
alter table public.hand_sessions
  add column if not exists reentries integer not null default 0,
  add column if not exists reentries_checked_at timestamptz,
  add column if not exists table_size smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hand_sessions_reentries_nao_negativo') then
    alter table public.hand_sessions
      add constraint hand_sessions_reentries_nao_negativo check (reentries >= 0);
  end if;
end $$;

update public.hand_sessions s
set table_size = sub.max_seats
from (
  select hand_session_id, max((parsed_data->>'maxSeats')::int) as max_seats
  from public.hand_reviews
  where hand_session_id is not null
    and parsed_data->>'maxSeats' ~ '^[0-9]+$'
  group by hand_session_id
) sub
where sub.hand_session_id = s.id
  and s.table_size is null;

alter table public.profiles
  add column if not exists performance_reset_at timestamptz;

-- 4) Bounty: em português o client escreve "Bounty de $ 7,50" e o parser
--    tirava a vírgula, gravando 750 (num torneio de $16,50 = 7,50 + 7,50 +
--    1,50, o card mostrava bounty de $750). O parser foi corrigido
--    (valorMonetario em hand-parser.ts); aqui o bounty já gravado é relido
--    do texto da mão mais recente de cada torneio. Vírgula seguida de 1-2
--    dígitos no fim é decimal; senão é separador de milhar.
with ultima as (
  select distinct on (r.hand_session_id)
    r.hand_session_id,
    substring(
      r.hand_history from
      '(?:Seat|Lugar) [0-9]+: '
        || regexp_replace(r.parsed_data->>'heroName', '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
        || ' \([^)]*Bounty (?:of|de) \$ ?([0-9.,]+)'
    ) as bruto
  from public.hand_reviews r
  where r.hand_session_id is not null
    and r.parsed_data->>'heroName' is not null
    and r.hand_history ~ 'Bounty (of|de) \$'
  order by r.hand_session_id, r.created_at desc
)
update public.hand_sessions s
set bounty_current = case
    when u.bruto ~ ',[0-9]{1,2}$' then replace(replace(u.bruto, '.', ''), ',', '.')::numeric
    else replace(u.bruto, ',', '')::numeric
  end
from ultima u
where u.hand_session_id = s.id
  and u.bruto ~ '^[0-9][0-9.,]*$';

-- O retorno da função muda (colunas novas), então precisa recriar.
drop function if exists public.list_hand_sessions_with_count(uuid);

create function public.list_hand_sessions_with_count(p_user_id uuid)
returns table(
  id uuid, user_id uuid, kind text, label text, tournament_id_ps text, format_type text,
  bounty_current numeric, buyin numeric, reentries integer, reentries_checked_at timestamptz, table_size smallint,
  stakes text, created_at timestamptz, updated_at timestamptz,
  champion boolean, final_place smallint, reached_ft boolean, hand_count bigint, last_hand_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    s.id, s.user_id, s.kind, s.label, s.tournament_id_ps, s.format_type,
    s.bounty_current, s.buyin, s.reentries, s.reentries_checked_at, s.table_size,
    s.stakes, s.created_at, s.updated_at,
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
