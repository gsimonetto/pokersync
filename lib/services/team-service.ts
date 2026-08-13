import { createClient } from "@/lib/supabase/client";

// ============================================================
// Modo Team — base (time, papeis, convites por token)
// ============================================================
// Regras que vivem no banco (nao replicar aqui como validacao final,
// so como UX antecipada):
//   - criar time exige user_plans.plan em ('team','master');
//   - 1 jogador = 1 time (PK de team_members em user_id);
//   - convite e' um token opaco gerado no servidor, com validade e
//     limite de usos — serve pra WhatsApp/comunidade, nao so e-mail;
//   - papel do time (admin/coach/player) nao se mistura com o acesso
//     total de plataforma (esse continua sendo por e-mail).

export type TeamRole = "admin" | "coach" | "player";

export interface Team {
  id: string;
  name: string;
  accent: string;
  ownerId: string | null;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  isCoach: boolean;
  coachId: string | null;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
  isMe: boolean;
}

export interface TeamInvite {
  id: string;
  token: string;
  role: TeamRole;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  revokedAt: string | null;
}

export interface MyTeam {
  team: Team;
  role: TeamRole;
  members: TeamMember[];
}

export interface InviteInfo {
  teamName: string | null;
  teamAccent: string | null;
  role: TeamRole | null;
  valid: boolean;
  reason: string | null;
}

// Erros das funcoes do banco chegam como codigo seco (ex.:
// "PLANO_TEAM_NECESSARIO"). Traduz pra mensagem de tela.
const ERROS: Record<string, string> = {
  NAO_AUTENTICADO: "Sessão expirada. Entre novamente.",
  PLANO_TEAM_NECESSARIO: "Criar um time exige o plano Team.",
  JA_PERTENCE_A_UM_TIME: "Você já faz parte de um time.",
  NOME_OBRIGATORIO: "Dê um nome ao time.",
  PAPEL_INVALIDO: "Papel inválido.",
  SEM_TIME: "Você ainda não faz parte de um time.",
  SEM_PERMISSAO: "Você não tem permissão para isso.",
  PARAMETRO_INVALIDO: "Validade ou limite de usos inválido.",
  CONVITE_INEXISTENTE: "Convite não encontrado.",
  CONVITE_CANCELADO: "Este convite foi cancelado.",
  CONVITE_EXPIRADO: "Este convite expirou.",
  CONVITE_ESGOTADO: "Este convite já atingiu o limite de usos.",
};

export function traduzErroTime(err: unknown): string {
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

// ============================================================
// Leitura
// ============================================================

export async function fetchMyPlan(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.from("user_plans").select("plan").maybeSingle();
  return data?.plan ?? "free";
}

export function planoPermiteCriarTime(plan: string): boolean {
  return plan === "team" || plan === "master";
}

export async function fetchMyTeam(): Promise<MyTeam | null> {
  const supabase = createClient();
  const meId = await getUserId();

  const { data: mine, error: eMine } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", meId)
    .maybeSingle();
  if (eMine) throw eMine;
  if (!mine) return null;

  const [{ data: teamRow, error: eTeam }, { data: memberRows, error: eMembers }] = await Promise.all([
    supabase.from("teams").select("id, name, accent, owner_id").eq("id", mine.team_id).maybeSingle(),
    supabase
      .from("team_members")
      .select("user_id, role, is_coach, coach_id, joined_at")
      .eq("team_id", mine.team_id),
  ]);
  if (eTeam) throw eTeam;
  if (eMembers) throw eMembers;
  if (!teamRow) return null;

  // Sem FK entre team_members e profiles — busca separada e junta no
  // client (mesmo padrao ja usado em hand-review-service).
  const ids = (memberRows ?? []).map((m) => m.user_id);
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, nome, apelido, avatar_id, avatar_url")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const ordem: Record<TeamRole, number> = { admin: 0, coach: 1, player: 2 };
  const members: TeamMember[] = (memberRows ?? [])
    .map((m) => {
      const p = (profileRows ?? []).find((row) => row.id === m.user_id);
      return {
        userId: m.user_id,
        role: m.role as TeamRole,
        isCoach: Boolean(m.is_coach),
        coachId: m.coach_id ?? null,
        name: p?.apelido || p?.nome || "Jogador",
        avatarId: p?.avatar_id ?? 1,
        avatarUrl: p?.avatar_url ?? null,
        joinedAt: m.joined_at,
        isOwner: teamRow.owner_id === m.user_id,
        isMe: meId === m.user_id,
      };
    })
    .sort((a, b) => ordem[a.role] - ordem[b.role] || a.name.localeCompare(b.name));

  return {
    team: { id: teamRow.id, name: teamRow.name, accent: teamRow.accent, ownerId: teamRow.owner_id },
    role: mine.role as TeamRole,
    members,
  };
}

export async function fetchInvites(teamId: string): Promise<TeamInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_invites")
    .select("id, token, role, label, created_at, expires_at, max_uses, uses, revoked_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    token: r.token,
    role: r.role as TeamRole,
    label: r.label,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    maxUses: r.max_uses,
    uses: r.uses,
    revokedAt: r.revoked_at,
  }));
}

export function inviteAtivo(i: TeamInvite): boolean {
  return !i.revokedAt && new Date(i.expiresAt) > new Date() && i.uses < i.maxUses;
}

export function inviteUrl(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://www.pokersync.com.br";
  return `${base}/time/convite/${token}`;
}

// ============================================================
// Escrita
// ============================================================

export async function createTeam(name: string, role: "admin" | "coach", accent: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_team", {
    p_name: name,
    p_role: role,
    p_accent: accent,
  });
  if (error) throw error;
  return data as string;
}

export async function createInvite(opts: {
  role: TeamRole;
  expiresHours: number;
  maxUses: number;
  label?: string;
}): Promise<{ token: string; expiresAt: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_team_invite", {
    p_role: opts.role,
    p_expires_hours: opts.expiresHours,
    p_max_uses: opts.maxUses,
    p_label: opts.label ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { token: row.token, expiresAt: row.expires_at };
}

export async function revokeInvite(inviteId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

// Trocar de papel ajusta is_coach junto: coach sempre atua como coach,
// jogador nunca atua. Admin mantem a escolha (padrao: nao recebe mao).
export async function updateMemberRole(userId: string, role: TeamRole) {
  const supabase = createClient();
  const patch: Record<string, unknown> = { role };
  if (role === "coach") patch.is_coach = true;
  if (role === "player") patch.is_coach = false;
  const { error } = await supabase.from("team_members").update(patch).eq("user_id", userId);
  if (error) throw error;
}

// Admin que acumula a funcao de coach: passa a receber maos dos
// jogadores. Revisar mao nao e' funcao do admin por padrao.
export async function updateMemberIsCoach(userId: string, isCoach: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("team_members").update({ is_coach: isCoach }).eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(userId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_members").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function leaveTeam() {
  const meId = await getUserId();
  await removeMember(meId);
}

// ============================================================
// Convite (lado de quem recebe o link)
// ============================================================

export async function getInviteInfo(token: string): Promise<InviteInfo> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_team_invite_info", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { teamName: null, teamAccent: null, role: null, valid: false, reason: "CONVITE_INEXISTENTE" };
  return {
    teamName: row.team_name,
    teamAccent: row.team_accent,
    role: row.role as TeamRole | null,
    valid: row.valid,
    reason: row.reason,
  };
}

export async function acceptInvite(token: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_team_invite", { p_token: token });
  if (error) throw error;
  return data as string;
}

// ============================================================
// Painel do time
// ============================================================
// Os agregados vem de RPCs security definer (team_dashboard /
// team_leaks) — a RLS individual so libera o proprio dono, entao a
// autorizacao acontece la dentro, por papel de time:
//   admin -> time inteiro | coach -> so os jogadores atribuidos a ele.

export interface TeamDashboardRow {
  userId: string;
  nome: string;
  role: TeamRole;
  isCoach: boolean;
  coachId: string | null;
  level: number | null;
  streakDays: number | null;
  lastActivityAt: string | null;
  treinos: number;
  acertosGto: number;
  maosRevisadas: number;
  maosCompartilhadas: number;
  xpPeriodo: number;
  // Acumulado desde que o jogador ACEITOU O CONVITE do time — nao
  // respeita o filtro de periodo do painel, e' contagem de vida no time.
  jogosNoTime: number;
  lucroNoTime: number;
}

export interface TeamActivityDay {
  dia: string;
  treinos: number;
  revisoes: number;
  xp: number;
}

export interface TeamLeak {
  reasonCode: string;
  label: string;
  total: number;
  jogadores: number;
}

export async function fetchTeamDashboard(days = 30): Promise<TeamDashboardRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_dashboard", { p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    nome: r.nome,
    role: r.role as TeamRole,
    isCoach: Boolean(r.is_coach),
    coachId: r.coach_id ?? null,
    level: r.level,
    streakDays: r.streak_days,
    lastActivityAt: r.last_activity_at,
    treinos: r.treinos ?? 0,
    acertosGto: r.acertos_gto ?? 0,
    maosRevisadas: r.maos_revisadas ?? 0,
    maosCompartilhadas: r.maos_compartilhadas ?? 0,
    xpPeriodo: r.xp_periodo ?? 0,
    jogosNoTime: r.jogos_no_time ?? 0,
    lucroNoTime: Number(r.lucro_no_time ?? 0),
  }));
}

// Evolucao diaria do time inteiro (escopo do coach ou do admin) —
// alimenta o grafico do painel geral.
export async function fetchTeamActivity(days = 30): Promise<TeamActivityDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_activity", { p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    treinos: r.treinos ?? 0,
    revisoes: r.revisoes ?? 0,
    xp: r.xp ?? 0,
  }));
}

export async function fetchTeamLeaks(days = 30, limit = 8): Promise<TeamLeak[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_leaks", { p_days: days, p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    reasonCode: r.reason_code,
    label: r.label,
    total: r.total ?? 0,
    jogadores: r.jogadores ?? 0,
  }));
}

// Atribui (ou remove) o coach responsavel por um jogador. O banco valida
// que o coach e' do mesmo time e atua como coach.
export async function assignCoach(playerUserId: string, coachUserId: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ coach_id: coachUserId })
    .eq("user_id", playerUserId);
  if (error) throw error;
}

// Sem atividade ha X dias: usado pra destacar quem precisa de
// acompanhamento no painel.
export function diasSemAtividade(lastActivityAt: string | null): number | null {
  if (!lastActivityAt) return null;
  const ms = Date.now() - new Date(lastActivityAt).getTime();
  return Math.floor(ms / 86_400_000);
}

// ============================================================
// Jogador individual (visao do coach)
// ============================================================
// Tudo passa por RPCs security definer que validam quem pode olhar:
// admin do time, coach responsavel pelo jogador, ou o proprio jogador.

export interface PlayerDetail {
  userId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  role: TeamRole;
  coachId: string | null;
  coachNome: string | null;
  joinedAt: string;
  level: number | null;
  xpTotal: number | null;
  streakDays: number | null;
  streakBest: number | null;
  lastActivityAt: string | null;
  treinos: number;
  acertosGto: number;
  errosGraves: number;
  maosRevisadas: number;
  maosPendentes: number;
  maosCompartilhadas: number;
  xpPeriodo: number;
  missoesConcluidas: number;
}

export interface PlayerActivityDay {
  dia: string;
  treinos: number;
  revisoes: number;
  xp: number;
}

export interface PlayerSharedHand {
  shareId: string;
  reviewId: string;
  titulo: string;
  status: string;
  compartilhadaEm: string;
  vistaEm: string | null;
  comentarios: number;
  ultimoComentarioEm: string | null;
}

export async function fetchPlayerDetail(playerId: string, days = 30): Promise<PlayerDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_detail", { p_player: playerId, p_days: days });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    userId: r.user_id,
    nome: r.nome,
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
    role: r.role as TeamRole,
    coachId: r.coach_id ?? null,
    coachNome: r.coach_nome ?? null,
    joinedAt: r.joined_at,
    level: r.level,
    xpTotal: r.xp_total,
    streakDays: r.streak_days,
    streakBest: r.streak_best,
    lastActivityAt: r.last_activity_at,
    treinos: r.treinos ?? 0,
    acertosGto: r.acertos_gto ?? 0,
    errosGraves: r.erros_graves ?? 0,
    maosRevisadas: r.maos_revisadas ?? 0,
    maosPendentes: r.maos_pendentes ?? 0,
    maosCompartilhadas: r.maos_compartilhadas ?? 0,
    xpPeriodo: r.xp_periodo ?? 0,
    missoesConcluidas: r.missoes_concluidas ?? 0,
  };
}

export async function fetchPlayerActivity(playerId: string, days = 30): Promise<PlayerActivityDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_activity", { p_player: playerId, p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    treinos: r.treinos ?? 0,
    revisoes: r.revisoes ?? 0,
    xp: r.xp ?? 0,
  }));
}

export async function fetchPlayerLeaks(playerId: string, days = 30, limit = 6): Promise<TeamLeak[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_leaks", {
    p_player: playerId,
    p_days: days,
    p_limit: limit,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    reasonCode: r.reason_code,
    label: r.label,
    total: r.total ?? 0,
    jogadores: 1,
  }));
}

export async function fetchPlayerSharedHands(playerId: string, limit = 20): Promise<PlayerSharedHand[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_shared_hands", { p_player: playerId, p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    shareId: r.share_id,
    reviewId: r.review_id,
    titulo: r.titulo,
    status: r.status,
    compartilhadaEm: r.compartilhada_em,
    vistaEm: r.vista_em ?? null,
    comentarios: r.comentarios ?? 0,
    ultimoComentarioEm: r.ultimo_comentario_em ?? null,
  }));
}

// ============================================================
// Alertas automaticos
// ============================================================
// Gerados pela varredura diaria no banco (run_team_alerts, via cron).
// Aqui so leitura: a RLS libera o proprio jogador, o coach responsavel
// e o admin do time.

export type TeamAlertKind =
  | "inatividade"
  | "queda_frequencia"
  | "sem_revisao"
  | "mao_sem_resposta"
  | "lembrete_estudo";

export interface TeamAlert {
  id: string;
  playerId: string;
  kind: TeamAlertKind;
  detail: string | null;
  createdAt: string;
}

export const ALERTA_LABEL: Record<TeamAlertKind, string> = {
  inatividade: "Inatividade",
  queda_frequencia: "Queda de frequência",
  sem_revisao: "Treina sem revisar",
  mao_sem_resposta: "Mão sem resposta",
  lembrete_estudo: "Lembrete enviado",
};

export async function fetchPlayerAlerts(playerId: string, limit = 10): Promise<TeamAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_alerts")
    .select("id, player_id, kind, detail, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    playerId: r.player_id,
    kind: r.kind as TeamAlertKind,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
