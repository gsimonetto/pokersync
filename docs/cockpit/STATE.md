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

**Última auditoria completa:** 14/09/2026 — código dos repositórios
`pokersync` e `pokersync-solver` lido linha a linha, não só mensagens
de commit. Este Cockpit vem sendo mantido colaborativamente desde
11/09/2026: tanto pela rotina automática diária (`trig_01NTMk54bjqESZjueiY5Znbe`)
quanto por sessões de desenvolvimento normais que tocam nestes arquivos
como parte do trabalho — ver `CHANGELOG.md` pra o histórico completo.

**Como o progresso é calculado:** cada item do `roadmap.json` recebe um
número (concluído=100, planejado=0, parcial/bloqueado/em progresso = uma
estimativa a partir do que existe de fato no código). O progresso de
cada frente é a média simples dos itens dela. **O "Progresso Geral" é a
média das 3 médias por frente** (não a média direta de todos os itens
juntos — isso pesaria demais as frentes com mais itens rastreados, hoje
Main e Solver, em vez de tratar as 3 frentes como igualmente
importantes). Não é uma opinião — é o cálculo sobre `roadmap.json`, que
qualquer um pode reproduzir.

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC — Progresso Geral: 80%

🟢 Main    ████████████████░░░░ 80%  (28 itens rastreados)
🔵 Radar   ███████████████░░░░░ 74%  (9 itens rastreados)
🟣 Solver  █████████████████░░░ 87%  (20 itens rastreados)

━━━━━━━━━━━━━━━━━━━━━━

## ONDE ESTAMOS?

### PokerSync Main — 72% completo
**Trabalho atual:** nenhuma frente "em progresso" ativa — o repositório
está numa sequência de módulos concluídos (Marketplace, Conquistas,
LGPD, segurança, Score de Evolução, Sync com agente desktop) sem nada
pela metade.
**Próximo:** 🔴 P0 — Pipeline pós-flop ponta a ponta (job → contrato →
UI), porque os 5 leaks reais da base de usuários são todos pós-flop e
sem isso o loop "leak vira treino" não fecha de verdade.
**Atenção:** ⚠️ cEV/ICM por mão (MAIN-007) foi marcado "concluído" em
13/09/2026 com base só na mensagem de um commit — auditoria de
14/09/2026 achou que a UI de consumo (painel "cEV & ICM") tinha sido
removida do produto em 12/09/2026 e nunca foi reconectada. Motor e
deploy do Solver (SOLVER-013/SOLVER-018) continuam prontos; falta só a
camada de produto. Rebaixado pra "atenção", 40%.

### PokerSync Solver — 87% completo
**Trabalho atual:** motor multiway (squeeze) — arquitetura pronta e
bugs graves corrigidos nesta janela, falta validar num spot real.
**Próximo:** 🟠 P1 — validar squeeze multiway num spot real (SOLVER-016).
**Bloqueio:** nenhum.

### Radar PokerSync (addon + agente desktop) — 74% completo
**Trabalho atual (25/09/2026):** auditoria ponta a ponta com o repositório
`pokersync-radar` anexado e lido linha a linha (a primeira desde que o
agente existe). Achados: a única versão publicada era a 0.1.0 de 08-09/09,
marcada como pré-lançamento, sem nenhuma das correções de 10-20/09 e sem
atualização automática; o site encerrava TODAS as sessões da conta no
"Sair", na saída por inatividade e no próprio login com Google do Radar
(o Radar caía quase todo dia); o link de volta do navegador nunca foi
registrado (configuração no lugar errado); "só a partir de agora" não
filtrava nada; o envio não conferia o plano; o seletor do Radar nos
módulos estava quebrado (migration de 21/09 nunca aplicada); ícone era um
quadrado azul provisório. Tudo corrigido (RADAR-002 e RADAR-005 a 008);
versão 0.2.0 testada ponta a ponta contra servidor de teste.
**Próximo:** 🔴 P0 — publicar a 0.2.0 (RADAR-006) e o dono reinstalar uma
vez; depois 🟡 P2 — leitor da ACR (RADAR-009, precisa de arquivo real).
**Bloqueio:** a publicação depende dos secrets de assinatura da
atualização (`TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD`) no repositório do
Radar — conferir antes de rodar a release.

**Nota de nomenclatura:** "Radar" não é um terceiro produto. É um addon
pago dentro do Main (`/radar`, painel reaproveitado em Performance) mais o
programa desktop que o alimenta (repositório `gsimonetto/pokersync-radar`,
ex-`pokersync-agent`, renomeado pra "Radar PokerSync" em 11/09/2026).

━━━━━━━━━━━━━━━━━━━━━━

## PRÓXIMOS PASSOS (ordem de prioridade)

🔴 P0 — Publicar o Radar 0.2.0 (RADAR-006 — sem isso o Radar dos jogadores continua na 0.1.0, que cai e não se atualiza)
🔴 P0 — Pipeline pós-flop ponta a ponta (destrava o loop leak → treino)
🔴 P0 — Reconstruir a UI de cEV/ICM no produto (MAIN-007 — motor pronto, falta a tela)
🟠 P1 — Validar squeeze multiway num spot real (SOLVER-016)
🟡 P2 — Validar parser de PartyPoker/888poker contra hand history real (RADAR-004)

━━━━━━━━━━━━━━━━━━━━━━

## EM PROGRESSO

Nenhum item com trabalho ativo identificado nesta auditoria. Os itens
"parciais"/"atenção" listados no roadmap estão parados, não em
desenvolvimento no momento.

━━━━━━━━━━━━━━━━━━━━━━

## BLOQUEIOS

Nenhum bloqueio ativo (ver `BLOCKERS.md`). Há 1 item em "atenção"
(MAIN-007) — não é bloqueio, é trabalho de produto pendente.

━━━━━━━━━━━━━━━━━━━━━━

## ÚLTIMA ATUALIZAÇÃO

14/09/2026 — RADAR-004: parser dedicado de PartyPoker e 888poker
implementado em `lib/poker/hand-parser.ts`, a partir de uma amostra de
cada (exemplo/gerada pelo dono, não capturada de mão real) — mesma
cautela já aplicada ao GGPoker antes de amostras reais. PartyPoker
ficou muito próximo do formato PokerStars já suportado; 888poker
exigiu regras próprias (linhas de ação sem ":", valores entre
colchetes). No processo, corrigido um bug introduzido nesta mesma
sessão (tornar "in chips" opcional pra aceitar os formatos novos
também fazia o parser confundir linhas do resumo final da mão com
listagem de assentos, em qualquer sala) — testado de novo contra uma
mão PokerStars sintética pra confirmar a correção. A amostra de
888poker tinha uma inconsistência interna (botão no assento 5, blinds
postados pelos assentos 8/9 em vez de 6/7); o parser seguiu a regra
padrão de poker, não a amostra, então pode sair diferente do formato
real da sala. RADAR-004 sobe de 30% pra 55% (implementado, não
validado contra hand history real).

14/09/2026 — MAIN-012 e RADAR-003 (sincronização com o agente desktop)
marcados como concluídos, com tráfego real confirmado. Verificado
direto no banco (Supabase): device Windows real de
gsimonetto1@gmail.com (`hand_sync_devices`, agent_version 0.1.0), um
batch `completed` (`hand_sync_batches`: PokerStars, 196 mãos lidas, 24
novas, 172 duplicatas, 0 erros) e as 24 mãos de fato gravadas em
`hand_reviews` com `source='agent'`. RADAR-002 subiu de 50% pra 65%
(scaffold validado em instalação real, mas o código Rust em si — repo
`pokersync-agent`/`pokersync-radar` — continua não auditado
diretamente nesta sessão).

Progresso combinado das duas entradas acima: Main 72%, Radar 63%→80%
(RADAR-002 65%, RADAR-003 100%, RADAR-004 55%), Geral 73%→80%.

14/09/2026 — MAIN-011 (Score de evolução consolidado) marcado como
concluído. A fórmula (5 componentes ponderados) já existia pronta na
view `player_performance_snapshot` desde antes, mas nunca tinha sido
exibida em nenhuma tela — achado verificando o banco de dados
diretamente (Supabase MCP), não só o código do repositório. Criado
`components/analysis/EvolutionScoreCard.tsx` e conectado em
`app/performance`: número final + nível + os 5 sub-scores com hover
explicando o que cada um mede. Progresso de Main recalculado pra 70%
(25 itens), Progresso Geral pra 73%.

14/09/2026 — sincronizado `roadmap.json` com correções que só tinham
sido aplicadas no painel visual (não no repositório): MAIN-007
rebaixado de "concluído" pra "atenção" (UI removida em 12/09, nunca
reconectada — achado verificando o código, não a mensagem de commit),
SOLVER-020 (hardening de segurança da API) adicionado. "Progresso
Geral" corrigido pra usar a média das 3 frentes (72%), não a média
direta de todos os itens (que dava 76% e superrepresentava Main/Solver
por terem mais itens rastreados que Radar).

13/09/2026 — estoque pré-flop de Modo Treino ampliado: 12 spots de
push/fold ICM (8 a 100bb, sb_vs_bb) e 20 spots de RFI/Jam (10 a 100bb,
sb_vs_bb e btn_vs_bb) gerados pelo motor e gravados na tabela `drills`.
MAIN-022 e SOLVER-006 marcados como concluídos. Deploy do Solver
confirmado ativo (SOLVER-018), arquivo de backup órfão removido
(MAIN-025), engine_version rastreado (MAIN-023). Ver `CHANGELOG.md`
para detalhes completos.

11/09/2026 — auditoria completa dos dois repositórios (código, não só
commits), criação do Cockpit.
