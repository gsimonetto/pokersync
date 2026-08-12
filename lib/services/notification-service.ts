import { createClient } from "@/lib/supabase/client";

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  kind: "info" | "success" | "warning" | string;
  read: boolean;
  // Deep-link opcional (ex: "/revisor?shared=<reviewId>") — clicar na
  // notificacao navega pra ca, alem de marcar como lida.
  action_url: string | null;
  created_at: string;
}

export async function fetchNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, kind, read, action_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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
