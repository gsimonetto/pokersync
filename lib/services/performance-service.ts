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

// Os 5 pilares do Score de Evolução (calculados no banco, view
// player_performance_snapshot), com peso e o texto do hover que explica
// de onde cada um vem -- usados pelo pentágono do Painel.
interface ScoreComponent {
  key: keyof Pick<
    PlayerPerformance,
    "score_tecnica" | "score_conhecimento" | "score_disciplina" | "score_performance" | "score_consistencia"
  >;
  label: string;
  peso: string;
  explicacao: string;
}

export const COMPONENTES_SCORE: ScoreComponent[] = [
  {
    key: "score_tecnica",
    label: "Técnica",
    peso: "25%",
    explicacao: "Quanto você acerta nas suas próprias avaliações de mão no Revisor (quando você marca se acertou ou errou a decisão).",
  },
  {
    key: "score_conhecimento",
    label: "Conhecimento",
    peso: "20%",
    explicacao: "Taxa de acerto nos treinos do Modo Treino (decisões comparadas com o GTO).",
  },
  {
    key: "score_disciplina",
    label: "Disciplina",
    peso: "20%",
    explicacao: "Sua sequência de dias ativos (streak) — 14 dias seguidos ou mais já vale o máximo desse pedaço.",
  },
  {
    key: "score_performance",
    label: "Performance",
    peso: "20%",
    explicacao: "Seu ROI (retorno sobre investimento) nas sessões registradas na Gestão de Banca.",
  },
  {
    key: "score_consistencia",
    label: "Consistência",
    peso: "15%",
    explicacao: "Quantas sessões por semana você registra — 3 ou mais por semana já vale o máximo desse pedaço.",
  },
];
