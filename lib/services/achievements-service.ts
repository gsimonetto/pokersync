import { createClient } from "@/lib/supabase/client";

// Estrutura minima de conquistas (2026-09): catalogo em `achievements` +
// desbloqueios em `user_achievements`. Hoje so' existe 1 conquista no
// catalogo ("founder" -- primeiro mes assinando o PokerSync), mas
// nenhum criterio automatico concede ela ainda: depende de um sistema
// de assinatura/pagamento que o produto ainda nao tem. Enquanto isso,
// fetchMyAchievements() sempre volta vazio pra todo mundo -- de
// proposito, nunca mostra um selo bloqueado/placeholder no lugar.

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

  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_code, unlocked_at, achievements ( code, label, description )")
    .eq("user_id", uid)
    .order("unlocked_at", { ascending: true });
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? [])
    .map((r: any) => {
      const a = r.achievements;
      if (!a) return null;
      return { code: a.code, label: a.label, description: a.description, unlockedAt: r.unlocked_at };
    })
    .filter((a): a is Achievement => a !== null);
}
