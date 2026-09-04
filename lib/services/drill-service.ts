import { createClient } from "@/lib/supabase/client";
import type { GtoNode } from "@/lib/poker/gto-verdict";

// Substitui api/drills/batch.js do Vite: la existia uma rota serverless
// porque a tabela drills so tinha RLS habilitado sem nenhuma policy
// (ninguem lia direto, nem autenticado). Adicionamos uma policy de
// leitura para authenticated, entao aqui consulta-se o Supabase direto
// do client, igual todo o resto do projeto (Banca, Hub, Revisor).

export interface DrillHand {
  drillId: string;
  board: unknown;
  pot: number;
  effectiveStack: number;
  gtoNodes: GtoNode;
  heroCards: string;
  // Posicao real do hero nesse spot (ex: "BB"). Fonte de verdade pro
  // layout de seats — nao usar filters.position pra isso, porque no
  // caminho de sugestao do Revisor o filtro manual fica vazio.
  position: string;
}

export interface DrillFilters {
  position?: string | null;
  action?: string | null;
  street?: string | null;
}

type CompleteDrillFilters = { position: string; action: string; street: string };

// Regra de negocio central: so existe criterio valido quando os 3 eixos
// (posicao, situacao, rua) estao presentes. Usado tanto pelo fetch manual
// quanto pela resolucao de sugestao do Revisor — nenhum dos dois caminhos
// busca no banco com criterio parcial ou vazio.
export function hasCompleteFilters(filters: DrillFilters): filters is CompleteDrillFilters {
  return !!filters.position && !!filters.action && !!filters.street;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidGtoNode(n: any): n is GtoNode {
  return (
    n &&
    typeof n === "object" &&
    Array.isArray(n.actions) &&
    n.actions.length > 0 &&
    n.strategy &&
    typeof n.strategy === "object" &&
    Object.keys(n.strategy).length > 0
  );
}

// Sorteia um combo especifico (ex: "AsKd") dentre os que o solver
// calculou estrategia para este spot. Distribuicao uniforme entre os
// combos presentes — aproximacao aceitavel para treino.
function dealHeroCombo(strategy: Record<string, number[]>): string {
  const combos = Object.keys(strategy);
  const idx = Math.floor(Math.random() * combos.length);
  return combos[idx];
}

// Aceita filtro parcial de proposito: o caminho manual sempre passa os 3
// eixos (garantido por hasCompleteFilters antes de chamar), mas o caminho
// de sugestao do Revisor so consegue traduzir a rua. Quem garante que
// nunca ha busca "sem criterio nenhum" sao os dois callers abaixo.
async function queryDrills(size: number, filters: DrillFilters): Promise<DrillHand[]> {
  const supabase = createClient();
  const clampedSize = Math.min(Math.max(size, 1), 50);

  let query = supabase
    .from("drills")
    .select("spot_id, board, pot, effective_stack, gto_nodes, position");

  if (filters.position) query = query.eq("position", filters.position);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.street) query = query.eq("street", filters.street);

  const { data, error } = await query.limit(clampedSize * 3); // margem para os que forem filtrados por gto_nodes invalido

  if (error) throw error;

  return (data ?? [])
    .filter((r) => isValidGtoNode(r.gto_nodes))
    .slice(0, clampedSize)
    .map((r) => {
      const gtoNodes = r.gto_nodes as GtoNode;
      return {
        drillId: r.spot_id,
        board: r.board,
        pot: Number(r.pot),
        effectiveStack: Number(r.effective_stack),
        gtoNodes,
        heroCards: dealHeroCombo(gtoNodes.strategy),
        position: r.position,
      };
    });
}

// Caminho manual: jogador seleciona posicao + situacao + rua nos filtros.
// Sem os 3 completos, nao faz nenhuma chamada ao Supabase — retorna vazio
// direto. Essa e a correcao do bug: antes, filters={} ja disparava a query.
export async function fetchDrillBatch(size = 20, filters: DrillFilters = {}): Promise<DrillHand[]> {
  if (!hasCompleteFilters(filters)) return [];
  return queryDrills(size, filters);
}

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
export interface SuggestionTarget {
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

export function resolveSuggestionTarget(filterConfig: unknown): SuggestionTarget | null {
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

// Caminho de pos-flop (ainda sem estoque): traduz so' a rua, que e' a
// unica dimensao com correspondencia 1:1 entre os dois vocabularios.
const SUGGESTION_STREET_MAP: Record<string, string> = {
  flop: "Flop",
  turn: "Turn",
  river: "River",
  // "preflop" fica de fora aqui de proposito: leak de preflop e' resolvido
  // por SCENARIO_TARGET acima, que aponta pro spot exato em vez de sortear
  // qualquer mao da rua.
};

export function resolveSuggestionStreet(filterConfig: unknown): string | null {
  if (!filterConfig || typeof filterConfig !== "object") return null;
  const street = (filterConfig as Record<string, unknown>).street;
  if (typeof street !== "string") return null;
  return SUGGESTION_STREET_MAP[street.toLowerCase()] ?? null;
}

// Caminho do Revisor de Maos: resolve o filter_config de uma sugestao ativa
// e busca os drills correspondentes. Se a rua da sugestao nao existir na
// base de drills (ex: leaks de preflop), retorna vazio em vez de trazer
// mao aleatoria — mesma regra de precisao do caminho manual.
export async function fetchDrillBatchBySuggestion(suggestionId: string, size = 20): Promise<DrillHand[]> {
  const supabase = createClient();

  const { data: suggestion, error } = await supabase
    .from("hand_review_drill_suggestions")
    .select("filter_config, active")
    .eq("id", suggestionId)
    .eq("active", true)
    .single();

  if (error) throw error;
  if (!suggestion) throw new Error("SUGGESTION_NOT_FOUND");

  const street = resolveSuggestionStreet(suggestion.filter_config);
  if (!street) return [];

  return queryDrills(size, { street });
}

export interface DrillFacet {
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
