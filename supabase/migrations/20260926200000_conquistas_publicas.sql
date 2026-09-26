-- Conquistas PokerSync são públicas: aparecem em destaque na ficha do
-- jogador no ranking (pedido explícito). Até aqui cada jogador só lia as
-- próprias linhas de user_achievements (user_achievements_own_select),
-- então a ficha de outro jogador nunca mostrava o selo de Membro Fundador.
--
-- Libera só a LEITURA, só pra quem está logado. Escrita continua
-- exclusiva do servidor (webhook de billing com service role).
-- O que fica visível: user_id, achievement_code e unlocked_at.

create policy user_achievements_select_authenticated
  on public.user_achievements
  for select
  to authenticated
  using (true);
