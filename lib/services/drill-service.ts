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

// O filter_config das sugestoes NAO usa o mesmo vocabulario dos drills:
//   sugestao: { action: "cbet", street: "flop", board_texture: [...] }
//             { street: "preflop", scenario: "3bet_defense" }
//   drills:   position BB|BTN|SB, action "vs Open"|"3-Bet", street Flop|Turn|River
// Nenhuma sugestao traz position, e o vocabulario de action nao tem
// correspondencia confiavel ("cbet" nao e' "vs Open" nem "3-Bet").
// Traduzir so a rua e' o unico mapeamento honesto hoje — inventar o
// resto geraria drill errado, que e' pior que drill nenhum.
const SUGGESTION_STREET_MAP: Record<string, string> = {
  flop: "Flop",
  turn: "Turn",
  river: "River",
  // "preflop" fica de fora de proposito: nao existe nenhum drill de
  // preflop na base hoje (confirmado — todos sao Flop/Turn/River).
};

export function resolveSuggestionStreet(filterConfig: unknown): string | null {
  if (!filterConfig || typeof filterConfig !== "object") return null;
  const street = (filterConfig as Record<string, unknown>).street;
  if (typeof street !== "string") return null;
  return SUGGESTION_STREET_MAP[street.toLowerCase()] ?? null;
}

// Uma sugestao so e' "treinavel" se a rua dela existir na base de drills.
// Usado pelo card de leaks pra so mostrar o botao quando ha mao de verdade.
export function suggestionHasDrills(filterConfig: unknown, facets: DrillFacet[]): boolean {
  const street = resolveSuggestionStreet(filterConfig);
  if (!street) return false;
  return facets.some((f) => f.street === street && f.n > 0);
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
