import { createClient } from "@/lib/supabase/client";
import { isModuleUnlocked, toPlanId } from "@/lib/plans/plans-data";
import { fetchMyPlanId } from "@/lib/services/plan-service";

// ============================================================
// Modo Team — base (time, papeis, convites por token)
// ============================================================

export type TeamRole = "admin" | "coach" | "player";

export interface Team {
  id: string;
  name: string;
  accent: string;
  ownerId: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: string | null;
}

export interface TeamLabel {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface TeamInfo extends Team {
  totalJogadores: number;
  totalCoaches: number;
  totalPendentes: number;
}

export interface TeamStaff {
  userId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  role: TeamRole;
  isCoach: boolean;
  joinedAt: string;
  jogadores: number;
}

export interface PendingMember {
  userId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  role: TeamRole;
  requestedAt: string;
}

export interface FinancialDay {
  dia: string;
  resultado: number;
  acumulado: number;
  sessoes: number;
}

export interface MyMembership {
  teamId: string;
  teamName: string;
  role: TeamRole;
  status: "pendente" | "ativo";
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
  MENSAGEM_VAZIA: "Escreva uma mensagem.",
  NAO_E_DO_MESMO_TIME: "Esse jogador não está mais no seu time.",
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
  return fetchMyPlanId();
}

export function planoPermiteCriarTime(plan: string): boolean {
  return isModuleUnlocked(toPlanId(plan), "time");
}

// Acesso em cascata (ver isModuleUnlockedFor/isAddonUnlockedFor em
// lib/plans/plans-data.ts): so' membro ATIVO usa o acesso do time --
// 'pendente' ainda nao foi aprovado, so' enxerga a fila de espera em
// /time, nada mais. Filtro por user_id e' obrigatorio (nao so' opcional):
// a RLS de team_members libera TODO membro do mesmo time, sem o filtro
// o .maybeSingle() quebra com "multiple rows" pra qualquer time com mais
// de 1 pessoa.
export async function fetchHasActiveTeamAccess(): Promise<boolean> {
  const supabase = createClient();
  const meId = await getUserId();
  const { data } = await supabase.from("team_members").select("status").eq("user_id", meId).maybeSingle();
  return data?.status === "ativo";
}

// ============================================================
// Cache curta (15s) pra fetchMyTeam/fetchTeamDashboard — Painel e Funil
// sao paginas separadas hoje e cada uma carrega o time do zero ao
// navegar entre elas. Sem isso, ir e voltar Painel<->Funil refaz as
// mesmas duas RPCs toda vez. TTL curto de proposito: e' so' pra
// suavizar a ida-e-volta imediata, nao pra esconder mudanca real (o
// usuario que mexeu em algo e trocou de aba ja espera ver atualizado
// em ~15s, nao precisa de invalidacao manual pra esse caso de uso).
// ============================================================
const CACHE_TTL_MS = 15_000;
let myTeamCache: { data: MyTeam | null; ts: number } | null = null;
const dashboardCache = new Map<number, { data: TeamDashboardRow[]; ts: number }>();

export async function fetchMyTeamCached(): Promise<MyTeam | null> {
  if (myTeamCache && Date.now() - myTeamCache.ts < CACHE_TTL_MS) return myTeamCache.data;
  const data = await fetchMyTeam();
  myTeamCache = { data, ts: Date.now() };
  return data;
}

export async function fetchTeamDashboardCached(days = 30): Promise<TeamDashboardRow[]> {
  const cached = dashboardCache.get(days);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  const data = await fetchTeamDashboard(days);
  dashboardCache.set(days, { data, ts: Date.now() });
  return data;
}

export async function fetchMyTeam(): Promise<MyTeam | null> {
  const supabase = createClient();
  const meId = await getUserId();

  const { data: mine, error: eMine } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", meId)
    .eq("status", "ativo")
    .maybeSingle();
  if (eMine) throw eMine;
  if (!mine) return null;

  const [{ data: teamRow, error: eTeam }, { data: memberRows, error: eMembers }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, accent, owner_id, description, logo_url, banner_url, created_at")
      .eq("id", mine.team_id)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("user_id, role, is_coach, coach_id, joined_at")
      .eq("team_id", mine.team_id),
  ]);
  if (eTeam) throw eTeam;
  if (eMembers) throw eMembers;
  if (!teamRow) return null;

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
    team: {
      id: teamRow.id,
      name: teamRow.name,
      accent: teamRow.accent,
      ownerId: teamRow.owner_id,
      description: teamRow.description ?? null,
      logoUrl: teamRow.logo_url ?? null,
      bannerUrl: teamRow.banner_url ?? null,
      createdAt: teamRow.created_at ?? null,
    },
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

export async function updateMemberRole(userId: string, role: TeamRole) {
  const supabase = createClient();
  const patch: Record<string, unknown> = { role };
  if (role === "coach") patch.is_coach = true;
  if (role === "player") patch.is_coach = false;
  const { error } = await supabase.from("team_members").update(patch).eq("user_id", userId);
  if (error) throw error;
}

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
  jogosNoTime: number;
  lucroNoTime: number;
  avatarId: number;
  avatarUrl: string | null;
  joinedAt: string;
  labelId: string | null;
  labelName: string | null;
  labelColor: string | null;
}

export interface TeamActivityDay {
  dia: string;
  treinos: number;
  revisoes: number;
  xp: number;
}

export interface TeamLeak {
  reasonCode: string;
  street: string;
  label: string;
  total: number;
  jogadores: number;
  drillId: string | null;
  drillTitle: string | null;
  treinavel: boolean;
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
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
    joinedAt: r.joined_at,
    labelId: r.label_id ?? null,
    labelName: r.label_name ?? null,
    labelColor: r.label_color ?? null,
  }));
}

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
    street: r.street,
    label: r.label,
    total: r.total ?? 0,
    jogadores: r.jogadores ?? 0,
    drillId: r.drill_id ?? null,
    drillTitle: r.drill_title ?? null,
    treinavel: Boolean(r.treinavel),
  }));
}

export interface TeamLeakPlayer {
  userId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
}

export async function fetchTeamLeakPlayers(reasonCode: string, street: string, days = 30): Promise<TeamLeakPlayer[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_leak_players", { p_reason_code: reasonCode, p_street: street, p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    nome: r.nome,
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
  }));
}

export async function assignTeamDrill(
  reasonCode: string,
  street: string,
  drillId: string,
  days = 30
): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("assign_team_drill", {
    p_reason_code: reasonCode,
    p_street: street,
    p_drill_id: drillId,
    p_days: days,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function assignCoach(playerUserId: string, coachUserId: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ coach_id: coachUserId })
    .eq("user_id", playerUserId);
  if (error) throw error;
}

export function diasSemAtividade(lastActivityAt: string | null): number | null {
  if (!lastActivityAt) return null;
  const ms = Date.now() - new Date(lastActivityAt).getTime();
  return Math.floor(ms / 86_400_000);
}

// ============================================================
// Score de evolução (0-100) -- resume num número só o que hoje só dava
// pra ver abrindo a ficha e cruzando 4-5 métricas na cabeça. Serve
// tanto pra linha de TeamDashboardRow (lista de Jogadores) quanto pra
// PlayerDetail (ficha) -- as duas já têm os campos abaixo, então não
// precisa de RPC nova nem tabela nova.
// Pesos: atividade pesa mais (é o sinal mais rápido de que algo mudou),
// depois estudo (acerto GTO), depois consistência (streak) e progresso
// (volume de treino/revisão no período). Faixas de risco usam a MESMA
// semântica de cor que o Assistente do coach já usa pros blocos de
// alerta (positive/evolution/negative), não uma paleta nova.
// ============================================================
export interface ScoreInput {
  treinos: number;
  acertosGto: number;
  maosRevisadas: number;
  streakDays: number | null;
  lastActivityAt: string | null;
}

export type NivelRisco = "baixo" | "medio" | "alto";

export interface EvolutionScore {
  valor: number;
  risco: NivelRisco;
}

function pontosAtividade(lastActivityAt: string | null): number {
  const d = diasSemAtividade(lastActivityAt);
  if (d === null) return 0;
  if (d === 0) return 40;
  if (d <= 3) return 32;
  if (d <= 7) return 20;
  if (d <= 14) return 8;
  return 0;
}

export function calcularScore(j: ScoreInput): EvolutionScore {
  const acertoPct = j.treinos > 0 ? (j.acertosGto / j.treinos) * 100 : null;
  const pontosEstudo = acertoPct === null ? 10 : Math.min(30, Math.round(acertoPct * 0.3));
  const pontosConsistencia = Math.min(15, Math.round((j.streakDays ?? 0) * 1.5));
  const pontosProgresso = Math.min(15, Math.round((j.treinos + j.maosRevisadas) * 1.5));
  const valor = Math.max(
    0,
    Math.min(100, pontosAtividade(j.lastActivityAt) + pontosEstudo + pontosConsistencia + pontosProgresso)
  );
  const risco: NivelRisco = valor < 40 ? "alto" : valor < 70 ? "medio" : "baixo";
  return { valor, risco };
}

// ------------------------------------------------------------
// Histórico do Score (foto diária gravada por snapshot_team_scores(),
// migração team_player_score_snapshots) -- alimenta o gráfico de
// tendência na Ficha do jogador e a comparação com "7 dias atrás" nos
// lugares onde o selo aparece.
// ------------------------------------------------------------
export interface PlayerScoreHistoryPoint {
  dia: string;
  score: number;
  risco: NivelRisco;
}

export async function fetchPlayerScoreHistory(playerId: string, days = 30): Promise<PlayerScoreHistoryPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_score_history", { p_player: playerId, p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    score: r.score,
    risco: r.risco as NivelRisco,
  }));
}

export type TendenciaScore = "subiu" | "caiu" | "estavel";

// Compara o score de hoje com o mais antigo disponível até 7 dias atrás
// -- "estavel" cobre tanto empate quanto histórico curto demais (menos
// de 2 dias), pra não fingir uma tendência que não dá pra sustentar.
export function calcularTendencia(historico: PlayerScoreHistoryPoint[]): TendenciaScore {
  if (historico.length < 2) return "estavel";
  const hoje = historico[historico.length - 1];
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const referencia = historico.find((p) => new Date(p.dia).getTime() >= limite) ?? historico[0];
  if (referencia === hoje) return "estavel";
  if (hoje.score > referencia.score) return "subiu";
  if (hoje.score < referencia.score) return "caiu";
  return "estavel";
}

export interface TeamScoreHistoryPoint {
  dia: string;
  scoreMedio: number;
}

export async function fetchTeamScoreHistory(days = 30): Promise<TeamScoreHistoryPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_score_history", { p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    scoreMedio: Math.round(Number(r.score_medio ?? 0)),
  }));
}

// ============================================================
// Jogador individual (visao do coach)
// ============================================================

export interface PeriodComparison {
  treinosAtual: number; treinosAnterior: number;
  acertosAtual: number; acertosAnterior: number;
  revisadasAtual: number; revisadasAnterior: number;
  xpAtual: number; xpAnterior: number;
}

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
  jogosNoTime: number;
  lucroNoTime: number;
  treinosPeriodoAnterior: number;
  acertosGtoPeriodoAnterior: number;
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
    jogosNoTime: r.jogos_no_time ?? 0,
    lucroNoTime: Number(r.lucro_no_time ?? 0),
    treinosPeriodoAnterior: r.treinos_periodo_anterior ?? 0,
    acertosGtoPeriodoAnterior: r.acertos_gto_periodo_anterior ?? 0,
  };
}

export async function fetchPlayerFinancialSeries(playerId: string, days = 30): Promise<FinancialDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_financial_series", { p_player: playerId, p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    resultado: Number(r.resultado ?? 0),
    acumulado: Number(r.acumulado ?? 0),
    sessoes: r.sessoes ?? 0,
  }));
}

// Staking/backing (2026-08): sessoes onde o jogador vendeu parte da acao —
// da' visibilidade pro coach/backer, que antes so' via o resultado bruto
// (o painel financeiro contava o swing inteiro, mesmo quando so' uma fatia
// era do jogador). resultadoLiquido ja' vem calculado no banco com a mesma
// formula do net() do frontend (ver migracao bankroll_session_net).
export interface PlayerStakingSession {
  id: string;
  dia: string;
  formato: string;
  ownPct: number;
  markup: number;
  backerName: string | null;
  resultadoLiquido: number;
  resultadoBruto: number;
}

export async function fetchPlayerStakingSessions(playerId: string, limit = 20): Promise<PlayerStakingSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_staking_sessions", { p_player: playerId, p_limit: limit });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    dia: r.dia,
    formato: r.formato,
    ownPct: Number(r.own_pct ?? 100),
    markup: Number(r.markup ?? 1),
    backerName: r.backer_name || null,
    resultadoLiquido: Number(r.resultado_liquido ?? 0),
    resultadoBruto: Number(r.resultado_bruto ?? 0),
  }));
}

export async function fetchPeriodComparison(days = 30): Promise<PeriodComparison> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_period_comparison", { p_days: days });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    treinosAtual: r?.treinos_atual ?? 0,
    treinosAnterior: r?.treinos_anterior ?? 0,
    acertosAtual: r?.acertos_atual ?? 0,
    acertosAnterior: r?.acertos_anterior ?? 0,
    revisadasAtual: r?.revisadas_atual ?? 0,
    revisadasAnterior: r?.revisadas_anterior ?? 0,
    xpAtual: r?.xp_atual ?? 0,
    xpAnterior: r?.xp_anterior ?? 0,
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

export interface PlayerLeak {
  reasonCode: string;
  label: string;
  total: number;
}

export async function fetchPlayerLeaks(playerId: string, days = 30, limit = 6): Promise<PlayerLeak[]> {
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

export type TeamAlertKind =
  | "inatividade"
  | "queda_frequencia"
  | "sem_revisao"
  | "mao_sem_resposta"
  | "lembrete_estudo"
  | "faltas_consecutivas"
  | "rsvp_sem_resposta";

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
  faltas_consecutivas: "Faltas consecutivas",
  rsvp_sem_resposta: "Convite sem resposta",
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

// Visao do time todo (RLS ja filtra: admin ve tudo, coach so os proprios
// jogadores) — usado no resumo do assistente do coach.
export async function fetchTeamAlerts(days = 14, limit = 30): Promise<TeamAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_alerts")
    .select("id, player_id, kind, detail, created_at")
    .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
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

// ============================================================
// Identidade do time, etiquetas e fila de aprovacao
// ============================================================

export async function fetchTeamInfo(): Promise<TeamInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_info");
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    accent: r.accent,
    ownerId: r.owner_id ?? null,
    description: r.description ?? null,
    logoUrl: r.logo_url ?? null,
    bannerUrl: r.banner_url ?? null,
    createdAt: r.created_at ?? null,
    totalJogadores: r.total_jogadores ?? 0,
    totalCoaches: r.total_coaches ?? 0,
    totalPendentes: r.total_pendentes ?? 0,
  };
}

export async function fetchTeamStaff(): Promise<TeamStaff[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_staff");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    nome: r.nome,
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
    role: r.role as TeamRole,
    isCoach: Boolean(r.is_coach),
    joinedAt: r.joined_at,
    jogadores: r.jogadores ?? 0,
  }));
}

export async function updateTeamInfo(patch: {
  name?: string;
  description?: string | null;
  accent?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}) {
  const supabase = createClient();
  const teamId = (await fetchTeamInfo())?.id;
  if (!teamId) throw new Error("SEM_TIME");
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.accent !== undefined) row.accent = patch.accent;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.bannerUrl !== undefined) row.banner_url = patch.bannerUrl;
  const { error } = await supabase.from("teams").update(row).eq("id", teamId);
  if (error) throw error;
}

export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${teamId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
  await updateTeamInfo({ logoUrl: data.publicUrl });
  return data.publicUrl;
}

// Banner customizavel do time (mesmo bucket/regra do logo — so' um
// prefixo de arquivo diferente). Mostrado na entrada do modo Time,
// mesmo tamanho do hero de boas-vindas dos Modulos.
export async function uploadTeamBanner(teamId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${teamId}/banner-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("team-logos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
  await updateTeamInfo({ bannerUrl: data.publicUrl });
  return data.publicUrl;
}

export async function removeTeamBanner(): Promise<void> {
  await updateTeamInfo({ bannerUrl: null });
}

export async function fetchTeamLabels(teamId: string): Promise<TeamLabel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_labels")
    .select("id, name, color, sort_order")
    .eq("team_id", teamId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order }));
}

export async function createLabel(teamId: string, name: string, color: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_labels").insert({ team_id: teamId, name: name.trim(), color });
  if (error) throw error;
}

export async function deleteLabel(labelId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("team_labels").delete().eq("id", labelId);
  if (error) throw error;
}

export async function setMemberLabel(userId: string, labelId: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from("team_members").update({ label_id: labelId }).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchPendingMembers(): Promise<PendingMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_pending_members");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    nome: r.nome,
    avatarId: r.avatar_id ?? 1,
    avatarUrl: r.avatar_url ?? null,
    role: r.role as TeamRole,
    requestedAt: r.requested_at,
  }));
}

export async function approveMember(userId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_team_member", { p_user: userId });
  if (error) throw error;
}

export async function rejectMember(userId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("reject_team_member", { p_user: userId });
  if (error) throw error;
}

export async function fetchMyMembership(): Promise<MyMembership | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_membership");
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return { teamId: r.team_id, teamName: r.team_name, role: r.role, status: r.status };
}

export async function fetchFinancialSeries(days = 30): Promise<FinancialDay[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_financial_series", { p_days: days });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    dia: r.dia,
    resultado: Number(r.resultado ?? 0),
    acumulado: Number(r.acumulado ?? 0),
    sessoes: r.sessoes ?? 0,
  }));
}

// ============================================================
// Metas por jogador (definidas pelo coach/admin)
// ============================================================

export type GoalMetric = "treinos" | "maos_revisadas" | "maos_compartilhadas";
export type GoalPeriod = "semana" | "mes";

export const METRICA_LABEL: Record<GoalMetric, string> = {
  treinos: "Treinos",
  maos_revisadas: "Mãos revisadas",
  maos_compartilhadas: "Mãos compartilhadas",
};

export interface PlayerGoal {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  active: boolean;
  createdAt: string;
  createdBy: string;
  // Prazo definido na criacao (obrigatorio desde a decisao 2026-09-04:
  // meta sem prazo fica avulsa). Passado esse dia, "finalizada" vira
  // true independente de "atingida" -- sao dois conceitos diferentes.
  deadline: string;
  progress: number;
  janelaDias: number;
  atingida: boolean;
  finalizada: boolean;
}

export async function fetchPlayerGoals(playerId: string): Promise<PlayerGoal[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_goals_progress", { p_player: playerId });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    metric: r.metric as GoalMetric,
    period: r.period as GoalPeriod,
    target: r.target,
    active: r.active,
    createdAt: r.created_at,
    createdBy: r.created_by,
    deadline: r.deadline,
    progress: r.progress ?? 0,
    janelaDias: r.janela_dias,
    atingida: Boolean(r.atingida),
    finalizada: Boolean(r.finalizada),
  }));
}

export async function createPlayerGoal(
  playerId: string,
  metric: GoalMetric,
  period: GoalPeriod,
  target: number,
  deadline: string
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_player_goal", {
    p_player: playerId,
    p_metric: metric,
    p_period: period,
    p_target: target,
    p_deadline: deadline,
  });
  if (error) throw error;
  return data as string;
}

export async function deactivatePlayerGoal(goalId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("deactivate_player_goal", { p_goal: goalId });
  if (error) throw error;
}

// ============================================================
// Chat 1:1, dentro do mesmo time (Central de Conversas)
// ============================================================
// RLS libera so remetente e destinatario. Insert sempre via RPC
// send_team_message (valida "mesmo time" + dispara notificacao de
// sino; ja suporta kind='audio' desde a v5-arg). Leitura e
// marcar-como-lida podem ir direto na tabela.

export type TeamMessageKind = "texto" | "audio";

export interface TeamMessage {
  id: string;
  teamId: string;
  senderId: string;
  recipientId: string;
  body: string;
  kind: TeamMessageKind;
  /** Path dentro do bucket privado "team-audio" (nao a URL publica --
      o bucket exige signed URL, ver getTeamAudioUrl). */
  audioUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  readAt: string | null;
}

const TEAM_MESSAGE_COLUMNS =
  "id, team_id, sender_id, recipient_id, body, kind, audio_url, duration_seconds, created_at, read_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTeamMessage(r: any): TeamMessage {
  return {
    id: r.id,
    teamId: r.team_id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    kind: (r.kind as TeamMessageKind) ?? "texto",
    audioUrl: r.audio_url,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export async function fetchTeamThread(otherUserId: string, limit = 100): Promise<TeamMessage[]> {
  const supabase = createClient();
  const meId = await getUserId();
  const { data, error } = await supabase
    .from("team_messages")
    .select(TEAM_MESSAGE_COLUMNS)
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${meId})`
    )
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapTeamMessage);
}

export async function sendTeamMessage(recipientId: string, body: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_team_message", {
    p_recipient: recipientId,
    p_body: body,
  });
  if (error) throw error;
  return data as string;
}

// Upload do blob gravado (webm/opus, ver ChatCenter) pro bucket privado
// "team-audio". Path segue a convencao exigida pela policy de INSERT
// (storage.foldername(name)[2] = auth.uid()): "{teamId}/{meId}/{arquivo}".
// Guardamos so' o path em team_messages.audio_url -- a policy de SELECT
// casa por sufixo (audio_url LIKE '%'||objects.name), entao path e URL
// publica funcionariam igual, mas o bucket nao e' publico.
export async function uploadTeamAudio(teamId: string, blob: Blob): Promise<string> {
  const supabase = createClient();
  const meId = await getUserId();
  const path = `${teamId}/${meId}/${crypto.randomUUID()}.webm`;
  const { error } = await supabase.storage.from("team-audio").upload(path, blob, {
    contentType: blob.type || "audio/webm",
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function sendTeamAudioMessage(
  recipientId: string,
  audioPath: string,
  durationSeconds: number
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_team_message", {
    p_recipient: recipientId,
    p_body: "",
    p_kind: "audio",
    p_audio_url: audioPath,
    p_duration_seconds: Math.min(120, Math.max(1, Math.round(durationSeconds))),
  });
  if (error) throw error;
  return data as string;
}

// Bucket privado -- precisa de signed URL pra tocar o audio (curta,
// so' pro player abrir; nao guardamos/cacheamos entre sessoes).
export async function getTeamAudioUrl(path: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("team-audio").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function markThreadRead(otherUserId: string) {
  const supabase = createClient();
  const meId = await getUserId();
  const { error } = await supabase
    .from("team_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherUserId)
    .eq("recipient_id", meId)
    .is("read_at", null);
  if (error) throw error;
}

// ============================================================
// Central de Conversas (topbar) -- lista todas as conversas que o
// usuario ja tem no time, tipo Discord. Reusa fetchMyTeamCached() pra
// nome/avatar/papel de cada contato (qualquer membro pode conversar
// com qualquer outro, mesma regra ja validada pelo RPC).
// ============================================================

export interface TeamThreadSummary {
  otherUserId: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  role: TeamRole;
  lastMessage: string;
  lastKind: TeamMessageKind;
  lastAt: string;
  lastIsMine: boolean;
  unreadCount: number;
}

const THREADS_SCAN_LIMIT = 500;

export async function fetchTeamThreads(): Promise<TeamThreadSummary[]> {
  const supabase = createClient();
  const meId = await getUserId();
  const [{ data: msgs, error }, myTeam] = await Promise.all([
    supabase
      .from("team_messages")
      .select("id, sender_id, recipient_id, body, kind, created_at, read_at")
      .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
      .order("created_at", { ascending: false })
      .limit(THREADS_SCAN_LIMIT),
    fetchMyTeamCached(),
  ]);
  if (error) throw error;
  if (!myTeam) return [];

  const memberById = new Map(myTeam.members.map((m) => [m.userId, m]));
  const byOther = new Map<string, TeamThreadSummary>();

  for (const m of msgs ?? []) {
    const otherId = m.sender_id === meId ? m.recipient_id : m.sender_id;
    const unread = m.recipient_id === meId && !m.read_at;
    const existing = byOther.get(otherId);
    if (existing) {
      if (unread) existing.unreadCount += 1;
      continue;
    }
    const member = memberById.get(otherId);
    byOther.set(otherId, {
      otherUserId: otherId,
      nome: member?.name ?? "Ex-membro do time",
      avatarId: member?.avatarId ?? 1,
      avatarUrl: member?.avatarUrl ?? null,
      role: member?.role ?? "player",
      lastMessage: m.kind === "audio" ? "🎤 Mensagem de voz" : m.body,
      lastKind: (m.kind as TeamMessageKind) ?? "texto",
      lastAt: m.created_at,
      lastIsMine: m.sender_id === meId,
      unreadCount: unread ? 1 : 0,
    });
  }

  return Array.from(byOther.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export async function fetchTeamUnreadCount(): Promise<number> {
  const supabase = createClient();
  const meId = await getUserId();
  const { count, error } = await supabase
    .from("team_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", meId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

// ============================================================
// Player Evolution do jogador (visão do coach) -- hand_tags só é
// legível pelo próprio dono (RLS), então isso não existia antes.
// Mesmas fórmulas de lib/services/analysis-service.ts
// (computePreflopMetrics/computePostflopMetrics), agregadas em SQL
// pra um jogador só via team_player_evolution_stats().
// ============================================================
export interface PlayerEvolutionStats {
  hands: number;
  vpipPct: number | null;
  pfrPct: number | null;
  threeBetPct: number | null;
  foldTo3betPct: number | null;
  cbetFlopPct: number | null;
  foldToCbetFlopPct: number | null;
  aggressionFactor: number | null;
  aggressionFrequencyPct: number | null;
  wsdPct: number | null;
  wsdWonPct: number | null;
}

export async function fetchPlayerEvolutionStats(playerId: string, days = 30): Promise<PlayerEvolutionStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_player_evolution_stats", { p_player: playerId, p_days: days });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    hands: r?.hands ?? 0,
    vpipPct: r?.vpip_pct ?? null,
    pfrPct: r?.pfr_pct ?? null,
    threeBetPct: r?.three_bet_pct ?? null,
    foldTo3betPct: r?.fold_to_3bet_pct ?? null,
    cbetFlopPct: r?.cbet_flop_pct ?? null,
    foldToCbetFlopPct: r?.fold_to_cbet_flop_pct ?? null,
    aggressionFactor: r?.aggression_factor ?? null,
    aggressionFrequencyPct: r?.aggression_frequency_pct ?? null,
    wsdPct: r?.wsd_pct ?? null,
    wsdWonPct: r?.wsd_won_pct ?? null,
  };
}
