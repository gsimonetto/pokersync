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

## POKERSYNC — Progresso Geral: 76%

🟢 Main    ██████████████░░░░░░ 70%  (25 itens rastreados)
🔵 Radar   █████████████░░░░░░░ 63%  (4 itens rastreados)
🟣 Solver  █████████████████░░░ 86%  (19 itens rastreados)

━━━━━━━━━━━━━━━━━━━━━━

## ONDE ESTAMOS?

### PokerSync Main — 70% completo
**Trabalho atual:** nenhuma frente "em progresso" ativa no momento da
auditoria — o repositório está numa sequência de módulos concluídos
(Marketplace, Conquistas, LGPD, segurança) sem nada pela metade.
**Próximo:** 🔴 P0 — Pipeline pós-flop ponta a ponta (job → contrato →
UI), porque os 5 leaks reais da base de usuários são todos pós-flop e
sem isso o loop "leak vira treino" não fecha de verdade.
**Bloqueio:** nenhum — cEV/ICM por mão (MAIN-007) concluído em
13/09/2026: deploy do Solver confirmado ativo e as env vars já estavam
configuradas no Vercel desde 03/09/2026 (a suposição de que faltava
configurar era desatualizada).

### PokerSync Solver — 86% completo
**Trabalho atual:** motor multiway (squeeze) — arquitetura pronta e
bugs graves corrigidos nesta janela, falta validar num spot real.
**Próximo:** 🟠 P1 — validar squeeze multiway num spot real (SOLVER-016).
**Bloqueio:** nenhum.

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

🔴 P0 — Pipeline pós-flop ponta a ponta (destrava o loop leak → treino)
🟠 P1 — Validar agente desktop (Radar) contra instalações reais
🟠 P1 — Validar squeeze multiway num spot real (SOLVER-016)

━━━━━━━━━━━━━━━━━━━━━━

## EM PROGRESSO

Nenhum item com trabalho ativo identificado nesta auditoria (o último
ciclo de commits fechou tudo que estava aberto). Os itens "parciais"
listados no roadmap estão parados, não em desenvolvimento no momento.

━━━━━━━━━━━━━━━━━━━━━━

## BLOQUEIOS

Nenhum bloqueio ativo (ver `BLOCKERS.md`).

━━━━━━━━━━━━━━━━━━━━━━

## ÚLTIMA ATUALIZAÇÃO

11/09/2026 — auditoria completa dos dois repositórios (código, não só
commits), criação do Cockpit.

13/09/2026 — estoque pré-flop de Modo Treino ampliado: 12 spots de
push/fold ICM (8 a 100bb, sb_vs_bb) e 20 spots de RFI/Jam (10 a 100bb,
sb_vs_bb e btn_vs_bb) gerados pelo motor e gravados na tabela `drills`
via SQL direto (sem credencial de service role disponível na sessão).
MAIN-022 e SOLVER-006 marcados como concluídos. Ver `CHANGELOG.md` para
detalhes completos da sessão.
