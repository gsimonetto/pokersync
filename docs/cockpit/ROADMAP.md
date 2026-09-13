# PokerSync — Roadmap (Cockpit)

> Cada linha aqui tem um ID igual ao `roadmap.json` — é lá que mora o
> dado estruturado. Este arquivo é a leitura humana; o JSON é a fonte
> pra qualquer automação futura.

Legenda de status: 🟢 concluído · 🟠 parcial · 🔵 planejado ·
🔴 bloqueado · ⚠️ precisa atenção
Prioridade: 🔴 P0 · 🟠 P1 · 🟡 P2 · ⚪ P3

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC MAIN — 59%

| ID | Item | Status | Prioridade | Próximo passo |
|---|---|---|---|---|
| MAIN-001 | Gestor de Banca | 🟢 | ⚪ P3 | — |
| MAIN-002 | Review de Mãos (Revisor) | 🟢 | 🟠 P1 | sugestão de drill depende de MAIN-021 |
| MAIN-003 | Modo Treino | 🟠 | 🔴 P0 | gerar estoque pós-flop (depende de MAIN-021) |
| MAIN-004 | Construtor de Ranges e Árvores | 🟢 | 🟡 P2 | — |
| MAIN-005 | Player Evolution (core) | 🟢 | 🟡 P2 | — |
| MAIN-006 | Módulo de Análise | 🟢 | 🟠 P1 | — |
| MAIN-007 | cEV/ICM por mão (consumo) | 🔴 | 🔴 P0 | resolver BLOQUEIO-001 |
| MAIN-008 | Estatísticas de oponente | 🔵 | 🟡 P2 | desenhar schema por jogador |
| MAIN-009 | HUD em tempo real | 🔵 | ⚪ P3 | não priorizado |
| MAIN-010 | Plataforma para Times (core) | 🟢 | 🟡 P2 | — |
| MAIN-011 | Score de evolução consolidado | 🟠 | 🟡 P2 | definir fórmula |
| MAIN-012 | Sync com agente desktop (schema) | 🟠 | 🟠 P1 | validar com instalações reais |
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
| MAIN-025 | Limpeza: arquivo de backup órfão | ⚠️ | ⚪ P3 | confirmar com o dono |

### Destaque — MAIN-003 Modo Treino
**Objetivo:** treinar o jogador com spots reais gerados pelo motor.
**O que existe:** filtros por posição/stack/tipo, sessão diária
retomável (persiste progresso do dia).
**O que falta:** estoque pós-flop — pré-flop agora tem 33 spots (12
push/fold ICM + 20 RFI/Jam, sb_vs_bb e btn_vs_bb, stacks de 8 a 100bb),
mas os leaks reais dos usuários são majoritariamente pós-flop.
**Próximo passo:** ver MAIN-021 (pipeline pós-flop ponta a ponta).
**Dependências:** MAIN-021.

### Destaque — MAIN-007 cEV/ICM por mão
**Objetivo:** mostrar o EV real (ajustado por sorte) de mãos all-in já
jogadas.
**O que existe:** endpoint no produto pronto e mergeado
(`app/api/hand-ev/compute`), chama o motor via HTTP.
**O que falta:** o motor nunca foi confirmadamente publicado — ver
`BLOCKERS.md`.
**Próximo passo:** resolver BLOQUEIO-001.
**Dependências:** SOLVER-013, SOLVER-018.

━━━━━━━━━━━━━━━━━━━━━━

## RADAR POKERSYNC (addon + agente desktop) — 63%

| ID | Item | Status | Prioridade | Próximo passo |
|---|---|---|---|---|
| RADAR-001 | Painel in-app (RadarPanel + gating) | 🟢 | 🟡 P2 | — |
| RADAR-002 | Agente desktop (repo `pokersync-agent`) | 🟠 | 🟠 P1 | validar contra instalações reais |
| RADAR-003 | Sync automático (`/api/agent/sync`) | 🟠 | 🟠 P1 | confirmar tráfego real |
| RADAR-004 | Suporte a mais salas de poker | 🟠 | 🟡 P2 | parser dedicado PartyPoker/888poker |

*Nota: o código do agente desktop em si (Rust/Tauri) vive no repositório
`pokersync-agent`, que não está anexado a esta sessão — os itens acima
foram avaliados a partir do que o repositório `pokersync` sabe sobre ele
(endpoints, schema, documentação), não por leitura direta do código Rust.*

━━━━━━━━━━━━━━━━━━━━━━

## POKERSYNC SOLVER — 79%

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
| SOLVER-013 | cEV/ICM heads-up por mão | 🔴 | 🔴 P0 | resolver BLOQUEIO-001 |
| SOLVER-014 | cEV/ICM multiway | 🟠 | 🟡 P2 | avaliar consumo no produto |
| SOLVER-015 | 3-bet real pré-flop | 🔵 | 🟡 P2 | não iniciado |
| SOLVER-016 | Squeeze multiway validado | 🔵 | 🟡 P2 | rodar spot real offline |
| SOLVER-017 | CI (GitHub Actions) | 🟢 | ⚪ P3 | — |
| SOLVER-018 | Deploy no Railway | ⚠️ | 🔴 P0 | ver BLOQUEIO-001 |
| SOLVER-019 | README desatualizado | 🟢 | 🟡 P2 | — |

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

Solver: SOLVER-013 cEV/ICM por mão (pronto no motor)
   ↓
Solver: SOLVER-018 Deploy Railway (⚠️ ambíguo — BLOQUEIO-001)
   ↓
Main: MAIN-007 cEV/ICM (consumo no produto)

Radar: RADAR-002 Agente desktop (parcial, repo separado)
   ↓
Main: MAIN-012 Sync com agente (schema pronto, falta tráfego real)
   ↓
Main: MAIN-009 HUD em tempo real (planejado, não priorizado)
```
