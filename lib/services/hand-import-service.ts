import { createClient } from "@/lib/supabase/client";
import { parseHand, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { listSessionsWithCount, type HandSessionWithCount } from "@/lib/services/hand-session-service";

export interface ImportableSession {
  id: string;
  label: string;
  kind: "tournament" | "cash";
  handCount: number;
}

export async function listSessionsForImport(): Promise<ImportableSession[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const sessions: HandSessionWithCount[] = await listSessionsWithCount(user.id);
  return sessions
    .filter((s) => s.hand_count > 0)
    .map((s) => ({ id: s.id, label: s.label, kind: s.kind, handCount: s.hand_count }));
}

export interface ImportableHand {
  id: string;
  title: string | null;
  createdAt: string;
  parsed: ParsedHand | null;
}

// Mesma logica de resolucao que o RevisorSessao usa: prioriza
// parsed_data ja pronto (fluxo de import em lote), so reparseia o texto
// bruto quando necessario (fluxo de colagem manual).
export async function listHandsForImport(sessionId: string): Promise<ImportableHand[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_reviews")
    .select("id, title, hand_history, parsed_data, created_at")
    .eq("hand_session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    let parsed: ParsedHand | null = null;
    if (row.parsed_data && (row.parsed_data as { kind?: string }).kind === "parsed") {
      parsed = row.parsed_data as unknown as ParsedHand;
    } else if (row.hand_history) {
      try {
        parsed = parseHand(row.hand_history);
      } catch (e) {
        if (!(e instanceof HandParseError)) console.warn("[listHandsForImport] parse falhou:", e);
        parsed = null;
      }
    }
    return { id: row.id, title: row.title, createdAt: row.created_at, parsed };
  });
}
