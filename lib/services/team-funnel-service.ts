import { createClient } from "@/lib/supabase/client";

// ============================================================
// Modo Team — Kanban de evolução (funil de fases)
// 1 card por jogador, que se move entre fases. Metas (drills/reviews/
// stat) vêm da fase por padrão, com override manual por card. Todo o
// progresso é calculado em cima de tabelas que já existem (training_
// sessions, hand_reviews, player_stats, team_event_participants) —
// nada é duplicado aqui, só consultado via RPC no banco.
// ============================================================

export type StatMetric = "vpip" | "pfr" | "three_bet";

export const STAT_METRIC_LABEL: Record<StatMetric, string> = {
  vpip: "VPIP",
  pfr: "PFR",
  three_bet: "3-bet",
};

export interface FunnelPhase {
  id: string;
  teamId: string;
  name: string;
  sortOrder: number;
  color: string;
  defaultDrillsTarget: number;
  defaultReviewsTarget: number;
  defaultStatMetric: StatMetric | null;
  defaultStatTarget: number | null;
}

export interface PlayerCard {
  cardId: string;
  playerId: string;
  phaseId: string;
  phaseName: string;
  phaseColor: string;
  phaseSortOrder: number;
  drillsTarget: number;
  reviewsTarget: number;
  statMetric: StatMetric | null;
  statTarget: number | null;
  notes: string | null;
  movedAt: string;
  drillsDone: number;
  reviewsDone: number;
  statValue: number | null;
  eventosTotal: number;
  eventosPresente: number;
  eventosAusente: number;
}

export async function fetchFunnelPhases(teamId: string): Promise<FunnelPhase[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_funnel_phases")
    .select("id, team_id, name, sort_order, color, default_drills_target, default_reviews_target, default_stat_metric, default_stat_target")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    name: r.name,
    sortOrder: r.sort_order,
    color: r.color,
    defaultDrillsTarget: r.default_drills_target,
    defaultReviewsTarget: r.default_reviews_target,
    defaultStatMetric: r.default_stat_metric as StatMetric | null,
    defaultStatTarget: r.default_stat_target,
  }));
}

export async function seedDefaultPhases(teamId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("seed_default_funnel_phases", { p_team_id: teamId });
  if (error) throw error;
}

export async function fetchPlayerCards(): Promise<PlayerCard[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_funnel_cards");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    cardId: r.card_id,
    playerId: r.player_id,
    phaseId: r.phase_id,
    phaseName: r.phase_name,
    phaseColor: r.phase_color,
    phaseSortOrder: r.phase_sort_order,
    drillsTarget: r.drills_target,
    reviewsTarget: r.reviews_target,
    statMetric: r.stat_metric as StatMetric | null,
    statTarget: r.stat_target,
    notes: r.notes,
    movedAt: r.moved_at,
    drillsDone: r.drills_done,
    reviewsDone: r.reviews_done,
    statValue: r.stat_value,
    eventosTotal: r.eventos_total,
    eventosPresente: r.eventos_presente,
    eventosAusente: r.eventos_ausente,
  }));
}

export async function movePlayerCard(playerId: string, phaseId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("move_player_card", { p_player: playerId, p_phase_id: phaseId });
  if (error) throw error;
}

export async function updateCardDetails(
  playerId: string,
  patch: {
    notes?: string;
    drillsTargetOverride?: number | null;
    reviewsTargetOverride?: number | null;
    statMetricOverride?: StatMetric | null;
    statTargetOverride?: number | null;
  }
) {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.drillsTargetOverride !== undefined) row.drills_target_override = patch.drillsTargetOverride;
  if (patch.reviewsTargetOverride !== undefined) row.reviews_target_override = patch.reviewsTargetOverride;
  if (patch.statMetricOverride !== undefined) row.stat_metric_override = patch.statMetricOverride;
  if (patch.statTargetOverride !== undefined) row.stat_target_override = patch.statTargetOverride;

  const { error } = await supabase.from("team_player_cards").update(row).eq("player_id", playerId);
  if (error) throw error;
}

export async function createPhase(teamId: string, name: string, color: string, sortOrder: number) {
  const supabase = createClient();
  const { error } = await supabase.from("team_funnel_phases").insert({
    team_id: teamId,
    name: name.trim(),
    color,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function updatePhase(
  phaseId: string,
  patch: {
    name?: string;
    color?: string;
    defaultDrillsTarget?: number;
    defaultReviewsTarget?: number;
  }
) {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.defaultDrillsTarget !== undefined) row.default_drills_target = patch.defaultDrillsTarget;
  if (patch.defaultReviewsTarget !== undefined) row.default_reviews_target = patch.defaultReviewsTarget;
  const { error } = await supabase.from("team_funnel_phases").update(row).eq("id", phaseId);
  if (error) throw error;
}

// Troca a ordem de duas fases vizinhas (subir/descer na lista de
// configuracoes) — mais simples que drag-and-drop pra reordenar so' 3-6
// fases, e evita duplicar a logica de drag que o board ja tem.
export async function swapPhaseOrder(a: FunnelPhase, b: FunnelPhase) {
  const supabase = createClient();
  const { error: e1 } = await supabase.from("team_funnel_phases").update({ sort_order: b.sortOrder }).eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("team_funnel_phases").update({ sort_order: a.sortOrder }).eq("id", b.id);
  if (e2) throw e2;
}

// Bloqueia (FK) se ainda houver card nessa fase — erro traduzido cobre
// esse caso especifico em vez do generico.
export async function deletePhase(phaseId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_funnel_phases").delete().eq("id", phaseId);
  if (error) throw error;
}

// ============================================================
// Arquivar card (sair do funil ativo, sem perder o historico)
// ============================================================

export type ArchiveReason = "concluido" | "removido";

export const ARCHIVE_REASON_LABEL: Record<ArchiveReason, string> = {
  concluido: "Acompanhamento completo",
  removido: "Removido do time",
};

export interface ArchivedCard {
  cardId: string;
  playerId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  phaseName: string;
  phaseColor: string;
  archivedAt: string;
  archivedReason: ArchiveReason;
  notes: string | null;
}

export async function archiveCard(playerId: string, reason: ArchiveReason) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_player_cards")
    .update({ archived_at: new Date().toISOString(), archived_reason: reason })
    .eq("player_id", playerId);
  if (error) throw error;
}

export async function fetchArchivedCards(): Promise<ArchivedCard[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_archived_cards");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    cardId: r.card_id,
    playerId: r.player_id,
    nome: r.nome,
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
    phaseName: r.phase_name,
    phaseColor: r.phase_color,
    archivedAt: r.archived_at,
    archivedReason: r.archived_reason as ArchiveReason,
    notes: r.notes,
  }));
}

// "Pronto pra subir" considera só drills e reviews — a meta de stat fica
// como referência visual no card (subir ou descer o número é uma leitura
// do coach, não algo que dá pra automatizar sem contexto da situação).
export function progressoPronto(card: PlayerCard): boolean {
  return card.drillsDone >= card.drillsTarget && card.reviewsDone >= card.reviewsTarget;
}

// ============================================================
// Checklist do card (Trello-like) — itens marcaveis alem das metas
// automaticas de drills/reviews.
// ============================================================

export interface ChecklistItem {
  id: string;
  cardId: string;
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
}

export async function fetchChecklist(cardId: string): Promise<ChecklistItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_card_checklist_items")
    .select("id, card_id, text, done, sort_order, created_at")
    .eq("card_id", cardId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    cardId: r.card_id,
    text: r.text,
    done: r.done,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

export async function addChecklistItem(cardId: string, text: string, sortOrder: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_card_checklist_items")
    .insert({ card_id: cardId, text: text.trim(), sort_order: sortOrder });
  if (error) throw error;
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("team_card_checklist_items").update({ done }).eq("id", itemId);
  if (error) throw error;
}

// Progresso (feitos/total) por card, pra mostrar na face do card sem
// carregar a lista inteira de itens.
export async function fetchChecklistProgressForCards(cardIds: string[]): Promise<Map<string, { done: number; total: number }>> {
  const supabase = createClient();
  const m = new Map<string, { done: number; total: number }>();
  if (cardIds.length === 0) return m;
  const { data, error } = await supabase
    .from("team_card_checklist_items")
    .select("card_id, done")
    .in("card_id", cardIds);
  if (error) throw error;
  for (const r of data ?? []) {
    const cur = m.get(r.card_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (r.done) cur.done += 1;
    m.set(r.card_id, cur);
  }
  return m;
}

export async function deleteChecklistItem(itemId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_card_checklist_items").delete().eq("id", itemId);
  if (error) throw error;
}

// ============================================================
// Etiquetas no card — reusa team_labels (mesma tabela das etiquetas
// de jogador), so' a ligacao N:N com o card e' nova.
// ============================================================

export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

export async function fetchCardLabels(cardId: string): Promise<CardLabel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_card_label_links")
    .select("team_labels(id, name, color)")
    .eq("card_id", cardId);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((r) => r.team_labels)
    .filter(Boolean)
    .map((l) => ({ id: l.id, name: l.name, color: l.color }));
}

export async function fetchCardLabelsForCards(cardIds: string[]): Promise<Map<string, CardLabel[]>> {
  const supabase = createClient();
  const m = new Map<string, CardLabel[]>();
  if (cardIds.length === 0) return m;
  const { data, error } = await supabase
    .from("team_card_label_links")
    .select("card_id, team_labels(id, name, color)")
    .in("card_id", cardIds);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (!r.team_labels) continue;
    const arr = m.get(r.card_id) ?? [];
    arr.push({ id: r.team_labels.id, name: r.team_labels.name, color: r.team_labels.color });
    m.set(r.card_id, arr);
  }
  return m;
}

export async function setCardLabel(cardId: string, labelId: string, ativo: boolean) {
  const supabase = createClient();
  if (ativo) {
    const { error } = await supabase.from("team_card_label_links").insert({ card_id: cardId, label_id: labelId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("team_card_label_links")
      .delete()
      .eq("card_id", cardId)
      .eq("label_id", labelId);
    if (error) throw error;
  }
}

// ============================================================
// Interações do card (ex-"atividade") — historico de auditoria: uma
// vez postada, a interacao nao pode ser editada nem apagada por
// ninguem (nem policy de UPDATE, nem de DELETE no banco). Suporta um
// anexo por interacao (print/arquivo), guardado no bucket privado
// "team-card-attachments".
// ============================================================

export interface CardComment {
  id: string;
  cardId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** Path dentro do bucket privado -- ver getCardAttachmentUrl. */
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
}

const CARD_COMMENT_COLUMNS = "id, card_id, author_id, body, created_at, attachment_url, attachment_name, attachment_type";

export async function fetchCardComments(cardId: string): Promise<CardComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_card_comments")
    .select(CARD_COMMENT_COLUMNS)
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.author_id))];
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, nome, apelido")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  return rows.map((r) => {
    const p = (profileRows ?? []).find((row) => row.id === r.author_id);
    return {
      id: r.id,
      cardId: r.card_id,
      authorId: r.author_id,
      authorName: p?.apelido || p?.nome || "Alguém do time",
      body: r.body,
      createdAt: r.created_at,
      attachmentUrl: r.attachment_url,
      attachmentName: r.attachment_name,
      attachmentType: r.attachment_type,
    };
  });
}

const ATTACHMENT_MAX_SIZE = 8 * 1024 * 1024;

// Upload do print/arquivo pro bucket privado. Path comeca com o
// card_id (1o segmento) -- e' o que a policy de storage usa pra
// decidir quem pode ver/mandar (can_view_card/can_manage_card).
export async function uploadCardAttachment(cardId: string, file: File): Promise<{ path: string; type: string; name: string }> {
  if (file.size > ATTACHMENT_MAX_SIZE) throw new Error("Arquivo excede 8MB.");
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${cardId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("team-card-attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
  });
  if (error) throw error;
  return { path, type: file.type || "application/octet-stream", name: file.name };
}

export async function getCardAttachmentUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("team-card-attachments").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function addCardComment(
  cardId: string,
  body: string,
  attachment?: { path: string; type: string; name: string } | null
) {
  const supabase = createClient();
  const { error } = await supabase.from("team_card_comments").insert({
    card_id: cardId,
    body: body.trim(),
    attachment_url: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_type: attachment?.type ?? null,
  });
  if (error) throw error;
}

// ============================================================
// Linha do tempo de conquistas do jogador (missoes completadas no Hub
// de Evolucao) -- gate via RPC porque xp_events/user_missions so' sao
// legiveis pelo proprio dono (RLS), o coach/admin precisa do
// can_view_player() dentro da function pra ver o card de outra pessoa.
// ============================================================

export interface PlayerAchievement {
  missionId: string;
  title: string;
  description: string | null;
  xpReward: number;
  icon: string | null;
  completedAt: string;
}

// ============================================================
// Historico de fases do card (team_player_card_history) -- mantido
// automaticamente por move_player_card, so' leitura aqui. Completa o
// "todo o historico do que foi feito" junto com interacoes e
// conquistas, sem precisar duplicar nada.
// ============================================================

export interface CardPhaseHistoryEntry {
  phaseId: string;
  phaseName: string;
  phaseColor: string;
  enteredAt: string;
  leftAt: string | null;
}

export async function fetchCardPhaseHistory(playerId: string): Promise<CardPhaseHistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_player_card_history")
    .select("phase_id, entered_at, left_at, team_funnel_phases(name, color)")
    .eq("player_id", playerId)
    .order("entered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fase = r.team_funnel_phases as any;
    return {
      phaseId: r.phase_id,
      phaseName: fase?.name ?? "Fase removida",
      phaseColor: fase?.color ?? "#8b8b8b",
      enteredAt: r.entered_at,
      leftAt: r.left_at,
    };
  });
}

export async function fetchPlayerAchievements(playerId: string, limit = 30): Promise<PlayerAchievement[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("player_achievement_timeline", { p_player: playerId, p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    missionId: r.mission_id,
    title: r.title,
    description: r.description,
    xpReward: r.xp_reward,
    icon: r.icon,
    completedAt: r.completed_at,
  }));
}

export function traduzErroFunil(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("SEM_PERMISSAO")) return "Você não tem permissão para essa ação.";
  if (msg.includes("SEM_TIME")) return "Você precisa estar em um time ativo.";
  if (msg.includes("excede 8MB")) return msg;
  if (msg.includes("foreign key constraint") && msg.includes("phase_id")) {
    return "Essa fase ainda tem jogador dentro — mova todos pra outra fase antes de excluir.";
  }
  return "Não foi possível completar a ação. Tente novamente.";
}

// Refina o link de treino de 3-bet: em vez de deixar a posicao livre,
// acha onde o proprio jogador mais errou em spots de 3-bet no Revisor.
// Sem isso, cai de volta pra null (posicao livre) — nunca inventa dado.
export async function fetchWorstThreeBetPosition(): Promise<string | null> {
  const supabase = createClient();
  const { data: evals, error: e1 } = await supabase
    .from("hand_review_street_evals")
    .select("review_id")
    .eq("self_rating", "errei");
  if (e1 || !evals || evals.length === 0) return null;

  const reviewIds = [...new Set(evals.map((e) => e.review_id))];
  const { data: tags, error: e2 } = await supabase
    .from("hand_tags")
    .select("hero_position, three_bet")
    .in("hand_review_id", reviewIds)
    .eq("three_bet", true);
  if (e2 || !tags) return null;

  const contagem = new Map<string, number>();
  for (const t of tags) {
    if (!t.hero_position) continue;
    contagem.set(t.hero_position, (contagem.get(t.hero_position) ?? 0) + 1);
  }
  if (contagem.size === 0) return null;
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
