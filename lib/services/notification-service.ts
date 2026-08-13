import { createClient } from "@/lib/supabase/client";

export type NotificationCategory = "sistema" | "tarefas" | "team";

export const CATEGORIA_LABEL: Record<NotificationCategory, string> = {
  sistema: "Sistema",
  tarefas: "Tarefas",
  team: "Time",
};

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  kind: "info" | "success" | "warning" | string;
  // sistema | tarefas | team — usado nos filtros do historico.
  category: NotificationCategory;
  read: boolean;
  // Deep-link opcional (ex: "/revisor?shared=<reviewId>") — clicar na
  // notificacao navega pra ca, alem de marcar como lida.
  action_url: string | null;
  created_at: string;
}

// O sino mostra so o que ainda nao foi lido (onlyUnread) — ao ler, o
// item sai da lista e continua acessivel no historico (/notificacoes).
export async function fetchNotifications(
  limit = 20,
  opts: { onlyUnread?: boolean; category?: NotificationCategory | "todas" } = {}
): Promise<Notification[]> {
  const supabase = createClient();
  let query = supabase
    .from("notifications")
    .select("id, title, body, kind, category, read, action_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.onlyUnread) query = query.eq("read", false);
  if (opts.category && opts.category !== "todas") query = query.eq("category", opts.category);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Notification[];
}

export async function fetchUnreadCountByCategory(): Promise<Record<NotificationCategory, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("notifications").select("category").eq("read", false);
  if (error) throw error;
  const base: Record<NotificationCategory, number> = { sistema: 0, tarefas: 0, team: 0 };
  for (const r of data || []) {
    const c = (r as { category: NotificationCategory }).category;
    if (c in base) base[c] += 1;
  }
  return base;
}

export async function markAsRead(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

// Sem filtro de user_id explicito: RLS (auth.uid() = user_id) ja garante
// que so as notificacoes do proprio usuario sao afetadas.
export async function markAllAsRead() {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) throw error;
}

export async function fetchUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteNotification(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}
