import { createClient } from "@/lib/supabase/client";
import type { Session, Transaction, TransactionType, Goal, GoalType, GoalPeriod, StudyLog, BrmThreshold, BrmFormat, Annotation } from "@/lib/bankroll/types";
import { DEFAULT_BRM_THRESHOLDS } from "@/lib/bankroll/calc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(r: any): Session {
  return {
    id: r.id,
    date: r.date,
    time: r.time || "",
    format: r.format,
    buyIn: Number(r.buy_in) || 0,
    reentries: Number(r.reentries) || 0,
    cashout: Number(r.cashout) || 0,
    stake: r.stake || "",
    hours: r.hours != null ? Number(r.hours) : undefined,
    venue: r.venue || "",
    notes: r.notes || "",
    mood: r.mood || undefined,
    tilt: r.tilt != null ? Number(r.tilt) : undefined,
    diaryNote: r.diary_note || undefined,
  };
}

function sessionToRow(s: Partial<Session>, userId: string) {
  return {
    user_id: userId,
    date: s.date,
    time: s.time || null,
    format: s.format,
    buy_in: Number(s.buyIn) || 0,
    reentries: Number(s.reentries) || 0,
    cashout: Number(s.cashout) || 0,
    stake: s.stake || null,
    hours: s.hours != null && String(s.hours) !== "" ? Number(s.hours) : null,
    venue: s.venue || null,
    notes: s.notes || null,
    mood: s.mood || null,
    tilt: s.tilt != null ? Number(s.tilt) : null,
    diary_note: s.diaryNote || null,
  };
}

async function getUserId() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NO_SESSION");
  return data.user.id;
}

export async function fetchSessions(): Promise<Session[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_sessions")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToSession);
}

export async function addSession(session: Omit<Session, "id">): Promise<Session> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_sessions")
    .insert(sessionToRow(session, userId))
    .select()
    .single();
  if (error) throw error;
  const profit = (Number(session.cashout) || 0) - (Number(session.buyIn) || 0);
  const xpBase = profit > 0 ? 30 : 20;
  try {
    await supabase.rpc("award_xp", {
      p_source: "bankroll",
      p_category: "bankroll",
      p_xp_base: xpBase,
      p_reference_id: data.id,
    });
  } catch (e) {
    console.error("Falha ao conceder XP da sessao de banca:", e);
  }
  return rowToSession(data);
}

export async function deleteSession(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("bankroll_sessions").delete().eq("id", id);
  if (error) throw error;
}

// Fechamento de sessao / diario pos-sessao: edita uma sessao ja salva com
// os campos de reflexao. Nao mexe em resultado/buy-in — so o diario.
export async function updateSessionDiary(
  id: string,
  diary: { mood?: string; tilt?: number; diaryNote?: string }
): Promise<Session> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_sessions")
    .update({
      mood: diary.mood || null,
      tilt: diary.tilt != null ? Number(diary.tilt) : null,
      diary_note: diary.diaryNote || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function fetchSettings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_settings")
    .select("bankroll, profile")
    .maybeSingle();
  if (error) throw error;
  return data
    ? { bankroll: Number(data.bankroll) || 0, profile: data.profile || "Padrao" }
    : { bankroll: 0, profile: "Padrao" };
}

export async function saveSettings({ bankroll, profile }: { bankroll: number; profile: string }) {
  const supabase = createClient();
  const userId = await getUserId();
  const { error } = await supabase.from("bankroll_settings").upsert(
    { user_id: userId, bankroll: Number(bankroll) || 0, profile, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// --- Transacoes (deposito/saque/caixinha) --------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTransaction(r: any): Transaction {
  return {
    id: r.id,
    date: r.date,
    type: r.type,
    amount: Number(r.amount) || 0,
    note: r.note || undefined,
    venue: r.venue || undefined,
  };
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_transactions")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTransaction);
}

export async function addTransaction(t: {
  date: string;
  type: TransactionType;
  amount: number;
  note?: string;
  venue?: string;
}): Promise<Transaction> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_transactions")
    .insert({
      user_id: userId,
      date: t.date,
      type: t.type,
      amount: Number(t.amount) || 0,
      note: t.note || null,
      venue: t.venue || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTransaction(data);
}

export async function deleteTransaction(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("bankroll_transactions").delete().eq("id", id);
  if (error) throw error;
}

// --- Metas (volume/estudo) ------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGoal(r: any): Goal {
  return { id: r.id, type: r.type, period: r.period, target: Number(r.target) || 0, unit: r.unit, active: !!r.active };
}

export async function fetchGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_goals")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToGoal);
}

export async function addGoal(g: { type: GoalType; period: GoalPeriod; target: number; unit: string }): Promise<Goal> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_goals")
    .insert({ user_id: userId, type: g.type, period: g.period, target: Number(g.target) || 0, unit: g.unit })
    .select()
    .single();
  if (error) throw error;
  return rowToGoal(data);
}

export async function deleteGoal(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("bankroll_goals").delete().eq("id", id);
  if (error) throw error;
}

// --- Log de estudo (alimenta meta de estudo) ------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStudyLog(r: any): StudyLog {
  return { id: r.id, date: r.date, minutes: Number(r.minutes) || 0, note: r.note || undefined };
}

export async function fetchStudyLogs(): Promise<StudyLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_study_logs")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToStudyLog);
}

export async function addStudyLog(l: { date: string; minutes: number; note?: string }): Promise<StudyLog> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_study_logs")
    .insert({ user_id: userId, date: l.date, minutes: Number(l.minutes) || 0, note: l.note || null })
    .select()
    .single();
  if (error) throw error;
  return rowToStudyLog(data);
}

// --- BRM thresholds (moveup/movedown por formato) -------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBrmThreshold(r: any): BrmThreshold {
  return { format: r.format, moveupBuyins: Number(r.moveup_buyins) || 0, movedownBuyins: Number(r.movedown_buyins) || 0 };
}

// Se o jogador nunca editou, devolve os padroes (sem gravar nada ainda —
// so grava quando ele efetivamente customiza um formato).
export async function fetchBrmThresholds(): Promise<BrmThreshold[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("bankroll_brm_thresholds").select("*");
  if (error) throw error;
  const saved = (data || []).map(rowToBrmThreshold);
  return DEFAULT_BRM_THRESHOLDS.map((d) => saved.find((s) => s.format === d.format) || d);
}

export async function saveBrmThreshold(t: { format: BrmFormat; moveupBuyins: number; movedownBuyins: number }): Promise<BrmThreshold> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_brm_thresholds")
    .upsert(
      {
        user_id: userId,
        format: t.format,
        moveup_buyins: Number(t.moveupBuyins) || 0,
        movedown_buyins: Number(t.movedownBuyins) || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,format" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToBrmThreshold(data);
}

// --- Anotacoes no grafico --------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAnnotation(r: any): Annotation {
  return { id: r.id, date: r.date, note: r.note };
}

export async function fetchAnnotations(): Promise<Annotation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_annotations")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToAnnotation);
}

export async function addAnnotation(a: { date: string; note: string }): Promise<Annotation> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_annotations")
    .insert({ user_id: userId, date: a.date, note: a.note })
    .select()
    .single();
  if (error) throw error;
  return rowToAnnotation(data);
}

export async function deleteAnnotation(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("bankroll_annotations").delete().eq("id", id);
  if (error) throw error;
}

// --- Alerta de BRM via notificacao ----------------------------------------
// Dispara uma notificacao (Hub de Evolucao ja tem o sino/lista) quando o
// status de moveup/movedown muda pra algo accionavel. Passa pela RPC
// notify_user (security definer) em vez de insert direto — a tabela
// notifications nao tinha policy de INSERT nenhuma antes disso, entao o
// insert direto falhava silenciosamente (bug corrigido aqui). Dedupe
// simples: nao duplica se ja existe notificacao com o mesmo titulo
// criada nas ultimas 20h (evita spam a cada reload da tela).
export async function notifyBrmAlert(title: string, body: string) {
  const supabase = createClient();
  const userId = await getUserId();
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: checkErr } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .gte("created_at", since)
    .limit(1);
  if (checkErr) throw checkErr;
  if (existing && existing.length > 0) return;
  const { error } = await supabase.rpc("notify_user", {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_kind: "warning",
    p_action_url: "/banca",
  });
  if (error) throw error;
}
