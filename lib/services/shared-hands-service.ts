import { createClient } from "@/lib/supabase/client";

// Mãos que jogadores do time compartilharam com o coach — lidas via
// shared_hands (policy shared_hands_select_team_member). Junta com
// hand_reviews (pro título/hand_history da mão) e profiles (nome do
// jogador que compartilhou).
export type SharedHandRow = {
  id: string;
  handReviewId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  status: "pendente" | "visto" | "comentado";
  createdAt: string;
  handTitle: string | null;
  handHistory: string | null;
  parsedData: unknown;
};

export async function fetchSharedHands(teamId: string): Promise<SharedHandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shared_hands")
    .select("id, hand_review_id, from_player_id, status, created_at, hand_reviews ( title, hand_history, parsed_data )")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // from_player_id referencia auth.users, não profiles — sem FK direta
  // pro PostgREST embedar num só select. Busca os nomes à parte, num
  // segundo round-trip (lista curta, sem paginação: mãos compartilhadas
  // não chegam a milhares por time).
  const playerIds = [...new Set(rows.map((r: any) => r.from_player_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, nome, apelido").in("id", playerIds);
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.apelido || p.nome || "Jogador"]));

  return rows.map((row: any) => ({
    id: row.id,
    handReviewId: row.hand_review_id,
    fromPlayerId: row.from_player_id,
    fromPlayerName: nameById.get(row.from_player_id) ?? "Jogador",
    status: row.status,
    createdAt: row.created_at,
    handTitle: row.hand_reviews?.title ?? null,
    handHistory: row.hand_reviews?.hand_history ?? null,
    parsedData: row.hand_reviews?.parsed_data ?? null,
  }));
}

export async function markSharedHandViewed(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("shared_hands")
    .update({ status: "visto", viewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente"); // não regride de "comentado" pra "visto"
  if (error) throw error;
}
