import { createClient } from "@/lib/supabase/client";

// ============================================================
// Marketplace de vagas — times publicam vagas, jogadores se
// candidatam. Toda leitura/escrita passa por aqui (nunca Supabase
// direto na tela); o match score e o cracha do candidato sao
// calculados em RPC (marketplace_match_score / marketplace_candidate_snapshot),
// nao no cliente, porque comparam dado sensivel (performance real do
// jogador) contra os requisitos da vaga.
// ============================================================

export type ListingFormat = "MTT" | "Cash" | "SNG" | "Spin";
export type ListingStatus = "aberta" | "fechada";
export type ApplicationStatus = "pendente" | "aceita" | "recusada" | "retirada";

export interface Listing {
  id: string;
  teamId: string;
  teamName: string;
  teamAccent: string;
  teamLogoUrl: string | null;
  teamBannerUrl: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  format: ListingFormat;
  buyInMin: number | null;
  buyInMax: number | null;
  stakingPct: number | null;
  minRoiPct: number | null;
  minVolumeSessionsMonth: number | null;
  minScoreGeral: number | null;
  status: ListingStatus;
  createdAt: string;
  closedAt: string | null;
  expiresAt: string | null;
}

export interface NewListingInput {
  title: string;
  description?: string;
  format: ListingFormat;
  buyInMin?: number | null;
  buyInMax?: number | null;
  stakingPct?: number | null;
  minRoiPct?: number | null;
  minVolumeSessionsMonth?: number | null;
  minScoreGeral?: number | null;
  expiresAt?: string | null;
}

// Vaga expirada nao vira "fechada" no banco sozinha (sem cron) -- toda
// tela que decide o que mostrar/permitir usa esta funcao em vez de
// checar listing.status direto, senao uma vaga vencida continuaria
// parecendo aberta ate alguem clicar em "Fechar vaga" manualmente.
export function isListingOpen(listing: Pick<Listing, "status" | "expiresAt">): boolean {
  if (listing.status !== "aberta") return false;
  if (listing.expiresAt && new Date(listing.expiresAt) <= new Date()) return false;
  return true;
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NAO_AUTENTICADO");
  return data.user.id;
}

function mapListing(row: Record<string, unknown>): Listing {
  const team = row.teams as { name: string; accent: string; logo_url: string | null; banner_url: string | null } | null;
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    teamName: team?.name ?? "Time",
    teamAccent: team?.accent ?? "#5AA6E0",
    teamLogoUrl: team?.logo_url ?? null,
    teamBannerUrl: team?.banner_url ?? null,
    createdBy: row.created_by as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    format: row.format as ListingFormat,
    buyInMin: (row.buy_in_min as number) ?? null,
    buyInMax: (row.buy_in_max as number) ?? null,
    stakingPct: (row.staking_pct as number) ?? null,
    minRoiPct: (row.min_roi_pct as number) ?? null,
    minVolumeSessionsMonth: (row.min_volume_sessions_month as number) ?? null,
    minScoreGeral: (row.min_score_geral as number) ?? null,
    status: row.status as ListingStatus,
    createdAt: row.created_at as string,
    closedAt: (row.closed_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
  };
}

const LISTING_SELECT = "*, teams(name, accent, logo_url, banner_url)";

// Feed publico — so vagas efetivamente abertas (nao expiradas), mais
// recentes primeiro.
export async function fetchOpenListings(): Promise<Listing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(LISTING_SELECT)
    .eq("status", "aberta")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListing).filter(isListingOpen);
}

// Vagas do proprio time (abertas e fechadas) — pra quem gerencia.
export async function fetchMyTeamListings(teamId: string): Promise<Listing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(LISTING_SELECT)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListing);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("marketplace_listings").select(LISTING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapListing(data) : null;
}

export async function createListing(teamId: string, input: NewListingInput): Promise<string> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .insert({
      team_id: teamId,
      created_by: userId,
      title: input.title,
      description: input.description ?? null,
      format: input.format,
      buy_in_min: input.buyInMin ?? null,
      buy_in_max: input.buyInMax ?? null,
      staking_pct: input.stakingPct ?? null,
      min_roi_pct: input.minRoiPct ?? null,
      min_volume_sessions_month: input.minVolumeSessionsMonth ?? null,
      min_score_geral: input.minScoreGeral ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function closeListing(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status: "fechada", closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Reabrir tambem limpa a validade -- senao uma vaga expirada voltaria
// "aberta" no banco mas continuaria escondida em todo lugar que checa
// isListingOpen, sem nenhuma pista visivel do porque.
export async function reopenListing(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status: "aberta", closed_at: null, expires_at: null })
    .eq("id", id);
  if (error) throw error;
}

// Score de match do jogador logado (ou de outro usuario, se quem chama
// gerencia a vaga) contra os requisitos da vaga. 0-100.
export async function fetchMatchScore(listingId: string, userId?: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_match_score", {
    p_listing_id: listingId,
    ...(userId ? { p_user: userId } : {}),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export interface MyApplication {
  id: string;
  listingId: string;
  status: ApplicationStatus;
  matchScore: number | null;
  message: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  listing: Listing;
}

export async function fetchMyApplications(): Promise<MyApplication[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_applications")
    .select(
      `id, listing_id, status, match_score, message, decision_note, created_at, updated_at, marketplace_listings(${LISTING_SELECT})`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    listingId: row.listing_id as string,
    status: row.status as ApplicationStatus,
    matchScore: (row.match_score as number) ?? null,
    message: (row.message as string) ?? null,
    decisionNote: (row.decision_note as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    listing: mapListing(row.marketplace_listings as Record<string, unknown>),
  }));
}

export async function fetchMyApplicationForListing(listingId: string): Promise<MyApplication | null> {
  const apps = await fetchMyApplications();
  return apps.find((a) => a.listingId === listingId) ?? null;
}

export async function applyToListing(listingId: string, message?: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_apply", {
    p_listing_id: listingId,
    p_message: message ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_withdraw_application", { p_application_id: applicationId });
  if (error) throw error;
}

const MARKETPLACE_ERROS: Record<string, string> = {
  JOGADOR_JA_TEM_TIME: "Esse jogador já faz parte de outro time — ele precisa sair de lá antes de entrar no seu.",
  CANDIDATURA_NAO_PENDENTE: "Essa candidatura já foi decidida.",
  SEM_PERMISSAO: "Você não tem permissão para decidir essa candidatura.",
};

export async function decideApplication(applicationId: string, decision: "aceita" | "recusada", reason?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_decide_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(MARKETPLACE_ERROS[error.message] ?? error.message);
}

export interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
  matchScore: number | null;
  createdAt: string;
}

// Lista enxuta dos candidatos de uma vaga (sem os dados de performance
// ainda) — o cracha completo de cada um so' e' buscado sob demanda via
// fetchCandidateSnapshot, pra nao pedir todas as stats de todo mundo de
// uma vez so' pra montar a lista.
export async function fetchApplicationsForListing(listingId: string): Promise<ApplicationSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_applications")
    .select("id, status, match_score, created_at")
    .eq("listing_id", listingId)
    .order("match_score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    status: row.status as ApplicationStatus,
    matchScore: (row.match_score as number) ?? null,
    createdAt: row.created_at as string,
  }));
}

// O "cracha" do candidato — foto, identidade e as principais
// informacoes do Player Evolution dele, pro time decidir aceitar ou
// nao. So' funciona pra quem gerencia a vaga (ou o proprio candidato,
// pra conferir o que o time esta vendo). Estatisticas de frequencia
// (VPIP/PFR/3-Bet) so aparecem se o jogador ja importou maos — manual
// ou via Radar PokerSync (agente desktop).
export interface CandidateSnapshot {
  applicationId: string;
  userId: string;
  nome: string;
  apelido: string | null;
  avatarId: number;
  avatarUrl: string | null;
  matchScore: number;
  hands: number;
  roiPct: number | null;
  abiTorneio: number | null;
  numTorneios: number | null;
  numCash: number | null;
  frequenciaSemanalSessoes: number | null;
  scoreGeral: number | null;
  vpipPct: number | null;
  pfrPct: number | null;
  threeBetPct: number | null;
  aggressionFactor: number | null;
  cbetFlopPct: number | null;
  /** Preenchidos em Minha Conta -- ver TempoExperiencia/HorarioTreino/DiaSemana em profile-service.ts. */
  tempoExperiencia: string | null;
  horarioTreino: string | null;
  diasTreinoSemana: string[] | null;
  status: ApplicationStatus;
  message: string | null;
  appliedAt: string;
  historicoTimes: TeamHistoryEntry[];
}

// Uma passagem por outro time — so' papel e duracao, nunca resultado
// financeiro/performance daquele time (pedido explicito: nada sensivel).
export interface TeamHistoryEntry {
  teamName: string;
  role: string;
  months: number;
  endedMonthsAgo: number;
}

export async function fetchCandidateSnapshot(applicationId: string): Promise<CandidateSnapshot> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_candidate_snapshot", { p_application_id: applicationId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    applicationId: r.application_id,
    userId: r.user_id,
    nome: r.nome,
    apelido: r.apelido,
    avatarId: r.avatar_id,
    avatarUrl: r.avatar_url,
    matchScore: Number(r.match_score ?? 0),
    hands: r.hands ?? 0,
    roiPct: r.roi_pct,
    abiTorneio: r.abi_torneio,
    numTorneios: r.num_torneios,
    numCash: r.num_cash,
    frequenciaSemanalSessoes: r.frequencia_semanal_sessoes,
    scoreGeral: r.score_geral,
    vpipPct: r.vpip_pct,
    pfrPct: r.pfr_pct,
    threeBetPct: r.three_bet_pct,
    aggressionFactor: r.aggression_factor,
    cbetFlopPct: r.cbet_flop_pct,
    tempoExperiencia: r.tempo_experiencia,
    horarioTreino: r.horario_treino,
    diasTreinoSemana: r.dias_treino_semana,
    status: r.status,
    message: r.message,
    appliedAt: r.applied_at,
    historicoTimes: ((r.historico_times ?? []) as Record<string, unknown>[]).map((h) => ({
      teamName: h.teamName as string,
      role: h.role as string,
      months: h.months as number,
      endedMonthsAgo: h.endedMonthsAgo as number,
    })),
  };
}

// ============================================================
// Favoritos — jogador marca vaga pra comparar depois.
// ============================================================

export async function fetchMyFavoriteIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("marketplace_favorites").select("listing_id");
  if (error) throw error;
  return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
}

export async function toggleFavorite(listingId: string, favorito: boolean): Promise<void> {
  const supabase = createClient();
  if (favorito) {
    const userId = await getUserId();
    const { error } = await supabase.from("marketplace_favorites").insert({ user_id: userId, listing_id: listingId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("marketplace_favorites").delete().eq("listing_id", listingId);
    if (error) throw error;
  }
}

// ============================================================
// Estatisticas publicas do time no Marketplace — so' agregados
// (nenhuma identidade de candidato), ajuda o jogador a avaliar o time
// antes de se candidatar.
// ============================================================

export interface TeamMarketplaceStats {
  totalVagas: number;
  vagasAbertas: number;
  totalCandidaturas: number;
  aceitas: number;
  taxaAceitePct: number | null;
  tempoMedioRespostaDias: number | null;
}

export async function fetchTeamStats(teamId: string): Promise<TeamMarketplaceStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_team_stats", { p_team_id: teamId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return {
    totalVagas: r?.total_vagas ?? 0,
    vagasAbertas: r?.vagas_abertas ?? 0,
    totalCandidaturas: r?.total_candidaturas ?? 0,
    aceitas: r?.aceitas ?? 0,
    taxaAceitePct: r?.taxa_aceite_pct ?? null,
    tempoMedioRespostaDias: r?.tempo_medio_resposta_dias ?? null,
  };
}

// ============================================================
// Opt-in do alerta de vaga compativel — sem isso, o gatilho
// notify_high_match_candidates (banco) nem considera o jogador, mesmo
// sem time. Fica em profiles.procurando_vaga por ser preferencia do
// jogador, nao da vaga.
// ============================================================

export async function fetchLookingForTeam(): Promise<boolean> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase.from("profiles").select("procurando_vaga").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.procurando_vaga ?? false;
}

export async function setLookingForTeam(value: boolean): Promise<void> {
  const supabase = createClient();
  const userId = await getUserId();
  const { error } = await supabase.from("profiles").update({ procurando_vaga: value }).eq("id", userId);
  if (error) throw error;
}

export const FORMAT_LABEL: Record<ListingFormat, string> = {
  MTT: "Torneio (MTT)",
  Cash: "Cash Game",
  SNG: "Sit & Go",
  Spin: "Spin & Go",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pendente: "Em análise",
  aceita: "Aceita",
  recusada: "Recusada",
  retirada: "Retirada",
};
