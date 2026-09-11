# PokerSync — Estado Atual (Cockpit)

> Leia este arquivo primeiro em qualquer nova sessão. Depois leia
> `ROADMAP.md` e `BLOCKERS.md`, e só então confira o código pra ver se
> continuam corretos.

**Painel visual:** <https://claude.ai/code/artifact/c5084416-d934-49d1-8ab1-ec2a41f4920f>
— mesma informação deste diretório, em formato de dashboard, com a
identidade visual do produto (fundo preto, Space Grotesk, cores por
frente) e um Idea Bank ao vivo (dá pra adicionar ideia direto no painel,
sem editar arquivo).

**`POKERSYNC.md` foi removido** em 11/09/2026 — o Cockpit é agora a
única fonte de verdade sobre estado de desenvolvimento. Não recriar.

**Última auditoria completa:** 11/09/2026 — código dos repositórios
`pokersync` (commit `2e68893`) e `pokersync-solver` (commit `a272ae5`)
lido linha a linha, não só mensagens de commit.

**Como o progresso é calculado:** cada item do `roadmap.json` recebe um
número (concluído=100, planejado=0, parcial/bloqueado/em progresso = uma
estimativa a partir do que existe de fato no código). O progresso de cada
frente é a média simples dos itens dela. Não é uma opinião — é o cálculo
sobre `roadmap.json`, que qualquer um pode reproduzir.

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC — Progresso Geral: 67%

🟢 Main    ████████████░░░░░░░░ 59%  (24 itens rastreados)
🔵 Radar   █████████████░░░░░░░ 63%  (4 itens rastreados)
🟣 Solver  ████████████████░░░░ 79%  (18 itens rastreados)

━━━━━━━━━━━━━━━━━━━━━━

## ONDE ESTAMOS?

### PokerSync Main — 59% completo
**Trabalho atual:** nenhuma frente "em progresso" ativa no momento da
auditoria — o repositório está numa sequência de módulos concluídos
(Marketplace, Conquistas, LGPD, segurança) sem nada pela metade.
**Próximo:** 🔴 P0 — Pipeline pós-flop ponta a ponta (job → contrato →
UI), porque os 5 leaks reais da base de usuários são todos pós-flop e
sem isso o loop "leak vira treino" não fecha de verdade.
**Bloqueio:** cEV/ICM por mão jogada está pronto no código dos dois lados
e travado só pelo status do deploy do Solver (ver Blocos abaixo).

### PokerSync Solver — 79% completo
**Trabalho atual:** motor multiway (squeeze) — arquitetura pronta e
bugs graves corrigidos nesta janela, falta validar num spot real.
**Próximo:** 🔴 P0 — resolver a ambiguidade do deploy no Railway (ver
Bloqueios) — é o item que, sozinho, destrava mais valor no produto.
**Bloqueio:** nenhum bloqueio técnico interno; o bloqueio é de decisão/
confirmação com o dono do projeto sobre o deploy.

### Radar PokerSync (addon + agente desktop) — 63% completo
**Trabalho atual:** validar o agente desktop (Tauri/Rust, repositório
`pokersync-agent`, fora do escopo de repositórios desta sessão) contra
instalações reais de usuários.
**Próximo:** 🟠 P1 — confirmar tráfego real via `/api/agent/sync` e
suporte a PartyPoker/888poker (hoje só chegam como dado bruto).
**Bloqueio:** nenhum — depende de tempo de uso real, não de código.

**Nota de nomenclatura:** "Radar" não é um terceiro produto/repositório
separado. É um addon pago dentro do Main (`/radar`, painel reaproveitado
em Player Evolution) mais o agente desktop que o alimenta — o agente foi
renomeado de "PokerSync Agent" para "Radar PokerSync" em 11/09/2026, mas
seu código vive no repositório `pokersync-agent`, que não está anexado a
esta sessão. Tratamos como frente própria no Cockpit porque é assim que
o dono pensa o produto, mas a fonte de verdade do agente em si só pode
ser auditada numa sessão com acesso a esse repositório.

━━━━━━━━━━━━━━━━━━━━━━

## PRÓXIMOS PASSOS (ordem de prioridade)

🔴 P0 — Reconciliar e resolver o deploy do `pokersync-solver` (destrava cEV/ICM)
🔴 P0 — Pipeline pós-flop ponta a ponta (destrava o loop leak → treino)
🟠 P1 — Gerar estoque pré-flop push/fold ICM (10/20/30/50bb) — só falta disparar
🟠 P1 — Validar agente desktop (Radar) contra instalações reais

━━━━━━━━━━━━━━━━━━━━━━

## EM PROGRESSO

Nenhum item com trabalho ativo identificado nesta auditoria (o último
ciclo de commits fechou tudo que estava aberto). Os itens "parciais"
listados no roadmap estão parados, não em desenvolvimento no momento.

━━━━━━━━━━━━━━━━━━━━━━

## BLOQUEIOS

🔴 **Solver** — status de deploy no Railway é ambíguo (ver `BLOCKERS.md`)
🔴 **Main** — cEV/ICM por mão depende do bloqueio acima

━━━━━━━━━━━━━━━━━━━━━━

## ÚLTIMA ATUALIZAÇÃO

11/09/2026 — auditoria completa dos dois repositórios (código, não só
commits), criação do Cockpit.
