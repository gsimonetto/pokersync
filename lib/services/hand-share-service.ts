import { createClient } from "@/lib/supabase/client";

// Resolve o vinculo ativo do jogador logado com um time — decisao
// registrada: "sempre 1 coach por vez". Se o jogador estiver em mais de
// uma linha 'ativo' em team_members (nao deveria acontecer dado a
// decisao, mas o schema nao impede), pega a mais recente por joined_at.
export type ActiveTeamMembership = {
  teamId: string;
  coachId: string | null;
};

export async function getActiveTeamMembership(): Promise<ActiveTeamMembership | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, coach_id, joined_at")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { teamId: data.team_id as string, coachId: (data.coach_id as string | null) ?? null };
}

// Envia o hand history de UMA mão pro coach abrir no replayer dele (Modo
// Time). Grava em shared_hands (migration ja aplicada em producao) — o
// coach le via a policy shared_hands_select_team_member (is_active_team_member).
export async function shareHandWithCoach(handReviewId: string, membership: ActiveTeamMembership): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const { error } = await supabase.from("shared_hands").insert({
    hand_review_id: handReviewId,
    team_id: membership.teamId,
    from_player_id: userId,
    to_coach_id: membership.coachId,
  });

  if (error) throw error;
}
