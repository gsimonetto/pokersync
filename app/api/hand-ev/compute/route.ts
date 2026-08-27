// Calcula (ou recalcula) o cEV/ICM de UMA mão via pokersync-solver
// (POST /hands/compute_cev) e grava em hand_ev_results. Roda server-side
// só pra não expor SOLVER_API_KEY no navegador — continua usando a sessão
// normal do usuário (cookie), não uma service key, então RLS de
// hand_ev_results/hand_reviews/tournament_payouts se aplica igual ao
// cliente (ver policies "*_own" nas migrações).
import { createClient } from "@/lib/supabase/server";
import { findEligibleAllInConfrontation } from "@/lib/poker/hand-ev-eligibility";
import type { ParsedHand } from "@/lib/poker/hand-parser";

interface SolverCevResponse {
  hero_equity_pct: number;
  chips_at_risk: number;
  hero_expected_chip_delta: number;
  hero_icm_baseline_dollars: number;
  hero_icm_if_win_dollars: number;
  hero_icm_if_lose_dollars: number;
  hero_expected_icm_dollars: number;
  hero_expected_icm_delta_dollars: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Sessão expirada." }, { status: 401 });

  let body: { handReviewId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!body.handReviewId) return Response.json({ ok: false, error: "handReviewId ausente." }, { status: 400 });

  const { data: hr, error: eHr } = await supabase
    .from("hand_reviews")
    .select("id, parsed_data, hand_session_id")
    .eq("id", body.handReviewId)
    .single();
  if (eHr || !hr) return Response.json({ ok: false, error: "Mão não encontrada." }, { status: 404 });

  const parsed = hr.parsed_data as { kind?: string } | null;
  if (!parsed || parsed.kind !== "parsed") {
    return Response.json({ ok: true, eligible: false, reason: "Mão sem hand history estruturada." });
  }

  const confrontation = findEligibleAllInConfrontation(parsed as unknown as ParsedHand);
  if (!confrontation) {
    return Response.json({
      ok: true,
      eligible: false,
      reason: "Não é um all-in heads-up preflop com as duas mãos mostradas — fora do escopo do cálculo hoje.",
    });
  }

  if (!hr.hand_session_id) {
    return Response.json({ ok: true, eligible: true, computed: false, reason: "Mão não está vinculada a um torneio." });
  }

  const { data: session } = await supabase
    .from("hand_sessions")
    .select("tournament_id_ps")
    .eq("id", hr.hand_session_id)
    .single();
  if (!session?.tournament_id_ps) {
    return Response.json({ ok: true, eligible: true, computed: false, reason: "Torneio sem tournament_id_ps identificado." });
  }

  const { data: payout } = await supabase
    .from("tournament_payouts")
    .select("places")
    .eq("tournament_id_ps", session.tournament_id_ps)
    .maybeSingle();
  const places = (payout?.places ?? []) as { place: number; amount: number }[];
  if (places.length === 0) {
    return Response.json({
      ok: true,
      eligible: true,
      computed: false,
      reason: "Sem estrutura de premiação cadastrada pra esse torneio — cadastre na aba Torneios antes de calcular.",
    });
  }
  const payouts = [...places].sort((a, b) => a.place - b.place).map((p) => p.amount);

  const solverUrl = process.env.SOLVER_API_URL;
  const solverKey = process.env.SOLVER_API_KEY;
  if (!solverUrl || !solverKey) {
    return Response.json({
      ok: true,
      eligible: true,
      computed: false,
      reason: "Motor GTO ainda não configurado neste ambiente (SOLVER_API_URL/SOLVER_API_KEY ausentes).",
    });
  }

  let solverResult: SolverCevResponse;
  try {
    const res = await fetch(`${solverUrl}/hands/compute_cev`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": solverKey },
      body: JSON.stringify({
        hero_combo: confrontation.heroCombo,
        villain_combo: confrontation.villainCombo,
        hero_stack_before: confrontation.heroStackBefore,
        villain_stack_before: confrontation.villainStackBefore,
        other_stacks: confrontation.otherStacks,
        payouts,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json({ ok: false, error: `Solver retornou ${res.status}: ${detail}` }, { status: 502 });
    }
    solverResult = await res.json();
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Falha ao chamar o solver." }, { status: 502 });
  }

  const { data: saved, error: eSave } = await supabase
    .from("hand_ev_results")
    .upsert(
      {
        hand_review_id: hr.id,
        user_id: user.id,
        hero_equity_pct: solverResult.hero_equity_pct,
        chips_at_risk: solverResult.chips_at_risk,
        hero_expected_chip_delta: solverResult.hero_expected_chip_delta,
        hero_icm_baseline_dollars: solverResult.hero_icm_baseline_dollars,
        hero_expected_icm_dollars: solverResult.hero_expected_icm_dollars,
        hero_expected_icm_delta_dollars: solverResult.hero_expected_icm_delta_dollars,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "hand_review_id" }
    )
    .select()
    .single();
  if (eSave) return Response.json({ ok: false, error: eSave.message }, { status: 500 });

  return Response.json({ ok: true, eligible: true, computed: true, result: saved });
}
