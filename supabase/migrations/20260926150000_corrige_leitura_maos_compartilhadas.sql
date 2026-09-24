-- Correção de segurança: leitura das mãos compartilhadas com o coach.
--
-- As 4 regras de leitura "compartilhada" abaixo comparavam a mão com ela
-- mesma (s.review_id = s.review_id -- sempre verdadeiro). Resultado: quem
-- tinha pelo menos 1 mão compartilhada com ele conseguia ler as respostas,
-- a lista de prints, as notas por rua e os marcadores das mãos de TODOS os
-- usuários. Agora cada linha só aparece se a mão DELA foi compartilhada com
-- quem está lendo -- mesmo padrão da regra hr_select_shared (hand_reviews),
-- que já estava certa. Nenhum dado é alterado; o dono continua vendo tudo
-- pelas regras dele (hra_all, hri_all, hrse_all, hrtl_all), que não mudam.

drop policy if exists hra_select_shared on public.hand_review_answers;
create policy hra_select_shared on public.hand_review_answers
  for select using (
    exists (
      select 1 from public.hand_review_shares s
      where s.review_id = hand_review_answers.review_id
        and s.shared_with = (select auth.uid())
    )
  );

drop policy if exists hri_select_shared on public.hand_review_images;
create policy hri_select_shared on public.hand_review_images
  for select using (
    exists (
      select 1 from public.hand_review_shares s
      where s.review_id = hand_review_images.review_id
        and s.shared_with = (select auth.uid())
    )
  );

drop policy if exists hrse_select_shared on public.hand_review_street_evals;
create policy hrse_select_shared on public.hand_review_street_evals
  for select using (
    exists (
      select 1 from public.hand_review_shares s
      where s.review_id = hand_review_street_evals.review_id
        and s.shared_with = (select auth.uid())
    )
  );

drop policy if exists hrtl_select_shared on public.hand_review_tag_links;
create policy hrtl_select_shared on public.hand_review_tag_links
  for select using (
    exists (
      select 1 from public.hand_review_shares s
      where s.review_id = hand_review_tag_links.review_id
        and s.shared_with = (select auth.uid())
    )
  );
