import type { SupabaseClient } from "@supabase/supabase-js";
import { contarRebuys, type MaoParaRebuy } from "@/lib/poker/rebuy-detector";

// Recalcula hand_sessions.reentries a partir de TODAS as mãos já salvas de
// cada torneio (ver rebuy-detector.ts) e marca reentries_checked_at. Recebe
// o client de quem chama: roda tanto no navegador (Revisor/Banca/
// Performance) quanto na rota do Radar (client autenticado pelo token do
// agente). Se o número mudou, atualiza também a sessão da Gestão de Banca
// importada desse torneio, pra o custo lá acompanhar.
export async function recalcularRebuys(supabase: SupabaseClient, sessionIds: string[]): Promise<Map<string, number>> {
  const resultado = new Map<string, number>();
  const ids = [...new Set(sessionIds)];
  if (ids.length === 0) return resultado;

  const { data, error } = await supabase
    .from("hand_reviews")
    .select(
      "hand_session_id, heroName:parsed_data->heroName, handId:parsed_data->handId, date:parsed_data->date, " +
        "seats:parsed_data->seats, streets:parsed_data->streets, winnings:parsed_data->winnings, winner:parsed_data->winner"
    )
    .in("hand_session_id", ids);
  if (error) throw error;

  const maosPorSessao = new Map<string, MaoParaRebuy[]>();
  for (const row of (data ?? []) as unknown as (MaoParaRebuy & { hand_session_id: string })[]) {
    const lista = maosPorSessao.get(row.hand_session_id) ?? [];
    lista.push(row);
    maosPorSessao.set(row.hand_session_id, lista);
  }

  const agora = new Date().toISOString();
  for (const id of ids) {
    const rebuys = contarRebuys(maosPorSessao.get(id) ?? []);
    resultado.set(id, rebuys);
    const { data: antes } = await supabase.from("hand_sessions").select("reentries").eq("id", id).maybeSingle();
    const { error: eUp } = await supabase.from("hand_sessions").update({ reentries: rebuys, reentries_checked_at: agora }).eq("id", id);
    if (eUp) throw eUp;
    if (antes && antes.reentries !== rebuys) {
      await supabase.from("bankroll_sessions").update({ reentries: rebuys }).eq("imported_hand_session_id", id);
    }
  }
  return resultado;
}

// Torneios que ainda nunca passaram pelo detector (importados antes dele
// existir) -- calcula uma vez e devolve as sessões já com o número certo.
export async function garantirRebuysCalculados<
  T extends { id: string; kind: string; reentries?: number | null; reentries_checked_at?: string | null }
>(supabase: SupabaseClient, sessoes: T[]): Promise<T[]> {
  const pendentes = sessoes.filter((s) => s.kind === "tournament" && !s.reentries_checked_at).map((s) => s.id);
  if (pendentes.length === 0) return sessoes;
  try {
    const calculados = await recalcularRebuys(supabase, pendentes);
    const agora = new Date().toISOString();
    return sessoes.map((s) => (calculados.has(s.id) ? { ...s, reentries: calculados.get(s.id)!, reentries_checked_at: agora } : s));
  } catch (e) {
    console.error("Falha ao calcular rebuys dos torneios:", e);
    return sessoes;
  }
}
