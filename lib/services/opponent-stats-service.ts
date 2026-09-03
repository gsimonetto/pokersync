import { createClient } from "@/lib/supabase/client";
import type { ParsedHand } from "@/lib/poker/hand-parser";

// Perfil consolidado de UM oponente, agregando todas as mãos já
// importadas em que ele apareceu na mesa (independente de qual review
// está sendo vista agora). Vem da RPC get_opponent_stats, que soma
// hand_opponent_tags no banco -- ver migration create_opponent_stats_rpcs_and_backfill.
//
// Limitação conhecida: agrupamos por NOME EXATO do jogador (mesmo texto
// do hand history). Não existe id único de jogador entre salas/hand
// histories, então o mesmo humano com nicks diferentes vira "oponentes"
// diferentes aqui -- não é um bug, é o limite do que dá pra inferir só
// do texto.
export interface OpponentStats {
  opponentName: string;
  handsCount: number;
  vpipPct: number | null;
  pfrPct: number | null;
  threeBetPct: number | null;
  foldTo3BetPct: number | null;
  cbetFlopPct: number | null;
  foldToCbetFlopPct: number | null;
  aggressionFactor: number | null;
  wentToShowdownPct: number | null;
  wonShowdownPct: number | null;
}

// Abaixo disso a estatística é ruído -- amostra pequena demais pra
// significar alguma coisa (mesmo piso informal usado por trackers de
// mercado tipo PT4/HM3 antes de confiar num HUD).
export const MIN_RELIABLE_HANDS = 10;

export function isSmallSample(stats: Pick<OpponentStats, "handsCount">): boolean {
  return stats.handsCount < MIN_RELIABLE_HANDS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): OpponentStats {
  return {
    opponentName: row.opponent_name,
    handsCount: row.hands_count ?? 0,
    vpipPct: row.vpip_pct,
    pfrPct: row.pfr_pct,
    threeBetPct: row.three_bet_pct,
    foldTo3BetPct: row.fold_to_3bet_pct,
    cbetFlopPct: row.cbet_flop_pct,
    foldToCbetFlopPct: row.fold_to_cbet_flop_pct,
    aggressionFactor: row.aggression_factor,
    wentToShowdownPct: row.went_to_showdown_pct,
    wonShowdownPct: row.won_showdown_pct,
  };
}

export async function fetchOpponentStats(opponentName: string): Promise<OpponentStats | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_opponent_stats", { p_opponent_name: opponentName });
  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.hands_count) return null;
  return mapRow(row);
}

// Nomes de todos os assentos que NÃO são o herói -- direto do
// parsed_data, então funciona mesmo antes da mão estar salva (preview
// de import, por exemplo).
export function opponentNamesFromHand(hand: ParsedHand): string[] {
  if (!hand.heroName) return [];
  return hand.seats.filter((s) => s.playerName && s.playerName !== hand.heroName).map((s) => s.playerName);
}

// Perfil de TODOS os oponentes sentados numa mão específica, de uma vez
// -- usado pelo card do Revisor ao abrir o replay. Jogador visto pela
// primeira vez (sem histórico ainda) simplesmente não entra na lista,
// em vez de aparecer com stats zeradas/enganosas.
export async function fetchOpponentsStatsForHand(hand: ParsedHand): Promise<OpponentStats[]> {
  const names = opponentNamesFromHand(hand);
  if (names.length === 0) return [];
  const results = await Promise.all(
    names.map((name) =>
      fetchOpponentStats(name).catch(() => null)
    )
  );
  return results.filter((r): r is OpponentStats => r !== null);
}
