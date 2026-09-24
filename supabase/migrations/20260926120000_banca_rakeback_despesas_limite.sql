-- Gestão de Banca: rakeback, bônus e despesas como movimentações, e
-- limite de perda do dia.
--
-- Só acrescenta: os tipos antigos (deposito/saque/caixinha) continuam
-- valendo e nenhuma linha existente muda.

alter table public.bankroll_transactions drop constraint if exists bankroll_transactions_type_check;
alter table public.bankroll_transactions
  add constraint bankroll_transactions_type_check
  check (type = any (array['deposito', 'saque', 'caixinha', 'rakeback', 'bonus', 'despesa']));

-- Categoria da despesa (coach, software, viagem, outros). Null nos demais tipos.
alter table public.bankroll_transactions add column if not exists category text;

-- Limite de perda do dia em buy-ins; null = desligado.
alter table public.bankroll_settings
  add column if not exists stop_loss_buyins numeric
  check (stop_loss_buyins is null or stop_loss_buyins > 0);
