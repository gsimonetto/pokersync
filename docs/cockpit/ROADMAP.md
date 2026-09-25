# PokerSync — Roadmap (Cockpit)

> Cada linha aqui tem um ID igual ao `roadmap.json` — é lá que mora o
> dado estruturado. Este arquivo é a leitura humana; o JSON é a fonte
> pra qualquer automação futura.

Legenda de status: 🟢 concluído · 🟠 parcial · 🔵 planejado ·
🔴 bloqueado · ⚠️ precisa atenção
Prioridade: 🔴 P0 · 🟠 P1 · 🟡 P2 · ⚪ P3

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC MAIN — 81%

| ID | Item | Status | Prioridade | Próximo passo |
|---|---|---|---|---|
| MAIN-001 | Gestor de Banca | 🟢 | ⚪ P3 | — |
| MAIN-002 | Review de Mãos (Revisor) | 🟢 | 🟠 P1 | sugestão de drill depende de MAIN-021 |
| MAIN-003 | Modo Treino | 🟠 | 🔴 P0 | gerar estoque pós-flop (depende de MAIN-021) |
| MAIN-004 | Construtor de Ranges e Árvores | 🟢 | 🟡 P2 | — |
| MAIN-005 | Player Evolution (core) | 🟢 | 🟡 P2 | — |
| MAIN-006 | Módulo de Análise | 🟢 | 🟠 P1 | — |
| MAIN-007 | cEV/ICM por mão (consumo) | 🟢 | 🔴 P0 | — |
| MAIN-008 | Estatísticas de oponente | 🟢 | 🟡 P2 | — |
| MAIN-009 | HUD em tempo real | 🔵 | ⚪ P3 | não priorizado |
| MAIN-010 | Plataforma para Times (core) | 🟢 | 🟡 P2 | — |
| MAIN-011 | Score de evolução consolidado | 🟢 | 🟡 P2 | — |
| MAIN-012 | Sync com agente desktop (schema) | 🟢 | 🟠 P1 | — |
| MAIN-013 | Hub de Evolução | 🟢 | ⚪ P3 | — |
| MAIN-014 | Marketplace de Vagas | 🟢 | 🟡 P2 | — |
| MAIN-015 | Conquistas (Achievements) | 🟢 | ⚪ P3 | corrigir comentário desatualizado no código |
| MAIN-016 | Chat | 🟢 | ⚪ P3 | — |
| MAIN-017 | Conformidade LGPD (core) | 🟢 | 🟠 P1 | — |
| MAIN-018 | Gestão de consentimentos | 🔵 | 🟡 P2 | avaliar exigência real |
| MAIN-019 | Correções de segurança | 🟢 | 🔴 P0 | — |
| MAIN-020 | Catálogo de formatos (Banca) | 🔵 | ⚪ P3 | decidir catálogo vs. migrar dados |
| MAIN-021 | Pipeline pós-flop ponta a ponta | 🔵 | 🔴 P0 | maior alavanca do backlog |
| MAIN-022 | Estoque push/fold ICM multi-stack | 🟢 | 🟠 P1 | — |
| MAIN-023 | `engine_version` em `hand_ev_results` | 🟢 | ⚪ P3 | — |
| MAIN-024 | Sincronizar board externo do roadmap | 🔵 | ⚪ P3 | avaliar aposentar em favor do Cockpit |
| MAIN-025 | Limpeza: arquivo de backup órfão | 🟢 | ⚪ P3 | — |
| MAIN-026 | Sistema de Amigos (chat 1:1 fora de Time) | 🟢 | 🟡 P2 | — |
| MAIN-027 | Widget de torneios ao vivo (BSOP/WSOP) | 🟢 | 🟡 P2 | — |
| MAIN-028 | Central de Notificações | 🟢 | ⚪ P3 | — |

### Destaque — MAIN-003 Modo Treino
**Objetivo:** treinar o jogador com spots reais gerados pelo motor.
**O que existe:** filtros por posição/stack/tipo, sessão diária
retomável (persiste progresso do dia).
**O que falta:** estoque pós-flop — pré-flop agora tem 32 spots (12
push/fold ICM + 20 RFI/Jam, sb_vs_bb e btn_vs_bb, stacks de 8 a 100bb),
mas os leaks reais dos usuários são majoritariamente pós-flop. Nenhum
spot pós-flop real no estoque hoje — a única linha que existia era um
dado ilustrativo/de teste, removida em 13/09/2026 a pedido do dono.
**Próximo passo:** ver MAIN-021 (pipeline pós-flop ponta a ponta).
**Dependências:** MAIN-021.

### Destaque — MAIN-008 Estatísticas de oponente 🟢 concluído (achado da auditoria de 22/09)
**Objetivo:** mostrar estatísticas do oponente (VPIP, PFR, 3-Bet etc.),
não só do próprio jogador.
**O que existe:** construído em 15/09/2026, mas nunca tinha entrado no
roadmap — a última auditoria (14/09) ficou pra trás. Não depende mais
só do parser: a tabela `hand_opponent_tags` no banco real já tem 4939
linhas de 147 oponentes distintos, preenchida automaticamente por um
trigger toda vez que uma mão é salva no Revisor. As estatísticas (VPIP,
PFR, 3-Bet, Fold to 3-Bet, C-Bet, Fold to C-Bet, fator de agressão,
WTSD, W$SD) aparecem num card clicável no assento do oponente dentro
do Revisor de Mãos, que abre um modal com o detalhe completo.
**O que falta:** nada no Revisor. O mesmo recurso existe no Modo Treino
mas está desligado por flag (`HUD_ENABLED=false`), a pedido explícito —
isso é uma decisão tomada, não uma pendência.
**Dependências:** nenhuma.

### Destaque — MAIN-007 cEV/ICM por mão 🟢 concluído
**Objetivo:** mostrar o EV real (ajustado por sorte) de mãos all-in já
jogadas.
**O que existe:** endpoint no produto pronto e mergeado
(`app/api/hand-ev/compute`), chama o motor via HTTP. Deploy do motor
confirmado ativo (BLOQUEIO-001 resolvido) e `SOLVER_API_URL`/
`SOLVER_API_KEY` já configuradas no Vercel (Production) desde
03/09/2026. A UI removida em 12/09/2026 foi reconstruída no Revisor de
Mãos (`revisor-detalhe.tsx` e `revisor-hand-table.tsx`, inclusive
versão mobile) entre 15 e 16/09/2026: botão "Calcular EV/ICM",
mensagens de erro em linguagem simples e cards de resultado — tudo
chamando `computeHandEv`/`fetchHandEvResult` (`hand-ev-service.ts`),
que hoje têm chamadores reais confirmados por grep no repo.
**O que falta:** nada — heads-up e multiway (SOLVER-014) já estão os
dois em produção via essa mesma tela.
**Dependências:** SOLVER-013, SOLVER-018 (ambos concluídos do lado do
motor).

### Destaque — MAIN-026/027/028: 3 módulos prontos que nunca entraram no roadmap
Achados na mesma auditoria de 22/09/2026, todos já em produção:
- **MAIN-026 Sistema de Amigos:** chat 1:1 entre jogadores que não têm
  time em comum (pedido de amizade por apelido+código, presença
  online, mensagens diretas).
- **MAIN-027 Torneios ao vivo:** widget na agenda/diário que mostra
  quando um torneio de grife (BSOP/WSOP) está transmitindo ao vivo no
  YouTube, com link direto.
- **MAIN-028 Central de Notificações:** `/notificacoes`, com
  categorias (sistema/tarefas/time), marcar lida/excluir e contador de
  não lidas — usada por vários outros módulos pra deep-link.

━━━━━━━━━━━━━━━━━━━━━━

## RADAR POKERSYNC (addon + agente desktop) — 74%

| ID | Item | Status | Prioridade | Próximo passo |
|---|---|---|---|---|
| RADAR-001 | Painel in-app (RadarPanel + gating) | 🟢 | 🟡 P2 | — |
| RADAR-002 | Agente desktop (repo `pokersync-radar`) | 🟠 | 🟠 P1 | publicar a 0.2.0 e reinstalar uma vez |
| RADAR-003 | Sync automático (`/api/agent/sync`) | 🟢 | 🟠 P1 | — |
| RADAR-004 | Suporte a mais salas de poker | 🟠 | 🟡 P2 | validar parser contra hand history real de cada sala |
| RADAR-005 | Sessão do Radar que não cai | 🟠 | 🔴 P0 | publicar a 0.2.0 |
| RADAR-006 | Publicação e atualização automática | 🟠 | 🔴 P0 | conferir secrets de assinatura e rodar a release v0.2.0 |
| RADAR-007 | Escolha do que importar valendo (3 opções, no Radar e no site) | 🟠 | 🟠 P1 | aplicar migration + publicar a 0.2.0 |
| RADAR-008 | Seletor do Radar por módulo | 🟠 | 🟡 P2 | aplicar as migrations no deploy |
| RADAR-009 | Leitor de mãos da ACR | ⚪ | 🟡 P2 | conseguir hand history real da ACR |

*Nota: auditado com o código do Radar (Rust/Tauri) aberto em 25/09/2026 —
antes disso, RADAR-002/003 tinham sido confirmados só por evidência no
banco. A 0.1.0 instalada no PC do dono não recebe atualização automática
(ela veio depois); a 0.2.0 precisa ser instalada uma vez à mão.*

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC SOLVER — 87%

| ID | Item | Status | Prioridade | Próximo passo |
|---|---|---|---|---|
| SOLVER-001 | Núcleo CFR | 🟢 | 🟠 P1 | — |
| SOLVER-002 | Equity pré-flop com blockers | 🟢 | 🟡 P2 | — |
| SOLVER-003 | ICM (Malmuth-Harville) | 🟢 | 🟠 P1 | — |
| SOLVER-004 | Push/Fold heads-up | 🟢 | 🟠 P1 | — |
| SOLVER-005 | RFI/Jam heads-up ICM (produção) | 🟢 | 🔴 P0 | — |
| SOLVER-006 | RFI/Jam multi-stack (sb_vs_bb e btn_vs_bb) | 🟢 | 🟡 P2 | — |
| SOLVER-007 | Motor multiway (N jogadores) | 🟠 | 🟠 P1 | validar squeeze real |
| SOLVER-008 | chipEV puro (toggle sem ICM) | 🟢 | 🟡 P2 | — |
| SOLVER-009 | Pós-flop river | 🟢 | 🟠 P1 | — |
| SOLVER-010 | Pós-flop turn | 🟢 | 🟠 P1 | — |
| SOLVER-011 | Pós-flop flop | 🟠 | 🟡 P2 | rodar mais iterações |
| SOLVER-012 | EV por ação pós-flop | 🟢 | 🟡 P2 | — |
| SOLVER-013 | cEV/ICM heads-up por mão | 🟢 | 🔴 P0 | — |
| SOLVER-014 | cEV/ICM multiway | 🟢 | 🟡 P2 | — |
| SOLVER-015 | 3-bet real pré-flop | 🔵 | 🟡 P2 | não iniciado |
| SOLVER-016 | Squeeze multiway validado | 🔵 | 🟡 P2 | rodar spot real offline |
| SOLVER-017 | CI (GitHub Actions) | 🟢 | ⚪ P3 | — |
| SOLVER-018 | Deploy no Railway | 🟢 | 🔴 P0 | — |
| SOLVER-019 | README desatualizado | 🟢 | 🟡 P2 | — |
| SOLVER-020 | Hardening de segurança da API | 🟢 | 🟡 P2 | — |

### Destaque — SOLVER-007 Motor multiway
**Objetivo:** resolver spots com 3+ jogadores (squeeze, CO vs BTN, UTG
vs BB), não só heads-up.
**O que existe:** arquitetura pronta; dois bugs reais de cálculo
encontrados e corrigidos nesta janela (peso de probabilidade de
alcance no treino, vazamento de informação na medição de
exploitability) — ambos provados com testes automatizados novos.
**O que falta:** squeeze nunca foi validado num spot real, só no caso
degenerado de 2 jogadores.
**Próximo passo:** rodar um squeeze de verdade offline (script já
existe: `run_offline_multiway.py`).

━━━━━━━━━━━━━━━━━━━━━━

## Dependências entre frentes

```
Solver: motor pós-flop (river/turn prontos)
   ↓
Solver: EV por ação pós-flop (pronto)
   ↓
Main: MAIN-021 Pipeline pós-flop ponta a ponta (planejado)
   ↓
Main: MAIN-003 Modo Treino (estoque pós-flop)

Solver: SOLVER-013 cEV/ICM por mão (🟢 pronto no motor)
   ↓
Solver: SOLVER-018 Deploy Railway (🟢 confirmado ativo)
   ↓
Main: MAIN-007 cEV/ICM (🟢 UI reconstruída no Revisor de Mãos, heads-up + multiway)

Radar: RADAR-002 Agente desktop (🟢 concluído, validado com instalação Windows real e no PC do dono)
   ↓
Main: MAIN-012 Sync com agente (🟢 tráfego real confirmado 14/09/2026)
   ↓
Main: MAIN-009 HUD em tempo real (planejado, não priorizado)
```
