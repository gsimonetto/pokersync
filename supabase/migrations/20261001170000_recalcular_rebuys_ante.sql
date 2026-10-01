-- Rebuy não detectado em torneio do PokerStars com ante (pedido do
-- jogador, 2026-10: "o torneio de 27$ teve rebuy").
--
-- No PokerStars os posts de blind e ante ficam antes de "*** HOLE CARDS ***"
-- e o parser os gravava sem postType. O detector de rebuy (lib/poker/
-- rebuy-detector.ts) somava o ante na aposta do blind e, num all-in do BB,
-- a conta de "perdeu todas as fichas" ficava exatamente o ante abaixo da
-- pilha -- a quebra não era vista e o rebuy não contava.
--
-- O parser e o detector foram corrigidos (o detector também funciona com
-- as mãos já salvas sem postType). Aqui só zeramos reentries_checked_at
-- dos torneios: eles são recalculados sozinhos na próxima vez que
-- aparecerem na tela (garantirRebuysCalculados), e a sessão da Gestão de
-- Banca importada acompanha o número novo.
--
-- Aplicar DEPOIS do código novo estar no ar -- com o código antigo o
-- recálculo daria o mesmo resultado errado.
update public.hand_sessions
set reentries_checked_at = null
where kind = 'tournament';
