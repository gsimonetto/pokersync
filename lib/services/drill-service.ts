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

async function queryDrills(size: number, filters: CompleteDrillFilters): Promise<DrillHand[]> {
  const supabase = createClient();
  const clampedSize = Math.min(Math.max(size, 1), 50);

  const { data, error } = await supabase
    .from("drills")
    .select("spot_id, board, pot, effective_stack, gto_nodes, position")
    .eq("position", filters.position)
    .eq("action", filters.action)
    .eq("street", filters.street)
    .limit(clampedSize * 3); // margem para os que forem filtrados por gto_nodes invalido

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

// Caminho do Revisor de Maos: resolve o filter_config de uma sugestao ativa
// e busca os drills correspondentes. Se a sugestao nao tiver os 3 campos
// preenchidos, tambem nao busca nada — mesma regra de precisao do caminho manual.
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

  const config = (suggestion.filter_config ?? {}) as DrillFilters;
  if (!hasCompleteFilters(config)) return [];

  return queryDrills(size, config);
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
