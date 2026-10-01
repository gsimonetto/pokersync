-- Bounties na Gestão de Banca (pedido do jogador, 2026-10: "os bountys
-- precisam somar no gestor de banca" / "precisa vir automatico essa
-- informação do bounty").
--
-- 1) bankroll_sessions.bounties: o que a sessão rendeu em bounties, à
--    parte do cashout (prêmio por colocação). Soma no resultado, no ROI e
--    no saldo; não conta pro ITM.
-- 2) bounties_dos_torneios(): quanto o herói ganhou em bounties em cada
--    torneio (hand_session), somando heroBountyCashWon das mãos -- a mesma
--    leitura das linhas "X wins $Y for eliminating Z" que a Performance já
--    usa. A Banca preenche sozinha o bounty das sessões importadas com isso.
alter table public.bankroll_sessions
  add column if not exists bounties numeric not null default 0;

create or replace function public.bounties_dos_torneios()
returns table (hand_session_id uuid, valor numeric, quantidade integer)
language sql
stable
security invoker
set search_path = public
as $$
  select h.hand_session_id,
    round(sum(coalesce((h.parsed_data->>'heroBountyCashWon')::numeric, 0)), 2) as valor,
    sum(coalesce((h.parsed_data->>'heroBountiesWon')::numeric, 0))::integer as quantidade
  from public.hand_reviews h
  where h.user_id = (select auth.uid())
    and h.hand_session_id is not null
    and h.parsed_data->>'kind' = 'parsed'
    and jsonb_typeof(h.parsed_data->'heroBountyCashWon') = 'number'
  group by h.hand_session_id
  having sum(coalesce((h.parsed_data->>'heroBountyCashWon')::numeric, 0)) > 0;
$$;

revoke all on function public.bounties_dos_torneios() from public, anon;
grant execute on function public.bounties_dos_torneios() to authenticated;
