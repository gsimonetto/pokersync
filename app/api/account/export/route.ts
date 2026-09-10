// app/api/account/export/route.ts
//
// Portabilidade de dados (LGPD art. 18, V) -- exporta os principais
// dados pessoais do próprio usuário logado em JSON. Roda com o cliente
// normal (sessão do usuário, RLS aplicada) -- nunca com service role,
// então só pode devolver o que o próprio usuário já teria acesso a ver
// na aplicação de qualquer forma.
//
// Não é exaustivo linha por linha de todas as ~70 tabelas do produto —
// cobre as categorias que concentram o dado pessoal de verdade (perfil,
// banca, mãos revisadas, treino/XP, plano, time). Suficiente pro direito
// de portabilidade; não é o mesmo escopo da exclusão de conta (essa sim
// cobre tudo, ver app/api/account/delete/route.ts).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });

  const uid = user.id;
  const [
    profile,
    bankrollSessions,
    bankrollTransactions,
    bankrollGoals,
    handReviews,
    trainingSessions,
    xpEvents,
    achievements,
    userPlan,
    teamMemberships,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle().then((r) => r.data),
    supabase.from("bankroll_sessions").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("bankroll_transactions").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("bankroll_goals").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("hand_reviews").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("training_sessions").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("xp_events").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("user_achievements").select("*").eq("user_id", uid).then((r) => r.data ?? []),
    supabase.from("user_plans").select("*").eq("user_id", uid).maybeSingle().then((r) => r.data),
    supabase.from("team_members").select("*").eq("user_id", uid).then((r) => r.data ?? []),
  ]);

  const payload = {
    exportado_em: new Date().toISOString(),
    conta: { id: uid, email: user.email },
    perfil: profile,
    banca: { sessoes: bankrollSessions, transacoes: bankrollTransactions, metas: bankrollGoals },
    revisor_maos: handReviews,
    treino_sessoes: trainingSessions,
    xp_eventos: xpEvents,
    conquistas: achievements,
    plano: userPlan,
    times: teamMemberships,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="pokersync-meus-dados-${uid}.json"`,
    },
  });
}
