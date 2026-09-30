-- Tarefas por temporada: novidades misturadas com o acervo.
--
-- Cada tarefa pode ter `temporada` (número da temporada em que estreia).
--   * null              -> acervo (sempre no sorteio)
--   * = temporada atual -> "Nova": estreia agora e fica com metade das vagas
--   * < temporada atual -> já estreou; vira acervo e continua aparecendo
--   * > temporada atual -> guardada até a temporada dela começar
-- As vagas de cada grupo (tipo x dificuldade) se alternam entre nova e
-- antiga, e um sorteio por pessoa/período decide quem começa: com 2 vagas
-- vem 1 nova + 1 antiga; a diária difícil (1 vaga) alterna entre as duas.
-- Nada disso depende do nível: é igual pra todo mundo.

alter table public.missions add column if not exists temporada integer;
create index if not exists missions_temporada_idx on public.missions (temporada) where temporada is not null;

create or replace function public.temporada_atual_numero()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.season_number::int
    from public.leaderboard_seasons_numbered s
   where current_date between s.starts_at and s.ends_at
   order by s.starts_at desc
   limit 1;
$$;

create or replace function public.assign_missions_for_all()
returns table(inserted_count integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
  v_month_start date := date_trunc('month', current_date)::date;
  v_temporada integer := coalesce(public.temporada_atual_numero(), 0);
  v_count integer := 0;
begin
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_today
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'daily');
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_week_start
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'weekly');
  update user_missions um set status = 'expired'
   where um.status = 'active' and um.period_start < v_month_start
     and exists (select 1 from missions m where m.id = um.mission_id and m.kind = 'monthly');

  insert into user_missions (user_id, mission_id, progress, goal_value, status, period_start)
  select s.user_id, s.mission_id, 0, s.goal_value, 'active', s.inicio
    from (
      select c.*,
             -- intercala nova/antiga: um lado nas posições ímpares, o outro
             -- nas pares; `moeda` decide quem começa pra essa pessoa/período
             row_number() over (
               partition by c.user_id, c.kind, c.difficulty
               order by case when c.nova then 2 * c.rn_lado - c.moeda else 2 * c.rn_lado - (1 - c.moeda) end, c.sorteio
             ) as rn
        from (
          select up.user_id,
                 m.id as mission_id,
                 m.kind,
                 m.difficulty,
                 greatest(1, m.goal_base) as goal_value,
                 p.inicio,
                 q.cota,
                 (m.temporada is not null and m.temporada = v_temporada) as nova,
                 random() as sorteio,
                 abs(hashtext(up.user_id::text || m.kind || m.difficulty || p.inicio::text)) % 2 as moeda,
                 row_number() over (
                   partition by up.user_id, m.kind, m.difficulty, (m.temporada is not null and m.temporada = v_temporada)
                   order by random()
                 ) as rn_lado,
                 (select count(*)
                    from user_missions um2
                    join missions m2 on m2.id = um2.mission_id
                   where um2.user_id = up.user_id
                     and m2.kind = m.kind
                     and m2.difficulty = m.difficulty
                     and um2.status in ('active', 'completed')
                     and um2.period_start = p.inicio
                     and (m2.active_until is null or m2.active_until > now())) as ja_tem
            from user_progress up
            cross join missions m
            join (values
                   ('daily', 'facil', 2), ('daily', 'media', 2), ('daily', 'dificil', 1),
                   ('weekly', 'facil', 2), ('weekly', 'media', 2), ('weekly', 'dificil', 2),
                   ('monthly', 'facil', 2), ('monthly', 'media', 2), ('monthly', 'dificil', 2)
                 ) as q(kind, dificuldade, cota)
              on q.kind = m.kind and q.dificuldade = m.difficulty
            cross join lateral (
              select case m.kind when 'daily' then v_today when 'weekly' then v_week_start else v_month_start end as inicio
            ) p
           where (m.active_from is null or m.active_from <= now())
             and (m.active_until is null or m.active_until > now())
             and (m.temporada is null or m.temporada <= v_temporada)
             and (m.category <> 'radar' or exists (select 1 from hand_sync_devices d where d.user_id = up.user_id))
             and not exists (
               select 1 from user_missions um
                where um.user_id = up.user_id and um.mission_id = m.id and um.period_start = p.inicio
             )
        ) c
    ) s
   where s.rn <= s.cota - s.ja_tem;
  get diagnostics v_count = row_count;

  inserted_count := v_count;
  return next;
end;
$function$;

-- Catálogo sazonal: 18 tarefas por temporada (2 por tipo x dificuldade).
-- XP fixo por dificuldade, igual ao resto do catálogo:
--   diária 15 / 30 / 60 · semanal 80 / 160 / 300 · mensal 300 / 600 / 1100
insert into public.missions (code, title, description, kind, category, goal_metric, goal_base, goal_scale, xp_reward, icon, difficulty, filter_payload, temporada)
select v.code, v.title, v.description, v.kind, v.category, v.goal_metric, v.goal_base, 0,
       case v.kind
         when 'daily'   then case v.difficulty when 'facil' then 15  when 'media' then 30  else 60 end
         when 'weekly'  then case v.difficulty when 'facil' then 80  when 'media' then 160 else 300 end
         else                case v.difficulty when 'facil' then 300 when 'media' then 600 else 1100 end
       end,
       v.icon, v.difficulty, v.filtro::jsonb, v.temporada
  from (values
    -- ===== Temporada 2: Pressão no short stack =====
    ('t2_d_jam_bb_8',     'Defesa de blind',          'Faça 8 drills de BB contra jam.',                     'daily',   'drill',    'drills_completed',               8, 'shield',         'facil',   '{"fase":"bbJam"}',     2),
    ('t2_d_diario_1',     'Anotação da noite',        'Escreva 1 anotação de sessão no diário.',             'daily',   'bankroll', 'session_diary',                  1, 'notebook',       'facil',   null,                   2),
    ('t2_d_sb_perf_6',    'SB afiado',                'Acerte em cheio 6 spots de SB abrindo.',              'daily',   'drill',    'perfect_drills',                 6, 'target',         'media',   '{"fase":"sbOpen"}',    2),
    ('t2_d_replay_5',     'Replay do dia',            'Assista 5 mãos no replayer.',                         'daily',   'review',   'hands_replayed',                 5, 'spade',          'media',   null,                   2),
    ('t2_d_limpa_12',     'Sem tremer',               'Emende 12 decisões limpas com 15 BB ou menos.',       'daily',   'drill',    'clean_streak',                  12, 'flame',          'dificil', '{"stack_max":15}',     2),
    ('t2_d_estudo_60',    'Uma hora de foco',         'Registre 60 minutos de estudo hoje.',                 'daily',   'study',    'study_minutes',                 60, 'book-open',      'dificil', null,                   2),
    ('t2_w_callj_30',     'Call ou fold?',            'Faça 30 drills de SB pagando jam.',                   'weekly',  'drill',    'drills_completed',              30, 'shield',         'facil',   '{"fase":"sbCallJam"}', 2),
    ('t2_w_ranges_30',    'Mapa de ranges',           'Treine 30 ranges na semana.',                         'weekly',  'range',    'range_drills',                  30, 'scale',          'facil',   null,                   2),
    ('t2_w_short_45',     'Short stack na veia',      'Acerte em cheio 45 spots com 15 BB ou menos.',        'weekly',  'drill',    'perfect_drills',                45, 'target',         'media',   '{"stack_max":15}',     2),
    ('t2_w_rev_6',        'Revisor ativo',            'Conclua 6 revisões de mão na semana.',                'weekly',  'review',   'reviews_concluded',              6, 'book-open',      'media',   null,                   2),
    ('t2_w_ok_200',       'Na linha do solver',       'Tome 200 decisões boas ou melhores na semana.',       'weekly',  'drill',    'gto_ok_or_better',             200, 'trending-up',    'dificil', null,                   2),
    ('t2_w_horas_15',     'Semana de grind',          'Jogue 15 horas na semana.',                           'weekly',  'bankroll', 'bankroll_hours',                15, 'clock',          'dificil', null,                   2),
    ('t2_m_bb_120',       'Dono do big blind',        'Faça 120 drills na posição BB no mês.',               'monthly', 'drill',    'drills_completed',             120, 'shield',         'facil',   '{"posicao":"BB"}',     2),
    ('t2_m_dias_12',      'Presença constante',       'Treine em 12 dias diferentes no mês.',                'monthly', 'habit',    'active_days',                   12, 'calendar',       'facil',   null,                   2),
    ('t2_m_jam_perf_120', 'Jam cirúrgico',            'Acerte em cheio 120 spots de BB contra jam no mês.',  'monthly', 'drill',    'perfect_drills',               120, 'target',         'media',   '{"fase":"bbJam"}',     2),
    ('t2_m_auto_20',      'Olho crítico',             'Faça 20 revisões com autoavaliação completa no mês.', 'monthly', 'review',   'reviews_full_self_eval',        20, 'clipboard-list', 'media',   null,                   2),
    ('t2_m_limpa_50',     'Maratona limpa',           'Emende 50 decisões limpas com 15 BB ou menos.',       'monthly', 'drill',    'clean_streak',                  50, 'flame',          'dificil', '{"stack_max":15}',     2),
    ('t2_m_estudo_1200',  '20 horas de estudo',       'Registre 1.200 minutos de estudo no mês.',            'monthly', 'study',    'study_minutes',               1200, 'book-open',      'dificil', null,                   2),

    -- ===== Temporada 3: Estudo profundo =====
    ('t3_d_estudo_25',    'Leitura rápida',           'Registre 25 minutos de estudo hoje.',                 'daily',   'study',    'study_minutes',                 25, 'book-open',      'facil',   null,                   3),
    ('t3_d_ranges_8',     'Aquecimento de ranges',    'Treine 8 ranges hoje.',                               'daily',   'range',    'range_drills',                   8, 'scale',          'facil',   null,                   3),
    ('t3_d_hits_30',      'Range na ponta da língua', 'Acerte 30 mãos nos treinos de range.',                'daily',   'range',    'range_hits',                    30, 'target',         'media',   null,                   3),
    ('t3_d_perg_1',       'Todas as perguntas',       'Responda todas as perguntas de 1 revisão.',           'daily',   'review',   'reviews_all_questions_answered', 1, 'help-circle',    'media',   null,                   3),
    ('t3_d_btn_20',       'Botão sem medo',           'Faça 20 drills na posição BTN.',                      'daily',   'drill',    'drills_completed',              20, 'shield',         'dificil', '{"posicao":"BTN"}',    3),
    ('t3_d_rev_3',        'Três mãos a fundo',        'Conclua 3 revisões de mão hoje.',                     'daily',   'review',   'reviews_concluded',              3, 'book-open',      'dificil', null,                   3),
    ('t3_w_estudo_120',   'Duas horas na semana',     'Registre 120 minutos de estudo na semana.',           'weekly',  'study',    'study_minutes',                120, 'book-open',      'facil',   null,                   3),
    ('t3_w_reg_3',        'Mãos para estudar',        'Registre 3 mãos no revisor.',                         'weekly',  'review',   'reviews_registered',             3, 'clipboard-list', 'facil',   null,                   3),
    ('t3_w_hits_150',     'Memória de range',         'Acerte 150 mãos nos treinos de range.',               'weekly',  'range',    'range_hits',                   150, 'target',         'media',   null,                   3),
    ('t3_w_replay_20',    'Sessão de replay',         'Assista 20 mãos no replayer.',                        'weekly',  'review',   'hands_replayed',                20, 'spade',          'media',   null,                   3),
    ('t3_w_estudo_480',   'Imersão',                  'Registre 480 minutos de estudo na semana.',           'weekly',  'study',    'study_minutes',                480, 'book-open',      'dificil', null,                   3),
    ('t3_w_auto_8',       'Crítico de si mesmo',      'Faça 8 revisões com autoavaliação completa.',         'weekly',  'review',   'reviews_full_self_eval',         8, 'clipboard-list', 'dificil', null,                   3),
    ('t3_m_ranges_100',   'Cem ranges',               'Treine 100 ranges no mês.',                           'monthly', 'range',    'range_drills',                 100, 'scale',          'facil',   null,                   3),
    ('t3_m_diario_10',    'Diário em dia',            'Escreva 10 anotações de sessão no mês.',              'monthly', 'bankroll', 'session_diary',                 10, 'notebook',       'facil',   null,                   3),
    ('t3_m_rev_25',       'Biblioteca de mãos',       'Conclua 25 revisões de mão no mês.',                  'monthly', 'review',   'reviews_concluded',             25, 'book-open',      'media',   null,                   3),
    ('t3_m_hits_500',     'Quinhentos acertos',       'Acerte 500 mãos nos treinos de range no mês.',        'monthly', 'range',    'range_hits',                   500, 'target',         'media',   null,                   3),
    ('t3_m_estudo_2000',  'Mestre dos livros',        'Registre 2.000 minutos de estudo no mês.',            'monthly', 'study',    'study_minutes',               2000, 'book-open',      'dificil', null,                   3),
    ('t3_m_perg_20',      'Revisão completa',         'Responda todas as perguntas de 20 revisões no mês.',  'monthly', 'review',   'reviews_all_questions_answered',20, 'help-circle',    'dificil', null,                   3),

    -- ===== Temporada 4: Consistência =====
    ('t4_d_sessao_1',     'Bateu o ponto',            'Registre 1 sessão no gestor de banca.',               'daily',   'bankroll', 'bankroll_sessions',              1, 'scale',          'facil',   null,                   4),
    ('t4_d_drills_12',    'Doze por dia',             'Faça 12 drills hoje.',                                'daily',   'drill',    'drills_completed',              12, 'shield',         'facil',   null,                   4),
    ('t4_d_ok_40',        'Decisões sólidas',         'Tome 40 decisões boas ou melhores hoje.',             'daily',   'drill',    'gto_ok_or_better',              40, 'trending-up',    'media',   null,                   4),
    ('t4_d_estudo_40',    'Estudo de rotina',         'Registre 40 minutos de estudo hoje.',                 'daily',   'study',    'study_minutes',                 40, 'book-open',      'media',   null,                   4),
    ('t4_d_perf_25',      'Dia impecável',            'Acerte em cheio 25 spots hoje.',                      'daily',   'drill',    'perfect_drills',                25, 'target',         'dificil', null,                   4),
    ('t4_d_replay_12',    'Doze replays',             'Assista 12 mãos no replayer hoje.',                   'daily',   'review',   'hands_replayed',                12, 'spade',          'dificil', null,                   4),
    ('t4_w_dias_4',       'Quatro dias firmes',       'Treine em 4 dias diferentes na semana.',              'weekly',  'habit',    'active_days',                    4, 'calendar',       'facil',   null,                   4),
    ('t4_w_diario_3',     'Três anotações',           'Escreva 3 anotações de sessão na semana.',            'weekly',  'bankroll', 'session_diary',                  3, 'notebook',       'facil',   null,                   4),
    ('t4_w_sessoes_5',    'Cinco sessões',            'Registre 5 sessões no gestor de banca.',              'weekly',  'bankroll', 'bankroll_sessions',              5, 'scale',          'media',   null,                   4),
    ('t4_w_deep_40',      'Stack fundo',              'Faça 40 drills com 40 BB ou mais.',                   'weekly',  'drill',    'drills_completed',              40, 'shield',         'media',   '{"stack_min":40}',     4),
    ('t4_w_dias_6',       'Quase perfeito',           'Treine em 6 dias diferentes na semana.',              'weekly',  'habit',    'active_days',                    6, 'calendar',       'dificil', null,                   4),
    ('t4_w_limpa_30',     'Trinta sem erro',          'Emende 30 decisões limpas.',                          'weekly',  'drill',    'clean_streak',                  30, 'flame',          'dificil', null,                   4),
    ('t4_m_horas_30',     'Mês de volume',            'Jogue 30 horas no mês.',                              'monthly', 'bankroll', 'bankroll_hours',                30, 'clock',          'facil',   null,                   4),
    ('t4_m_dias_15',      'Metade do mês',            'Treine em 15 dias diferentes no mês.',                'monthly', 'habit',    'active_days',                   15, 'calendar',       'facil',   null,                   4),
    ('t4_m_ok_600',       'Solidez',                  'Tome 600 decisões boas ou melhores no mês.',          'monthly', 'drill',    'gto_ok_or_better',             600, 'trending-up',    'media',   null,                   4),
    ('t4_m_verde_5',      'Cinco no verde',           'Emende 5 sessões positivas seguidas.',                'monthly', 'bankroll', 'bankroll_positive_streak',       5, 'trending-up',    'media',   null,                   4),
    ('t4_m_dias_25',      'Todo dia é dia',           'Treine em 25 dias diferentes no mês.',                'monthly', 'habit',    'active_days',                   25, 'calendar',       'dificil', null,                   4),
    ('t4_m_diario_20',    'Registro de campeão',      'Escreva 20 anotações de sessão no mês.',              'monthly', 'bankroll', 'session_diary',                 20, 'notebook',       'dificil', null,                   4)
  ) as v(code, title, description, kind, category, goal_metric, goal_base, icon, difficulty, filtro, temporada)
 where not exists (select 1 from public.missions m where m.code = v.code);
