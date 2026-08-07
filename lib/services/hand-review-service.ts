import { createClient } from "@/lib/supabase/client";
import { parseSession, type ParsedHand } from "@/lib/poker/hand-parser";

const BUCKET = "hand-reviews";
const MAX_IMAGES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Deriva a extensao pelo mime type, nao pelo nome do arquivo — screenshots
// colados via Ctrl+V costumam nao ter nome/extensao (ex.: "image.png" generico
// ou ate sem extensao nenhuma), o que quebrava o upload silenciosamente antes.
function extensionFromFile(file: File): string {
  if (MIME_EXT[file.type]) return MIME_EXT[file.type];
  const fromName = file.name.split(".").pop();
  return fromName && fromName.length <= 4 ? fromName.toLowerCase() : "png";
}

export const STREETS = ["preflop", "flop", "turn", "river"] as const;
export type Street = (typeof STREETS)[number];

export const RATINGS = [
  { code: "acertei", label: "Acertei", color: "#10b981" },
  { code: "errei", label: "Errei", color: "#ef4444" },
  { code: "duvida", label: "Dúvida", color: "#f59e0b" },
  { code: "nao_se_aplica", label: "N/A", color: "#666" },
] as const;

export interface Tag {
  id: string;
  label: string;
  is_system: boolean;
  user_id: string | null;
}

export interface ReviewImage {
  id: string;
  storage_path: string;
  position: number;
}

export interface ReviewAnswer {
  id?: string;
  position?: number;
  question: string;
  answer: string;
}

export interface ReviewListItem {
  id: string;
  title: string | null;
  free_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  concluded_at: string | null;
  tags: Tag[];
  thumb: string | null;
}

export interface ReviewDetail extends ReviewListItem {
  user_id: string;
  hand_history: string | null;
  learning_note: string | null;
  drill_suggestion: string | null;
  images: ReviewImage[];
  answers: ReviewAnswer[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed_data: any | null;
  source: "manual" | "import" | "print";
  session_id: string | null;
}

export interface StreetEval {
  street: Street;
  self_rating: string;
  reason_code: string;
  notes: string;
}

export interface Reason {
  code: string;
  label: string;
  category: string;
}

// ============================================================
// Validações
// ============================================================
export function validateImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return "Formato inválido (use JPG, PNG ou WEBP).";
  if (file.size > MAX_SIZE) return "Arquivo excede 5MB.";
  return null;
}

// ============================================================
// Tags
// ============================================================
export async function fetchTags(): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_review_tags")
    .select("id, label, is_system, user_id")
    .order("is_system", { ascending: false })
    .order("label", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createUserTag(userId: string, label: string): Promise<Tag> {
  const clean = label.trim();
  if (!clean) throw new Error("Etiqueta vazia.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_review_tags")
    .insert({ user_id: userId, label: clean, is_system: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// Reviews CRUD
// ============================================================
export async function createReview(
  userId: string,
  payload: {
    title?: string;
    freeText?: string;
    handHistory?: string;
    tagIds?: string[];
    images?: File[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedData?: any | null;
    source?: "manual" | "import" | "print";
    sessionId?: string | null;
  }
) {
  const supabase = createClient();
  const { title, freeText, handHistory, tagIds, images, parsedData, source, sessionId } = payload;

  const { data: review, error: e1 } = await supabase
    .from("hand_reviews")
    .insert({
      user_id: userId,
      title: title?.trim() || null,
      free_text: freeText?.trim() || null,
      hand_history: handHistory?.trim() || null,
      parsed_data: parsedData ?? null,
      source: source ?? "manual",
      session_id: sessionId ?? null,
      status: "pendente",
    })
    .select()
    .single();
  if (e1) throw e1;

  if (tagIds?.length) {
    const links = tagIds.map((tag_id) => ({ review_id: review.id, tag_id, user_id: userId }));
    const { error: e2 } = await supabase.from("hand_review_tag_links").insert(links);
    if (e2) throw e2;
  }

  if (images?.length) {
    const limited = images.slice(0, MAX_IMAGES);
    for (let i = 0; i < limited.length; i++) {
      const file = limited[i];
      const ext = extensionFromFile(file);
      const path = `${userId}/${review.id}/${i + 1}.${ext}`;
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (eUp) throw eUp;

      const { error: eImg } = await supabase.from("hand_review_images").insert({
        review_id: review.id,
        user_id: userId,
        storage_path: path,
        position: i + 1,
      });
      if (eImg) throw eImg;
    }
  }

  return review;
}

export async function listReviews(
  userId: string,
  { status }: { status?: string } = {}
): Promise<ReviewListItem[]> {
  const supabase = createClient();
  let q = supabase
    .from("hand_reviews")
    .select(
      `
      id, title, free_text, status, created_at, updated_at, concluded_at,
      hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) ),
      hand_review_images ( id, storage_path, position )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    ...r,
    tags: (r.hand_review_tag_links ?? []).map((l: any) => l.hand_review_tags).filter(Boolean),
    thumb: r.hand_review_images?.[0]?.storage_path || null,
  }));
}

export async function getThumbUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function deleteReview(reviewId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("hand_reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

export async function getReview(reviewId: string): Promise<ReviewDetail> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_reviews")
    .select(
      `
      id, user_id, title, free_text, hand_history, status,
      learning_note, drill_suggestion, created_at, updated_at, concluded_at,
      hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) ),
      hand_review_images ( id, storage_path, position ),
      hand_review_answers ( id, position, question, answer )
    `
    )
    .eq("id", reviewId)
    .single();
  if (error) throw error;
  return {
    ...data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: (data.hand_review_tag_links ?? []).map((l: any) => l.hand_review_tags).filter(Boolean),
    images: (data.hand_review_images ?? []).sort((a: ReviewImage, b: ReviewImage) => a.position - b.position),
    answers: (data.hand_review_answers ?? []).sort(
      (a: ReviewAnswer, b: ReviewAnswer) => (a.position ?? 0) - (b.position ?? 0)
    ),
    thumb: data.hand_review_images?.[0]?.storage_path || null,
  };
}

// ============================================================
// Perguntas guiadas
// ============================================================
export function suggestGuidedQuestions(tags: Tag[], parsedHand?: { board?: string[]; heroPosition?: string | null } | null): string[] {
  const labels = tags.map((t) => t.label.toLowerCase());
  const base = [
    "Qual era o seu plano antes da ação do vilão?",
    "Qual parte do range do vilão você estava atacando/defendendo?",
    "Que informação você usou para tomar a decisão (sizings, timing, dinâmica)?",
  ];
  const extras: string[] = [];
  if (labels.some((l) => l.includes("icm") || l.includes("bubble") || l.includes("final table")))
    extras.push("Como o fator ICM afetou o range de call/shove nesse spot?");
  if (labels.some((l) => l.includes("3-bet") || l.includes("4-bet")))
    extras.push("O range de 3B/4B do vilão inclui blefes suficientes para justificar sua ação?");
  if (labels.some((l) => l.includes("pko"))) extras.push("Qual o valor da recompensa (bounty) na decisão de risco?");
  if (labels.some((l) => l.includes("hero call") || l.includes("bluffcatch")))
    extras.push("Que blockers você tem contra o range de value do vilão?");
  if (labels.some((l) => l.includes("cbet") || l.includes("turn barrel")))
    extras.push("A textura da board favorece mais o range do agressor ou do caller?");

  // Quando a mao veio de import parseado, ancora a primeira pergunta no board
  // e na posicao reais em vez de generica.
  if (parsedHand?.board?.length) {
    base[0] = `No board ${parsedHand.board.join(" ")}${
      parsedHand.heroPosition ? ` (você na ${parsedHand.heroPosition})` : ""
    }, qual era o seu plano antes da ação do vilão?`;
  }

  return [...base, ...extras].slice(0, 5);
}

export async function saveAnswers(reviewId: string, userId: string, qas: ReviewAnswer[]) {
  const supabase = createClient();
  const { error: eDel } = await supabase.from("hand_review_answers").delete().eq("review_id", reviewId);
  if (eDel) throw eDel;

  if (qas.length === 0) return;
  const rows = qas.map((q, i) => ({
    review_id: reviewId,
    user_id: userId,
    position: i + 1,
    question: q.question,
    answer: q.answer || null,
  }));
  const { error } = await supabase.from("hand_review_answers").insert(rows);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateReviewProgress(reviewId: string, patch: Record<string, any>) {
  const supabase = createClient();
  const { data, error } = await supabase.from("hand_reviews").update(patch).eq("id", reviewId).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// Auto-avaliação por street
// ============================================================
export async function fetchReasons(): Promise<Reason[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_eval_reasons")
    .select("code, label, category")
    .eq("active", true)
    .order("category")
    .order("label");
  if (error) throw error;
  return data ?? [];
}

export async function fetchStreetEvals(reviewId: string): Promise<StreetEval[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_review_street_evals")
    .select("street, self_rating, reason_code, notes")
    .eq("review_id", reviewId);
  if (error) throw error;
  return data ?? [];
}

export async function saveStreetEvals(reviewId: string, userId: string, evals: StreetEval[]) {
  const supabase = createClient();
  const { error: eDel } = await supabase.from("hand_review_street_evals").delete().eq("review_id", reviewId);
  if (eDel) throw eDel;

  const rows = evals
    .filter((e) => e.self_rating)
    .map((e) => ({
      review_id: reviewId,
      user_id: userId,
      street: e.street,
      self_rating: e.self_rating,
      reason_code: e.self_rating === "errei" ? e.reason_code || null : null,
      notes: e.notes || null,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("hand_review_street_evals").insert(rows);
  if (error) throw error;
}

// ============================================================
// Leaks e sugestões de drill
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUserLeaksWithDrills(days = 30, minOccurrences = 3): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("suggest_drills_for_user", {
    p_days: days,
    p_min_occurrences: minOccurrences,
    p_per_leak: 1,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchReviewSummary(days = 30) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("user_review_summary", { p_days: days });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ============================================================
// Eventos de XP / gamificação
// ============================================================
export async function registerReviewEvent(eventType: string, reviewId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("register_review_event", {
    p_event_type: eventType,
    p_review_id: reviewId,
  });
  if (error) {
    console.warn("[XP] Falha ao registrar evento:", error.message);
    return null;
  }
  return data?.[0] ?? null;
}

// ============================================================
// Import de hand history (PokerStars / GGPoker) — 1 mao ou sessao inteira
// ============================================================
export interface ImportBatch {
  id: string;
  site: string | null;
  raw_text: string;
  parsed_hands: ParsedHand[];
  imported_hand_ids: string[];
  created_at: string;
}

export async function createImportBatch(userId: string, rawText: string): Promise<ImportBatch> {
  const hands = parseSession(rawText);
  const site = hands[0]?.site ?? "desconhecido";
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_import_batches")
    .insert({
      user_id: userId,
      site,
      raw_text: rawText,
      parsed_hands: hands,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchImportBatch(batchId: string): Promise<ImportBatch> {
  const supabase = createClient();
  const { data, error } = await supabase.from("hand_import_batches").select("*").eq("id", batchId).single();
  if (error) throw error;
  return data;
}

// Cria hand_reviews de verdade a partir das maos selecionadas de um batch.
export async function importSelectedHands(
  batchId: string,
  userId: string,
  selectedIndexes: number[]
): Promise<string[]> {
  const batch = await fetchImportBatch(batchId);
  const supabase = createClient();
  const newIds: string[] = [];

  for (const idx of selectedIndexes) {
    const hand = batch.parsed_hands[idx];
    if (!hand) continue;
    const title = [hand.format, hand.stakes, hand.heroPosition].filter(Boolean).join(" · ") || "Mão importada";
    const { data, error } = await supabase
      .from("hand_reviews")
      .insert({
        user_id: userId,
        title,
        hand_history: hand.rawText,
        parsed_data: { kind: "parsed", ...hand },
        source: "import",
        status: "pendente",
      })
      .select()
      .single();
    if (error) throw error;
    newIds.push(data.id);
  }

  const { error: eUp } = await supabase
    .from("hand_import_batches")
    .update({ imported_hand_ids: [...batch.imported_hand_ids, ...newIds] })
    .eq("id", batchId);
  if (eUp) throw eUp;

  return newIds;
}

export async function deleteImportBatch(batchId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("hand_import_batches").delete().eq("id", batchId);
  if (error) throw error;
}

// ============================================================
// Ficha minima para maos so-print (sem hand history) — classificacao
// rapida em 3 toques que alimenta o mesmo pipeline de leaks, sem solver.
// ============================================================
export interface ManualTicket {
  format: string;
  street: Street;
  action: string;
}

export async function saveMinimalTicket(reviewId: string, ticket: ManualTicket) {
  const supabase = createClient();
  const { error } = await supabase
    .from("hand_reviews")
    .update({ parsed_data: { kind: "manual_ticket", ...ticket } })
    .eq("id", reviewId);
  if (error) throw error;
}

// ============================================================
// Vinculo com sessao de banca (opcional)
// ============================================================
export interface BankrollSessionOption {
  id: string;
  date: string;
  format: string | null;
  stake: string | null;
}

export async function fetchRecentBankrollSessions(limit = 5): Promise<BankrollSessionOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bankroll_sessions")
    .select("id, date, format, stake")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function linkReviewToSession(reviewId: string, sessionId: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("hand_reviews").update({ session_id: sessionId }).eq("id", reviewId);
  if (error) throw error;
}
