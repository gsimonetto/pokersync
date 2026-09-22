-- Escopo do Radar POR MÓDULO (Gestão de Banca, Revisor de Mãos, Performance).
--
-- Já existia profiles.radar_import_scope (global, controla se o Agente
-- desktop varre só o que acontecer a partir de agora ou também o
-- histórico do computador) -- essa continua existindo e continua sendo
-- quem manda no que o Agente de fato importa (ver
-- lib/supabase/agent-import-scope.ts e app/api/agent/sync*).
--
-- As colunas abaixo são um filtro de EXIBIÇÃO independente por módulo,
-- por cima do que já foi importado: cada módulo decide, sozinho, se
-- mostra tudo que já entrou (full_history) ou só o que foi jogado a
-- partir do momento em que o jogador clicou (from_now, com o instante
-- gravado em *_since). Não depende do Agente rodar de novo -- é
-- instantâneo porque só filtra dado que já está no banco.
--
-- null = jogador ainda não mexeu nesse botão no módulo -- nesse caso o
-- módulo continua mostrando tudo (comportamento de sempre), pra não
-- esconder dado de quem nunca viu esse botão novo.
alter table public.profiles
  add column if not exists radar_scope_banca text check (radar_scope_banca in ('from_now', 'full_history')),
  add column if not exists radar_scope_banca_since timestamptz,
  add column if not exists radar_scope_revisor text check (radar_scope_revisor in ('from_now', 'full_history')),
  add column if not exists radar_scope_revisor_since timestamptz,
  add column if not exists radar_scope_performance text check (radar_scope_performance in ('from_now', 'full_history')),
  add column if not exists radar_scope_performance_since timestamptz;
