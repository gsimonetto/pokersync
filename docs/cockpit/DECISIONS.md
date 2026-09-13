# PokerSync — Architecture Decisions

> As decisões 001–013 já existiam em `POKERSYNC.md` (§5) — reproduzidas
> aqui no formato ADR do Cockpit, sem mudar o conteúdo. Novas decisões
> entram só a partir da 014.

### ADR-001 — O produto não é apenas um organizador de dados
**Decisão:** o PokerSync deve usar dados para ajudar o jogador a evoluir.
**Motivo:** a visão evoluiu de centralização para evolução contínua.
**Impacto:** toda funcionalidade nova precisa gerar ação, não só relatório.
**Data:** 30/07/2026

### ADR-002 — Integração entre módulos é prioridade
**Decisão:** os módulos compartilham contexto quando isso gera valor.
**Motivo:** mãos revisadas devem gerar sugestões de treino, e assim por diante.
**Impacto:** nenhum módulo deve ser construído isolado dos demais.
**Data:** 30/07/2026

### ADR-003 — Review não depende de solver na V1
**Decisão:** o Review de Mãos funciona sem GTO Wizard, PIO ou solver externo.
**Motivo:** reduzir a barreira de entrada e entregar valor desde o início.
**Impacto:** o veredito do Revisor vem da aderência às ranges do próprio
jogador; o motor próprio é reforço opcional, não requisito.
**Data:** 30/07/2026

### ADR-004 — Entrada manual deve existir
**Decisão:** o usuário nunca será obrigado a instalar agente desktop.
**Motivo:** reduzir fricção de adoção.
**Impacto:** toda funcionalidade que depende de hand history precisa de
caminho manual.
**Data:** 30/07/2026

### ADR-005 — Agente desktop é caminho futuro
**Decisão:** o agente é alternativa de automação, não dependência.
**Motivo:** consistente com ADR-004.
**Impacto:** Radar PokerSync (agente) sempre opcional.
**Data:** 30/07/2026

### ADR-006 — Gestor de Banca deve evoluir para performance
**Decisão:** o módulo vai além de saldo e resultado — hábitos, metas,
sessões, evolução.
**Motivo:** banca sozinha não gera aprendizado.
**Impacto:** Banca ganhou KPIs, alertas, diário, staking.
**Data:** 30/07/2026

### ADR-007 — Times são uma extensão natural
**Decisão:** a arquitetura permite jogadores, coaches, métricas e
performance de times sobre a mesma base.
**Motivo:** reaproveitar dados individuais em contexto de time.
**Impacto:** Plataforma para Times construída sobre as mesmas tabelas.
**Data:** 30/07/2026

### ADR-008 — Slogan
**Decisão:** PokerSync — Organize. Estude. Evolua.
**Motivo:** resumir a proposta de valor em três verbos.
**Impacto:** usado em copy de produto e onboarding.
**Data:** 30/07/2026

### ADR-009 — Motor GTO próprio, em repositório separado
**Decisão:** o PokerSync tem motor próprio (CFR com desconto + ICM), num
repositório à parte, com deploy independente.
**Motivo:** ADR-003 fala sobre dependência de solver externo, não sobre
capacidade interna. Ter o motor em casa dá controle sobre formato, custo
e convergência; mantê-lo fora do repo do produto impede que uma mudança
no motor derrube a plataforma.
**Impacto:** nasceu o repositório `pokersync-solver`.
**Data:** 21/08/2026 (registrada — já valia na prática antes)

### ADR-010 — Nada de solve em tempo real
**Decisão:** spots são resolvidos em lote, offline, e gravados na tabela
`drills`. A API do motor só dispara e monitora jobs.
**Motivo:** um spot de RFI/Jam leva milhões de iterações; resolver sob
demanda tornaria a tela refém do motor.
**Impacto:** toda tela de treino consome estoque pré-computado.
**Data:** 21/08/2026 (registrada — já valia na prática antes)

### ADR-011 — Convergência sempre carimbada no dado
**Decisão:** toda linha gravada pelo motor leva `engine_version` e
`exploitability`.
**Motivo:** a ausência desse log tornou o diagnóstico do pipeline antigo
(TexasSolver) muito lento.
**Impacto:** MAIN-023 — aplicada em `hand_ev_results` em 13/09/2026.
Nota: `exploitability` não se aplica aos endpoints `compute_cev`/
`compute_cev_multiway` (são cálculo analítico/EV direto de uma mão já
jogada, não um solve iterativo de estratégia) — só `engine_version` é
gravado ali.
**Data:** 21/08/2026 (registrada — já valia na prática antes)

### ADR-012 — Estrutura mínima aceita: ICM primeiro
**Decisão:** os spots pré-flop são resolvidos com ICM (torneio), não em
ChipEV puro.
**Motivo:** é o contexto real do público-alvo.
**Impacto:** ChipEV entra como modo alternativo (SOLVER-008), não padrão.
**Data:** 21/08/2026 (registrada — já valia na prática antes)

### ADR-013 — Resolução sob demanda, só pra cEV/ICM de mão jogada
**Decisão:** a exceção prevista na ADR-010 aconteceu — `POST
/hands/compute_cev` no `pokersync-solver` resolve sob demanda, mas só o
EV analítico de UMA mão específica já jogada, all-in heads-up com as
duas mãos mostradas no showdown. Não é solve de spot.
**Motivo:** cEV/ICM por mão exige o resultado de UM confronto específico,
não dá pra pré-computar em lote sem saber quais mãos serão jogadas.
**Impacto:** ADR-011 aplicada em `hand_ev_results` em 13/09/2026 (MAIN-023).
**Data:** 27/08/2026

### ADR-014 — "Radar" é uma frente, não dois módulos
**Decisão:** o Cockpit trata "Radar PokerSync" como uma frente única
que engloba o addon in-app (`/radar`, `RadarPanel`) e o agente desktop
(repositório `pokersync-agent`) que o alimenta — não como duas
funcionalidades separadas.
**Motivo:** auditoria de código confirmou que são a mesma coisa sob dois
ângulos (o agente foi literalmente renomeado para "Radar PokerSync" em
11/09/2026); documentá-los separadamente geraria duplicação e confusão.
**Impacto:** ver `ROADMAP.md` — seção "Radar PokerSync".
**Data:** 11/09/2026

### ADR-015 — O Cockpit é fonte de verdade sobre desenvolvimento; código continua sendo fonte de verdade sobre o produto
**Decisão:** nenhum item deste Cockpit é marcado como concluído sem
verificação no código, banco, rotas ou testes reais — nunca só porque um
comentário ou checkbox diz que está pronto.
**Motivo:** pedido explícito do dono do projeto; evita que a
documentação vire ficção conforme o código evolui.
**Impacto:** toda sessão de desenvolvimento deve reconferir `STATE.md`/
`ROADMAP.md` contra o código antes de confiar neles, e atualizá-los ao
final.
**Data:** 11/09/2026

---

## Regras de evolução do produto

> Resgatadas dos documentos originais de 30/07/2026 (`Product Vision &
> Roadmap` e `AI Context`) — existiam antes do Cockpit, mas nunca tinham
> migrado pra cá. Valem tanto pra decisão humana quanto pra qualquer IA
> trabalhando no projeto.

**Regra do roadmap** — toda funcionalidade nova deve:
1. fortalecer um módulo existente; **ou**
2. criar uma integração útil entre módulos; **ou**
3. contribuir claramente para a evolução do jogador ou do time.

O PokerSync não deve virar um conjunto de ferramentas isoladas.

**Antes de implementar qualquer coisa, perguntar:**
1. A funcionalidade fortalece a visão do produto?
2. Existe módulo relacionado — e o item já não está feito? (conferir
   `ROADMAP.md` antes de abrir tarefa — muita coisa que parecia
   pendente já está no ar)
3. Há integração com outro módulo que deveria vir junto?
4. Está duplicando algo sem benefício claro?
5. A UX é simples o bastante para um jogador em sessão?
