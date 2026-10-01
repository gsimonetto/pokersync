import { createClient } from "@/lib/supabase/client";
import type { RangeHands } from "@/lib/poker/grade-gto";

// Formato compacto que o motor novo (pokersync-solver) grava:
// cada mão vira [freq, ev_da_ação, gap] em vez de um objeto — bem mais
// leve pro Supabase, mas precisa ser convertido pro formato que a
// grade do spot (RangeDoSpot) entende (fold/call/raise em %) antes de renderizar.
export interface RfiJamPhaseRaw {
  ev_fold: number;
  action: "open" | "allin" | "call";
  hands: Record<string, [freq: number, ev: number, gap: number]>;
}

export interface RfiJamSpot {
  spotId: string;
  matchup: string;
  stackBb: number;
  effectiveStack: number;
  /** Pote antes da ação: blinds (+ ante e blind morto do SB no motor v2). */
  pot: number;
  exploitability: number | null;
  sbOpen: RfiJamPhaseRaw;
  bbJam: RfiJamPhaseRaw;
  // So' existe em spots de RFI/Jam -- spots de Push/Fold tem so' 2 fases.
  sbCallJam?: RfiJamPhaseRaw;
  // Motor v2 (pokersync-solver engine/rfi_jam_v2.py, 2026-10): ante, call
  // do BB e all-in direto de quem abre. Cada decisão passa a ter as
  // opções reais -- quem abre: fold/raise/all-in; BB diante do raise:
  // fold/call/all-in; BB diante do all-in direto: fold/call.
  /** Quem abre indo all-in direto (2a opção da fase sbOpen). */
  sbJam?: RfiJamPhaseRaw;
  /** BB pagando o raise (2a opção da fase bbJam). */
  bbCallRaise?: RfiJamPhaseRaw;
  /** BB diante do all-in direto de quem abre (fase própria). */
  bbCallJam?: RfiJamPhaseRaw;
  /** Ante em bb (só v2). */
  ante?: number;
  /** Valor de 1 bb na escala do motor, calculado pelo próprio motor (v2). */
  icmPorBb?: number;
  /** Frequência total de cada ação -- fase que quase nunca acontece fica de fora do sorteio. */
  totals?: {
    opener: { fold: number; raise: number; jam: number };
    bb_vs_raise: { fold: number; call: number; jam: number };
    bb_vs_jam: { fold: number; call: number };
  };
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
const POS_TO_TOKEN: Record<string, string> = {
  UTG: "utg",
  "UTG+1": "utg1",
  MP: "mp",
  HJ: "hj",
  CO: "co",
  BTN: "btn",
  SB: "sb",
  BB: "bb",
};
const TOKEN_TO_POS: Record<string, string> = Object.fromEntries(
  Object.entries(POS_TO_TOKEN).map(([label, token]) => [token, label])
);

export function parseMatchup(matchup: string): { hero: string | null; villain: string | null } {
  const [heroToken, villainToken] = matchup.split("_vs_");
  return { hero: TOKEN_TO_POS[heroToken] ?? null, villain: TOKEN_TO_POS[villainToken] ?? null };
}

// action='open' pinta na cor de "raise" do grid (verde), porque
// tecnicamente é all-in — não existe uma 4a cor pronta no componente
// e criar uma agora só pra isso não vale o esforço nesse estágio de
// teste. action='call' pinta na cor de "call" (azul), que já existe.
// action='allin' e' um all-in de verdade -- marca o raiseType pra a
// grade do construtor colorir igual ao botao "All-in" (nao o verde
// generico de "Raise"), consistente com o que o solver de fato resolveu.
const ACTION_RAISE_TYPE: Record<RfiJamPhaseRaw["action"], "raise" | "allin" | undefined> = {
  open: "raise",
  allin: "allin",
  call: undefined,
};

// `phase` pode não existir (spots de Push/Fold não têm sb_call_jam) --
// devolve grade vazia em vez de quebrar, quem chama decide se esconde
// essa fase da UI (ver motor-library-panel.tsx).
function phaseToRangeHands(phase: RfiJamPhaseRaw | undefined): RangeHands {
  if (!phase) return {};
  const out: RangeHands = {};
  const raiseType = ACTION_RAISE_TYPE[phase.action];
  for (const [label, [freq]] of Object.entries(phase.hands)) {
    const pct = Math.round(freq * 100);
    out[label] =
      phase.action === "call"
        ? { fold: 100 - pct, call: pct, raise: 0 }
        : { fold: 100 - pct, call: 0, raise: pct, raiseType };
  }
  return out;
}

// Fase com duas ações além do fold (motor v2): quem abre (raise +
// all-in) e o BB diante do raise (call + all-in). A barra de raise vira
// a mistura raise/all-in (cores diferentes na mesma célula).
function twoActionPhaseToRangeHands(main: RfiJamPhaseRaw, extra: RfiJamPhaseRaw): RangeHands {
  const out: RangeHands = {};
  for (const [label, [freqMain]] of Object.entries(main.hands)) {
    const freqExtra = extra.hands[label]?.[0] ?? 0;
    const a = Math.round(freqMain * 100);
    const b = Math.round(freqExtra * 100);
    const fold = Math.max(0, 100 - a - b);
    if (extra.action === "call") {
      // BB diante do raise: main = all-in, extra = call
      out[label] = { fold, call: b, raise: a, raiseType: "allin" };
    } else {
      // quem abre: main = raise, extra = all-in
      out[label] = {
        fold,
        call: 0,
        raise: a + b,
        raiseType: b > a ? "allin" : "raise",
        raiseMix: a > 0 && b > 0 ? [{ type: "raise", weight: a }, { type: "allin", weight: b }] : undefined,
      };
    }
  }
  return out;
}

export function rfiJamSpotToRangeHands(spot: RfiJamSpot) {
  return {
    sbOpen: spot.sbJam ? twoActionPhaseToRangeHands(spot.sbOpen, spot.sbJam) : phaseToRangeHands(spot.sbOpen),
    bbJam: spot.bbCallRaise ? twoActionPhaseToRangeHands(spot.bbJam, spot.bbCallRaise) : phaseToRangeHands(spot.bbJam),
    sbCallJam: phaseToRangeHands(spot.sbCallJam),
    bbCallJam: phaseToRangeHands(spot.bbCallJam),
  };
}

// Fase que quase nunca acontece no equilíbrio (ex.: com 10 bb ninguém dá
// raise pequeno, então "BB diante do raise" não existe na prática) fica
// fora do sorteio -- treinar uma decisão que o GTO nunca enfrenta só
// ensinaria ruído. Spots antigos (sem `totals`) mantêm as fases que têm.
const MIN_FREQ_FASE = 0.03;
export function faseDisponivel(spot: RfiJamSpot, key: "sbOpen" | "bbJam" | "sbCallJam" | "bbCallJam"): boolean {
  if (key === "sbOpen") return true;
  const phase = spot[key];
  if (!phase) return false;
  const t = spot.totals;
  if (!t) return true;
  if (key === "bbJam") return t.opener.raise >= MIN_FREQ_FASE;
  if (key === "sbCallJam") return t.opener.raise * t.bb_vs_raise.jam >= MIN_FREQ_FASE / 2;
  return t.opener.jam >= MIN_FREQ_FASE;
}

// Situações que o Treino sabe desenhar hoje -- RFI/Jam (3 fases:
// sb_open/bb_jam/sb_call_jam) e Push/Fold (2 fases: sb_open/bb_jam, no
// MESMO formato -- ver jobs/solve_pushfold_batch.py no pokersync-solver,
// v0.2.0). Qualquer outro `action` na tabela (ex: pos-flop, quando
// existir) fica de fora ate' ter uma tela que saiba renderizar.
const DRILL_ACTIONS = ["rfi_jam", "pushfold"] as const;

// Lista os spots disponíveis pro Treino (só o necessário pra montar um
// seletor) — separado do fetch completo porque o gto_nodes de cada
// spot pesa ~15-17KB, não queremos baixar todos só pra listar.
export async function listRfiJamSpots(): Promise<RfiJamListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("drills")
    .select("spot_id, position, stack_bb")
    .in("action", DRILL_ACTIONS)
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
    .in("action", DRILL_ACTIONS)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // nenhuma linha encontrada
    throw error;
  }
  if (!data) return null;

  // sb_call_jam so' existe em spots de RFI/Jam -- Push/Fold so' tem 2
  // fases (nao existe um "pagar o all-in" separado, quem empurrou ja'
  // esta' all-in por definicao).
  const nodes = data.gto_nodes as {
    sb_open: RfiJamPhaseRaw;
    bb_jam: RfiJamPhaseRaw;
    sb_call_jam?: RfiJamPhaseRaw;
    sb_jam?: RfiJamPhaseRaw;
    bb_call_raise?: RfiJamPhaseRaw;
    bb_call_jam?: RfiJamPhaseRaw;
    ante?: number;
    icm_por_bb?: number;
    totals?: RfiJamSpot["totals"];
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
    sbJam: nodes.sb_jam,
    bbCallRaise: nodes.bb_call_raise,
    bbCallJam: nodes.bb_call_jam,
    ante: nodes.ante,
    icmPorBb: nodes.icm_por_bb,
    totals: nodes.totals,
  };
}
