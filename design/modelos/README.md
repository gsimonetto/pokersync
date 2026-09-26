# Modelos guardados

Peças de interface prontas, **não usadas no app**, guardadas para uso futuro.

## Carta do ranking (`carta-ranking.tsx`)

A ficha do jogador no ranking desenhada como carta. É do mesmo nível da carta de Membro Fundador:

- a moldura é do material da patente do jogador;
- tem gravuras de cédula: rosácea de guilhochê, ondas, micro-texto e cantos art déco;
- a posição aparece gigante, gravada no fundo;
- os 3 primeiros ganham uma fita de medalha no canto;
- tem brilho holográfico e inclina seguindo o mouse.

Referência visual: `carta-ranking-lendario.png`, `carta-ranking-diamante.png` e `carta-ranking-esmeralda.png`.

**Para usar:** em `components/hub/ranking/ranking.tsx`, trocar `FichaJogador` por `CartaRankingModelo`. As props são as mesmas: `j`, `eu` e `onFechar`.

Obs.: o modelo é anterior às conquistas na ficha. Se for ativado, trazer junto o bloco "Conquista PokerSync" de `components/hub/ranking/ficha.tsx`.
