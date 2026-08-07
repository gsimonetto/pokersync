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
}

export interface DrillFilters {
  position?: string | null;
  action?: string | null;
  street?: string | null;
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

export async function fetchDrillBatch(size = 20, filters: DrillFilters = {}): Promise<DrillHand[]> {
  const supabase = createClient();
  const clampedSize = Math.min(Math.max(size, 1), 50);

  let query = supabase.from("drills").select("spot_id, board, pot, effective_stack, gto_nodes").limit(clampedSize * 3); // margem para os que forem filtrados por gto_nodes invalido

  if (filters.position) query = query.eq("position", filters.position);
  if (filters.street) query = query.eq("street", filters.street);
  if (filters.action) query = query.eq("action", filters.action);

  const { data, error } = await query;
  if (error) throw error;

  const hands: DrillHand[] = (data ?? [])
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
      };
    });

  return hands;
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
