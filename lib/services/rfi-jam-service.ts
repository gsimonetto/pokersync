import { createClient } from "@/lib/supabase/client";
import type { RangeHands } from "@/components/ranges/range-grid";

// Formato compacto que o motor novo (pokersync-solver) grava:
// cada mão vira [freq, ev_da_ação, gap] em vez de um objeto — bem mais
// leve pro Supabase, mas precisa ser convertido pro formato que o
// RangeGrid já entende (fold/call/raise em %) antes de renderizar.
export interface RfiJamPhaseRaw {
  ev_fold: number;
  action: "open" | "jam" | "call";
  hands: Record<string, [freq: number, ev: number, gap: number]>;
}

export interface RfiJamSpot {
  spotId: string;
  matchup: string;
  stackBb: number;
  effectiveStack: number;
  pot: number;
  exploitability: number | null;
  sbOpen: RfiJamPhaseRaw;
  bbJam: RfiJamPhaseRaw;
  sbCallJam: RfiJamPhaseRaw;
}

export interface RfiJamListItem {
  spotId: string;
  matchup: string;
  stackBb: number;
}

// Posicoes e conversao pro token usado no spot_id gerado pelo motor
// (ex "btn_vs_bb") — vive aqui (nao em cada tela que consome spot RFI/
// Jam) pra Treino e Construtor de Ranges nao duplicarem o mesmo mapa.
export const ALL_POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];
export const POS_TO_TOKEN: Record<string, string> = {
  UTG: "utg",
  "UTG+1": "utg1",
  MP: "mp",
  HJ: "hj",
  CO: "co",
  BTN: "btn",
  SB: "sb",
  BB: "bb",
};
export const TOKEN_TO_POS: Record<string, string> = Object.fromEntries(
  Object.entries(POS_TO_TOKEN).map(([label, token]) => [token, label])
);

export function matchupKey(hero: string, villain: string): string {
  return `${POS_TO_TOKEN[hero]}_vs_${POS_TO_TOKEN[villain]}`;
}

export function parseMatchup(matchup: string): { hero: string | null; villain: string | null } {
  const [heroToken, villainToken] = matchup.split("_vs_");
  return { hero: TOKEN_TO_POS[heroToken] ?? null, villain: TOKEN_TO_POS[villainToken] ?? null };
}

// action='open'/'jam' pinta na cor de "raise" do grid (verde), porque
// tecnicamente são all-in — não existe uma 4a cor pronta no componente
// e criar uma agora só pra isso não vale o esforço nesse estágio de
// teste. action='call' pinta na cor de "call" (azul), que já existe.
function phaseToRangeHands(phase: RfiJamPhaseRaw): RangeHands {
  const out: RangeHands = {};
  for (const [label, [freq]] of Object.entries(phase.hands)) {
    const pct = Math.round(freq * 100);
    out[label] =
      phase.action === "call"
        ? { fold: 100 - pct, call: pct, raise: 0 }
        : { fold: 100 - pct, call: 0, raise: pct };
  }
  return out;
}

export function rfiJamSpotToRangeHands(spot: RfiJamSpot) {
  return {
    sbOpen: phaseToRangeHands(spot.sbOpen),
    bbJam: phaseToRangeHands(spot.bbJam),
    sbCallJam: phaseToRangeHands(spot.sbCallJam),
  };
}

// Lista os spots rfi_jam disponíveis (só o necessário pra montar um
// seletor) — separado do fetch completo porque o gto_nodes de cada
// spot pesa ~15-17KB, não queremos baixar todos só pra listar.
export async function listRfiJamSpots(): Promise<RfiJamListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("drills")
    .select("spot_id, position, stack_bb")
    .eq("action", "rfi_jam")
    .order("position", { ascending: true })
    .order("stack_bb", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    spotId: row.spot_id as string,
    matchup: row.position as string,
    stackBb: row.stack_bb as number,
  }));
}

export async function getRfiJamSpot(spotId: string): Promise<RfiJamSpot | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("drills")
    .select("spot_id, position, stack_bb, effective_stack, pot, exploitability, gto_nodes")
    .eq("spot_id", spotId)
    .eq("action", "rfi_jam")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // nenhuma linha encontrada
    throw error;
  }
  if (!data) return null;

  const nodes = data.gto_nodes as {
    sb_open: RfiJamPhaseRaw;
    bb_jam: RfiJamPhaseRaw;
    sb_call_jam: RfiJamPhaseRaw;
  };

  return {
    spotId: data.spot_id as string,
    matchup: data.position as string,
    stackBb: data.stack_bb as number,
    effectiveStack: data.effective_stack as number,
    pot: data.pot as number,
    exploitability: (data.exploitability as number | null) ?? null,
    sbOpen: nodes.sb_open,
    bbJam: nodes.bb_jam,
    sbCallJam: nodes.sb_call_jam,
  };
}
