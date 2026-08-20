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
// Comentarios/atividade do card
// ============================================================

export interface CardComment {
  id: string;
  cardId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export async function fetchCardComments(cardId: string): Promise<CardComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_card_comments")
    .select("id, card_id, author_id, body, created_at")
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
    };
  });
}

export async function addCardComment(cardId: string, body: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_card_comments").insert({ card_id: cardId, body: body.trim() });
  if (error) throw error;
}

export function traduzErroFunil(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("SEM_PERMISSAO")) return "Você não tem permissão para essa ação.";
  if (msg.includes("SEM_TIME")) return "Você precisa estar em um time ativo.";
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
