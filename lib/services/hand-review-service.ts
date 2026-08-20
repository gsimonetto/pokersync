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

// Marcadores totalmente editaveis DEPOIS da mao ja salva (pedido
// explicito) — antes so dava pra escolher tag na criacao (Mãos avulsas).
// Estrategia replace-all: apaga os vinculos atuais e recria com o set
// novo — mais simples e seguro que diff incremental pra uma lista curta
// de tags, e evita ficar com vinculo orfao se o id mudar de dono no meio.
export async function updateReviewTags(reviewId: string, userId: string, tagIds: string[]) {
  const supabase = createClient();
  const { error: delErr } = await supabase.from("hand_review_tag_links").delete().eq("review_id", reviewId);
  if (delErr) throw delErr;
  if (tagIds.length === 0) return;
  const links = tagIds.map((tag_id) => ({ review_id: reviewId, tag_id, user_id: userId }));
  const { error: insErr } = await supabase.from("hand_review_tag_links").insert(links);
  if (insErr) throw insErr;
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
      parsed_data, source, session_id,
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

export interface ReviewSummary {
  totalReviews: number;
  totalConcluded: number;
  totalErrors: number;
  totalCorrect: number;
  totalDoubts: number;
  worstStreet: string | null;
  worstCategory: string | null;
}

// RPC ja existia pronta no banco (contagens + pior rua/categoria dos
// ultimos N dias) mas nunca era chamada -- o Revisor era so uma lista de
// maos, sem nenhum numero consolidado (diferente da Banca, que sempre
// teve Resultado/ROI/ITM no topo).
export async function fetchReviewSummary(days = 30): Promise<ReviewSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("user_review_summary", { p_days: days });
  if (error) throw error;
  const r = data?.[0];
  if (!r) return null;
  return {
    totalReviews: r.total_reviews ?? 0,
    totalConcluded: r.total_concluded ?? 0,
    totalErrors: r.total_errors ?? 0,
    totalCorrect: r.total_correct ?? 0,
    totalDoubts: r.total_doubts ?? 0,
    worstStreet: r.worst_street ?? null,
    worstCategory: r.worst_category ?? null,
  };
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

// Sessao ja vinculada pode nao estar entre as ultimas N (o vinculo e'
// antigo, ou o jogador ja registrou varias sessoes desde entao) — sem
// isso a tela de detalhe nao tinha como mostrar qual sessao a mao ja
// esta vinculada, so' as sugestoes recentes pra escolher uma nova.
export async function fetchBankrollSessionById(id: string): Promise<BankrollSessionOption | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("bankroll_sessions").select("id, date, format, stake").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function linkReviewToSession(reviewId: string, sessionId: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("hand_reviews").update({ session_id: sessionId }).eq("id", reviewId);
  if (error) throw error;
}

// Quantas maos ja foram revisadas por sessao de banca -- fecha o ciclo
// no sentido banca->revisor (antes so' existia revisor->banca, o
// vinculo nunca aparecia de volta na tela de banca).
export async function fetchReviewCountsBySessionIds(sessionIds: string[]): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.from("hand_reviews").select("session_id").in("session_id", sessionIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const sid = (row as { session_id: string | null }).session_id;
    if (sid) counts[sid] = (counts[sid] || 0) + 1;
  }
  return counts;
}

// ============================================================
// Compartilhar mao com o coach do time
// ============================================================
// Base minima de Times (role coach/jogador em team_members) — mao
// continua pertencendo ao jogador, o coach so ganha leitura (RLS
// aditiva: hr_select_shared e as demais *_select_shared). O coach abre
// no MESMO RevisorDetalhe (mao, tags e perguntas guiadas), nao uma tela
// separada — e' o pedido explicito de "abrir o replayer do mesmo
// formato".
export interface TeamCoach {
  userId: string;
  name: string;
  role: "admin" | "coach";
}

export async function fetchTeamCoaches(userId: string): Promise<TeamCoach[]> {
  const supabase = createClient();
  const { data: me, error: teamErr } = await supabase
    .from("team_members")
    .select("team_id, coach_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (teamErr) throw teamErr;
  if (!me) return [];

  // Quem recebe mao e' quem ATUA como coach (is_coach). Admin puro nao
  // entra aqui — revisar mao nao e' funcao dele; so aparece se acumular
  // a funcao de coach.
  // A mao vai APENAS pro coach responsavel pelo jogador. Sem coach
  // atribuido, ninguem recebe — mesma regra da RLS (hrs_insert).
  if (!me.coach_id) return [];

  const { data: coachRows, error } = await supabase
    .from("team_members")
    .select("user_id, role")
    .eq("team_id", me.team_id)
    .eq("is_coach", true)
    .eq("user_id", me.coach_id);
  if (error) throw error;

  const rows = (coachRows ?? []).filter(
    (r, idx, arr) => arr.findIndex((x) => x.user_id === r.user_id) === idx
  );
  if (rows.length === 0) return [];

  // Sem FK entre team_members e profiles — busca separada em vez de
  // embed do PostgREST, junta no client.
  const { data: profileRows, error: profErr } = await supabase
    .from("profiles")
    .select("id, nome, apelido")
    .in(
      "id",
      rows.map((r) => r.user_id)
    );
  if (profErr) throw profErr;

  return rows.map((r) => {
    const p = (profileRows ?? []).find((row) => row.id === r.user_id);
    return {
      userId: r.user_id,
      name: p?.apelido || p?.nome || "Coach",
      role: r.role as "admin" | "coach",
    };
  });
}

export async function shareReviewWithCoach(reviewId: string, coachUserId: string, reviewTitle: string) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const sharedBy = userData.user?.id;
  if (!sharedBy) throw new Error("NO_SESSION");

  const { error: shareErr } = await supabase
    .from("hand_review_shares")
    .insert({ review_id: reviewId, shared_by: sharedBy, shared_with: coachUserId });
  if (shareErr) throw shareErr;

  // notify_user (RPC security definer) — insert direto em notifications
  // pra outro usuario nao passaria pela RLS de qualquer forma.
  const { error: notifyErr } = await supabase.rpc("notify_user", {
    p_user_id: coachUserId,
    p_title: "Mão pra revisar",
    p_body: `${reviewTitle || "Uma mão"} foi compartilhada com você pra revisão.`,
    p_kind: "info",
    p_action_url: `/revisor?shared=${reviewId}`,
    p_category: "team",
  });
  if (notifyErr) throw notifyErr;
}

// ============================================================
// Conversa da mao compartilhada (jogador <-> coach)
// ============================================================
// Uma mao compartilhada vira uma linha em hand_review_shares. Os
// comentarios ficam em hand_review_share_comments, visiveis so pelos
// dois participantes daquele compartilhamento (RLS). Se a mesma mao foi
// enviada pra mais de um coach, cada um tem a propria conversa — o
// jogador ve todas.

export interface ShareThread {
  shareId: string;
  counterpartId: string;
  counterpartName: string;
  iAmCoach: boolean;
  createdAt: string;
}

export interface ShareComment {
  id: string;
  shareId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
}

export async function fetchShareThreads(reviewId: string): Promise<ShareThread[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const meId = userData.user?.id;
  if (!meId) return [];

  const { data, error } = await supabase
    .from("hand_review_shares")
    .select("id, shared_by, shared_with, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.shared_by === meId ? r.shared_with : r.shared_by));
  const { data: profileRows } = await supabase.from("profiles").select("id, nome, apelido").in("id", otherIds);

  return rows.map((r) => {
    const otherId = r.shared_by === meId ? r.shared_with : r.shared_by;
    const p = (profileRows ?? []).find((row) => row.id === otherId);
    return {
      shareId: r.id,
      counterpartId: otherId,
      counterpartName: p?.apelido || p?.nome || "Membro do time",
      iAmCoach: r.shared_with === meId,
      createdAt: r.created_at,
    };
  });
}

// Marca como visto quando o coach abre a mao — usado depois no painel
// do coach pra separar o que ja foi analisado do que esta na fila.
export async function markShareViewed(shareId: string) {
  const supabase = createClient();
  await supabase
    .from("hand_review_shares")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", shareId)
    .is("viewed_at", null);
}

export async function fetchShareComments(shareId: string): Promise<ShareComment[]> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const meId = userData.user?.id ?? "";

  const { data, error } = await supabase
    .from("hand_review_share_comments")
    .select("id, share_id, author_id, body, created_at")
    .eq("share_id", shareId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.author_id))];
  const { data: profileRows } = await supabase.from("profiles").select("id, nome, apelido").in("id", ids);

  return rows.map((r) => {
    const p = (profileRows ?? []).find((row) => row.id === r.author_id);
    return {
      id: r.id,
      shareId: r.share_id,
      authorId: r.author_id,
      authorName: p?.apelido || p?.nome || "Membro do time",
      body: r.body,
      createdAt: r.created_at,
      isMine: r.author_id === meId,
    };
  });
}

export async function addShareComment(
  thread: ShareThread,
  body: string,
  reviewId: string,
  reviewTitle: string
): Promise<ShareComment> {
  const text = body.trim();
  if (!text) throw new Error("COMENTARIO_VAZIO");

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const meId = userData.user?.id;
  if (!meId) throw new Error("NO_SESSION");

  const { data, error } = await supabase
    .from("hand_review_share_comments")
    .insert({ share_id: thread.shareId, author_id: meId, body: text })
    .select("id, share_id, author_id, body, created_at")
    .single();
  if (error) throw error;

  // Avisa o outro lado — mesmo deep-link da mao compartilhada.
  await supabase.rpc("notify_user", {
    p_user_id: thread.counterpartId,
    p_title: thread.iAmCoach ? "Comentário do coach" : "Resposta do jogador",
    p_body: `Nova mensagem em "${reviewTitle || "uma mão"}".`,
    p_kind: "info",
    p_action_url: `/revisor?shared=${reviewId}`,
    p_category: "team",
  });

  return {
    id: data.id,
    shareId: data.share_id,
    authorId: data.author_id,
    authorName: "Você",
    body: data.body,
    createdAt: data.created_at,
    isMine: true,
  };
}
