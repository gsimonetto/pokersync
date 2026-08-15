import { createClient } from "@/lib/supabase/client";

// ============================================================
// Modo Team — Calendário (aulas/reuniões)
// Lista simples de próximos eventos (sem grade de mês/semana).
// Criação restrita a admin/coach (RLS já garante isso no banco).
// ============================================================

export type EventType = "aula" | "reuniao" | "outro";
export type ParticipantStatus = "pendente" | "confirmado" | "recusado";

export interface TeamEventParticipant {
  playerId: string;
  status: ParticipantStatus;
  attended: boolean | null;
}

export interface TeamEvent {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  eventType: EventType;
  locationUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  recurrenceGroupId: string | null;
  participants: TeamEventParticipant[];
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("NAO_AUTENTICADO");
  return data.user.id;
}

export async function fetchTeamEvents(opts?: { onlyUpcoming?: boolean; limit?: number }): Promise<TeamEvent[]> {
  const supabase = createClient();
  let query = supabase
    .from("team_events")
    .select("id, team_id, title, description, event_type, location_url, starts_at, ends_at, created_by, created_at, recurrence_group_id, team_event_participants(player_id, status, attended)")
    .order("starts_at", { ascending: true })
    .limit(opts?.limit ?? 100);

  if (opts?.onlyUpcoming !== false) {
    query = query.gte("starts_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    title: r.title,
    description: r.description,
    eventType: r.event_type as EventType,
    locationUrl: r.location_url,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    recurrenceGroupId: r.recurrence_group_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (r.team_event_participants ?? []).map((p: any) => ({
      playerId: p.player_id,
      status: p.status as ParticipantStatus,
      attended: p.attended as boolean | null,
    })),
  }));
}

export async function createTeamEvent(input: {
  title: string;
  description?: string;
  eventType: EventType;
  locationUrl?: string;
  startsAt: string;
  endsAt?: string;
  teamId: string;
  participantIds: string[];
  recurrenceGroupId?: string;
}): Promise<string> {
  const supabase = createClient();
  const uid = await getUserId();

  const { data: event, error } = await supabase
    .from("team_events")
    .insert({
      team_id: input.teamId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      event_type: input.eventType,
      location_url: input.locationUrl?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      created_by: uid,
      recurrence_group_id: input.recurrenceGroupId || null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.participantIds.length > 0) {
    const rows = input.participantIds.map((playerId) => ({ event_id: event.id, player_id: playerId }));
    const { error: pErr } = await supabase.from("team_event_participants").insert(rows);
    if (pErr) throw pErr;
  }

  return event.id as string;
}

// Cria uma serie semanal simples: repete a partir de startsAt/endsAt,
// de 7 em 7 dias, ate untilDate (inclusive). Cada ocorrencia e' um
// team_events proprio (RSVP, presenca e notificacao por ocorrencia),
// todas marcadas com o mesmo recurrenceGroupId pra permitir cancelar a
// serie inteira de uma vez depois.
const MAX_OCORRENCIAS = 26; // ~6 meses semanais, trava contra loop infinito

export async function createRecurringTeamEvents(input: {
  title: string;
  description?: string;
  eventType: EventType;
  locationUrl?: string;
  startsAt: string;
  endsAt?: string;
  teamId: string;
  participantIds: string[];
  untilDate: string; // yyyy-mm-dd
}): Promise<string[]> {
  const groupId = crypto.randomUUID();
  const ids: string[] = [];

  let cursorStart = new Date(input.startsAt);
  let cursorEnd = input.endsAt ? new Date(input.endsAt) : null;
  const until = new Date(`${input.untilDate}T23:59:59`);

  let n = 0;
  while (cursorStart <= until && n < MAX_OCORRENCIAS) {
    const id = await createTeamEvent({
      title: input.title,
      description: input.description,
      eventType: input.eventType,
      locationUrl: input.locationUrl,
      startsAt: cursorStart.toISOString(),
      endsAt: cursorEnd ? cursorEnd.toISOString() : undefined,
      teamId: input.teamId,
      participantIds: input.participantIds,
      recurrenceGroupId: groupId,
    });
    ids.push(id);
    cursorStart = new Date(cursorStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (cursorEnd) cursorEnd = new Date(cursorEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    n += 1;
  }

  return ids;
}

// Cancela avisando quem nao recusou (notify_system dentro da RPC).
export async function cancelTeamEvent(eventId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_team_event", { p_event_id: eventId });
  if (error) throw error;
}

export async function cancelEventSeries(recurrenceGroupId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_event_series", { p_group_id: recurrenceGroupId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function updateMyParticipantStatus(eventId: string, status: ParticipantStatus) {
  const supabase = createClient();
  const uid = await getUserId();
  const { error } = await supabase
    .from("team_event_participants")
    .update({ status })
    .eq("event_id", eventId)
    .eq("player_id", uid);
  if (error) throw error;
}

// Presenca real (diferente do RSVP): so admin/coach conseguem gravar —
// trigger no banco reverte qualquer tentativa vinda do proprio jogador.
// Fica oculto do jogador (nunca exibido em /time, so no painel do coach).
export async function markAttendance(eventId: string, playerId: string, attended: boolean | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_event_participants")
    .update({ attended })
    .eq("event_id", eventId)
    .eq("player_id", playerId);
  if (error) throw error;
}

export function traduzErroCalendario(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("NAO_AUTENTICADO")) return "Sua sessão expirou. Entre novamente.";
  if (msg.includes("row-level security")) return "Você não tem permissão para essa ação.";
  return "Não foi possível completar a ação. Tente novamente.";
}
