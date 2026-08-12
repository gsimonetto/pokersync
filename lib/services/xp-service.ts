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

export function getPatente(level: number) {
  if (level >= 25) return "Lenda do Poker";
  return PATENTES[level - 1] || "Micro Stakes I";
}

export function xpForNextLevel(level: number) {
  return Math.round(100 * Math.pow(level, 1.5));
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
      "id, progress, goal_value, status, period_start, completed_at, missions(code, title, description, kind, category, xp_reward, icon)"
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
    .select("code, title, description, kind, category, goal_base, xp_reward, icon")
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
export interface LeaderboardEntry {
  userId: string;
  name: string;
  level: number;
  xpTotal: number;
  streakDays: number;
  rank: number;
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
  }));
}
