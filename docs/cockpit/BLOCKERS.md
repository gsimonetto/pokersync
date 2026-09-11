# PokerSync — Bloqueios Ativos

## 🔴 BLOQUEIO-001 — Status de deploy do `pokersync-solver` é ambíguo

**Afeta:** MAIN-007, SOLVER-013, SOLVER-018 (cEV/ICM por mão jogada)

**O que se sabe de cada lado:**
- O documento mestre do Main (`POKERSYNC.md`) afirma categoricamente que
  o `pokersync-solver` **nunca foi publicado** no Railway e que
  `SOLVER_API_URL`/`SOLVER_API_KEY` não existem em nenhum ambiente.
- Do lado do Solver, `scripts/trigger_job.sh` tem uma URL de produção
  "hardcoded" como valor padrão:
  `https://pokersync-solver-production.up.railway.app`. Um domínio tão
  específico normalmente só existe se um projeto Railway chamado
  `pokersync-solver` foi criado em algum momento — o que sugere que
  *talvez* já tenha havido um deploy, mesmo que o produto não tenha sido
  configurado pra usá-lo.
- Não há segredo de deploy no workflow de CI do Solver (`.github/workflows`
  só roda testes, não faz deploy), nem `.env`/`.env.example` no repositório
  (esperado — não deveria haver segredo commitado).

**Por que isso importa:** é o único item que, sozinho, destrava o
cEV/ICM por mão jogada — ambos os lados do código já estão prontos e
mergeados (decisão 013 do `POKERSYNC.md`).

**Próximo passo:** confirmar com o dono do projeto (fora do alcance do
código) se esse domínio do Railway corresponde a um deploy real e ativo,
ou se é resquício de um teste antigo. Se estiver ativo, só falta
configurar as variáveis de ambiente no produto. Se não estiver, seguir o
plano original: criar o projeto no Railway e fazer o primeiro deploy.

**Não travar em cima disso:** nenhuma outra tarefa depende de resolver
isso primeiro — pipeline pós-flop (MAIN-021) pode avançar em paralelo.

---

## Como registrar um novo bloqueio

Copiar o formato acima: título com 🔴, itens afetados (IDs do
`roadmap.json`), o que se sabe, por que importa, próximo passo. Um
bloqueio sai desta lista quando resolvido — mover o resumo pra
`CHANGELOG.md` na data em que foi destravado.
