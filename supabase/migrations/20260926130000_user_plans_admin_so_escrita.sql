-- A policy do admin em user_plans valia pra TODOS os comandos (FOR ALL),
-- inclusive leitura: com ela o admin enxergava a linha de plano de todo
-- mundo, e a leitura do "meu plano" no app (sem filtro de user_id, que
-- confia no RLS) recebia varias linhas e caia no Free -- o admin ficava
-- com os modulos bloqueados mesmo no plano mais alto. O uso real dela e'
-- so' ESCRITA manual; a leitura do proprio plano continua com
-- user_plans_select_own, igual pra qualquer usuario.
drop policy if exists user_plans_admin_write on public.user_plans;

create policy user_plans_admin_insert on public.user_plans
  for insert
  with check ((auth.jwt() ->> 'email') = 'gsimonetto1@gmail.com');

create policy user_plans_admin_update on public.user_plans
  for update
  using ((auth.jwt() ->> 'email') = 'gsimonetto1@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'gsimonetto1@gmail.com');

create policy user_plans_admin_delete on public.user_plans
  for delete
  using ((auth.jwt() ->> 'email') = 'gsimonetto1@gmail.com');
