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
**Módulo:** Nenhum — processo/documentação, fora dos módulos do produto
**Prioridade:** ⚪ P3
**Status:** 🔎 AVALIAR

### IDEA-002 — Tela de gestão de consentimentos LGPD
**Descrição:** hoje o consentimento é gravado no login mas o usuário não
tem onde ver histórico ou revogar. Avaliar com a skill `dpo-lgpd-senior`
se isso é exigência real pro perfil de dados do PokerSync.
**Frente:** Main (LGPD)
**Módulo:** Conformidade LGPD (tela de conta/perfil — `MAIN-017`/`MAIN-018`)
**Prioridade:** 🟡 P2
**Status:** 🔎 AVALIAR

### IDEA-003 — Documentar `compute_cev_multiway` e `compute_action_evs` no README do Solver
**Descrição:** os dois endpoints existem, estão testados em CI, mas o
README nunca foi atualizado depois de implementados — achado pela
auditoria de 11/09/2026.
**Frente:** Solver (documentação)
**Módulo:** Solver (README do repo `pokersync-solver` — `SOLVER-019`)
**Prioridade:** 🟡 P2
**Status:** ✅ INCORPORADA (feito em `SOLVER-019`, ver `roadmap.json`)

### IDEA-004 — Limpar `app/modulos/_backup-page.tsx`
**Descrição:** arquivo de rascunho/backup encontrado no repositório do
Main, sem uso aparente. Confirmar com o dono antes de apagar.
**Frente:** Main (limpeza)
**Módulo:** Nenhum — limpeza de arquivo órfão em `app/modulos/`, não é um módulo do produto (`MAIN-025`)
**Prioridade:** ⚪ P3
**Status:** ✅ INCORPORADA (feito em `MAIN-025`, ver `roadmap.json`)

### IDEA-005 — Corrigir comentário desatualizado em `achievements-service.ts`
**Descrição:** o comentário diz que "nenhum critério automático concede"
a conquista Founder, mas o código já concede automaticamente no
pagamento desde um commit posterior. Comentário engana quem ler depois.
**Frente:** Main (qualidade de código)
**Módulo:** Conquistas / Achievements (`achievements-service.ts` — `MAIN-015`)
**Prioridade:** ⚪ P3
**Status:** ✅ INCORPORADA (feito em `MAIN-015`, ver `roadmap.json`)

### IDEA-006 — Integrações externas de dados
**Descrição:** ideia original dos documentos de 30/07/2026, mantida:
integrações com fontes de dados externas (ex: sites de estatística de
torneio).
**Frente:** Main
**Módulo:** A definir — vaga demais hoje pra apontar um módulo especifico;
precisa de refinamento antes (que dado, que tela consome)
**Prioridade:** ⚪ P3
**Status:** 💡 NOVA

### IDEA-007 — Integrações opcionais com solvers de terceiros
**Descrição:** ideia original, hoje parcialmente superada pelo motor
próprio (`pokersync-solver`) — mas pode voltar a fazer sentido pra
validação cruzada.
**Frente:** Solver
**Módulo:** Solver (motor `pokersync-solver`)
**Prioridade:** ⚪ P3
**Status:** ❌ DESCARTADA (superada pelo motor próprio; reabrir só se
houver necessidade concreta de validação cruzada)

### IDEA-008 — Leitura de print via IA de visão no Modo Treino
**Descrição:** decisão registrada em 08/08/2026 (changelog antigo do
produto), nunca implementada: jogador anexa print da mesa, uma IA de
visão (Edge Function no Supabase + API externa) tenta extrair os dados
da mão automaticamente, e uma tela de confirmação/correção aparece
antes de salvar — nunca aceita a leitura da IA sem revisão do jogador.
Diferente do "Upload de print" que já existe no Revisor (esse só
guarda a imagem, não lê o conteúdo). Resgatada de um arquivo antigo
que o dono enviou em 12/09/2026 — não tinha rastro em nenhum lugar do
Cockpit até então.
**Frente:** Main (Modo Treino)
**Módulo:** Modo Treino (`MAIN-003`) — não confundir com o upload de
print do Revisor de Mãos, que é outro módulo e só guarda a imagem
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-009 — Mais automações de performance
**Descrição:** item genérico do backlog original de 30/07/2026
("Ideias futuras"), nunca detalhado — não ficou claro o que significa
na prática. Resgatado por completude, mas precisa de refinamento antes
de virar algo acionável: o que, especificamente, deveria ser
automatizado em Player Evolution/Performance que hoje não é?
**Frente:** Main (Player Evolution)
**Módulo:** Performance (`MAIN-005`, ex-Player Evolution)
**Prioridade:** ⚪ P3
**Status:** 🔎 AVALIAR (vaga demais pra ir direto pro roadmap)

### IDEA-010 — Paridade competitiva do Modo Treino (vs. GTO Wizard / Upswing Lab)
**Descrição:** comparação de 14/09/2026 com os líderes de mercado focados
só em treino (GTO Wizard, Upswing Poker Lab) identificou 3 gaps que
ainda não têm rastro em nenhum item do roadmap (o gap de conteúdo
pós-flop em si já está coberto por MAIN-021, não duplicar):
1. **Feedback instantâneo por decisão** — os concorrentes dão nota/score
   na hora de cada escolha dentro do drill, não só no resultado final da
   sessão. Verificar se o Modo Treino atual já faz isso e, se não,
   avaliar incluir junto da UI nova de pós-flop (MAIN-021).
2. **Organização de drills salvos (tags/filtros/reuso)** — GTO Wizard
   deixa o usuário salvar configurações de drill com um clique e
   organizar por tag/dificuldade. Hoje nosso Modo Treino não tem esse
   conceito de "drill salvo reutilizável" pelo jogador.
3. **Modo RNG para estratégias mistas** — GTO Wizard treina o jogador a
   executar frequências mistas (ex: 30% call / 70% fold) sorteando a
   ação certa aleatoriamente respeitando a frequência, em vez de só
   cobrar a ação "pura". Não existe equivalente no nosso motor de treino.
**Frente:** Main (Modo Treino)
**Módulo:** Modo Treino (`MAIN-003`)
**Prioridade:** 🟡 P2 (avaliar depois de MAIN-021 fechar o pós-flop)
**Status:** 🔎 AVALIAR

### IDEA-011 — Stop-loss / stop-win configurável na Gestão de Banca
**Descrição:** comparação de 15/09/2026 com os líderes de mercado de
gestão de banca (Poker Income Tracker, Poker Bankroll Tracker,
PokerCharts) identificou essa lacuna: hoje o módulo de banca
(`lib/bankroll/coach.ts`) só tem um alerta fixo de downswing (10/20
buy-ins) dentro do Coach — não existe um limite de perda/ganho que o
próprio jogador defina por sessão/dia/semana (ex: "parar aos -3
buy-ins hoje"). É o recurso mais citado como padrão nos concorrentes e
o gap mais visível encontrado na auditoria.
**Frente:** Main (Gestão de Banca)
**Módulo:** Gestor de Banca (`MAIN-001`, tela `app/banca`)
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-012 — Notificações proativas de limites de banca (stop-loss/BRM)
**Descrição:** decorre da IDEA-011 — hoje os alertas do Coach e do BRM
(`notifyBrmAlert()` em `bankroll-service.ts`) só aparecem quando o
jogador abre a tela de Gestão de Banca. Concorrentes de ponta avisam em
tempo real (push/notificação) quando um limite é atingido durante a
sessão, não só depois. Depende de a IDEA-011 existir para ter o que
notificar; avaliar junto.
**Frente:** Main (Gestão de Banca / Notificações)
**Módulo:** Gestor de Banca (`MAIN-001`) — consome o sistema de
notificações (`lib/services/notification-service.ts`), não o Hub de
Evolução
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-013 — Filtro de busca de mãos por posição, stack e resultado (incl. posição vs. posição)
**Descrição:** comparação de 15/09/2026 do Revisor de Mãos com trackers
de mercado (PokerTracker 4, Hold'em Manager 3, Hand2Note) identificou
essa lacuna: hoje a busca de mãos (`revisor-fila.tsx`) só filtra por
status, tag e sessão vinculada — não há filtro por posição, stack (ex:
20bb) ou resultado (ganhou/perdeu/showdown). Também falta o cruzamento
posição vs. posição (ex: "só mãos onde eu era BB contra um raise do
BTN"), que é o nível de granularidade que permite estudar um confronto
específico depois de identificar um leak, em vez de só posição isolada.
**Frente:** Main (Revisor de Mãos)
**Módulo:** Review de Mãos / Revisor (`MAIN-002`, `components/revisor/revisor-fila.tsx`)
**Prioridade:** 🟡 P2
**Status:** ✅ INCORPORADA (parcial — implementada em 16/09/2026: nova
aba "Filtros avançados" com busca por stack em bb e "Só all-in".
Posição, resultado e cruzamento posição vs. posição ainda não —
reabrir como ideia nova se isso continuar sendo necessário)

### IDEA-014 — Mural do Time (ranges, vídeos e avisos, tudo dentro do módulo)
**Descrição:** investigação de 15/09/2026 a pedido do dono, depois de
notar que compartilhamento hoje "vaza" pra fora do módulo Time.
Confirmado por grep no repo:
1. **Ranges do time já existem, mas moram no lugar errado** —
   `app/ranges/time/page.tsx` (componente `TeamLibrary`) fica dentro do
   módulo de Ranges, não dentro de `/time`. O compartilhamento em si já
   funciona e já é bidirecional (qualquer membro do time publica pro
   grupo via `publishRangeToTeam`/`listTeamSharedRanges` em
   `lib/services/range-service.ts`), só está na tela errada.
2. **Vídeos: não existe nada.** Nenhum upload ou link de vídeo em
   nenhum lugar do sistema hoje — recurso 100% novo.
3. **Avisos/mural: não existe.** O que tem hoje não serve pra isso:
   `team_alerts` são alertas *automáticos* do sistema (ex: downswing),
   e `team_messages` é chat *privado 1-para-1* (coach↔jogador). Nenhum
   dos dois é um post visível pra todo o time. Precisa de mecanismo
   novo (ex: tabela `team_posts`).
**Exigência explícita do dono (15/09/2026):** essa é uma tela do time —
tudo que for compartilhado ali (ranges, vídeos, avisos) precisa **ficar
dentro do módulo Time** e não sair dele. Deve abrir como uma aba nova
dentro do painel do time, no mesmo padrão da aba Funil (que já abre
separada em `app/time/painel/funil/page.tsx`). Compartilhamento
bidirecional: coach → jogadores e jogadores → coach (mesmo padrão que
já existe hoje nos ranges).
**Escopo técnico:** (1) mover `TeamLibrary` pra dentro de `/time` como
nova aba; (2) criar suporte a vídeo (upload ou link embutido); (3)
criar mecanismo de post/anúncio pro time todo, distinto do chat 1-a-1 —
envolve mudança de schema no Supabase (fora deste repo, direto no
banco remoto).
**Frente:** Main (Plataforma para Times)
**Módulo:** Plataforma para Times (`MAIN-010` — nova aba em `app/time/painel/`)
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-015 — Repasse financeiro automático de staking dentro da plataforma
**Descrição:** identificada na comparação de 15/09/2026 com plataformas
dedicadas de staking (Poker Staking Manager, marketplace de staking da
GGPoker): calcular e repassar automaticamente o valor devido a backers
depois do resultado, direto dentro do PokerSync. **Descartada
explicitamente pelo dono em 15/09/2026**: isso tornaria o produto um
intermediário financeiro de fato (custódia e repasse de dinheiro entre
usuários), trazendo obrigações regulatórias de fintech (KYC, compliance
de pagamento, responsabilidade sobre disputa de valores) que estão fora
da direção desejada pro produto. Hoje o PokerSync só **exibe** dados de
staking que o próprio jogador já registrou na banca (`own_pct`,
`markup`, `backer_name`) — isso continua, só não vai virar
processamento de pagamento.
**Frente:** Main (Plataforma para Times)
**Módulo:** Plataforma para Times — repasse financeiro (fora de escopo)
**Prioridade:** ⚪ N/A
**Status:** ❌ DESCARTADA (decisão explícita do dono — não é direção do produto)

### IDEA-016 — bb/100 real pra cash game no Performance
**Descrição:** análise de 15/09/2026 do módulo Performance: o campo
`bb_100` (a métrica padrão de mercado pra medir winrate de cash de um
jeito comparável entre stakes) já existe no tipo de dado
(`PlayerPerformance`), mas sempre volta `null` — nunca foi ligado a um
cálculo real. Hoje um jogador de cash não vê essa métrica em lugar
nenhum, só quem joga torneio tem ROI/ITM% de verdade.
**Frente:** Main (Performance)
**Módulo:** Performance (`MAIN-005`, `lib/services/performance-service.ts`)
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-017 — Benchmark real (população ou GTO) em vez de tabela heurística fixa
**Descrição:** análise de 15/09/2026: as faixas "min/max" que o
Performance usa pra dizer se uma estatística (VPIP, 3-bet, C-bet etc.)
está boa ou ruim (`PREFLOP_REFERENCE`/`POSTFLOP_REFERENCE` em
`analysis-service.ts`) são uma tabela escrita à mão, baseada em
material de treino genérico — o próprio código já admite que não é
motor GTO nem dataset auditável. Concorrentes (HM3 Leak Explorer,
EVLeakFinder) comparam com dado real de milhares de jogadores ou com
solver GTO de verdade.
**Frente:** Main (Performance)
**Módulo:** Performance (`MAIN-005`, `lib/services/analysis-service.ts`)
**Prioridade:** ⚪ P3 (depende de fonte de dado populacional ou solver — não é baixo esforço)
**Status:** 🔎 AVALIAR

### IDEA-018 — Avisar (não só esconder) quando a amostra de mãos é pequena
**Descrição:** análise de 15/09/2026: hoje quando não há mãos
suficientes pra confiar numa estatística, o filtro correspondente é
simplesmente desabilitado sem nenhuma explicação
(`AnalysisFilters.tsx`) — o jogador não entende por que a opção sumiu.
Ferramentas de mercado mostram um aviso explícito tipo "amostra pequena
demais, jogue mais mãos antes de confiar nesse número".
**Frente:** Main (Performance)
**Módulo:** Performance (`MAIN-005`, `components/analysis/AnalysisFilters.tsx`)
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-019 — Religar o painel de insights automáticos e o "raio-x" de habilidade (código já existe, está desconectado)
**Descrição:** análise de 15/09/2026 encontrou código órfão real: as
funções `get_player_insights` (gera frases automáticas tipo "sua
métrica X piorou") e `get_skill_breakdown` (resumo visual único de
Preflop/Flop/Turn/River/Posição, no estilo do Leak Buster) já existem
prontas no backend (`lib/services/performance-service.ts`), mas não são
chamadas em nenhuma tela do app hoje — ficaram desconectadas. É
provavelmente o gap mais barato de fechar dos 5 encontrados nesta
auditoria, porque não precisa construir nada novo, só ligar o que já
foi feito.
**Frente:** Main (Performance)
**Módulo:** Performance (`MAIN-005`/`MAIN-011`, `lib/services/performance-service.ts`)
**Prioridade:** 🟢 P1 (baixo esforço, alto valor — código pronto)
**Status:** 💡 NOVA

### IDEA-020 — Filtros por período (data), plataforma/sala e stake no Performance
**Descrição:** análise de 15/09/2026: hoje o Performance filtra por
modalidade, profundidade de stack, posição e ação pré-flop, mas não dá
pra filtrar por data (ex: "só os últimos 30 dias"), por sala/plataforma
(ex: "só PokerStars"), nem por stake como texto — padrão básico em
qualquer tracker de mercado.
**Frente:** Main (Performance)
**Módulo:** Performance (`MAIN-005`, `components/analysis/AnalysisFilters.tsx`)
**Prioridade:** 🟡 P2
**Status:** 💡 NOVA

### IDEA-021 — Construtor de Árvores vira mapa de cobertura do motor (CFR)
**Descrição:** discussão de 16/09/2026 sobre o Construtor de Árvores
(hoje removido do menu, IDEA anterior era descartá-lo). Decisão final
do dono: em vez de descartar, a árvore deveria evoluir pra virar um
"termômetro" visual de onde o motor CFR (`pokersync-solver`) já
consegue resolver de verdade uma decisão, e onde ainda depende de
range manual do jogador. Cada nó ganharia um status (✅ resolvido pelo
motor / 💡 manual), crescendo sozinho conforme o motor evolui (hoje:
EV de all-in já jogado e pós-flop turn/river com board+ranges definidos
são resolvíveis; flop e multiway completo ainda não).
**Pré-requisito identificado:** antes de acoplar o motor, a árvore
precisa de uma representação visual de diagrama — hoje é uma lista de
formulários indentada, sem noção gráfica nenhuma (ver auditoria de UX
de 15/09/2026 no Construtor de Ranges).
**Frente:** Main (Construtor de Ranges)
**Módulo:** Construtor de Ranges — Árvores (`MAIN-004`, `components/ranges/tree-editor.tsx`, hoje fora do menu)
**Prioridade:** 🟡 P2 (retomar quando a aba voltar a ficar visível)
**Status:** 🔎 AVALIAR (arquitetura discutida, nada implementado ainda —
aba está fora do menu por enquanto)

---

## Como usar

1. Qualquer descoberta durante o desenvolvimento que não seja bug nem
   tarefa já planejada vira uma entrada aqui, sem interromper o roadmap.
2. Uma ideia só sai do Idea Bank quando promovida — aí ganha um ID
   `MAIN-`/`SOLVER-`/`RADAR-` em `roadmap.json` e o estado aqui vira
   ✅ INCORPORADA (ou ❌ DESCARTADA, se decidido não fazer).
