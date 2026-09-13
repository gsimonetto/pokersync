# PokerSync — Changelog do Cockpit

> Só entradas curtas. Detalhe técnico completo continua nos commits e
> no `POKERSYNC.md`/README do Solver — aqui é o resumo pra quem só quer
> saber "o que mudou".

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
  - Estoque pré-flop total: 33 spots (12 push/fold + 20 RFI/Jam ativo em
    Modo Treino), acima dos 8 spots que existiam antes desta sessão.
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
