import { createClient } from "@/lib/supabase/client";

export interface LeakItem {
  code: string;
  label: string | null;
  category: string | null;
  ocorrencias: number;
}

export interface PlayerPerformance {
  user_id: string;
  // Financeiro
  num_sessoes: number | null;
  horas_jogadas: number | null;
  lucro_acumulado: number | null;
  total_investido: number | null;
  roi_pct: number | null;
  dolar_hora: number | null;
  abi_torneio: number | null;
  maior_sessao_positiva: number | null;
  maior_sessao_negativa: number | null;
  downswing_atual: number | null;
  num_torneios: number | null;
  num_cash: number | null;
  itm_pct_aproximado: number | null;
  frequencia_semanal_sessoes: number | null;
  // Estudo / evolução
  maos_revisadas: number | null;
  num_drills: number | null;
  taxa_acerto_treino_pct: number | null;
  streak_atual: number | null;
  streak_best: number | null;
  xp_total: number | null;
  top_leaks: LeakItem[] | null;
  // Frequências (aproximadas — dependem da qualidade do hand history colado)
  vpip_pct: number | null;
  pfr_pct: number | null;
  three_bet_pct: number | null;
  maos_com_dados_frequencia: number | null;
  // Reservado para quando o agente desktop existir
  bb_100: number | null;
  itm_pct_real: number | null;
  // Score Geral de Evolucao — 5 componentes 0-100 + nota final ponderada.
  // Quando falta dado, o componente vem 50 (neutro), nunca 0.
  score_tecnica: number | null;
  score_conhecimento: number | null;
  score_disciplina: number | null;
  score_performance: number | null;
  score_consistencia: number | null;
  score_geral: number | null;
  updated_at: string;
}

export interface TimelineEvent {
  event_date: string;
  event_type: string;
  title: string;
  detail: string | null;
}

// Busca o snapshot agregado do usuario logado. A view "player_performance"
// ja filtra por auth.uid() no proprio SQL (RLS nao se aplica a
// materialized view, entao a protecao esta nessa view fina) — nao precisa
// (e nao deve) passar user_id manualmente aqui.
export async function fetchPlayerPerformance(): Promise<PlayerPerformance | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("player_performance").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export interface SkillArea {
  area: string;
  accuracy_pct: number | null;
  sample_count: number;
}

// Precisao da auto-avaliacao (Revisor) por area. ICM ficou de fora —
// sem dado de bolha/ICM ainda (ver decisao registrada sobre o agente
// desktop).
export async function fetchSkillBreakdown(): Promise<SkillArea[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_skill_breakdown");
  if (error) throw error;
  return (data ?? []) as SkillArea[];
}

export interface PeriodComparisonRow {
  metric: string;
  period_early: number | null;
  period_recent: number | null;
  unit: string;
}

// Primeira metade do historico de sessoes vs segunda metade — nao 90
// dias fixos, pra funcionar mesmo com poucos meses de dado.
export async function fetchPeriodComparison(): Promise<PeriodComparisonRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_period_comparison");
  if (error) throw error;
  return (data ?? []) as PeriodComparisonRow[];
}

// Frases geradas por regra simples (delta >= 3 pontos percentuais)
// sobre a comparacao de periodos. Sem IA/servico externo.
export async function fetchPlayerInsights(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_player_insights");
  if (error) throw error;
  return (data ?? []).map((r: { insight: string }) => r.insight);
}

// Sistema de niveis — bucket direto do score_geral. Nao precisa de
// tabela nem de RPC, e' derivado no cliente.
export function nivelDoScore(score: number | null): string {
  if (score === null) return "Sem dado ainda";
  if (score < 30) return "Iniciante";
  if (score < 50) return "Regular";
  if (score < 70) return "Competidor";
  if (score < 85) return "Grinder";
  return "Profissional";
}

export interface PositionStat {
  position: string;
  hands: number;
  vpip_pct: number | null;
  pfr_pct: number | null;
  three_bet_pct: number | null;
}

// Ordem canonica de posicoes MTT — usada so pra ordenar a exibicao,
// nunca pra inferir posicoes que o parser nao detectou.
const POSITION_ORDER = ["UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN", "SB", "BB"];

// Le direto de player_stats (Stats Engine), mantido incremental pelo
// trigger de hand_tags — sem nenhum recalculo aqui, so leitura + formatacao.
// RLS de player_stats ja restringe a linhas do proprio usuario.
export async function fetchPositionStats(): Promise<PositionStat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("player_stats")
    .select("value, hands_count, vpip_count, pfr_count, three_bet_count")
    .eq("dimension", "position");
  if (error) throw error;

  const stats = (data ?? [])
    .filter((r) => r.value)
    .map((r) => ({
      position: r.value as string,
      hands: r.hands_count,
      vpip_pct: r.hands_count > 0 ? Math.round((r.vpip_count / r.hands_count) * 1000) / 10 : null,
      pfr_pct: r.hands_count > 0 ? Math.round((r.pfr_count / r.hands_count) * 1000) / 10 : null,
      three_bet_pct: r.hands_count > 0 ? Math.round((r.three_bet_count / r.hands_count) * 1000) / 10 : null,
    }));

  return stats.sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a.position);
    const ib = POSITION_ORDER.indexOf(b.position);
    if (ia === -1 && ib === -1) return a.position.localeCompare(b.position);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export interface MatchupStat {
  matchup: string; // "BTN_vs_BB"
  hands: number;
  vpip_pct: number | null;
  pfr_pct: number | null;
  three_bet_pct: number | null;
}

// So heads-up pots geram matchup (2 jogadores no flop) — le direto de
// player_stats, sem recalculo. Top 10 por volume de maos.
export async function fetchMatchupStats(): Promise<MatchupStat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("player_stats")
    .select("value, hands_count, vpip_count, pfr_count, three_bet_count")
    .eq("dimension", "matchup")
    .order("hands_count", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.value)
    .map((r) => ({
      matchup: (r.value as string).replace("_vs_", " vs "),
      hands: r.hands_count,
      vpip_pct: r.hands_count > 0 ? Math.round((r.vpip_count / r.hands_count) * 1000) / 10 : null,
      pfr_pct: r.hands_count > 0 ? Math.round((r.pfr_count / r.hands_count) * 1000) / 10 : null,
      three_bet_pct: r.hands_count > 0 ? Math.round((r.three_bet_count / r.hands_count) * 1000) / 10 : null,
    }));
}

export interface IpOopSplit {
  ip_hands: number;
  oop_hands: number;
  ip_pct: number | null;
}

// So conta maos heads-up (onde IP/OOP tem sentido definido). Multiway
// nao entra aqui — nunca teve in_position calculado.
export async function fetchIpOopSplit(): Promise<IpOopSplit> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("player_stats")
    .select("value, hands_count")
    .eq("dimension", "ip_oop");
  if (error) throw error;
  const ip = (data ?? []).find((r) => r.value === "IP")?.hands_count ?? 0;
  const oop = (data ?? []).find((r) => r.value === "OOP")?.hands_count ?? 0;
  const total = ip + oop;
  return { ip_hands: ip, oop_hands: oop, ip_pct: total > 0 ? Math.round((ip / total) * 1000) / 10 : null };
}

// Destaques automaticos em cima da tabela "por posicao" — 100% derivado
// do que ja foi buscado, sem chamada nova ao banco. So considera posicao
// com pelo menos MIN_HANDS_FOR_HIGHLIGHT maos: com amostra pequena, um
// unico 3-bet vira "50%" e engana mais do que ajuda.
const MIN_HANDS_FOR_HIGHLIGHT = 10;

export function computePositionHighlights(stats: PositionStat[]): string[] {
  const eligible = stats.filter((s) => s.hands >= MIN_HANDS_FOR_HIGHLIGHT);
  if (eligible.length === 0) return [];

  const highlights: string[] = [];

  const topThreeBet = eligible
    .filter((s) => s.three_bet_pct !== null)
    .sort((a, b) => (b.three_bet_pct as number) - (a.three_bet_pct as number))[0];
  if (topThreeBet && (topThreeBet.three_bet_pct as number) > 0) {
    highlights.push(`Sua posição de maior 3-bet é ${topThreeBet.position} (${topThreeBet.three_bet_pct}%)`);
  }

  const topVpip = eligible
    .filter((s) => s.vpip_pct !== null)
    .sort((a, b) => (b.vpip_pct as number) - (a.vpip_pct as number))[0];
  if (topVpip) {
    highlights.push(`Você joga mais mãos (VPIP) em ${topVpip.position} (${topVpip.vpip_pct}%)`);
  }

  const topPfr = eligible
    .filter((s) => s.pfr_pct !== null)
    .sort((a, b) => (b.pfr_pct as number) - (a.pfr_pct as number))[0];
  if (topPfr) {
    highlights.push(`Você mais dá raise (PFR) em ${topPfr.position} (${topPfr.pfr_pct}%)`);
  }

  return highlights;
}

// Marcos da carreira do jogador — so inclui tipo de evento que da pra provar
// com dado real ja existente (primeira mao, primeiro drill, mesa final,
// titulo, patamares de ROI). RLS/SECURITY DEFINER da funcao ja filtra por
// auth.uid() internamente.
export async function fetchPlayerTimeline(): Promise<TimelineEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_player_timeline");
  if (error) throw error;
  return (data ?? []) as TimelineEvent[];
}
