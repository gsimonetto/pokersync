import { createClient } from "@/lib/supabase/client";
import { fetchLeaderboardPeriod, fetchMyLeaderboardRank } from "@/lib/services/xp-service";

// Ranking da temporada do Hub, com recorte (geral / amigos / time).
//
// Fonte principal: RPC get_season_ranking (migração
// 20260925120000_ranking_temporada_escopos). Enquanto ela não existir no
// banco, o recorte "geral" cai nas RPCs antigas (sem foto e sem
// movimento) e os recortes amigos/time ficam indisponíveis -- a tela
// avisa em vez de quebrar.

export type EscopoRanking = "global" | "amigos" | "time";

export interface JogadorRanking {
  userId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  nivel: number;
  /** XP ganho na temporada. */
  xp: number;
  /** XP ganho nos últimos 7 dias (null = dado indisponível). */
  xp7d: number | null;
  /** Posição hoje; null = ainda sem pontos na temporada. */
  posicao: number | null;
  /** Posição 7 dias atrás no mesmo recorte; null = não pontuava ainda. */
  posicao7d: number | null;
  streak: number;
  /** Temporadas que já venceu (Temporada #N). */
  titulos: number[];
  souEu: boolean;
}

export interface RankingTemporada {
  jogadores: JogadorRanking[];
  /** Quantos jogadores pontuaram no recorte. */
  total: number;
  /** false = banco ainda sem a função nova (sem foto/movimento). */
  completo: boolean;
}

let rpcNovaDisponivel = true;

/** false depois que o banco respondeu que a função nova não existe. */
export function rankingCompletoDisponivel() {
  return rpcNovaDisponivel;
}

function funcaoAusente(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  return err.code === "PGRST202" || err.code === "42883" || /get_season_ranking/.test(err.message ?? "");
}

export async function fetchRankingTemporada(escopo: EscopoRanking, limite = 50): Promise<RankingTemporada> {
  if (rpcNovaDisponivel) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_season_ranking", { p_scope: escopo, p_limit: limite });
    if (!error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linhas = (data ?? []) as any[];
      return {
        jogadores: linhas.map((r) => ({
          userId: r.user_id,
          nome: r.name,
          avatarId: r.avatar_id ?? 1,
          avatarUrl: r.avatar_url ?? null,
          nivel: r.level ?? 1,
          xp: r.xp ?? 0,
          xp7d: r.xp_7d ?? 0,
          posicao: r.rank ?? null,
          posicao7d: r.rank_7d ?? null,
          streak: r.streak_days ?? 0,
          titulos: (r.champion_seasons ?? []).map(Number),
          souEu: !!r.is_me,
        })),
        total: Number(linhas[0]?.total ?? 0),
        completo: true,
      };
    }
    if (!funcaoAusente(error)) throw error;
    rpcNovaDisponivel = false;
  }

  if (escopo !== "global") return { jogadores: [], total: 0, completo: false };

  // Caminho antigo: top 50 + a própria posição, sem foto nem movimento.
  const supabase = createClient();
  const [lista, meu, usuario] = await Promise.all([
    fetchLeaderboardPeriod("season", limite),
    fetchMyLeaderboardRank("season").catch(() => null),
    supabase.auth.getUser().then(({ data }) => data.user?.id ?? null).catch(() => null),
  ]);
  const jogadores: JogadorRanking[] = lista.map((e) => ({
    userId: e.userId,
    nome: e.name,
    avatarId: 1,
    avatarUrl: null,
    nivel: e.level,
    xp: e.xpTotal,
    xp7d: null,
    posicao: e.rank,
    posicao7d: null,
    streak: e.streakDays,
    titulos: e.championSeasons,
    souEu: e.userId === usuario,
  }));
  if (meu && usuario && !jogadores.some((j) => j.souEu)) {
    jogadores.push({
      userId: usuario,
      nome: "Você",
      avatarId: 1,
      avatarUrl: null,
      nivel: 1,
      xp: meu.xp,
      xp7d: null,
      posicao: meu.rank,
      posicao7d: null,
      streak: 0,
      titulos: [],
      souEu: true,
    });
  }
  return { jogadores, total: meu?.totalPlayers ?? jogadores.length, completo: false };
}
