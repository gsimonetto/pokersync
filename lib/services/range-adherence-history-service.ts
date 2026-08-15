import { createClient } from "@/lib/supabase/client";

export interface AdherenceRunInput {
  rangeId: string | null;
  rangeName: string;
  position: string;
  totalHands: number;
  comparable: number;
  flagged: number;
  accuracyPct: number;
}

// Log append-only — cada vez que o jogador roda "Analisar sessao" na
// Aderencia a Range, isso vira um ponto no historico. Falha ao gravar
// nao deve travar a analise em si (melhor esforco), por isso quem
// chama trata erro silenciosamente.
export async function logAdherenceRun(input: AdherenceRunInput): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("range_adherence_runs").insert({
    user_id: user.id,
    range_id: input.rangeId,
    range_name: input.rangeName,
    position: input.position,
    total_hands: input.totalHands,
    comparable: input.comparable,
    flagged: input.flagged,
    accuracy_pct: input.accuracyPct,
  });
}

export interface AdherenceRunPoint {
  date: string; // ISO
  accuracyPct: number;
  comparable: number;
}

// Historico filtrado por range+posicao especificos — comparar "BTN Open"
// contra "CO Open" no mesmo grafico misturaria duas coisas diferentes,
// entao o historico e' sempre por combinacao exata.
export async function fetchAdherenceHistory(rangeId: string, position: string): Promise<AdherenceRunPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("range_adherence_runs")
    .select("created_at, accuracy_pct, comparable")
    .eq("range_id", rangeId)
    .eq("position", position)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    date: r.created_at,
    accuracyPct: r.accuracy_pct,
    comparable: r.comparable,
  }));
}
