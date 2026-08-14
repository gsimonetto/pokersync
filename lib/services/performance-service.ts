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
  updated_at: string;
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
