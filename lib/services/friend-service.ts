import { createClient } from "@/lib/supabase/client";

// ============================================================
// Amigos -- chat 1:1 fora do time (dois jogadores que nao dividem
// time, ou que so' querem conversar sem virar time). Tabela e RPC
// espelham team_messages/send_team_message, so' trocando a checagem
// de "mesmo time" por are_friends(). Ver lib/services/team-service.ts
// pra a versao "Time" da Central de Conversas.
// ============================================================

const ERROS: Record<string, string> = {
  NAO_AUTENTICADO: "Sessão expirada. Entre novamente.",
  PARAMETRO_INVALIDO: "Preencha o apelido e o código.",
  JOGADOR_NAO_ENCONTRADO: "Nenhum jogador encontrado com esse apelido e código.",
  NAO_PODE_ADICIONAR_VOCE_MESMO: "Você não pode adicionar a si mesmo.",
  JA_SAO_AMIGOS: "Vocês já são amigos.",
  PEDIDO_JA_ENVIADO: "Pedido já enviado — falta a outra pessoa aceitar.",
  MENSAGEM_VAZIA: "Escreva uma mensagem.",
  NAO_SAO_AMIGOS: "Vocês não são mais amigos.",
};

export function traduzErroAmigos(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? "";
  const code = Object.keys(ERROS).find((k) => raw.includes(k));
  return code ? ERROS[code] : "Não foi possível concluir a ação.";
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("NAO_AUTENTICADO");
  return data.user.id;
}

// "Online" e' calculado no client a partir de last_seen_at (heartbeat
// em lib/hooks/use-presence-heartbeat.ts) -- sem Supabase Realtime/
// Presence, mesmo padrao de polling ja usado no resto do chat.
const ONLINE_JANELA_MS = 90_000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_JANELA_MS;
}

interface PerfilBasico {
  id: string;
  nome: string;
  apelido: string;
  friend_code: string;
  avatar_id: number;
  avatar_url: string | null;
  last_seen_at: string | null;
}

async function fetchProfilesByIds(ids: string[]): Promise<PerfilBasico[]> {
  if (ids.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, apelido, friend_code, avatar_id, avatar_url, last_seen_at")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

// Le so' last_seen_at pra uma lista de ids (ex: os membros do time na
// Central de Conversas, que ja vem de outro lugar sem essa coluna).
export async function fetchLastSeenMap(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("id, last_seen_at").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id, r.last_seen_at]));
}

export interface Friend {
  userId: string;
  nome: string;
  apelido: string;
  friendTag: string;
  avatarId: number;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  friendshipId: string;
  since: string;
}

function paraFriend(perfil: PerfilBasico | undefined, otherId: string, friendshipId: string, since: string): Friend {
  return {
    userId: otherId,
    nome: perfil?.apelido || perfil?.nome || "Jogador",
    apelido: perfil?.apelido ?? "",
    friendTag: perfil ? `@${perfil.apelido || perfil.nome}#${perfil.friend_code}` : "@jogador",
    avatarId: perfil?.avatar_id ?? 1,
    avatarUrl: perfil?.avatar_url ?? null,
    lastSeenAt: perfil?.last_seen_at ?? null,
    friendshipId,
    since,
  };
}

export async function fetchFriends(): Promise<Friend[]> {
  const supabase = createClient();
  const me = await getUserId();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, recipient_id, created_at")
    .eq("status", "aceito")
    .or(`requester_id.eq.${me},recipient_id.eq.${me}`);
  if (error) throw error;
  const rows = data ?? [];
  const outrosIds = rows.map((r) => (r.requester_id === me ? r.recipient_id : r.requester_id));
  const perfis = await fetchProfilesByIds(outrosIds);
  return rows
    .map((r) => {
      const otherId = r.requester_id === me ? r.recipient_id : r.requester_id;
      return paraFriend(perfis.find((p) => p.id === otherId), otherId, r.id, r.created_at);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface FriendRequest {
  friendshipId: string;
  userId: string;
  nome: string;
  friendTag: string;
  avatarId: number;
  avatarUrl: string | null;
  createdAt: string;
}

export async function fetchIncomingFriendRequests(): Promise<FriendRequest[]> {
  const supabase = createClient();
  const me = await getUserId();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, created_at")
    .eq("recipient_id", me)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const perfis = await fetchProfilesByIds(rows.map((r) => r.requester_id));
  return rows.map((r) => {
    const p = perfis.find((x) => x.id === r.requester_id);
    return {
      friendshipId: r.id,
      userId: r.requester_id,
      nome: p?.apelido || p?.nome || "Jogador",
      friendTag: p ? `@${p.apelido || p.nome}#${p.friend_code}` : "@jogador",
      avatarId: p?.avatar_id ?? 1,
      avatarUrl: p?.avatar_url ?? null,
      createdAt: r.created_at,
    };
  });
}

// Manda pedido por @apelido#codigo. Se a outra pessoa ja tinha mandado
// um pedido pra mim, aceita na hora em vez de criar um segundo pedido
// cruzado (evita ficar "os dois pendentes" esperando o outro aceitar
// o que o outro tambem mandou).
export async function sendFriendRequest(apelido: string, codigo: string): Promise<"enviado" | "aceito"> {
  const supabase = createClient();
  const me = await getUserId();
  const apelidoLimpo = apelido.trim().replace(/^@/, "");
  const codigoLimpo = codigo.trim().replace(/^#/, "");
  if (!apelidoLimpo || !codigoLimpo) throw new Error("PARAMETRO_INVALIDO");

  const { data: alvo, error: eAlvo } = await supabase
    .from("profiles")
    .select("id")
    .ilike("apelido", apelidoLimpo)
    .eq("friend_code", codigoLimpo)
    .maybeSingle();
  if (eAlvo) throw eAlvo;
  if (!alvo) throw new Error("JOGADOR_NAO_ENCONTRADO");
  if (alvo.id === me) throw new Error("NAO_PODE_ADICIONAR_VOCE_MESMO");

  const { data: existente, error: eExistente } = await supabase
    .from("friendships")
    .select("id, requester_id, status")
    .or(`and(requester_id.eq.${me},recipient_id.eq.${alvo.id}),and(requester_id.eq.${alvo.id},recipient_id.eq.${me})`)
    .maybeSingle();
  if (eExistente) throw eExistente;

  if (existente) {
    if (existente.status === "aceito") throw new Error("JA_SAO_AMIGOS");
    if (existente.requester_id === alvo.id) {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "aceito", responded_at: new Date().toISOString() })
        .eq("id", existente.id);
      if (error) throw error;
      return "aceito";
    }
    throw new Error("PEDIDO_JA_ENVIADO");
  }

  const { error } = await supabase.from("friendships").insert({ requester_id: me, recipient_id: alvo.id });
  if (error) throw error;
  return "enviado";
}

export async function acceptFriendRequest(friendshipId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "aceito", responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
}

// Recusar pedido pendente e desfazer amizade aceita sao a mesma
// operacao (delete da linha) -- nao ha diferenca de estado a manter.
export async function removeFriendship(friendshipId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

// ============================================================
// Chat 1:1 com amigo -- mesmo shape de TeamMessage/TeamThreadSummary
// (lib/services/team-service.ts), so' que sobre friend_messages.
// ============================================================

export type FriendMessageKind = "texto" | "audio";

export interface FriendMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  kind: FriendMessageKind;
  audioUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  readAt: string | null;
}

const FRIEND_MESSAGE_COLUMNS = "id, sender_id, recipient_id, body, kind, audio_url, duration_seconds, created_at, read_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFriendMessage(r: any): FriendMessage {
  return {
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    kind: (r.kind as FriendMessageKind) ?? "texto",
    audioUrl: r.audio_url,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export async function fetchFriendThread(otherUserId: string, limit = 100): Promise<FriendMessage[]> {
  const supabase = createClient();
  const meId = await getUserId();
  const { data, error } = await supabase
    .from("friend_messages")
    .select(FRIEND_MESSAGE_COLUMNS)
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${meId})`
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapFriendMessage);
}

export async function sendFriendMessage(recipientId: string, body: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_friend_message", { p_recipient: recipientId, p_body: body });
  if (error) throw error;
  return data as string;
}

export async function uploadFriendAudio(blob: Blob): Promise<string> {
  const supabase = createClient();
  const meId = await getUserId();
  const path = `${meId}/${crypto.randomUUID()}.webm`;
  const { error } = await supabase.storage.from("friend-audio").upload(path, blob, {
    contentType: blob.type || "audio/webm",
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function sendFriendAudioMessage(recipientId: string, audioPath: string, durationSeconds: number): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_friend_message", {
    p_recipient: recipientId,
    p_body: "",
    p_kind: "audio",
    p_audio_url: audioPath,
    p_duration_seconds: Math.min(120, Math.max(1, Math.round(durationSeconds))),
  });
  if (error) throw error;
  return data as string;
}

export async function getFriendAudioUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("friend-audio").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function markFriendThreadRead(otherUserId: string) {
  const supabase = createClient();
  const meId = await getUserId();
  const { error } = await supabase
    .from("friend_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", meId)
    .is("read_at", null);
  if (error) throw error;
}

export interface FriendThreadSummary {
  otherUserId: string;
  lastMessage: string;
  lastKind: FriendMessageKind;
  lastAt: string;
  lastIsMine: boolean;
  unreadCount: number;
}

const THREADS_SCAN_LIMIT = 500;

export async function fetchFriendThreads(): Promise<FriendThreadSummary[]> {
  const supabase = createClient();
  const meId = await getUserId();
  const { data, error } = await supabase
    .from("friend_messages")
    .select("id, sender_id, recipient_id, body, kind, created_at, read_at")
    .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
    .order("created_at", { ascending: false })
    .limit(THREADS_SCAN_LIMIT);
  if (error) throw error;

  const byOther = new Map<string, FriendThreadSummary>();
  for (const m of data ?? []) {
    const otherId = m.sender_id === meId ? m.recipient_id : m.sender_id;
    const unread = m.recipient_id === meId && !m.read_at;
    const existing = byOther.get(otherId);
    if (existing) {
      if (unread) existing.unreadCount += 1;
      continue;
    }
    byOther.set(otherId, {
      otherUserId: otherId,
      lastMessage: m.kind === "audio" ? "🎤 Mensagem de voz" : m.body,
      lastKind: (m.kind as FriendMessageKind) ?? "texto",
      lastAt: m.created_at,
      lastIsMine: m.sender_id === meId,
      unreadCount: unread ? 1 : 0,
    });
  }
  return Array.from(byOther.values());
}

export async function fetchFriendUnreadCount(): Promise<number> {
  const supabase = createClient();
  const meId = await getUserId();
  const { count, error } = await supabase
    .from("friend_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", meId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}
