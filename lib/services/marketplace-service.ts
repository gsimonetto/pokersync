import { createClient } from "@/lib/supabase/client";

// ============================================================
// Marketplace de vagas — times publicam vagas, jogadores se
// candidatam. Toda leitura/escrita passa por aqui (nunca Supabase
// direto na tela); o match e o cracha do candidato sao calculados em
// RPC (marketplace_meus_matches / marketplace_candidate_snapshot), nao
// no cliente, porque comparam dado sensivel (performance real do
// jogador) contra os requisitos da vaga.
// ============================================================

export type ListingFormat = "MTT" | "Cash" | "SNG" | "Spin";
export type ListingStatus = "aberta" | "fechada";
export type ApplicationStatus = "pendente" | "aceita" | "recusada" | "retirada";
/** Moeda da vaga: o time escolhe ao publicar. */
export type Moeda = "BRL" | "USD";

// Categorização visual do feed (pedido explicito: "faça cards das vagas
// separadas por MICRO / LOW / MEDIUM / HIGH STAKES / CASH GAME / SPIN").
// Cash e Spin são categorias pelo próprio formato -- só MTT/SNG usam a
// faixa de buy-in pra decidir o stake tier, porque são os únicos formatos
// em que "quanto custa entrar" varia livremente vaga a vaga.
export type StakeTier = "micro" | "low" | "medium" | "high" | "cash" | "spin";

export const STAKE_TIER_LABEL: Record<StakeTier, string> = {
  micro: "Micro Stakes",
  low: "Low Stakes",
  medium: "Medium Stakes",
  high: "High Stakes",
  cash: "Cash Game",
  spin: "Spin",
};

// Ordem pedida explicitamente: MICRO / LOW / MEDIUM / HIGH STAKES /
// CASH GAME / SPIN.
export const STAKE_TIER_ORDER: StakeTier[] = ["micro", "low", "medium", "high", "cash", "spin"];

// As faixas são em reais: vaga em dólar entra convertida pela cotação
// guardada nela.
export function stakeTierOf(
  listing: Pick<Listing, "format" | "buyInMin" | "buyInMax" | "moeda" | "cotacaoUsdBrl">,
): StakeTier {
  if (listing.format === "Cash") return "cash";
  if (listing.format === "Spin") return "spin";
  const fator = listing.moeda === "USD" ? (listing.cotacaoUsdBrl ?? 1) : 1;
  const buyIn = (listing.buyInMin ?? listing.buyInMax ?? 0) * fator;
  if (buyIn < 10) return "micro";
  if (buyIn < 50) return "low";
  if (buyIn < 200) return "medium";
  return "high";
}

/** O time da vaga como aparece nas Vagas: identidade + números dele aqui. */
export interface TimeNasVagas {
  teamId: string;
  nome: string;
  cor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  descricao: string | null;
  jogadores: number;
  totalVagas: number;
  vagasAbertas: number;
  totalCandidaturas: number;
  aceitas: number;
  taxaAceitePct: number | null;
  tempoMedioRespostaDias: number | null;
}

export interface Listing {
  id: string;
  teamId: string;
  teamName: string;
  teamAccent: string;
  teamLogoUrl: string | null;
  teamBannerUrl: string | null;
  /** Nome, cor e números do time -- null se não deu pra buscar. */
  time: TimeNasVagas | null;
  createdBy: string;
  title: string;
  description: string | null;
  format: ListingFormat;
  moeda: Moeda;
  /** Só em vaga em dólar: a cotação do dia em que foi publicada. */
  cotacaoUsdBrl: number | null;
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
  moeda?: Moeda;
  cotacaoUsdBrl?: number | null;
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

const SIMBOLO: Record<Moeda, string> = { BRL: "R$", USD: "US$" };

export function formatarValor(valor: number, moeda: Moeda): string {
  return `${SIMBOLO[moeda]} ${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}

/** "R$ 10–50", "a partir de US$ 5", "até R$ 100" -- null sem buy-in. */
export function formatarBuyIn(l: Pick<Listing, "buyInMin" | "buyInMax" | "moeda">): string | null {
  const { buyInMin: min, buyInMax: max, moeda } = l;
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (min != null && max != null) return min === max ? formatarValor(min, moeda) : `${SIMBOLO[moeda]} ${n(min)}–${n(max)}`;
  if (min != null) return `a partir de ${formatarValor(min, moeda)}`;
  if (max != null) return `até ${formatarValor(max, moeda)}`;
  return null;
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NAO_AUTENTICADO");
  return data.user.id;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function mapListing(row: Record<string, unknown>): Listing {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    teamName: "Time",
    teamAccent: "#5AA6E0",
    teamLogoUrl: null,
    teamBannerUrl: null,
    time: null,
    createdBy: row.created_by as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    format: row.format as ListingFormat,
    moeda: row.moeda === "USD" ? "USD" : "BRL",
    cotacaoUsdBrl: num(row.cotacao_usd_brl),
    buyInMin: num(row.buy_in_min),
    buyInMax: num(row.buy_in_max),
    stakingPct: num(row.staking_pct),
    minRoiPct: num(row.min_roi_pct),
    minVolumeSessionsMonth: num(row.min_volume_sessions_month),
    minScoreGeral: num(row.min_score_geral),
    status: row.status as ListingStatus,
    createdAt: row.created_at as string,
    closedAt: (row.closed_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
  };
}

// Os dados do time são fechados pra quem não é do time -- nome, cor, logo
// e os números nas Vagas vêm de uma RPC que só mostra time com vaga que a
// pessoa enxerga.
export async function fetchTimes(teamIds: string[]): Promise<Map<string, TimeNasVagas>> {
  const ids = [...new Set(teamIds)];
  if (!ids.length) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_times", { p_team_ids: ids });
  if (error) throw error;
  return new Map(
    ((data ?? []) as Record<string, unknown>[]).map((r) => [
      r.team_id as string,
      {
        teamId: r.team_id as string,
        nome: r.nome as string,
        cor: (r.cor as string) || "#5AA6E0",
        logoUrl: (r.logo_url as string) ?? null,
        bannerUrl: (r.banner_url as string) ?? null,
        descricao: (r.descricao as string) ?? null,
        jogadores: Number(r.jogadores ?? 0),
        totalVagas: Number(r.total_vagas ?? 0),
        vagasAbertas: Number(r.vagas_abertas ?? 0),
        totalCandidaturas: Number(r.total_candidaturas ?? 0),
        aceitas: Number(r.aceitas ?? 0),
        taxaAceitePct: num(r.taxa_aceite_pct),
        tempoMedioRespostaDias: num(r.tempo_medio_resposta_dias),
      },
    ]),
  );
}

async function comTimes(listings: Listing[]): Promise<Listing[]> {
  const times = await fetchTimes(listings.map((l) => l.teamId)).catch(() => new Map<string, TimeNasVagas>());
  return listings.map((l) => {
    const t = times.get(l.teamId);
    return t ? { ...l, teamName: t.nome, teamAccent: t.cor, teamLogoUrl: t.logoUrl, teamBannerUrl: t.bannerUrl, time: t } : l;
  });
}

// Feed publico — so vagas efetivamente abertas (nao expiradas), mais
// recentes primeiro.
export async function fetchOpenListings(): Promise<Listing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("status", "aberta")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return comTimes((data ?? []).map(mapListing).filter(isListingOpen));
}

// Vagas do proprio time (abertas e fechadas) — pra quem gerencia.
export async function fetchMyTeamListings(teamId: string): Promise<Listing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return comTimes((data ?? []).map(mapListing));
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("marketplace_listings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [l] = await comTimes([mapListing(data)]);
  return l;
}

export async function createListing(teamId: string, input: NewListingInput): Promise<string> {
  const supabase = createClient();
  const userId = await getUserId();
  const moeda = input.moeda ?? "BRL";
  const { data, error } = await supabase
    .from("marketplace_listings")
    .insert({
      team_id: teamId,
      created_by: userId,
      title: input.title,
      description: input.description ?? null,
      format: input.format,
      moeda,
      cotacao_usd_brl: moeda === "USD" ? (input.cotacaoUsdBrl ?? null) : null,
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

// ============================================================
// Match explicado — o match do jogador logado com cada vaga e, pra cada
// requisito que a vaga pede, o número dele, o pedido e se bate. A conta
// (pesos, neutro em 50) mora no banco: marketplace_match_partes.
// ============================================================

export type ChaveRequisito = "roi" | "volume" | "evolucao" | "buyin";

export interface Requisito {
  chave: ChaveRequisito;
  /** Quanto pesa no match (30, 25, 25, 20). */
  peso: number;
  pedidoMin: number;
  /** Só no buy-in: o topo da faixa. */
  pedidoMax: number | null;
  /** O número do jogador (buy-in em reais); null = ainda sem dado. */
  meu: number | null;
  /** Buy-in do jogador na moeda da vaga (vaga em dólar). */
  meuNaMoeda: number | null;
  ok: boolean | null;
  /** Pontos (0-100) que o jogador faz nessa parte; 50 = neutro. */
  pontos: number | null;
  /** Pontos se ele passar a bater o pedido (pra dica "subindo X..."). */
  pontosSeBater: number | null;
}

export interface MeuMatch {
  listingId: string;
  match: number;
  requisitos: Requisito[];
  /** Quantos se candidataram (sem contar quem retirou). */
  candidatos: number;
}

export async function fetchMeusMatches(listingIds?: string[]): Promise<Map<string, MeuMatch>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_meus_matches", listingIds ? { p_listing_ids: listingIds } : {});
  if (error) throw error;
  return new Map(
    ((data ?? []) as Record<string, unknown>[]).map((r) => [
      r.listing_id as string,
      {
        listingId: r.listing_id as string,
        match: Number(r.match_score ?? 50),
        candidatos: Number(r.candidatos ?? 0),
        requisitos: ((r.requisitos ?? []) as Record<string, unknown>[]).map((q) => ({
          chave: q.chave as ChaveRequisito,
          peso: Number(q.peso),
          pedidoMin: Number(q.pedido_min),
          pedidoMax: num(q.pedido_max),
          meu: num(q.meu),
          meuNaMoeda: num(q.meu_na_moeda),
          ok: typeof q.ok === "boolean" ? q.ok : null,
          pontos: num(q.pontos),
          pontosSeBater: num(q.pontos_se_bater),
        })),
      },
    ]),
  );
}

/** Requisitos que dá pra comparar (o jogador tem o dado). */
export function requisitosAvaliados(m: Pick<MeuMatch, "requisitos">): Requisito[] {
  return m.requisitos.filter((r) => r.ok !== null);
}

/** Bate tudo o que a vaga pede (vaga sem requisito conta como sim). */
export function bateTudo(m: Pick<MeuMatch, "requisitos">): boolean {
  return m.requisitos.every((r) => r.ok === true);
}

// ============================================================
// O cartão do próprio jogador -- os mesmos números que o time vê na
// candidatura -- e o que falta pra ele ficar completo.
// ============================================================

export interface MeuCartao {
  userId: string;
  nome: string;
  apelido: string | null;
  avatarId: number;
  avatarUrl: string | null;
  maos: number;
  roiPct: number | null;
  abiTorneio: number | null;
  numSessoes: number | null;
  lucroAcumulado: number | null;
  frequenciaSemanalSessoes: number | null;
  scoreGeral: number | null;
  numDrills: number | null;
  taxaAcertoTreinoPct: number | null;
  tempoExperiencia: string | null;
  horarioTreino: string | null;
  diasTreinoSemana: string[] | null;
  procurandoVaga: boolean;
}

export async function fetchMeuCartao(): Promise<MeuCartao | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_meu_cartao");
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    userId: r.user_id as string,
    nome: (r.nome as string) ?? "",
    apelido: (r.apelido as string) ?? null,
    avatarId: Number(r.avatar_id ?? 1),
    avatarUrl: (r.avatar_url as string) ?? null,
    maos: Number(r.hands ?? 0),
    roiPct: num(r.roi_pct),
    abiTorneio: num(r.abi_torneio),
    numSessoes: num(r.num_sessoes),
    lucroAcumulado: num(r.lucro_acumulado),
    frequenciaSemanalSessoes: num(r.frequencia_semanal_sessoes),
    scoreGeral: num(r.score_geral),
    numDrills: num(r.num_drills),
    taxaAcertoTreinoPct: num(r.taxa_acerto_treino_pct),
    tempoExperiencia: (r.tempo_experiencia as string) ?? null,
    horarioTreino: (r.horario_treino as string) ?? null,
    diasTreinoSemana: (r.dias_treino_semana as string[]) ?? null,
    procurandoVaga: Boolean(r.procurando_vaga),
  };
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

function mapApplication(row: Record<string, unknown>): MyApplication | null {
  const listing = row.marketplace_listings as Record<string, unknown> | null;
  if (!listing) return null;
  return {
    id: row.id as string,
    listingId: row.listing_id as string,
    status: row.status as ApplicationStatus,
    matchScore: num(row.match_score),
    message: (row.message as string) ?? null,
    decisionNote: (row.decision_note as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    listing: mapListing(listing),
  };
}

const APPLICATION_SELECT = "id, listing_id, status, match_score, message, decision_note, created_at, updated_at, marketplace_listings(*)";

export async function fetchMyApplications(): Promise<MyApplication[]> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("marketplace_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const apps = (data ?? []).map(mapApplication).filter((a): a is MyApplication => a !== null);
  const listings = await comTimes(apps.map((a) => a.listing));
  return apps.map((a, i) => ({ ...a, listing: listings[i] }));
}

export async function fetchMyApplicationForListing(listingId: string): Promise<MyApplication | null> {
  const supabase = createClient();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("marketplace_applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapApplication(data) : null;
}

const MARKETPLACE_ERROS: Record<string, string> = {
  NAO_AUTENTICADO: "Sessão expirada. Entre de novo.",
  VAGA_INEXISTENTE: "Essa vaga não existe mais.",
  VAGA_FECHADA: "Essa vaga já fechou.",
  CANDIDATURA_JA_EXISTE: "Você já se candidatou a essa vaga.",
  JOGADOR_JA_TEM_TIME: "Esse jogador já faz parte de outro time — ele precisa sair de lá antes de entrar no seu.",
  CANDIDATURA_NAO_PENDENTE: "Essa candidatura já foi decidida.",
  CANDIDATURA_INEXISTENTE_OU_SEM_PERMISSAO: "Essa candidatura não está mais em análise.",
  SEM_PERMISSAO: "Você não tem permissão pra fazer isso.",
  MENSAGEM_VAZIA: "Escreva a mensagem antes de enviar.",
  MENSAGEM_LONGA: "Mensagem longa demais (até 2.000 letras).",
  CONVERSA_ENCERRADA: "A conversa fechou: a candidatura já foi decidida ou retirada.",
  MUITAS_MENSAGENS: "Muitas mensagens seguidas. Espere um pouco e tente de novo.",
};

function erroAmigavel(error: { message: string }): Error {
  return new Error(MARKETPLACE_ERROS[error.message] ?? error.message);
}

export async function applyToListing(listingId: string, message?: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_apply", {
    p_listing_id: listingId,
    p_message: message ?? null,
  });
  if (error) throw erroAmigavel(error);
  return data as string;
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_withdraw_application", { p_application_id: applicationId });
  if (error) throw erroAmigavel(error);
}

export async function decideApplication(applicationId: string, decision: "aceita" | "recusada", reason?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_decide_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) throw erroAmigavel(error);
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
    matchScore: num(row.match_score),
    createdAt: row.created_at as string,
  }));
}

export interface ContagemCandidatos {
  total: number;
  /** Em análise (ainda sem decisão). */
  pendentes: number;
  /** Ids das candidaturas (pra somar mensagens não lidas por vaga). */
  ids: string[];
}

/** Candidaturas das vagas do time, por vaga (sem contar quem retirou). */
export async function fetchContagemCandidatos(listingIds: string[]): Promise<Map<string, ContagemCandidatos>> {
  const out = new Map<string, ContagemCandidatos>();
  if (!listingIds.length) return out;
  const supabase = createClient();
  const { data, error } = await supabase.from("marketplace_applications").select("id, listing_id, status").in("listing_id", listingIds);
  if (error) throw error;
  for (const r of (data ?? []) as { id: string; listing_id: string; status: ApplicationStatus }[]) {
    if (r.status === "retirada") continue;
    const c = out.get(r.listing_id) ?? { total: 0, pendentes: 0, ids: [] };
    c.total += 1;
    if (r.status === "pendente") c.pendentes += 1;
    c.ids.push(r.id);
    out.set(r.listing_id, c);
  }
  return out;
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
  numSessoes: number | null;
  lucroAcumulado: number | null;
  frequenciaSemanalSessoes: number | null;
  scoreGeral: number | null;
  vpipPct: number | null;
  pfrPct: number | null;
  threeBetPct: number | null;
  aggressionFactor: number | null;
  cbetFlopPct: number | null;
  /** Preenchidos em Configurações -- ver TempoExperiencia/HorarioTreino/DiaSemana em profile-service.ts. */
  tempoExperiencia: string | null;
  horarioTreino: string | null;
  diasTreinoSemana: string[] | null;
  status: ApplicationStatus;
  message: string | null;
  appliedAt: string;
  historicoTimes: TeamHistoryEntry[];
  /** Estudo (carreira) -- null antes da migração funil_crm_avancado. */
  numDrills: number | null;
  taxaAcertoTreinoPct: number | null;
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
  if (error) throw erroAmigavel(error);
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
    roiPct: num(r.roi_pct),
    abiTorneio: num(r.abi_torneio),
    numTorneios: r.num_torneios,
    numCash: r.num_cash,
    numSessoes: r.num_sessoes,
    lucroAcumulado: num(r.lucro_acumulado),
    frequenciaSemanalSessoes: num(r.frequencia_semanal_sessoes),
    scoreGeral: num(r.score_geral),
    vpipPct: num(r.vpip_pct),
    pfrPct: num(r.pfr_pct),
    threeBetPct: num(r.three_bet_pct),
    aggressionFactor: num(r.aggression_factor),
    cbetFlopPct: num(r.cbet_flop_pct),
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
    numDrills: r.num_drills ?? null,
    taxaAcertoTreinoPct: num(r.taxa_acerto_treino_pct),
  };
}

// ============================================================
// Conversa da candidatura — o admin/coach do time e quem se candidatou
// conversam antes da decisão. Vale enquanto a candidatura está em
// análise ou foi aceita; tudo passa por RPC (a tabela é fechada).
// ============================================================

export interface MensagemCandidatura {
  id: string;
  /** true = escrita por alguém do time (admin/coach). */
  doTime: boolean;
  minha: boolean;
  autor: string;
  avatarId: number;
  avatarUrl: string | null;
  texto: string;
  criadaEm: string;
  lidaEm: string | null;
}

export async function fetchMensagens(applicationId: string): Promise<MensagemCandidatura[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_mensagens", { p_application_id: applicationId });
  if (error) throw erroAmigavel(error);
  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    doTime: Boolean(m.do_time),
    minha: Boolean(m.minha),
    autor: (m.autor as string) ?? "Alguém",
    avatarId: Number(m.avatar_id ?? 1),
    avatarUrl: (m.avatar_url as string) ?? null,
    texto: m.body as string,
    criadaEm: m.created_at as string,
    lidaEm: (m.read_at as string) ?? null,
  }));
}

export async function enviarMensagem(applicationId: string, texto: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_enviar_mensagem", { p_application_id: applicationId, p_body: texto });
  if (error) throw erroAmigavel(error);
}

/** Disparado quando a pessoa lê mensagens (o badge das abas acompanha). */
export const MENSAGENS_LIDAS = "pokersync:vagas-mensagens-lidas";

export async function marcarMensagensLidas(applicationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("marketplace_marcar_mensagens_lidas", { p_application_id: applicationId });
  if (error) throw erroAmigavel(error);
  window.dispatchEvent(new Event(MENSAGENS_LIDAS));
}

export interface NaoLidas {
  /** Candidatura → quantas mensagens do outro lado ainda sem ler. */
  porCandidatura: Map<string, number>;
  /** Só as das candidaturas da própria pessoa (mensagens do time). */
  minhas: number;
}

export async function fetchNaoLidas(): Promise<NaoLidas> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("marketplace_nao_lidas");
  if (error) throw error;
  const rows = (data ?? []) as { application_id: string; nao_lidas: number; sou_candidato: boolean }[];
  return {
    porCandidatura: new Map(rows.map((r) => [r.application_id, Number(r.nao_lidas)])),
    minhas: rows.filter((r) => r.sou_candidato).reduce((s, r) => s + Number(r.nao_lidas), 0),
  };
}

export const SEM_NAO_LIDAS: NaoLidas = { porCandidatura: new Map(), minhas: 0 };

/** Candidatura aceita ou em análise ainda deixa conversar. */
export function conversaAberta(status: ApplicationStatus): boolean {
  return status === "pendente" || status === "aceita";
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
// Opt-in do alerta de vaga compativel — sem isso, o gatilho
// notify_high_match_candidates (banco) nem considera o jogador, mesmo
// sem time. Fica em profiles.procurando_vaga por ser preferencia do
// jogador, nao da vaga.
// ============================================================

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

export const APPLICATION_STATUS_COLOR: Record<ApplicationStatus, string> = {
  pendente: "#E0B24C",
  aceita: "#2FB89A",
  recusada: "#e0555a",
  retirada: "#8A94A3",
};
