import { createClient } from "@/lib/supabase/client";
import type { Verdict } from "@/lib/poker/gto-verdict";

export interface DrillAnswerInput {
  rangeId: string | null;
  rangeName: string;
  handLabel: string;
  combos: number;
  verdict: Verdict;
  hit: boolean;
}

// Log append-only — nao precisamos de update/delete, cada resposta do
// drill vira uma linha imutavel. Falha de log nao deve travar o drill
// (o jogador continua treinando mesmo se o journal nao gravar), por
// isso quem chama trata erro como "melhor esforco".
export async function logDrillAnswer(input: DrillAnswerInput): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("range_drill_answers").insert({
    user_id: user.id,
    range_id: input.rangeId,
    range_name: input.rangeName,
    hand_label: input.handLabel,
    combos: input.combos,
    verdict: input.verdict,
    hit: input.hit,
  });
}

interface RawAnswerRow {
  range_name: string;
  combos: number;
  hit: boolean;
  answered_at: string;
}

export interface RangeToday {
  rangeName: string;
  hands: number;
  hits: number;
}

export interface JournalData {
  today: {
    ranges: RangeToday[];
    hands: number;
    hits: number;
    accuracyPct: number;
  };
  last30d: {
    studySeconds: number;
    combos: number;
    hands: number;
    hits: number;
    accuracyPct: number;
  };
  streakDays: number;
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Estima tempo de estudo agrupando respostas em "sessoes": um gap maior
// que 3 minutos entre duas respostas seguidas fecha a sessao anterior.
// Sessao de resposta unica ganha um piso de 15s (tempo de ler a mao e
// decidir) pra nao contar como 0 — e' uma estimativa, nao um cronometro
// de verdade (o produto nao tem tela de drill com timer explicito).
function estimateStudySeconds(rows: RawAnswerRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = [...rows].sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime());
  const GAP_MS = 3 * 60 * 1000;
  const FLOOR_S = 15;

  let total = 0;
  let sessionStart = new Date(sorted[0].answered_at).getTime();
  let sessionEnd = sessionStart;

  for (let i = 1; i < sorted.length; i++) {
    const t = new Date(sorted[i].answered_at).getTime();
    if (t - sessionEnd > GAP_MS) {
      total += Math.max((sessionEnd - sessionStart) / 1000, FLOOR_S);
      sessionStart = t;
    }
    sessionEnd = t;
  }
  total += Math.max((sessionEnd - sessionStart) / 1000, FLOOR_S);
  return Math.round(total);
}

function computeStreak(rows: RawAnswerRow[]): number {
  const days = new Set(rows.map((r) => localDateKey(r.answered_at)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function fetchJournalData(): Promise<JournalData> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("range_drill_answers")
    .select("range_name, combos, hit, answered_at")
    .gte("answered_at", since.toISOString())
    .order("answered_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as RawAnswerRow[];

  const todayKey = localDateKey(new Date().toISOString());
  const todayRows = rows.filter((r) => localDateKey(r.answered_at) === todayKey);

  const byRangeToday = new Map<string, RangeToday>();
  for (const r of todayRows) {
    const entry = byRangeToday.get(r.range_name) ?? { rangeName: r.range_name, hands: 0, hits: 0 };
    entry.hands += 1;
    if (r.hit) entry.hits += 1;
    byRangeToday.set(r.range_name, entry);
  }

  const todayHits = todayRows.filter((r) => r.hit).length;
  const last30Hits = rows.filter((r) => r.hit).length;
  const last30Combos = rows.reduce((s, r) => s + r.combos, 0);

  return {
    today: {
      ranges: Array.from(byRangeToday.values()),
      hands: todayRows.length,
      hits: todayHits,
      accuracyPct: todayRows.length > 0 ? Math.round((todayHits / todayRows.length) * 100) : 0,
    },
    last30d: {
      studySeconds: estimateStudySeconds(rows),
      combos: last30Combos,
      hands: rows.length,
      hits: last30Hits,
      accuracyPct: rows.length > 0 ? Math.round((last30Hits / rows.length) * 100) : 0,
    },
    streakDays: computeStreak(rows),
  };
}
