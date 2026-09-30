import { createClient } from "@/lib/supabase/client";

// ---- Sugestao de leak -> alvo de treino ---------------------------------
//
// O filter_config das sugestoes NAO usa o mesmo vocabulario dos drills:
//   sugestao: { action: "cbet", street: "flop", board_texture: [...] }
//             { street: "preflop", scenario: "bvb" }
//   drills:   position sb_vs_bb|btn_vs_bb, action rfi_jam, street Preflop
// Nenhuma sugestao traz position, e o vocabulario de action nao tem
// correspondencia direta. Traduzir CENARIO -> alvo, um a um e so' quando
// a equivalencia e' exata, e' o unico mapeamento honesto — inventar o
// resto geraria drill errado, que e' pior que drill nenhum.
//
// (Ate 2026-08 este arquivo assumia o inverso: que a base era toda
// Flop/Turn/River e nao tinha nada de preflop. Hoje e' exatamente o
// contrario -- a base e' 100% Preflop, RFI/Jam -- e por isso nenhum leak
// aparecia como treinavel.)

/** Chaves que casam com drill_facets, mais o que a tela de Treino precisa. */
interface SuggestionTarget {
  position: string;
  action: string;
  street: string;
  /** Stack preferido quando o cenario implica um; sem isso, o Treino escolhe. */
  stackBb?: number;
}

// Um cenario so entra aqui quando (1) o estoque de drills resolve a MESMA
// decisao que o leak descreve e (2) a tela de Treino sabe renderizar esse
// formato. Ficam de fora, de proposito, ate que as duas coisas existam:
//   push_fold  -> o job de push/fold ICM ja existe no motor mas nunca foi
//                 disparado; e a decisao nao e' a mesma do RFI/Jam (la o SB
//                 abre 2.2x, aqui ele shova), entao NAO da pra apontar um
//                 pro outro.
//   3bet_defense, pko_call -> a arvore do motor trata toda resposta a um
//                 raise como all-in; nao existe 3-bet "de verdade" ainda.
//   cbet, bluffcatch, thin_value, hero_call, pot_control, river_bluff,
//   cbet_called_barrel -> dependem do pipeline de pos-flop (motor pronto,
//                 sem job, sem estoque, sem UI).
const SCENARIO_TARGET: Record<string, SuggestionTarget> = {
  // Blind vs blind pre-flop e' exatamente a decisao que o spot de
  // sb_vs_bb resolve: abrir ou foldar do SB, responder do BB.
  bvb: { position: "sb_vs_bb", action: "rfi_jam", street: "Preflop" },
};

function resolveSuggestionTarget(filterConfig: unknown): SuggestionTarget | null {
  if (!filterConfig || typeof filterConfig !== "object") return null;
  const scenario = (filterConfig as Record<string, unknown>).scenario;
  if (typeof scenario !== "string") return null;
  return SCENARIO_TARGET[scenario.toLowerCase()] ?? null;
}

// Uma sugestao so e' "treinavel" quando existe estoque de verdade pro alvo
// dela. Usado pelo card de leaks pra so mostrar o botao quando o clique
// leva a uma mao real — botao que abre tela vazia e' pior que botao nenhum.
export function suggestionHasDrills(filterConfig: unknown, facets: DrillFacet[]): boolean {
  const target = resolveSuggestionTarget(filterConfig);
  if (!target) return false;
  return facets.some(
    (f) => f.position === target.position && f.action === target.action && f.street === target.street && f.n > 0
  );
}

// Usado pela tela de Treino pra honrar /treino?suggestionId=... — devolve
// o alvo e o titulo da sugestao (pro banner "voce esta treinando X").
export async function fetchSuggestionTarget(
  suggestionId: string
): Promise<{ title: string; target: SuggestionTarget } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_review_drill_suggestions")
    .select("drill_title, filter_config, active")
    .eq("id", suggestionId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const target = resolveSuggestionTarget(data.filter_config);
  if (!target) return null;
  return { title: (data.drill_title as string) ?? "", target };
}

interface DrillFacet {
  position: string;
  action: string;
  street: string;
  n: number;
}

export async function fetchDrillFacets(): Promise<DrillFacet[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("drill_facets");
  if (error) throw error;
  return data ?? [];
}

// Quantos drills o jogador ja completou hoje -- usado pra aplicar o
// limite diario do plano Free (ver PLANS.free.modules.drill.limit em
// lib/plans/plans-data.ts) na tela do Treino (app/treino/page.tsx),
// antes de deixar ele comecar mais um. A trava de verdade e' o trigger
// training_sessions_check_free_limit no banco (a RPC register_training
// tem o erro dela ignorado pelo client, "XP e' bonus, nao trava o
// treino") -- isto aqui e' so' pra avisar o jogador antes, em vez dele
// jogar o drill inteiro e so descobrir no fim que nao contou.
export async function fetchTodayTrainingCount(): Promise<number> {
  const supabase = createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

// Acerto/erro ACUMULADO do jogador em todo o historico de training_sessions
// -- nao e' uma contagem de sessao/pagina, e' o placar "X/Y otimas" mostrado
// no cabecalho do Treino (rfi-jam-drill.tsx). Antes esse numero vivia so'
// em estado local do componente, entao reiniciava a cada login/reload
// (bug reportado) -- agora e' sempre lido daqui e so' incrementado
// localmente enquanto a mesma sessao de navegador dura, pra nao bater no
// banco a cada mao. "Otima" tem dois nomes no banco: 'PERFECT' (o que
// register_training grava desde setembro) e 'OTIMA' (treinos antigos).
export async function fetchTrainingAccuracy(): Promise<{ hits: number; total: number }> {
  const supabase = createClient();
  const [totalRes, hitsRes] = await Promise.all([
    supabase.from("training_sessions").select("id", { count: "exact", head: true }),
    supabase.from("training_sessions").select("id", { count: "exact", head: true }).in("verdict", ["PERFECT", "OTIMA"]),
  ]);
  if (totalRes.error) throw totalRes.error;
  if (hitsRes.error) throw hitsRes.error;
  return { hits: hitsRes.count ?? 0, total: totalRes.count ?? 0 };
}

// Perda em bb (training_sessions.ev_loss_bb, preenchida no banco pela
// mesma conta de lib/poker/ev-em-bb.ts) somada no total e hoje -- base do
// bb/100 do Treino. Maos sem regua de bb (treinos antigos) ficam de fora.
export interface ResumoEvTreino {
  total: { maos: number; perdaBb: number };
  hoje: { maos: number; perdaBb: number };
}

export async function fetchResumoEvTreino(): Promise<ResumoEvTreino> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("resumo_ev_treino").maybeSingle<{
    maos: number;
    perda_bb: number;
    maos_hoje: number;
    perda_bb_hoje: number;
  }>();
  if (error) throw error;
  return {
    total: { maos: data?.maos ?? 0, perdaBb: Number(data?.perda_bb ?? 0) },
    hoje: { maos: data?.maos_hoje ?? 0, perdaBb: Number(data?.perda_bb_hoje ?? 0) },
  };
}

// ---- Sessao diaria retomavel (filtros + progresso do bloco) -------------
//
// register_training (RPC chamada a cada mao, ver xp-service.registerTraining)
// grava/atualiza uma unica linha em training_session_state por jogador,
// reiniciando sozinha quando o dia muda. Aqui so' lemos essa linha, pra
// saber se ha uma sessao de hoje pra retomar quando /treino abre.

export interface RfiJamFilterState {
  heroPos: string;
  villainPos: string;
  stackBb: number;
  phaseKey: string;
  heroAny: boolean;
  villainAny: boolean;
  stackAny: boolean;
  phaseAny: boolean;
}

interface TrainingSessionState {
  filters: RfiJamFilterState;
  handsPlayed: number;
  hits: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidFilterState(f: any): f is RfiJamFilterState {
  return (
    f &&
    typeof f === "object" &&
    typeof f.heroPos === "string" &&
    typeof f.villainPos === "string" &&
    typeof f.stackBb === "number" &&
    typeof f.phaseKey === "string" &&
    typeof f.heroAny === "boolean" &&
    typeof f.villainAny === "boolean" &&
    typeof f.stackAny === "boolean" &&
    typeof f.phaseAny === "boolean"
  );
}

// Retorna null quando nao ha sessao pra retomar: sem linha ainda, dia
// diferente de hoje (a propria RPC ja reinicia a linha nesse caso, mas o
// jogador pode abrir /treino antes de jogar a primeira mao do dia), ou
// filtros salvos num formato que essa versao do app nao reconhece mais.
export async function fetchSessionState(): Promise<TrainingSessionState | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_session_state")
    .select("day, filters, hands_played, hits")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  if (data.day !== today) return null;
  if (!isValidFilterState(data.filters)) return null;

  return { filters: data.filters, handsPlayed: data.hands_played ?? 0, hits: data.hits ?? 0 };
}
