import { createClient } from "@/lib/supabase/client";
import type { ParsedHand } from "@/lib/poker/hand-parser";

// Camada de servico do novo agrupador do Revisor. Torneios sao unicos por
// (user_id, tournament_id_ps) — quando o parser identifica esses campos na
// mao colada, a UI usa findExistingTournamentSession pra decidir se abre o
// modal "anexar/criar novo".

export type HandSessionKind = "tournament" | "cash";
export type FormatType = "regular" | "pko" | "mystery";

export interface HandSession {
  id: string;
  user_id: string;
  kind: HandSessionKind;
  label: string;
  tournament_id_ps: string | null;
  format_type: FormatType | null;
  bounty_current: number | null;
  buyin: number | null;
  stakes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandSessionWithCount extends HandSession {
  hand_count: number;
  last_hand_at: string | null;
}

// Detalhes que a UI pede pro parser na hora de propor um label razoavel
// pra sessao nova. Extraido do ParsedHand + heuristica: o nome do torneio
// e' a parte do texto antes do "-" na primeira linha ("PokerStars Hand #X:
// Tournament #Y, $5+$0.50 USD Hold'em No Limit - Level V").
export interface ParsedTournamentInfo {
  tournamentIdPs: string | null;
  tournamentName: string | null;
  buyin: number | null;
  platform: string | null;
  // Bounty do heroi lido diretamente do hand history (seat do heroi tem
  // sufixo ", Bounty de $ X" em torneios PKO/Mystery) — "ler automatico"
  // em vez de pedir digitado. Null quando o formato nao tem bounty visivel
  // no HH (regular) ou o heroi nao foi identificado na mao.
  heroBountyFromHand: number | null;
  // true quando QUALQUER assento da mao tem valor de bounty — sinal forte
  // de torneio PKO (Mystery Bounty tambem pode aparecer assim dependendo
  // do formato exato do HH). Usado pra pre-selecionar "PKO" no modal em
  // vez de "Regular", o jogador ainda pode trocar pra Mystery se for o caso.
  looksLikeBounty: boolean;
}

// Extrai id do torneio + buy-in + plataforma + bounty do cabecalho e dos
// assentos. Bilingue (2026-08): "Tournament #" (EN) e "Torneio #" (PT-BR)
// — hand-parser.ts ja normaliza o resto, mas essa extracao roda direto no
// rawText pra pegar detalhes que ParsedHand nao guarda em campo proprio
// (buy-in, nome do torneio).
export function extractTournamentInfo(hand: ParsedHand): ParsedTournamentInfo {
  const text = hand.rawText;
  const tournM = text.match(/(?:Tournament|Torneio)\s+#(\d+)/i);
  const tournamentIdPs = tournM ? tournM[1] : null;

  // Buy-in aparece como "$X+$Y USD" (2 partes, formato comum) ou "$X+$Y+$Z
  // USD" (3 partes — buy-in + bounty pool + rake, tipico de PKO em PT-BR:
  // "$ 50+$ 50+$ 9 USD"). Soma todas as partes presentes = custo total de
  // entrada. Aceita "$" com espaco depois (client PT-BR insere: "$ 50").
  let buyin: number | null = null;
  const buyinM = text.match(
    /(?:Tournament|Torneio)\s+#\d+,\s+\$?\s?([\d.,]+)\+\$?\s?([\d.,]+)(?:\+\$?\s?([\d.,]+))?\s+USD/i
  );
  if (buyinM) {
    const parts = [buyinM[1], buyinM[2], buyinM[3]]
      .filter(Boolean)
      .map((p) => Number(p!.replace(",", ".")))
      .filter((n) => Number.isFinite(n));
    if (parts.length > 0) buyin = Math.round(parts.reduce((s, n) => s + n, 0) * 100) / 100;
  }

  const platform = hand.site === "pokerstars" ? "PokerStars" : hand.site ?? null;

  // Bounty do heroi: procura o assento do heroi (isHero) e le bountyValue,
  // ja capturado pelo hand-parser.ts a partir do sufixo "Bounty de $ X" /
  // "Bounty of $ X" junto do stack. Se o heroi nao foi identificado ou o
  // formato nao tem bounty visivel, fica null — modal pede digitado nesse caso.
  const heroSeat = hand.seats.find((s) => s.isHero);
  const heroBountyFromHand = heroSeat?.bountyValue ?? null;
  const looksLikeBounty = hand.seats.some((s) => s.bountyValue != null);

  // Nome curto do card do torneio — formato "Plataforma / Buy-in", pedido
  // explicito pra dar contexto imediato na fila. Fallback pra "Torneio #ID"
  // quando buy-in nao parseou.
  const tournamentName = platform && buyin != null
    ? `${platform} / $${buyin}`
    : tournamentIdPs
      ? `Torneio #${tournamentIdPs}`
      : null;

  return { tournamentIdPs, tournamentName, buyin, platform, heroBountyFromHand, looksLikeBounty };
}

export async function findExistingTournamentSession(
  userId: string,
  tournamentIdPs: string
): Promise<HandSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "tournament")
    .eq("tournament_id_ps", tournamentIdPs)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Cria sessao nova a partir do dado ja resolvido no modal (tipo + bounty).
// Nunca sobrescreve label depois — o card fica com o nome escolhido no momento
// da criacao, ao anexar mao nova a gente so bumpa updated_at.
export async function createTournamentSession(params: {
  userId: string;
  label: string;
  tournamentIdPs: string | null;
  formatType: FormatType;
  bountyCurrent: number | null;
  buyin: number | null;
}): Promise<HandSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sessions")
    .insert({
      user_id: params.userId,
      kind: "tournament",
      label: params.label,
      tournament_id_ps: params.tournamentIdPs,
      format_type: params.formatType,
      bounty_current: params.bountyCurrent,
      buyin: params.buyin,
      stakes: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cash game — agrupado por stakes (nao por tournament id). A UI pode reusar
// uma sessao de cash existente pesquisando por (user_id, kind='cash', stakes).
export async function createCashSession(params: {
  userId: string;
  label: string;
  stakes: string | null;
}): Promise<HandSession> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sessions")
    .insert({
      user_id: params.userId,
      kind: "cash",
      label: params.label,
      tournament_id_ps: null,
      format_type: null,
      bounty_current: null,
      buyin: null,
      stakes: params.stakes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findExistingCashSession(
  userId: string,
  stakes: string | null
): Promise<HandSession | null> {
  if (!stakes) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "cash")
    .eq("stakes", stakes)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Lista sessoes do usuario pra fila do Revisor. Contagem de maos e' feita
// em SQL agregado (rpc dedicado) pra nao explodir em N+1. Ordenacao:
// mais recentes primeiro (por updated_at do agrupador).
export async function listSessionsWithCount(userId: string): Promise<HandSessionWithCount[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_hand_sessions_with_count", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? []) as HandSessionWithCount[];
}

export async function updateSessionBounty(sessionId: string, bountyCurrent: number | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("hand_sessions")
    .update({ bounty_current: bountyCurrent, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

// Bumpa updated_at pra sessao aparecer no topo da fila. Chamado depois de
// anexar mao nova a uma sessao existente — o INSERT de hand_review sozinho
// nao dispara isso porque hand_reviews e sessions estao em tabelas diferentes.
export async function touchSession(sessionId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("hand_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

// Vincula hand_reviews recem-importadas (via importSelectedHands, que nao
// conhece sessao) a uma hand_sessions ja resolvida (criada ou existente).
// Chamado logo apos o import batch confirmar — update em lote pelos ids
// retornados, sem precisar tocar em hand-review-service.ts.
export async function attachReviewsToSession(reviewIds: string[], sessionId: string) {
  if (reviewIds.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("hand_reviews")
    .update({ hand_session_id: sessionId })
    .in("id", reviewIds);
  if (error) throw error;
  await touchSession(sessionId);
}
