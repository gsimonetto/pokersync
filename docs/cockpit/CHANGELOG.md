# PokerSync — Changelog do Cockpit

> Só entradas curtas. Detalhe técnico completo continua nos commits e
> no `POKERSYNC.md`/README do Solver — aqui é o resumo pra quem só quer
> saber "o que mudou".

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
