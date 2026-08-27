# PokerSync — Documento Mestre

> **Organize. Estude. Evolua.**

Este arquivo substitui e unifica os cinco documentos anteriores —
`AI_CONTEXT.md`, `PRODUCT.md`, `DECISIONS.md`, `BACKLOG.md` e
`CHANGELOG.md` (todos de 2026-07-30). Nada foi descartado: a visão, os
princípios e as 8 decisões originais estão preservados na íntegra abaixo.
O que mudou é que **cada item de backlog agora carrega o estado real**,
conferido em 2026-08-21 contra o código dos repositórios e contra o banco
de produção — os documentos originais listavam 60+ itens como pendentes,
e a maioria já está no ar.

Este documento vive no repositório do produto
(<https://github.com/gsimonetto/pokersync>) e é atualizado conforme o
projeto anda — ver §10, "Ao atualizar este documento".

**Índice**
1. [O produto](#1-o-produto)
2. [Princípios](#2-princípios)
3. [O que o PokerSync não é](#3-o-que-o-pokersync-não-é)
4. [Arquitetura real](#4-arquitetura-real)
5. [Decisões de produto](#5-decisões-de-produto)
6. [Estado real dos módulos](#6-estado-real-dos-módulos)
7. [Backlog vivo — só o que falta](#7-backlog-vivo--só-o-que-falta)
8. [Lacunas entre motor e produto](#8-lacunas-entre-motor-e-produto)
9. [Changelog](#9-changelog)
10. [Regras de evolução e orientação para IA](#10-regras-de-evolução-e-orientação-para-ia)

---

## 1. O produto

PokerSync é uma plataforma que centraliza as ferramentas de estudo,
gestão e evolução do jogador de poker.

A visão inicial era **manter tudo em um só lugar**. A visão atual é
maior: **ajudar o jogador a evoluir continuamente**, conectando dados,
estudo, revisão, comportamento e performance numa experiência única. A
mesma base atende o jogador individual e, no modo Time, coaches e
gestores.

**Slogan:** PokerSync — Organize. Estude. Evolua.

**Módulos:** Modo Treino · Gestor de Banca · Construtor de Ranges e
Árvores (era "Construtor de Hands") · Review de Mãos · Player Evolution
· Plataforma para Times · Hub de Evolução.

> O Hub de Evolução (XP, missões, ranking, temporadas) não existia nos
> documentos originais — nasceu durante a construção e hoje é um dos sete
> módulos no ar.

## 2. Princípios

1. **Jogador em primeiro lugar.**
2. **Ensinar > apenas informar.**
3. **Simplicidade antes de complexidade** — menos funcionalidades, melhor
   resolvidas.
4. **Módulos conversam entre si** — integração é prioridade, não enfeite.
5. **A experiência diária importa** — o produto é usado antes, durante e
   depois da sessão.
6. **Dados devem gerar ação e aprendizado**, não só relatório.
7. **Acompanhar a evolução, não apenas registrar o histórico.**
8. **Nada isolado** — nenhuma funcionalidade sem propósito claro dentro
   de um módulo ou de uma integração.

## 3. O que o PokerSync não é

O produto deve ser percebido como um **sistema de evolução do jogador**,
e não como:

- um tracker;
- um gestor de banca;
- um repositório de mãos;
- um substituto de solver.

## 4. Arquitetura real

Quatro repositórios e um banco. Isso não estava documentado em lugar
nenhum e é o contexto que mais falta a quem (ou o que) chega no projeto.

| Onde | O que é | Stack |
| --- | --- | --- |
| [`gsimonetto/pokersync`](https://github.com/gsimonetto/pokersync) | **O produto.** Todas as telas e serviços. | Next.js (App Router) + Supabase |
| [`gsimonetto/pokersync-solver`](https://github.com/gsimonetto/pokersync-solver) | **Motor GTO próprio.** CFR + ICM, jobs em lote, API de disparo. | Python, FastAPI, Railway |
| [`gsimonetto/pokersync-agent`](https://github.com/gsimonetto/pokersync-agent) | **Agente desktop.** Varre hand history no computador do jogador e sincroniza via `/api/agent/*` (neste repo). | Rust + Tauri |
| [`gsimonetto/pokersync-road-map`](https://github.com/gsimonetto/pokersync-road-map) | Roadmap editável (board visual). | TanStack Start / Lovable |
| Supabase `PokerSync` | Banco, RLS, ~65 tabelas e ~90 RPCs. Fonte de verdade de tudo. | Postgres 17 |

**Convenções do produto** (seguir ao implementar):

- Toda leitura/escrita passa por um serviço em `lib/services/*.ts` — as
  telas não falam com o Supabase direto.
- Lógica de poker fica em `lib/poker/*.ts`; lógica de banca em
  `lib/bankroll/*.ts`.
- Regra de negócio pesada e agregação moram em **RPC no Postgres**
  (`team_dashboard`, `get_player_insights`, `register_training`,
  `detect_user_leaks`…), não no cliente.
- O motor é assíncrono por natureza: o produto **nunca resolve um spot em
  tempo real**. Jobs gravam spots na tabela `drills`; as telas consomem
  esse estoque.

**Separação motor ↔ produto** (decisão registrada no repo do solver): o
motor vive fora do repositório do produto para que uma mudança no CFR
nunca quebre o deploy da plataforma.

## 5. Decisões de produto

As oito decisões originais valem integralmente. As quatro seguintes
(009–012) documentam decisões que já foram tomadas na prática — estão
implementadas no código — mas nunca tinham sido escritas.

### 001 — O produto não é apenas um organizador de dados
**Decisão:** o PokerSync deve usar dados para ajudar o jogador a evoluir.
**Motivo:** a visão evoluiu de centralização para evolução contínua.

### 002 — Integração entre módulos é prioridade
**Decisão:** os módulos compartilham contexto quando isso gera valor.
**Exemplo:** mãos revisadas geram sugestões de treino.

### 003 — Review não depende de solver na V1
**Decisão:** o Review de Mãos funciona sem GTO Wizard, PIO ou qualquer
solver externo.
**Motivo:** reduzir a barreira de entrada e entregar valor desde o início.
**Estado:** mantida. O veredito objetivo do Revisor vem da aderência às
ranges do próprio jogador; o motor próprio é reforço opcional, não
requisito.

### 004 — Entrada manual deve existir
**Decisão:** o usuário nunca será obrigado a instalar agente desktop.

### 005 — Agente desktop é caminho futuro
**Decisão:** o agente é alternativa de automação, não dependência.

### 006 — Gestor de Banca deve evoluir para performance
**Decisão:** o módulo vai além de saldo e resultado — hábitos, metas,
sessões, evolução.

### 007 — Times são uma extensão natural
**Decisão:** a arquitetura permite jogadores, coaches, métricas e
performance de times sobre a mesma base.

### 008 — Slogan
**Decisão:** PokerSync — Organize. Estude. Evolua.

### 009 — Motor GTO próprio, em repositório separado *(registrada agora)*
**Decisão:** o PokerSync tem motor próprio (CFR com desconto + ICM), num
repositório à parte, com deploy independente.
**Motivo:** a decisão 003 fala sobre *dependência de solver externo* —
não impede capacidade interna. Ter o motor em casa dá controle sobre
formato, custo e convergência; mantê-lo fora do repo do produto impede
que uma mudança no motor derrube a plataforma.

### 010 — Nada de solve em tempo real *(registrada agora)*
**Decisão:** spots são resolvidos em lote, offline, e gravados na tabela
`drills`. A API do motor só dispara e monitora jobs.
**Motivo:** um spot de RFI/Jam leva milhões de iterações; resolver sob
demanda tornaria a tela refém do motor. Resolução sob demanda só será
reconsiderada quando o Hand Replayer precisar.

### 011 — Convergência sempre carimbada no dado *(registrada agora)*
**Decisão:** toda linha gravada pelo motor leva `engine_version` e
`exploitability`.
**Motivo:** foi a ausência desse log que tornou o diagnóstico do
pipeline antigo (TexasSolver) tão lento. Não se repete.

### 012 — Estrutura mínima aceita: ICM primeiro *(registrada agora)*
**Decisão:** os spots pré-flop são resolvidos com ICM (torneio), não em
ChipEV puro.
**Motivo:** é o contexto real do público-alvo. ChipEV entra depois, se
houver demanda de cash — e exige mudar o cálculo de utilidade terminal
do motor, não é um flag.

### 013 — Resolução sob demanda, só pra cEV/ICM de mão jogada (2026-08-27)
**Decisão:** a exceção prevista na decisão 010 ("só será reconsiderada
quando o Hand Replayer precisar") aconteceu — `POST
/hands/compute_cev` no `pokersync-solver` resolve sob demanda, mas só
o $EV analítico (equity real via Monte Carlo + ICM Malmuth-Harville)
de UMA mão específica que já foi jogada, all-in heads-up com as duas
mãos mostradas no showdown. Não é solve de spot (não treina CFR,
responde em <1s) — decisão 010 continua valendo pra geração de range
(`drills`), que segue 100% em lote.
**Motivo:** cEV/ICM por mão exige o resultado de UM confronto
específico (cartas e stacks reais daquela mão), não uma tabela de
range genérica — não dá pra pré-computar em lote sem saber de
antemão quais mãos vão ser jogadas.
**Pendência:** decisão 011 (todo dado do motor carrega
`engine_version`/`exploitability`) não foi aplicada em
`hand_ev_results` ainda — cálculo analítico não tem "convergência" no
sentido de CFR, mas `engine_version` (pra rastrear se a fórmula mudou)
deveria existir mesmo assim. Registrado no backlog (§7).

## 6. Estado real dos módulos

Legenda: **✅ no ar** · **🟡 parcial** · **⬜ não iniciado** ·
**🔒 pronto no código, bloqueado por falta de dados**

### 6.1 Gestor de Banca — `/banca`

| Item (backlog original) | Estado | Evidência |
| --- | :-: | --- |
| Registro manual de sessão | ✅ | `bankroll_sessions`, 73 sessões reais |
| Fechamento de sessão com resumo | ✅ | `mood`, `tilt`, `diary_note` |
| Diário pós-sessão | ✅ | `updateSessionDiary()` |
| Metas de volume | ✅ | `bankroll_goals` |
| Metas de estudo | ✅ | `bankroll_goals` + `bankroll_study_logs` |
| Resumo automático da sessão | ✅ | KPIs + `bankroll_session_net()` |
| Dashboard de evolução | ✅ | página de 1.918 linhas, heatmap de volume |
| Fluxo de caixa (depósitos/saques) | ✅ | `bankroll_transactions`: depósito, saque, caixinha |
| Métrica de tempo / winrate horário | ✅ | KPIs R$/hora **e** bb/hora com intervalo de confiança |
| Histórico expandido com filtros | ✅ | "Ver todas" + busca livre + filtros dedicados de formato e período (PR #36) |
| Edição de sessão (lápis) | ✅ | `updateSession()`; edita na mesma linha, sem perder vínculo com as mãos revisadas nem conceder XP de novo (PR #36) |
| Formulário dinâmico por formato | ✅ | "Rebuys/Add-on" em cash, big blind promovido a campo principal quando o formato é Cash (PR #36) |

**Além do backlog** (não estava previsto e está no ar): rake e rakeback,
multi-moeda, staking/backing com markup, BRM com limites por formato,
alertas de banca, anotações no gráfico.

### 6.2 Review de Mãos — `/revisor`

| Item | Estado | Evidência |
| --- | :-: | --- |
| Captura rápida (<30s) | ✅ | `revisor-nova-mao.tsx` |
| Colar hand history | ✅ | `hand_reviews.hand_history` + parser próprio |
| Upload de print | ✅ | `hand_review_images` (com limite por trigger) |
| Etiquetas (3-bet, ICM, PKO, hero call) | ✅ | `hand_review_tags` + `hand_tags` (38 colunas de stats) |
| Fila de revisão | ✅ | `hand_reviews.status` + `revisor-fila.tsx` |
| Histórico de revisões | ✅ | `user_review_summary()` |
| Perguntas guiadas | ✅ | `hand_review_answers` |
| Registro de aprendizado | ✅ | `hand_reviews.learning_note` |
| Sugestão de drills | 🔒 | 12 sugestões cadastradas, 3 RPCs prontas e o handoff pro Treino fechado (PR #35) — falta **estoque de drills pra apontar** (ver §8) |

**Além do backlog:** replay de mão com atalhos de teclado, avaliação por
rua (`hand_review_street_evals`), aderência à range com histórico,
compartilhar mão com o time e thread de coach, sessões de mãos.

### 6.3 Modo Treino — `/treino`

| Item | Estado | Evidência |
| --- | :-: | --- |
| Drills personalizados | 🟡 | filtros de posição/stack/tipo funcionam, mas só há 8 spots (RFI/Jam pré-flop) |
| Sugestões baseadas em reviews | 🔒 | encanamento completo (PR #35): o botão resolve o alvo, o Treino honra o `suggestionId` e aplica matchup/stack. Segue bloqueado só por estoque — os 5 leaks reais da base são todos pós-flop (§8) |
| Sugestões baseadas em performance | ✅ | o leak de formato da Banca vira sugestão de stack curto no treino |

**Além do backlog:** XP, combo de acertos, missões e veredito na mesa;
drill de ranges próprias (`range-drill.tsx`).

### 6.4 Construtor — `/ranges`

O "Construtor de Hands" do documento original virou **Construtor de
Ranges e Árvores**, mais amplo do que o previsto.

| Item | Estado | Evidência |
| --- | :-: | --- |
| Construção de spots | ✅ | editor de ranges, editor de árvores (`strategy_trees`), versionamento |
| Integração com Review | ✅ | importar mão do Revisor, aderência de range |
| Integração com Treino | ✅ | range salva vira drill; biblioteca do motor no construtor |

**Além do backlog:** comparador de ranges, calculadora de equity,
analisador de board (single e multi, com filtro de textura),
biblioteca de time, journal de decisões.

### 6.5 Player Evolution — `/performance`

| Item | Estado |
| --- | :-: |
| ROI · ABI · Volume · Lucro | ✅ |
| Evolução temporal | ✅ (`get_player_timeline`) |
| Tendências | ✅ (`get_period_comparison`) |
| Insights acionáveis | ✅ (`get_player_insights`, `get_skill_breakdown`) |
| Banco de dados unificado de performance | ✅ (`player_stats`, `player_preflop_stats`, `player_postflop_stats` — **⚠ estas duas últimas estão paradas**, sem trigger vivo desde a última vez que alguém rodou o script de backfill manualmente; `hand_tags` é a fonte viva hoje, ver módulo de Análise abaixo) |

#### Módulo de Análise — `/performance/analise` (2026-08-27)

Rota dedicada dentro do Player Evolution (não modal, não nova aba):
filtros globais combináveis + 5 abas (Visão Geral, Preflop & Matriz
13×13, Postflop & Tendências, Torneios, Leak Finder & Replayer). Tudo
calculado no cliente a partir de `hand_tags`/`hand_reviews`
(`lib/services/analysis-service.ts`), sem RPC nova.

| Item | Estado |
| --- | :-: |
| VPIP/PFR/3-Bet/Fold-to-3Bet/4-Bet/Steal/Squeeze, por posição | ✅ |
| C-Bet flop/turn/river, Fold-to-C-Bet por rua, Check-Raise por rua | ✅ (migração estendeu `hand_tags` — antes só flop existia) |
| Aggression Factor / Aggression Frequency, WSD%/W$SD% | ✅ |
| Matriz 13×13 com heatmap | ✅ — mas o "range ideal" mostrado é referência simplificada, não o motor GTO (preflop_ranges nunca foi ligado a isto) |
| Leak Finder → Replayer | ✅ — reaproveita o Replayer do Revisor (`/revisor?shared=<id>`), não duplica UI |
| Importação manual de hand history | ✅ — embutida na barra de filtros, mesmo motor do Revisor (`hand_import_batches`) |
| Importação automática (agente desktop) | ✅ do lado do servidor — `/api/agent/sync` grava na mesma `hand_reviews`, o mesmo trigger computa `hand_tags`. Sem caminho novo de código quando o agente enviar de verdade |
| Estrutura de premiação de torneio | ✅ (`tournament_payouts`, linkada por `tournament_id_ps`) — manual hoje, schema já aceita `source: 'agent'` pra quando o agente buscar sozinho |
| cEV/ICM por mão | 🟡 pipeline pronto ponta a ponta (`pokersync-solver` `POST /hands/compute_cev` + `hand_ev_results` + botão "Calcular cEV") — **bloqueado só no deploy**: `pokersync-solver` nunca foi publicado (Railway) e `SOLVER_API_URL`/`SOLVER_API_KEY` não existem em nenhum ambiente. Escopo: só all-in heads-up preflop com as duas mãos mostradas (5 mãos qualificam na base real hoje) |
| Estatísticas de oponente (perfil por jogador, não só herói) | ⏳ não iniciado — parser é 100% hero-centric por design; HM3/PT4 têm isso, é o maior gap real de paridade |
| HUD em tempo real | ⏳ não iniciado — categoria de produto diferente (scraping de mesa ao vivo), vive no agente desktop, que ainda não faz isso |

### 6.6 Plataforma para Times — `/time`

| Item | Estado | Evidência |
| --- | :-: | --- |
| Cadastro de time | ✅ | `create_team()` |
| Cadastro/convite de jogadores | ✅ | `team_invites`, `accept_team_invite()` |
| Papéis e permissões | ✅ | RLS + `is_team_admin/manager`, aprovação de membro |
| Dashboard do coach | ✅ | `team_dashboard()`, funil estilo Trello, calendário |
| Metas e acompanhamento | ✅ | `team_player_goals` + progresso |
| Métricas consolidadas | ✅ | financeiro, atividade, leaks por jogador |
| Alertas | ✅ | `team_alerts` + `run_team_alerts()` |
| Score de evolução | 🟡 | existe XP/nível e leaks por jogador; não existe um "score" único consolidado |
| JSON padronizado / sincronização | 🟡 | o schema existe (`hand_sync_devices`, `hand_sync_batches`, `agent_version`, `raw_payload`) |
| **Agente desktop** | 🟡 | scaffold em [`pokersync-agent`](https://github.com/gsimonetto/pokersync-agent) (Tauri + Rust): varredura de HH no disco, `/api/agent/{ping,sync}` (neste repo) gravando em `hand_sync_devices`/`hand_sync_batches`/`hand_reviews`. Falta validar contra instalações reais |

### 6.7 Hub de Evolução — `/hub`

XP com fontes múltiplas, níveis, missões diárias (32 cadastradas),
combo de acertos, ranking com pódio e temporadas com prêmio,
notificações. ✅ no ar — não estava em nenhum documento.

## 7. Backlog vivo — só o que falta

Ordenado pelo que os dados reais pedem, não pelo custo: o item 1 é o
único que faz o loop central do produto ("dados geram ação") funcionar
de verdade hoje.

| # | Item | Módulo | Nota |
| :-: | --- | --- | --- |
| 1 | Publicar `pokersync-solver` no Railway + configurar `SOLVER_API_URL`/`SOLVER_API_KEY` | Análise | **só isso destrava o cEV/ICM** — código pronto e mergeado dos dois lados (PRs #86 no produto, #13 no motor), zero linha a mais pra escrever, só deploy |
| 2 | Pipeline de pós-flop ponta a ponta (job → contrato → UI) | Treino ↔ Review | os 5 leaks reais da base são todos pós-flop, então é o item que faz o loop leak → treino funcionar de verdade |
| 3 | Estatísticas de oponente (perfil por jogador) | Análise | parser é 100% hero-centric hoje — maior gap de paridade com HM3/PT4, mudança estrutural (parser + schema novo por jogador) |
| 4 | Gerar estoque pré-flop: push/fold ICM e stacks 10/20/30/50bb | Treino | motor, job e endpoint já existem — falta disparar (escreve em produção) |
| 5 | Score de evolução consolidado do jogador | Times / Hub | há matéria-prima (XP, leaks, aderência, ROI) |
| 6 | Agente desktop | Times | 🟡 iniciado, já em repo próprio ([`pokersync-agent`](https://github.com/gsimonetto/pokersync-agent), decisão 009) — falta validar varredura/parsing contra instalações reais de cada sala |
| 7 | Decidir o catálogo de formatos | Banca | o formulário oferece MTT/Cash/SNG/Spin, mas 61 das 73 sessões gravadas dizem `"Torneio"`; ou o catálogo muda, ou as sessões antigas migram |
| 8 | `engine_version` em `hand_ev_results` | Análise | decisão 011 pede isso em todo dado do motor — cálculo analítico (sem CFR) não tem exploitability, mas versão da fórmula deveria ser rastreada mesmo assim |
| 9 | Sincronizar o board do roadmap com a realidade | Roadmap | todos os itens estão marcados "Planejado", inclusive os módulos no ar |

**Concluídos desde a consolidação (2026-08-21):** handoff leak → treino
(PR #35); os três itens de Banca — edição de sessão, filtros do
histórico e formulário por formato (PR #36); ações rápidas nos leaks
(PR #37); módulo de Análise completo com preflop/postflop real, matriz
13×13, leak finder, import manual+agente (PR #84); estrutura de
premiação de torneio (PR #85); pipeline de cEV/ICM ponta a ponta,
faltando só deploy (PR #86, `pokersync-solver` PR #13); bug de
denominador corrigido em Fold-to-3Bet%/Fold-to-Steal%/etc (flags de
oportunidade estavam sendo filtradas por `!== null` em vez de
`=== true`).

**Ideias futuras** (mantidas dos documentos originais): integrações
externas de dados; integrações opcionais com solvers de terceiros —
hoje parcialmente superada pelo motor próprio; mais automações de
performance.

## 8. Lacunas entre motor e produto

Análise completa em `ANALISE_GAPS.md`, no repositório do motor
([pokersync-solver](https://github.com/gsimonetto/pokersync-solver)).
Resumo:

O motor já resolve mais do que o produto consome, e o produto já tem
telas e RPCs esperando dados que nenhum job gerou. A tabela `drills`
inteira tem **8 linhas**, todas RFI/Jam de pré-flop.

- **Push/Fold ICM**: motor, job e endpoint prontos e conectados; nunca
  disparado. A sugestão de leak de maior prioridade não tem drill.
- **cEV/ICM por mão jogada (novo endpoint, 2026-08-27)**: diferente do
  item acima (gera range offline), `POST /hands/compute_cev` resolve
  sob demanda o $EV de uma mão específica — decisão 013. Pipeline
  ponta a ponta pronto e mergeado dos dois lados; só falta o deploy do
  `pokersync-solver` (nunca foi publicado) e configurar
  `SOLVER_API_URL`/`SOLVER_API_KEY` no ambiente do produto — o
  `pokersync` nunca chamou o motor por HTTP antes disso.
- **Pós-flop river/turn**: motor validado (0,39% de exploitability no
  river), sem job, sem endpoint, sem UI. Dois ativos prontos e órfãos no
  banco: `flop_subsets` (184 flops ponderados) e `preflop_ranges` (29
  ranges nomeadas), que nenhum dos repositórios lê.
- ~~**Bug de idempotência**: 3 de 4 jobs perderam 2,5 milhões de iterações
  no `insert` final por `spot_id` duplicado.~~ Corrigido no motor: `upsert`
  por `spot_id` nos dois jobs, e `spot_id` determinístico no push/fold.
- ~~**Bug de mapeamento**: o drill-service documentava que a base era toda
  Flop/Turn/River.~~ Corrigido (PR #35): tradução por cenário, e o Treino
  passou a honrar o `suggestionId` que o Revisor manda.
- **Estoque é o gargalo restante**: os leaks reais da base são `tilt`/flop,
  `sizing_errado`/turn, `valor_perdido`/river, `range_mal_lido`/flop e
  `timing_ruim`/turn. Todos pós-flop — três viram drill assim que o
  pipeline existir; `tilt` é comportamental e não vira drill.
- **Multiway e multi-tamanho**: motores prontos, sem caminho de ingestão
  e sem leitura do formato novo no frontend.

## 9. Changelog

### 2026-08-27 — Módulo de Análise + pipeline de cEV/ICM
- Nova rota `/performance/analise` (PR #84): filtros globais
  combináveis, 5 abas (Visão Geral, Preflop & Matriz 13×13, Postflop,
  Torneios, Leak Finder & Replayer), importação manual embutida.
  Métricas calculadas no cliente a partir de `hand_tags`.
- Migração no Supabase estendeu `hand_tags` com detalhe pós-flop por
  rua (river c-bet, check-raise por rua, fold-to-cbet turn/river,
  contagem bet/raise/call/fold pra Aggression Factor, showdown) — tudo
  calculado direto de `parsed_data->streets` em SQL, mesmo padrão de
  `compute_pot_type`/`compute_stack_bucket`. Backfill nas mãos já
  importadas.
- Corrigido bug real: `hero_faced_3bet`/`hero_faced_4bet`/
  `blind_defense_opportunity`/`steal_opportunity` são flags de
  oportunidade sempre `true`/`false` (nunca `null` com herói
  identificado) — o cálculo de Fold-to-3Bet%/Fold-to-4Bet%/Fold-to-Steal%
  filtrava por `!== null`, o que incluía TODAS as mãos no denominador
  em vez de só as que tiveram a situação de verdade.
- Estrutura de premiação de torneio (PR #85): tabela
  `tournament_payouts`, linkada por `tournament_id_ps` — a mesma chave
  que já une `hand_reviews`/`hand_sessions` de torneio. Suporta
  `source: 'agent' | 'manual'` desde o início.
- Pipeline de cEV/ICM por mão jogada (decisão 013): novo endpoint
  síncrono `POST /hands/compute_cev` no `pokersync-solver` (PR #13,
  cálculo analítico — equity real + ICM Malmuth-Harville, sem treinar
  CFR, responde em <1s) + `app/api/hand-ev/compute` no produto (PR
  #86) que detecta mãos elegíveis (all-in heads-up preflop, ambas
  mostradas no showdown), chama o motor e grava em `hand_ev_results`.
  Pronto dos dois lados, mas nunca testado ponta a ponta em produção —
  falta publicar o `pokersync-solver` (nunca foi feito deploy) e
  configurar `SOLVER_API_URL`/`SOLVER_API_KEY`.
- Fix: link "Análise avançada" em `/performance` só aparecia em telas
  ≥640px e nem existia no estado "ainda sem dados" (PR #87).

### 2026-08-27 — Login com Google no agente desktop
- Nova página `app/agent-login/` — o agente desktop (`pokersync-agent`)
  não consegue rodar o OAuth do Google dentro da webview embutida
  (bloqueado pelo próprio Google), então abre essa página no navegador do
  sistema. `app/auth/confirm/route.ts` ganhou um segundo desvio: quando o
  parâmetro `agent_state` está presente, devolve os tokens pro agente via
  deep link (`pokersync-agent://auth`) em vez de abrir `/modulos` na aba.
  Resolve o caso relatado de "logou pelo Google, senha não funciona no
  agente" — contas OAuth-only nunca tiveram senha no Supabase.

### 2026-08-26 — Agente desktop extraído para repo próprio
- Código do agente (antes em `agent-desktop/` neste repo) movido para
  [`gsimonetto/pokersync-agent`](https://github.com/gsimonetto/pokersync-agent)
  via `git subtree split`, preservando o histórico. Fecha a pendência
  registrada abaixo — decisão 009 (motor/agente fora do repo do produto)
  agora vale também pro agente. Só `app/api/agent/{ping,sync}` e
  `lib/services/agent-sync-service.ts` continuam aqui, por serem parte do
  produto (consomem `lib/poker/hand-parser.ts`).

### 2026-08-26 — Início do agente desktop
- Scaffold do agente em `agent-desktop/` (Tauri + Rust): crate `scanner`
  varre pastas de hand history por sala/SO e evita reenviar arquivos
  inalterados; crate `sync-client` fala com o backend; shell Tauri com
  login (Supabase), seleção de salas, busca e sync sob demanda.
  PokerStars, GGPoker, PartyPoker e 888poker no MVP — os dois primeiros com
  parsing validado no backend, os dois últimos chegam como `raw_payload`
  até o parser ganhar suporte a esses formatos.
- Novo endpoint `app/api/agent/sync` (+ `agent/ping`): autentica por bearer
  token, reaproveita `lib/poker/hand-parser.ts` (nenhuma lógica de parsing
  duplicada em Rust) e grava `hand_reviews` com `source: "agent"`,
  atualizando `hand_sync_devices`/`hand_sync_batches`.
- Ainda dentro do repo do produto — a separação em repositório próprio
  (decisão 009) não saiu porque a integração de GitHub desta sessão não
  tinha permissão pra criar repositório novo; fica registrado como
  próximo passo em `agent-desktop/README.md`.

### 2026-08-21 — Primeira rodada sobre o backlog consolidado (cont.)
- Ações rápidas no painel de leaks da Banca: "Treinar" (só onde o estoque
  casa com a fatia) e "Registrar mão", ligando Banca a Treino e Revisor.
- Corrigido: `TOURNEY_FORMATS` não incluía `"Torneio"`, o valor usado por
  61 das 73 sessões reais — a ponte Banca → Treino estava muda para a
  maior parte da base.

### 2026-08-21 — Primeira rodada sobre o backlog consolidado
- Motor: `upsert` por `spot_id` nos dois jobs e `spot_id` determinístico
  no push/fold — re-rodar um spot deixou de custar o job inteiro.
- Handoff leak → treino fechado nas três pontas: tradução por cenário,
  `suggestionId` honrado pela tela de Treino, `initialMatchup` no drill.
- Banca: edição de sessão sem excluir e refazer, filtros dedicados de
  formato e período no histórico, e formulário adaptado por formato.
- Registrado que o gargalo do loop leak → treino é estoque de pós-flop,
  não mapeamento: todos os leaks reais da base são pós-flop.

### 2026-08-21 — Consolidação da documentação
- Cinco documentos (`AI_CONTEXT`, `PRODUCT`, `DECISIONS`, `BACKLOG`,
  `CHANGELOG`) unificados neste arquivo, com o estado real de cada item
  conferido contra código e banco.
- Registradas as decisões 009 a 012, que já vigoravam na prática.
- Publicada a análise de lacunas entre motor e produto.

### 2026-08-19 a 2026-08-21 — Onda de UX e integração
Modo Treino RFI/Jam consumindo o motor próprio; XP real ligado ao treino;
ranking e temporadas no Hub; modo Time completo (funil, calendário,
assistente do coach, alertas); construtor de ranges com árvores, equity e
análise de board; header, modais e margens padronizados em todo o app;
staking, rake/rakeback, multi-moeda e bb/hora na Banca.

### 2026-08-07 a 2026-08-18 — Migração e construção
Produto migrado para Next.js (App Router) e Supabase; módulos de Banca,
Revisor, Hub, Performance e Ranges construídos sobre RLS e RPCs.
*(405 commits no repositório do produto até 2026-08-21.)*

### 2026-07-30 — Documentação inicial
Criada a visão oficial do produto; definido o slogan; registrados os
princípios; roadmap organizado por módulos; decisões 001–008
registradas; backlog inicial criado; definidas a captura manual como
alternativa ao agente desktop e a independência de solver na V1.

## 10. Regras de evolução e orientação para IA

### Regra do roadmap
Toda funcionalidade nova deve:
1. fortalecer um módulo existente; **ou**
2. criar uma integração útil entre módulos; **ou**
3. contribuir claramente para a evolução do jogador ou do time.

O PokerSync não deve virar um conjunto de ferramentas isoladas.

### Antes de implementar
1. A funcionalidade fortalece a visão do produto?
2. Existe módulo relacionado — e o item já não está feito? **Conferir a
   §6 antes de abrir tarefa:** os documentos antigos listavam como
   pendente muita coisa que já está no ar.
3. Há integração com outro módulo que deveria vir junto?
4. Está duplicando algo sem benefício claro?
5. A UX é simples o bastante para um jogador em sessão?

### Ao escrever código
- Serviço em `lib/services`, nunca Supabase direto na tela.
- Agregação pesada vira RPC no Postgres.
- Nada de resolver spot em tempo real (decisão 010).
- Dado gerado pelo motor carrega `engine_version` e `exploitability`
  (decisão 011).
- Antes de mexer no `cfr_core.py`, rodar `tests/kuhn_poker.py`.

### Ao atualizar este documento
Manter os quatro pilares na mesma ordem — visão, decisões, estado real,
backlog — e registrar toda decisão nova numerada, mesmo (e principalmente)
quando ela já tiver sido tomada na prática pelo código.
