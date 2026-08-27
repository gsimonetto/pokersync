import { createClient } from "@/lib/supabase/client";
import { findEligibleAllInConfrontation } from "@/lib/poker/hand-ev-eligibility";
import type { ParsedHand } from "@/lib/poker/hand-parser";

export interface HandEvResult {
  handReviewId: string;
  heroEquityPct: number | null;
  chipsAtRisk: number | null;
  heroExpectedChipDelta: number | null;
  heroIcmBaselineDollars: number | null;
  heroExpectedIcmDollars: number | null;
  heroExpectedIcmDeltaDollars: number | null;
  computedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToResult(r: any): HandEvResult {
  return {
    handReviewId: r.hand_review_id,
    heroEquityPct: r.hero_equity_pct,
    chipsAtRisk: r.chips_at_risk,
    heroExpectedChipDelta: r.hero_expected_chip_delta,
    heroIcmBaselineDollars: r.hero_icm_baseline_dollars,
    heroExpectedIcmDollars: r.hero_expected_icm_dollars,
    heroExpectedIcmDeltaDollars: r.hero_expected_icm_delta_dollars,
    computedAt: r.computed_at,
  };
}

export async function fetchHandEvResults(): Promise<HandEvResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("hand_ev_results").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToResult);
}

// Mãos que ainda não têm hand_ev_results — pré-filtra no cliente por
// elegibilidade (mesma função usada no servidor) antes de chamar a rota,
// pra não gastar chamada ao solver com mão que nunca vai qualificar.
export async function fetchEligibleHandReviewIds(): Promise<string[]> {
  const supabase = createClient();
  const [{ data: reviews, error: eReviews }, { data: existing, error: eExisting }] = await Promise.all([
    supabase.from("hand_reviews").select("id, parsed_data"),
    supabase.from("hand_ev_results").select("hand_review_id"),
  ]);
  if (eReviews) throw eReviews;
  if (eExisting) throw eExisting;
  const already = new Set((existing ?? []).map((r) => r.hand_review_id as string));

  return (reviews ?? [])
    .filter((r) => !already.has(r.id))
    .filter((r) => {
      const parsed = r.parsed_data as { kind?: string } | null;
      if (!parsed || parsed.kind !== "parsed") return false;
      return findEligibleAllInConfrontation(parsed as unknown as ParsedHand) !== null;
    })
    .map((r) => r.id);
}

export interface ComputeHandEvOutcome {
  handReviewId: string;
  ok: boolean;
  computed: boolean;
  reason?: string;
}

export async function computeHandEv(handReviewId: string): Promise<ComputeHandEvOutcome> {
  const res = await fetch("/api/hand-ev/compute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handReviewId }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    return { handReviewId, ok: false, computed: false, reason: body.error ?? `HTTP ${res.status}` };
  }
  return { handReviewId, ok: true, computed: Boolean(body.computed), reason: body.reason };
}

// Roda sequencial de propósito (não Promise.all) — o solver processa uma
// mão de cada vez em <1s, e mandar dezenas em paralelo não ganha nada
// além de estressar o serviço à toa.
export async function computeHandEvBatch(
  handReviewIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<ComputeHandEvOutcome[]> {
  const outcomes: ComputeHandEvOutcome[] = [];
  for (let i = 0; i < handReviewIds.length; i++) {
    outcomes.push(await computeHandEv(handReviewIds[i]));
    onProgress?.(i + 1, handReviewIds.length);
  }
  return outcomes;
}
