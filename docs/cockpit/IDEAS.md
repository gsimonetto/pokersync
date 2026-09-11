# 💡 IDEA BANK

> Ideias não entram direto no roadmap. Entram aqui primeiro; só viram
> item de `roadmap.json` quando promovidas explicitamente.

Estados: 💡 NOVA · 🔎 AVALIAR · 📌 PLANEJADA · 🛠️ EM DESENVOLVIMENTO ·
✅ INCORPORADA · ❌ DESCARTADA

---

### IDEA-001 — Reconciliar o roadmap externo (`pokersync-road-map`)
**Descrição:** o board visual separado (TanStack Start/Lovable) mostra
tudo como "Planejado", inclusive módulos que já estão no ar há semanas.
Ou ele é atualizado pra bater com a realidade, ou é aposentado em favor
deste Cockpit (que já cumpre o mesmo papel e se auto-atualiza).
**Frente:** Main (documentação/processo)
**Prioridade:** ⚪ P3
**Status:** 🔎 AVALIAR

### IDEA-002 — Tela de gestão de consentimentos LGPD
**Descrição:** hoje o consentimento é gravado no login mas o usuário não
tem onde ver histórico ou revogar. Avaliar com a skill `dpo-lgpd-senior`
se isso é exigência real pro perfil de dados do PokerSync.
**Frente:** Main (LGPD)
**Prioridade:** 🟡 P2
**Status:** 🔎 AVALIAR

### IDEA-003 — Documentar `compute_cev_multiway` e `compute_action_evs` no README do Solver
**Descrição:** os dois endpoints existem, estão testados em CI, mas o
README nunca foi atualizado depois de implementados — achado pela
auditoria de 11/09/2026.
**Frente:** Solver (documentação)
**Prioridade:** 🟡 P2
**Status:** 📌 PLANEJADA (baixo esforço, sem dependência)

### IDEA-004 — Limpar `app/modulos/_backup-page.tsx`
**Descrição:** arquivo de rascunho/backup encontrado no repositório do
Main, sem uso aparente. Confirmar com o dono antes de apagar.
**Frente:** Main (limpeza)
**Prioridade:** ⚪ P3
**Status:** 💡 NOVA

### IDEA-005 — Corrigir comentário desatualizado em `achievements-service.ts`
**Descrição:** o comentário diz que "nenhum critério automático concede"
a conquista Founder, mas o código já concede automaticamente no
pagamento desde um commit posterior. Comentário engana quem ler depois.
**Frente:** Main (qualidade de código)
**Prioridade:** ⚪ P3
**Status:** 📌 PLANEJADA

### IDEA-006 — Integrações externas de dados
**Descrição:** ideia original dos documentos de 30/07/2026, mantida:
integrações com fontes de dados externas (ex: sites de estatística de
torneio).
**Frente:** Main
**Prioridade:** ⚪ P3
**Status:** 💡 NOVA

### IDEA-007 — Integrações opcionais com solvers de terceiros
**Descrição:** ideia original, hoje parcialmente superada pelo motor
próprio (`pokersync-solver`) — mas pode voltar a fazer sentido pra
validação cruzada.
**Frente:** Solver
**Prioridade:** ⚪ P3
**Status:** ❌ DESCARTADA (superada pelo motor próprio; reabrir só se
houver necessidade concreta de validação cruzada)

---

## Como usar

1. Qualquer descoberta durante o desenvolvimento que não seja bug nem
   tarefa já planejada vira uma entrada aqui, sem interromper o roadmap.
2. Uma ideia só sai do Idea Bank quando promovida — aí ganha um ID
   `MAIN-`/`SOLVER-`/`RADAR-` em `roadmap.json` e o estado aqui vira
   ✅ INCORPORADA (ou ❌ DESCARTADA, se decidido não fazer).
