import { createClient } from "@/lib/supabase/client";
import type { ParsedHand } from "@/lib/poker/hand-history-parser";

// RLS confirmada: hand_reviews usa policy "user_id = auth.uid()" pra
// ALL (select/insert/update/delete) — insert direto do client funciona
// sem RPC especial, igual os outros services do projeto.
//
// Colunas e CHECK constraints confirmados contra o schema real antes de
// escrever isso: source aceita 'manual' | 'agent' | 'import', status
// aceita 'pendente' | 'em_revisao' | 'concluida'. Usar qualquer outro
// valor quebraria o insert com violação de constraint.
export async function saveHandReview(parsed: ParsedHand, rawText: string): Promise<{ id: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const title = `${parsed.site === "pokerstars" ? "PokerStars" : parsed.site} #${parsed.handId}`;

  const { data, error } = await supabase
    .from("hand_reviews")
    .insert({
      user_id: user.id,
      title,
      hand_history: rawText,
      parsed_data: parsed,
      source: "manual",
      status: "pendente",
      poker_room: parsed.site,
      external_hand_id: parsed.handId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id };
}
