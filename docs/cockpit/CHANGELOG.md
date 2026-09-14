# PokerSync — Changelog do Cockpit

> Só entradas curtas. Detalhe técnico completo continua nos commits e
> no `POKERSYNC.md`/README do Solver — aqui é o resumo pra quem só quer
> saber "o que mudou".

## 14/09/2026 — RADAR-004: parser dedicado de PartyPoker e 888poker

A pedido do dono, implementado suporte a mais duas salas em
`lib/poker/hand-parser.ts` a partir de uma amostra de cada (exemplo/
gerada, não capturada de mão real jogada) — mesma cautela já aplicada
ao GGPoker antes de ter amostra real.

- **PartyPoker**: formato muito próximo do PokerStars já suportado
  (mesmas linhas de ação com "PlayerName: verb amount"). Só precisou de
  detecção de site/início de mão, listagem de assentos sem o sufixo
  "in chips", e extração do ID da mão (formato "Game hand #X" sem
  ":").
- **888poker**: formato bem mais diferente — linhas de ação SEM ":"
  depois do nome e valores entre colchetes ("Player6 raises [50]") em
  vez de "PlayerName: raises 50". Regras de blind/board/pote também
  próprias dessa sala. Turn/river/showdown foram extrapolados por
  simetria com o padrão "Dealing X" observado no flop — não
  confirmados contra exemplo real.
- Durante o teste manual contra as duas amostras, um bug foi
  encontrado e corrigido no processo: deixar o sufixo "in chips"
  opcional (pra aceitar PartyPoker/888poker) fazia o parser também
  confundir linhas do resumo final da mão ("Seat X: Nome (button)
  folded...") com listagem de assentos, inflando a contagem de
  jogadores em QUALQUER sala, PokerStars/GGPoker incluídos. Corrigido
  restringindo a busca de assentos ao trecho antes de "HOLE CARDS"/
  "Dealing down cards" — testado de novo com uma mão PokerStars
  sintética pra confirmar que voltou a dar 6 assentos, não 12.
- A amostra de 888poker fornecida tinha uma inconsistência interna
  (botão no assento 5, blinds postados pelos assentos 8/9 em vez de
  6/7) — o parser seguiu a regra padrão de poker (posição por rotação
  a partir do botão), então pode sair diferente do 888poker real se
  essa amostra não refletir o formato de verdade da sala.
- `RADAR-004` sobe de 30% pra 55% (parser implementado, não validado
  contra hand history real) — mesmo status intermediário que o
  GGPoker teve antes de ganhar amostras reais em 13/09/2026.

## 14/09/2026 — MAIN-011 (Score de evolução consolidado) concluído

A fórmula do score já existia pronta há tempos na view
`player_performance_snapshot` do Supabase (5 componentes ponderados:
técnica 25%, conhecimento 20%, disciplina 20%, performance 20%,
consistência 15%, com neutro=50 quando falta dado), mas nunca tinha
sido exibida em nenhuma tela do produto — só foi possível achar isso
consultando o banco diretamente (Supabase MCP), já que não há migração
SQL desse objeto commitada no repositório.

- Criado `components/analysis/EvolutionScoreCard.tsx`: número final
  (0-100) + nível (`nivelDoScore`) + os 5 sub-scores, cada um com hover
  explicando de onde vem o valor (pedido explícito do dono: "intuitivo,
  que ao passar o mouse mostre o que contempla aquele valor").
- Conectado em `app/performance`, acima das abas — vale pra qualquer
  aba que o jogador esteja olhando, não só uma.
- `MAIN-011` marcado como concluído/100% no `roadmap.json`. Progresso
  de Main recalculado de 67% pra 70%; Progresso Geral de 72% pra 73%.

## 14/09/2026 — Sincronização: painel visual e repositório estavam divergentes

A auditoria automática de hoje (rotina `PokerSync Cockpit — auditoria
diária`) fez um trabalho correto e rigoroso — achou que `MAIN-007`
(cEV/ICM por mão) tinha sido marcado "concluído" ontem só pela
mensagem de um commit, sem checar que a UI de consumo foi removida do
produto horas antes. Corrigiu isso e achou `SOLVER-020` (hardening de
segurança da API), mas **só publicou a correção no painel visual — nunca
commitou de volta pro `roadmap.json`**. Os dois ficaram divergentes por
algumas horas até esta sessão notar e sincronizar.

- `MAIN-007` rebaixado de "concluído"/100% pra "atenção"/40% no
  `roadmap.json` (já estava assim no painel).
- `SOLVER-020` adicionado ao `roadmap.json` (hardening de segurança da
  API do Solver: limite de iterations, comparação de API key resistente
  a timing attack, Dockerfile sem root).
- **"Progresso Geral" corrigido de 76% pra 72%** — a sessão de ontem
  tinha trocado silenciosamente o método de cálculo pra média direta de
  todos os itens (o que super-representa Main/Solver, que têm mais
  itens rastreados que Radar) em vez da média das 3 frentes, que é o
  método documentado desde a criação do Cockpit. Voltou ao método
  original; `STATE.md` agora deixa a fórmula explícita pra evitar essa
  ambiguidade de novo.
- `meta.last_full_audit` em `roadmap.json` atualizado pra 14/09/2026
  (estava preso em 11/09/2026 apesar do trabalho real de 13 e 14/09).
- Nota: um arquivo `docs/cockpit/resumo-overnight.html` (resumo estático
  de uma sessão overnight) também apareceu no repositório em 14/09/2026
  — mantido como está, não é parte do fluxo padrão do Cockpit
  (STATE/ROADMAP/roadmap.json/painel), é um artefato pontual daquela
  sessão.

Progresso final: Main 67%, Radar 63%, Solver 87%, geral 72%.

## 13/09/2026 (parte 6) — Remoção de dado ilustrativo/de teste do estoque pós-flop

- A pedido do dono ("retire tudo que foi colocado como teste, quero só
  arquivos reais a partir de agora"), removido o único spot pós-flop
  que existia em `drills` (`postflop_river_cbet_river_dry_board`) — era
  um dado ilustrativo com ranges inventadas à mão só pra provar o
  pipeline ponta a ponta durante o desenvolvimento do motor, nunca foi
  uma situação real de mesa. Removido também o `solver_jobs` associado.
- `DEFAULT_CBET_RIVER_SPOT` removida de `jobs/solve_postflop_batch.py`
  (pokersync-solver) — o job de river continua funcionando normalmente,
  só não tem mais um exemplo fake embutido no arquivo.
- Corrigido um erro de contagem introduzido na parte 3 (abaixo): "33
  spots pré-flop" estava errado — eram 32 (12 push/fold + 20 RFI/Jam);
  o "33" incluía sem querer essa linha de teste, que nem era pré-flop.
- Investigação nesse processo (registrada em `roadmap.json`, MAIN-021):
  hoje NÃO existe estoque pós-flop real nenhum, e a tela de Modo Treino
  só sabe renderizar o formato de spot do RFI/Jam — um componente de UI
  mais antigo (`components/drill/range-drill.tsx`) sabe ler um formato
  genérico de GTO, mas não está conectado a nenhuma tela do produto.
  Construir o pipeline pós-flop de verdade (MAIN-021) exige ranges reais
  por spot (trabalho de conteúdo, não só código), um componente de UI
  novo pra árvore de decisão do river/turn/flop, e integração com o
  sistema de sugestão leak→treino — maior que uma sessão só.

## 13/09/2026 (parte 5) — MAIN-007 concluído: env vars já estavam configuradas

- Ao pedir pro dono checar o painel do Vercel, descobrimos que
  `SOLVER_API_URL` e `SOLVER_API_KEY` **já estavam configuradas em
  Production desde 03/09/2026** — a suposição (registrada na parte 4,
  abaixo) de que faltava esse passo manual estava desatualizada.
- `MAIN-007` e `SOLVER-013` marcados como concluídos.
- Progresso recalculado: Main 69%→70%, geral 75%→76% (Solver e Radar
  sem mudança).
- Próximo passo real do item: só falta validar com uma mão all-in
  elegível de verdade no Revisor pra confirmar que o cálculo aparece na
  UI ponta a ponta.

## 13/09/2026 (parte 4) — BLOQUEIO-001 resolvido: deploy do Solver confirmado ativo

- O dono confirmou que `https://pokersync-solver-production.up.railway.app`
  está no ar e responde `/health` — a ambiguidade registrada em
  `BLOCKERS.md` desde 21/08/2026 está resolvida.
- `SOLVER-018` (deploy Railway) marcado como concluído.
- `SOLVER-013` e `MAIN-007` (cEV/ICM por mão) sobem de "bloqueado" pra
  "atenção" — achávamos nesse momento que ainda faltava configurar
  `SOLVER_API_URL`/`SOLVER_API_KEY` no Vercel (ver correção acima, na
  parte 5, feita minutos depois).
- Progresso recalculado a partir de `roadmap.json` (a fórmula descrita em
  `STATE.md` — média de progresso por frente): Main 59%→69%, Solver
  79%→86%, geral 67%→75%. Radar ficou em 63% (sem itens alterados).

## 13/09/2026 (parte 3) — Limpeza do arquivo de backup órfão (MAIN-025)

- Removido `app/modulos/_backup-page.tsx` (backup deliberado da tela de
  Módulos anterior ao redesenho com sidebar, agosto/2026) — confirmado
  com o dono que o redesenho já está estabilizado e divergiu demais do
  backup (404 linhas vs 62, já tem Metas/Recados do Coach) pra continuar
  valendo como rede de segurança; o histórico do git cobre isso.
- `MAIN-025` marcado como concluído.

## 13/09/2026 (parte 2) — engine_version em hand_ev_results (MAIN-023)

- Coluna `engine_version` adicionada à tabela `hand_ev_results` via
  migration.
- `compute_hand_cev()` e `compute_hand_cev_multiway()` (pokersync-solver)
  agora retornam `engine_version` (`pokersync-solver-v1.0.0-hand-cev` e
  `-hand-cev-multiway`), seguindo a mesma convenção dos jobs em lote.
- A rota `app/api/hand-ev/compute/route.ts` grava esse valor junto com o
  resto do resultado; `HandEvResult`/`hand-ev-service.ts` expõe
  `engineVersion` pro resto do produto.
- `exploitability` não se aplica a esses dois endpoints (cálculo
  analítico de uma mão específica, não solve iterativo) — decisão
  registrada em `DECISIONS.md` (ADR-011).
- `MAIN-023` marcado como concluído.

## 13/09/2026 — Correções de dados/UI e ampliação do estoque pré-flop do Modo Treino

**Correções (Player Evolution / Gestão de Banca / Revisor)**
- ROI/ITM/buy-in médio/streaks estavam diluídos por torneios importados
  sem buy-in conhecido — `fetchTournamentMetrics` agora só considera
  torneios com `hand_sessions.buyin` preenchido.
- Removidas 58 linhas de teste/fake em `tournament_payouts` (todas com
  `source="agent"`, sem `hero_payout_amount`, geradas no mesmo minuto).
- Isolamento de dados garantido nos dois sentidos: mãos importadas
  manualmente no Revisor (`source` fora de `agent`/`import`) não entram
  mais em Player Evolution nem em Gestão de Banca, e confirmado que
  Gestão de Banca nunca afeta os demais (FKs são `ON DELETE SET NULL`,
  não `CASCADE`).
- Corrigido bug que impedia excluir uma sessão "Importada" em Gestão de
  Banca: a sincronização automática recriava a sessão apagada. Nova
  coluna `hand_sessions.bankroll_excluded` marca a exclusão manual sem
  afetar Player Evolution/Revisor.
- Removida a seção inteira de cEV/ICM de `StatisticsTab` (painel, cálculo
  automático, estado associado) a pedido do dono — feature adiada.

**Correções (Revisor de Mãos)**
- Badge de bounty reposicionado pra não sobrepor mais o nome do jogador
  (`bottom: 100%` em vez de posição absoluta sobre a placa).
- No celular, o seat do topo (posições ímpares de jogadores) estava muito
  próximo do centro da mesa — corrigido o cálculo de layout.
- Removido o replayer da tela "Analisar mão" (desktop e mobile) — no
  celular ele quebrava visualmente e a mesa completa já não aparecia
  mais nessa tela de qualquer forma.
- Pendente: pedido de remover o "ante" da UI do Revisor não foi
  localizado no código (não há nenhum texto/label visível de ante) —
  aguardando o dono apontar exatamente onde aparece (print ajudaria).

**Estoque pré-flop do Modo Treino (MAIN-022, SOLVER-006)**
- Gerados e gravados na tabela `drills` do Supabase (projeto
  `olgziujndtlvxegcnaoq`), via chamadas diretas ao motor Python
  (sem `SUPABASE_SERVICE_ROLE_KEY` disponível na sessão — inserção feita
  via SQL direto):
  - 8 novos spots de **push/fold ICM** (`sb_vs_bb`): 40, 60, 75, 100bb
    (somados aos 25bb já existente e aos 8/12/15bb re-upados com
    arredondamento), totalizando 12 stacks: 8/10/12/15/20/25/30/40/50/
    60/75/100bb.
  - 12 novos spots de **RFI/Jam**: stacks 10/20/30/50/75/100bb em
    `sb_vs_bb` e `btn_vs_bb`, somados aos 4 já existentes por matchup
    (15/25/40/60bb), totalizando 10 stacks por matchup (10 a 100bb).
  - Estoque pré-flop total: 32 spots (12 push/fold + 20 RFI/Jam ativo em
    Modo Treino), acima dos 8 spots que existiam antes desta sessão.
    (Correção 13/09: o número "33" citado originalmente aqui incluía por
    engano 1 spot pós-flop ilustrativo/de teste, removido depois — ver
    entrada mais recente abaixo.)
  - `MAIN-022` e `SOLVER-006` marcados como concluídos no roadmap.
- README do `pokersync-solver` ganhou seções documentando
  `compute_cev_multiway` (cEV/ICM multiway) e `compute_action_evs`
  (EV por ação pós-flop), além de nota sobre o status ambíguo do deploy
  no Railway (ver `BLOCKERS.md`).
- Estoque pós-flop (o maior leak real dos usuários) continua pendente —
  depende do pipeline ponta a ponta de MAIN-021, não gerado nesta sessão.

## 11/09/2026 (parte 2) — POKERSYNC.md removido, painel com identidade visual real

- `POKERSYNC.md` excluído a pedido do dono — o Cockpit (`docs/cockpit/`)
  passa a ser a única fonte de verdade. Os 4 comentários de código que
  apontavam pra ele foram atualizados pra apontar pro Cockpit.
- Painel visual redesenhado pra usar a identidade real do produto (lida
  em `app/globals.css` e `lib/modules-data.tsx`): fundo preto puro,
  fonte Space Grotesk, verde/índigo/dourado como cor de Main/Solver/
  Radar (o dourado é literalmente o accent do módulo Radar no app).
  Responsivo (colunas empilham abaixo de 860px).
- Idea Bank do painel passou a ser ao vivo (capacidade `db` do
  Artifact): qualquer ideia nova discutida na conversa é adicionada por
  quem estiver desenvolvendo, sem precisar editar `IDEAS.md` à mão.
  `IDEAS.md` continua existindo como snapshot legível fora do painel.

## 11/09/2026

**Cockpit**
- Criado o sistema de Cockpit (`docs/cockpit/`): `STATE.md`,
  `ROADMAP.md`, `roadmap.json`, `IDEAS.md`, `DECISIONS.md`,
  `BLOCKERS.md`, `CHANGELOG.md` (este arquivo).
- Auditoria completa de código nos dois repositórios (`pokersync` commit
  `2e68893`, `pokersync-solver` commit `a272ae5`) — não só leitura de
  commits, leitura de código de verdade.
- Progresso calculado a partir de `roadmap.json`: Main 59%, Radar 63%,
  Solver 79%, geral 67%.

**Achados da auditoria (Main)**
- `POKERSYNC.md` estava 104 commits desatualizado (~2 semanas).
- Marketplace de Vagas dos Times: módulo novo, concluído.
- Conquista Founder (Achievements): concluída, concessão automática no
  pagamento confirmada no código.
- Sessão diária retomável no Modo Treino: concluída.
- LGPD (Termos, Privacidade, consentimento, exportação/exclusão de
  conta): concluída nas peças centrais.
- Correções de segurança (vazamento de dados em `profiles`, RPCs sem
  checagem de auth, rate limit de login, webhook Stripe): confirmadas
  presentes no código atual.
- Chat: módulo pré-existente de 730 linhas, nunca tinha sido
  documentado — adicionado ao Cockpit agora.
- Esclarecido: "Radar PokerSync" é uma frente só (addon + agente
  desktop), não dois módulos — ver ADR-014.

**Achados da auditoria (Solver)**
- `compute_action_evs` (EV por ação pós-flop): implementado e testado,
  não estava no README.
- `compute_cev_multiway`: endpoint existe e testado em CI, ausente do
  README e não consumido pelo produto ainda.
- CI (GitHub Actions) confirmado real: 17 scripts de teste rodando a
  cada push/PR.
- Status de deploy no Railway ficou ambíguo — registrado como
  BLOQUEIO-001 em vez de assumido pra qualquer lado.

**Decisões**
- Registrada ADR-014 (Radar é uma frente única) e ADR-015 (código é
  sempre a fonte de verdade do Cockpit).

---

## Antes de 11/09/2026

Histórico completo até 27/08/2026 preservado em `POKERSYNC.md` §9 (Main)
e no README do `pokersync-solver` (histórico de commits). Não duplicado
aqui — este changelog começa a partir da criação do Cockpit.
