import { createClient } from "@/lib/supabase/client";

// Estrutura minima de conquistas (2026-09): catalogo em `achievements` +
// desbloqueios em `user_achievements`. Hoje so' existe 1 conquista no
// catalogo ("founder" -- Membro Fundador: os 100 primeiros que fizerem o
// pagamento anual no primeiro mes, ver grantFounderAchievement() no
// webhook de billing e conceder_fundador() no banco). fetchMyAchievements()
// so' devolve o que o jogador ja' desbloqueou de verdade -- nunca mostra
// selo bloqueado/placeholder no lugar de uma conquista nao conquistada.

export interface Achievement {
  code: string;
  label: string;
  description: string;
  unlockedAt: string;
}

export async function fetchMyAchievements(): Promise<Achievement[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  return fetchConquistasDoJogador(uid);
}

// Conquistas de qualquer jogador -- são públicas (aparecem em destaque
// na ficha do ranking). A leitura de linhas de outros jogadores depende
// da policy user_achievements_select_authenticated.
export async function fetchConquistasDoJogador(userId: string): Promise<Achievement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_code, unlocked_at, achievements ( code, label, description )")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: true });
  if (error) throw error;

  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => {
      const a = r.achievements;
      if (!a) return null;
      return { code: a.code, label: a.label, description: a.description, unlockedAt: r.unlocked_at };
    })
    .filter((a): a is Achievement => a !== null);
}
