import { createClient } from "@/lib/supabase/client";

// Estrutura de premiação — pré-requisito pro cEV/ICM (ver types/analysis.ts
// PayoutStructureRow). Linkada por tournament_id_ps, a mesma chave que já
// une hand_reviews/hand_sessions de torneio (ver hand-session-service.ts) —
// de propósito, pra não virar uma segunda fonte de verdade sobre "qual
// torneio é esse". Suporta as duas origens: 'agent' (agente desktop busca
// automático — ver agent-tournament-sync-service.ts, que também preenche
// `pokerRoom`) e 'manual' (jogador preenche; pokerRoom fica null porque o
// formulário nunca perguntou isso).

export type PayoutSource = "agent" | "manual";

export interface PayoutPlace {
  place: number;
  amount: number;
}

export interface TournamentPayout {
  id: string;
  tournamentIdPs: string;
  source: PayoutSource;
  pokerRoom: string | null;
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
    pokerRoom: r.poker_room ?? null,
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

export async function deleteTournamentPayout(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("tournament_payouts").delete().eq("id", id);
  if (error) throw error;
}
