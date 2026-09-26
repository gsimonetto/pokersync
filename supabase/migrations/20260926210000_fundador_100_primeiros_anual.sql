-- Membro Fundador: só os 100 primeiros que fizerem o pagamento ANUAL no
-- primeiro mês (pedido explícito). Antes, todo checkout de plano pago
-- ganhava o selo, sem limite e sem prazo.
--
-- Regra (aplicada aqui no banco, de forma atômica, pra nunca passar de 100
-- mesmo com dois pagamentos chegando no mesmo instante):
--   * só conta concessão vinda de pagamento (origem = 'pagamento');
--     as concedidas à mão (admin, contas de demonstração) ficam como
--     'manual' e não ocupam vaga;
--   * o "primeiro mês" começa no primeiro pagamento anual que virar
--     fundador e dura 1 mês;
--   * no máximo 100 fundadores por pagamento.
-- Quem confere se o pagamento é anual é o webhook do Stripe
-- (app/api/billing/webhook), antes de chamar conceder_fundador().

alter table public.user_achievements
  add column if not exists origem text not null default 'manual'
  check (origem in ('manual', 'pagamento'));

comment on column public.user_achievements.origem is
  'manual = concedida à mão (não conta no limite); pagamento = concedida pelo webhook do Stripe.';

create or replace function public.conceder_fundador(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_total int;
begin
  -- Um pagamento por vez: garante o limite de 100 sem corrida.
  perform pg_advisory_xact_lock(hashtext('conceder_fundador'));

  if exists (select 1 from user_achievements where user_id = p_user and achievement_code = 'founder') then
    return false;
  end if;

  select min(unlocked_at), count(*) into v_inicio, v_total
  from user_achievements
  where achievement_code = 'founder' and origem = 'pagamento';

  if v_total >= 100 then
    return false;
  end if;
  if v_inicio is not null and now() > v_inicio + interval '1 month' then
    return false;
  end if;

  insert into user_achievements (user_id, achievement_code, origem)
  values (p_user, 'founder', 'pagamento')
  on conflict (user_id, achievement_code) do nothing;
  return true;
end;
$$;

-- Só o servidor (service role do webhook) concede.
revoke all on function public.conceder_fundador(uuid) from public, anon, authenticated;
grant execute on function public.conceder_fundador(uuid) to service_role;

update public.achievements
set label = 'Membro Fundador',
    description = 'Entre os 100 primeiros a assinar o plano anual no primeiro mês do PokerSync.'
where code = 'founder';
