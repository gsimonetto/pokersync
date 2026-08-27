import { createClient } from "@/lib/supabase/client";

const PATENTES = [
  "Micro Stakes I", "Micro Stakes II", "Micro Stakes III",
  "Low Stakes I", "Low Stakes II", "Low Stakes III",
  "Mid Stakes I", "Mid Stakes II", "Mid Stakes III",
  "High Stakes I", "High Stakes II", "High Stakes III",
  "High Roller I", "High Roller II", "High Roller III",
  "Super High Roller I", "Super High Roller II", "Super High Roller III",
  "Nosebleeds I", "Nosebleeds II", "Nosebleeds III",
  "Nosebleeds IV", "Nosebleeds V", "Nosebleeds VI", "Nosebleeds VII",
];

export const MAX_LEVEL = 99;

// Mesma formula da funcao xp_for_next_level no banco — recalibrada pro
// teto de 99 (pedido explicito: "nao tao facil nem tao dificil"). A
// formula antiga (100*level^1.5) levaria a casa dos 10 anos pra chegar
// no 99 no ritmo novo de missoes (5 diarias+10 semanais+10 mensais).
export function xpForNextLevel(level: number) {
  return Math.round(60 * Math.pow(level, 1.3));
}

// Cor do nivel muda a cada 10 (pedido explicito) — 10 faixas cobrindo
// 1-99. Progressao inspirada em "materiais" crescentes (bronze ->
// lendario), reaproveitando cores ja usadas no resto do produto onde
// fazia sentido (ex: dourado da faixa 3 e' o ACCENT padrao do Hub).
const LEVEL_BAND_COLORS = [
  "#B08D57", // 1-10  bronze
  "#C0C6CC", // 11-20 prata
  "#E0B24C", // 21-30 ouro
  "#22c55e", // 31-40 esmeralda
  "#3b82f6", // 41-50 safira
  "#A855F7", // 51-60 ametista
  "#e0555a", // 61-70 rubi
  "#22d3ee", // 71-80 platina
  "#f472b6", // 81-90 diamante
  "#F5D48C", // 91-99 lendario
];

// Nome do "material" de cada faixa -- pedido explicito: "detalhes que
// remetam o nivel igual as patentes de jogos" (Bronze/Prata/Ouro etc,
// no estilo League/Valorant/CS). Paralelo posicional a LEVEL_BAND_COLORS.
const LEVEL_BAND_MATERIALS = [
  "Bronze", "Prata", "Ouro", "Esmeralda", "Safira",
  "Ametista", "Rubi", "Platina", "Diamante", "Lendário",
];

function bandIndex(level: number): number {
  const band = Math.min(Math.ceil(level / 10), LEVEL_BAND_COLORS.length);
  return Math.max(0, band - 1);
}

export function levelColor(level: number): string {
  return LEVEL_BAND_COLORS[bandIndex(level)];
}

export function levelMaterial(level: number): string {
  return LEVEL_BAND_MATERIALS[bandIndex(level)];
}

// Subdivisao dentro da faixa (estilo "Ouro III"), do 4 (acabou de entrar
// na faixa) ao 1 (prestes a subir de material) -- mesma logica de
// divisoes que jogos de ranking usam pra dar sensacao de progresso
// dentro do proprio tier, nao so entre tiers.
export function levelSubTier(level: number): string {
  const posInBand = ((level - 1) % 10) + 1; // 1..10
  const tier = posInBand <= 2 ? 4 : posInBand <= 5 ? 3 : posInBand <= 8 ? 2 : 1;
  return ["", "I", "II", "III", "IV"][tier];
}

// Legado — nao usado mais na UI (nome de patente em ingles removido a
// pedido explicito), mantido so pra nao quebrar quem ainda importa.
export function getPatente(level: number) {
  if (level >= 25) return "Lenda do Poker";
  return PATENTES[level - 1] || "Micro Stakes I";
}

export interface Progress {
  level: number;
  xp_current: number;
  xp_total: number;
  streak_days: number;
  streak_best: number;
  combo_gto: number;
  prestige_count: number;
}

export async function fetchProgress(): Promise<Progress> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_progress")
    .select("level, xp_current, xp_total, streak_days, streak_best, combo_gto, prestige_count")
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      level: 1,
      xp_current: 0,
      xp_total: 0,
      streak_days: 0,
      streak_best: 0,
      combo_gto: 0,
      prestige_count: 0,
    }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchActiveMissions(): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_missions")
    .select(
      "id, progress, goal_value, status, period_start, completed_at, missions(code, title, description, kind, category, xp_reward, icon, difficulty)"
    )
    .eq("status", "active")
    .order("period_start", { ascending: false });
  if (error) throw error;
  return data || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchMissionCatalog(): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("missions")
    .select("code, title, description, kind, category, goal_base, xp_reward, icon, difficulty")
    .order("kind", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function registerTraining({
  spotId,
  verdict,
  evLoss,
  userAction,
  userSizing,
}: {
  spotId?: string | null;
  verdict: string;
  evLoss: number;
  userAction?: string | null;
  userSizing?: number | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("register_training", {
    p_spot_id: spotId || null,
    p_verdict: verdict,
    p_ev_loss: Number(evLoss) || 0,
    p_user_action: userAction || null,
    p_user_sizing: userSizing != null ? Number(userSizing) : null,
  });
  if (error) throw error;
  return data?.[0];
}

export async function awardXP({
  source,
  category,
  xpBase,
  referenceId,
}: {
  source: string;
  category: string;
  xpBase: number;
  referenceId?: string | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("award_xp", {
    p_source: source,
    p_category: category,
    p_xp_base: xpBase,
    p_reference_id: referenceId || null,
  });
  if (error) throw error;
  return data?.[0];
}

// --- Ranking global (todos os membros PokerSync) --------------------------
export type LeaderboardPeriod = "week" | "month" | "season" | "all";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  level: number;
  xpTotal: number;
  streakDays: number;
  rank: number;
  /** Numeros das temporadas que esse jogador ja venceu (Temporada #N) -- [] se nenhuma. */
  championSeasons: number[];
}

export async function fetchLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    name: r.name,
    level: r.level,
    xpTotal: r.xp_total,
    streakDays: r.streak_days,
    rank: Number(r.rank),
    championSeasons: (r.champion_seasons ?? []).map(Number),
  }));
}

// Ranking por periodo (semana/mes/geral) — "geral" e' xp_total vitalicio
// (mesma coisa que fetchLeaderboard), semana/mes somam xp_events da
// janela. xpTotal aqui carrega o xp DO PERIODO quando period != "all",
// nao o xp vitalicio — nome do campo mantido por simplicidade de uso na UI.
export async function fetchLeaderboardPeriod(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_leaderboard_period", { p_period: period, p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    name: r.name,
    level: r.level,
    xpTotal: r.xp_period,
    streakDays: r.streak_days,
    rank: Number(r.rank),
    championSeasons: (r.champion_seasons ?? []).map(Number),
  }));
}

export interface MyRank {
  rank: number;
  xp: number;
  totalPlayers: number;
}

// Posicao do proprio usuario, mesmo fora do top exibido -- sem isso quem
// nao esta no top 50 nunca sabe onde esta no ranking.
export async function fetchMyLeaderboardRank(period: LeaderboardPeriod): Promise<MyRank | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_leaderboard_rank", { p_period: period });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return { rank: Number(r.rank), xp: Number(r.xp), totalPlayers: Number(r.total_players) };
}

// --- Temporada de ranking (3 em 3 meses, premio configuravel) -------------
export interface Season {
  id: string;
  /** Numero sequencial da temporada (Temporada #N), calculado por ordem de inicio. */
  seasonNumber: number;
  startsAt: string;
  endsAt: string;
  rewardTitle: string | null;
  rewardDescription: string | null;
  daysRemaining: number;
}

// null quando nenhuma temporada esta configurada pro periodo atual --
// tela trata isso mostrando "sem temporada ativa", nao cai no ranking geral.
export async function fetchActiveSeason(): Promise<Season | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_active_season");
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id: r.id,
    seasonNumber: Number(r.season_number),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    rewardTitle: r.reward_title || null,
    rewardDescription: r.reward_description || null,
    daysRemaining: Number(r.days_remaining),
  };
}

// Apura o campeao de qualquer temporada ja encerrada que ainda nao tem
// vencedor registrado (idempotente) -- chamada de leve ao abrir a vista
// de Ranking, sem depender de cron: a temporada "liquida" na proxima vez
// que alguem visita a tela apos o fim dela.
export async function settleExpiredSeasons(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("settle_expired_seasons");
  if (error) throw error;
}

// Dispara os avisos globais de temporada (1 semana / 1 dia pro fim, e
// campeao anunciado apos apurada) — idempotente no banco, so' cria
// notificacao na primeira chamada apos cruzar cada limiar.
export async function checkSeasonNotifications(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("check_season_notifications");
  if (error) throw error;
}
