-- Preferências da mesa (Treino e Revisor) na conta, pra acompanharem a
-- pessoa em qualquer aparelho: cor do feltro, baralho de 2/4 cores, valores
-- em BB ou fichas, velocidade das animações e tempo pra decidir. O app
-- guarda um objeto pequeno (ver lib/hooks/use-preferencias-mesa.ts) e
-- valida cada campo ao ler -- valor estranho volta pro padrão.
--
-- Sem policy nova: a linha de profiles já só é lida/atualizada pelo próprio
-- dono (profiles_own_select / profiles_own_update). O check só garante que
-- é um objeto e que não cresce além do necessário.
alter table public.profiles
  add column if not exists preferencias_mesa jsonb;

alter table public.profiles
  drop constraint if exists profiles_preferencias_mesa_objeto;

alter table public.profiles
  add constraint profiles_preferencias_mesa_objeto
  check (
    preferencias_mesa is null
    or (jsonb_typeof(preferencias_mesa) = 'object' and pg_column_size(preferencias_mesa) <= 2048)
  );
