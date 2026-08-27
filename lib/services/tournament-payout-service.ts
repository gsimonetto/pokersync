import { createClient } from "@/lib/supabase/client";

// Estrutura de premiação — pré-requisito pro cEV/ICM (ver types/analysis.ts
// PayoutStructureRow). Linkada por tournament_id_ps, a mesma chave que já
// une hand_reviews/hand_sessions de torneio (ver hand-session-service.ts) —
// de propósito, pra não virar uma segunda fonte de verdade sobre "qual
// torneio é esse". Suporta as duas origens desde o início: 'agent' (agente
// desktop busca automático — ainda não implementado do lado do agente) e
// 'manual' (jogador preenche).

export type PayoutSource = "agent" | "manual";

export interface PayoutPlace {
  place: number;
  amount: number;
}

export interface TournamentPayout {
  id: string;
  tournamentIdPs: string;
  source: PayoutSource;
  totalEntrants: number | null;
  prizePool: number | null;
  places: PayoutPlace[];
  heroFinishPlace: number | null;
  heroPayoutAmount: number | null;
  fetchedAt: string | null;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPayout(r: any): TournamentPayout {
  return {
    id: r.id,
    tournamentIdPs: r.tournament_id_ps,
    source: r.source,
    totalEntrants: r.total_entrants,
    prizePool: r.prize_pool,
    places: (r.places ?? []) as PayoutPlace[],
    heroFinishPlace: r.hero_finish_place,
    heroPayoutAmount: r.hero_payout_amount,
    fetchedAt: r.fetched_at,
    updatedAt: r.updated_at,
  };
}

export async function fetchTournamentPayouts(): Promise<TournamentPayout[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tournament_payouts").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToPayout);
}

// Upsert por (user_id, tournament_id_ps) — mesma linha serve pro primeiro
// registro manual e pra uma atualização futura do agente (ou vice-versa);
// `source` sempre reflete quem escreveu por último, sem tentar arbitrar
// qual origem é "mais confiável" (não temos base pra isso ainda).
export async function upsertTournamentPayout(params: {
  tournamentIdPs: string;
  source: PayoutSource;
  totalEntrants?: number | null;
  prizePool?: number | null;
  places?: PayoutPlace[];
  heroFinishPlace?: number | null;
  heroPayoutAmount?: number | null;
}): Promise<TournamentPayout> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada — faça login novamente.");

  const { data, error } = await supabase
    .from("tournament_payouts")
    .upsert(
      {
        user_id: user.id,
        tournament_id_ps: params.tournamentIdPs,
        source: params.source,
        total_entrants: params.totalEntrants ?? null,
        prize_pool: params.prizePool ?? null,
        places: params.places ?? [],
        hero_finish_place: params.heroFinishPlace ?? null,
        hero_payout_amount: params.heroPayoutAmount ?? null,
        fetched_at: params.source === "agent" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tournament_id_ps" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToPayout(data);
}

export async function deleteTournamentPayout(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("tournament_payouts").delete().eq("id", id);
  if (error) throw error;
}
