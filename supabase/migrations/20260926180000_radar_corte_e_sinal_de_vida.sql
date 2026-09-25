-- Radar PokerSync: escolha do que importar valendo de verdade (agora com
-- 3 opções) + sinal de vida.
--
-- 1) profiles.radar_import_scope ganha a opção "last_3_months" (pedido
--    explícito: "só de agora em diante", "últimos 3 meses" e "tudo") e
--    profiles.radar_import_scope_since guarda o corte: o instante da
--    escolha (from_now) ou esse instante menos 3 meses (last_3_months).
--    Antes a escolha só destravava o envio (as rotas /api/agent/sync*
--    recusavam tudo enquanto radar_import_scope era null) — nada filtrava
--    por data, e o histórico inteiro do computador entrava do mesmo jeito.
--    Agora as rotas descartam mão/torneio jogado antes do corte (com folga
--    de fuso, ver jogadoAntesDoCorte em lib/supabase/agent-import-scope.ts).
--    O corte é gravado por trigger (hora do banco, não do navegador nem do
--    Radar) sempre que a escolha muda; quem já tinha "from_now" antes desta
--    migration fica com o corte em agora (nada já importado é apagado).
--
-- 2) hand_sync_devices.last_seen_at: o sinal de vida do Radar (POST
--    /api/agent/ping a cada ~5 min enquanto o computador está ligado).
--    last_sync_at continua sendo "chegou mão/torneio"; sem o sinal de vida,
--    a Gestão de Banca mostrava "Radar" verde mesmo com ele parado havia dias.
--
-- Depende de 20260921120000_radar_module_scope (colunas do seletor por
-- módulo), que estava no repositório mas nunca tinha sido aplicada no banco.

alter table public.profiles
  drop constraint if exists profiles_radar_import_scope_check;
alter table public.profiles
  add constraint profiles_radar_import_scope_check
  check (radar_import_scope in ('from_now', 'last_3_months', 'full_history'));

alter table public.profiles
  add column if not exists radar_import_scope_since timestamptz;

update public.profiles
   set radar_import_scope_since = now()
 where radar_import_scope = 'from_now'
   and radar_import_scope_since is null;

create or replace function public.profiles_radar_import_scope_since()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.radar_import_scope is distinct from old.radar_import_scope then
    new.radar_import_scope_since := case new.radar_import_scope
      when 'from_now' then now()
      when 'last_3_months' then now() - interval '3 months'
      else null
    end;
  end if;
  return new;
end;
$$;

-- Função de trigger: ninguém chama direto (mesmo padrão das outras
-- funções de trigger do projeto).
revoke execute on function public.profiles_radar_import_scope_since() from public, anon, authenticated;

drop trigger if exists profiles_radar_import_scope_since on public.profiles;
create trigger profiles_radar_import_scope_since
  before update of radar_import_scope on public.profiles
  for each row execute function public.profiles_radar_import_scope_since();

alter table public.hand_sync_devices
  add column if not exists last_seen_at timestamptz;

update public.hand_sync_devices
   set last_seen_at = last_sync_at
 where last_seen_at is null;
