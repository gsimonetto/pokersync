-- Lançamento: todo mundo começa junto em 05/01/2027.
--
-- Até o lançamento não há temporada valendo: o ranking fica fechado e o
-- sorteio só usa o acervo de tarefas (as sazonais esperam a temporada 1).
--   1) apaga a temporada de teste (Ago–Out 2026, sem campeão nem lembrete);
--   2) a temporada do prêmio "1 ano de assinatura" vira a Temporada 1:
--      05/01/2027 a 04/04/2027;
--   3) tarefas sazonais renumeradas pra estrear junto: 2->1, 3->2, 4->3;
--   4) no dia do lançamento (00:00 UTC, antes do sorteio das 00:05) um job
--      zera o progresso de todo mundo -- nível 1, 0 XP, sequências,
--      tarefas e conquistas -- e se desliga. É a única vez em que o nível
--      desce; a trava "nível nunca baixa" só abre dentro dessa função.

delete from public.leaderboard_seasons
 where reward_title = 'Temporada Ago–Out 2026'
   and not exists (select 1 from public.leaderboard_season_winners w where w.season_id = leaderboard_seasons.id);

update public.leaderboard_seasons
   set starts_at = date '2027-01-05', ends_at = date '2027-04-04'
 where reward_title = '1 ano de assinatura PokerSync';

update public.missions set temporada = temporada - 1 where temporada in (2, 3, 4);
update public.missions set code = regexp_replace(code, '^t([234])_', 's' || (substring(code from 2 for 1)::int - 1) || '_')
 where code ~ '^t[234]_';

-- A trava aceita uma exceção explícita, ligada só dentro da transação do
-- lançamento (set_config local).
create or replace function public.nivel_nunca_baixa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.level < old.level and coalesce(current_setting('pokersync.lancamento', true), '') <> 'zerar' then
    new.level := old.level;
    new.xp_current := old.xp_current;
  end if;
  return new;
end;
$$;

create table if not exists public.lancamento (
  id boolean primary key default true check (id),
  data date not null,
  zerado_em timestamptz
);
alter table public.lancamento enable row level security;
insert into public.lancamento (data) values (date '2027-01-05')
on conflict (id) do update set data = excluded.data;

create or replace function public.zerar_para_lancamento()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data date;
  v_feito timestamptz;
begin
  select data, zerado_em into v_data, v_feito from public.lancamento;
  if v_data is null or v_feito is not null or current_date < v_data then
    return;
  end if;

  perform set_config('pokersync.lancamento', 'zerar', true);

  delete from public.user_missions where true;
  delete from public.user_achievements where true;
  delete from public.xp_events where true;
  update public.user_progress
     set level = 1, xp_current = 0, xp_total = 0, streak_days = 0, streak_best = 0,
         combo_gto = 0, prestige_count = 0, last_activity_at = null, nivel_comemorado = 1
   where true;

  update public.lancamento set zerado_em = now();
  perform cron.unschedule('lancamento-zerar');
end;
$$;

revoke all on function public.zerar_para_lancamento() from public, anon, authenticated;

select cron.unschedule('lancamento-zerar') where exists (select 1 from cron.job where jobname = 'lancamento-zerar');
select cron.schedule('lancamento-zerar', '0 0 5 1 *', 'select public.zerar_para_lancamento();');
