import { createClient } from "@/lib/supabase/client";
import type { ParsedHand } from "@/lib/poker/hand-parser";
import { nomeEhDeBounty, nomeTorneioDoArquivoAcr } from "@/lib/poker/acr-arquivos";
import { addSession, fetchBountiesDosTorneios } from "@/lib/services/bankroll-service";
import { linkHandSessionReviews } from "@/lib/services/hand-review-service";
import { fetchTournamentPayouts } from "@/lib/services/tournament-payout-service";
import { todayISO } from "@/lib/bankroll/format";
import { plataformaDoRotulo } from "@/lib/bankroll/platforms";
import { buyinNoNome } from "@/lib/format";
import { garantirRebuysCalculados, recalcularRebuys } from "@/lib/services/tournament-rebuy-service";

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
  // Rebuys/re-entries detectados sozinhos nas maos (ver rebuy-detector.ts):
  // o buy-in acima e' so' o da entrada inicial, o custo real do torneio e'
  // buyin * (1 + reentries). reentries_checked_at null = torneio antigo que
  // ainda nao passou pelo detector (ver garantirRebuysCalculados).
  reentries: number;
  reentries_checked_at: string | null;
  // Tamanho da mesa declarado nas maos ("3-max" = Spin & Go).
  table_size: number | null;
  stakes: string | null;
  // Campeao automatico (2026-08): true quando alguma mao anexada a essa
  // sessao e' a mao final do torneio vencida pelo heroi (ver
  // ParsedHand.wonTournament em hand-parser.ts). Alimenta o icone de
  // taca na lista de torneios — nunca setado manualmente pelo jogador.
  champion: boolean;
  // 2 ou 3 quando a posicao final do heroi no torneio foi detectada
  // (ver ParsedHand.heroFinishPlace) e for top-3 sem ser campeao. Null
  // caso contrario (nao detectado, ou fora do podio).
  final_place: number | null;
  // true quando o heroi foi eliminado dentro do tamanho da mesa final
  // (heuristica: heroFinishPlace <= maxSeats da mao de eliminacao) mas
  // NAO ficou entre os 3 primeiros. Selo "FT" na lista de torneios.
  reached_ft: boolean;
  // true quando o jogador excluiu manualmente a sessao de banca que tinha
  // sido importada a partir deste torneio (ver excludeSessionFromBankroll)
  // -- so' controla se a sincronizacao automatica agente->banca (Gestao de
  // Banca) pode recriar essa sessao; nunca filtra Player Evolution/Revisor,
  // que continuam vendo o torneio normalmente.
  bankroll_excluded: boolean;
  created_at: string;
  updated_at: string;
  // Data da última mão jogada no torneio -- só preenchido por
  // fetchTournamentSessions (analysis-service.ts), não é coluna.
  last_played_at?: string | null;
}

export interface HandSessionWithCount extends HandSession {
  hand_count: number;
  last_hand_at: string | null;
}

// Detalhes que a UI pede pro parser na hora de propor um label razoavel
// pra sessao nova. Extraido do ParsedHand + heuristica: o nome do torneio
// e' a parte do texto antes do "-" na primeira linha ("PokerStars Hand #X:
// Tournament #Y, $5+$0.50 USD Hold'em No Limit - Level V").
interface ParsedTournamentInfo {
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
// `nomeArquivo` (opcional, vem do Radar): na ACR o nome do torneio e o
// "PKO" só existem no nome do arquivo de mãos (ver acr-arquivos.ts).
export function extractTournamentInfo(hand: ParsedHand, nomeArquivo?: string | null): ParsedTournamentInfo {
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

  const platform = hand.site === "pokerstars" ? "PokerStars" : hand.site === "acr" ? "ACR" : hand.site ?? null;

  // Bounty do heroi: procura o assento do heroi (isHero) e le bountyValue,
  // ja capturado pelo hand-parser.ts a partir do sufixo "Bounty de $ X" /
  // "Bounty of $ X" junto do stack. Se o heroi nao foi identificado ou o
  // formato nao tem bounty visivel, fica null — modal pede digitado nesse caso.
  const heroSeat = hand.seats.find((s) => s.isHero);
  const heroBountyFromHand = heroSeat?.bountyValue ?? null;
  const nomeAcr = hand.site === "acr" ? nomeTorneioDoArquivoAcr(nomeArquivo) : null;
  const looksLikeBounty = hand.seats.some((s) => s.bountyValue != null) || nomeEhDeBounty(nomeAcr);

  // Nome curto do card do torneio — formato "Plataforma / Buy-in", pedido
  // explicito pra dar contexto imediato na fila. Fallback pra "Torneio #ID"
  // quando buy-in nao parseou.
  const tournamentName = platform && buyin != null
    ? `${platform} / ${buyinNoNome(buyin)}`
    : platform && nomeAcr
      ? `${platform} / ${nomeAcr}`
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
  return garantirRebuysCalculados(supabase, (data ?? []) as HandSessionWithCount[]);
}

/** Exclui um torneio/sessão do Revisor com todas as mãos dele (pedido
 *  explícito: botão de excluir em cada card). As análises, marcadores e
 *  EV das mãos saem junto (ON DELETE CASCADE). A sessão da Gestão de
 *  Banca que veio dele fica -- é dinheiro que de fato entrou/saiu --, só
 *  perde o vínculo (imported_hand_session_id vira null). */
export async function excluirTorneio(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error: eMaos } = await supabase.from("hand_reviews").delete().eq("hand_session_id", sessionId);
  if (eMaos) throw eMaos;
  const { error } = await supabase.from("hand_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

export function isSpinAndGo(s: Pick<HandSession, "kind" | "table_size">): boolean {
  return s.kind === "tournament" && s.table_size === 3;
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
async function touchSession(sessionId: string) {
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
// `hands` (opcional): as ParsedHand correspondentes aos reviewIds, ja
// disponiveis no batch de import — usadas so pra checar campeao
// automatico, sem precisar reparsear nada.
export async function attachReviewsToSession(reviewIds: string[], sessionId: string, hands?: ParsedHand[]) {
  if (reviewIds.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("hand_reviews")
    .update({ hand_session_id: sessionId })
    .in("id", reviewIds);
  if (error) throw error;

  // Campeao automatico: qualquer mao do lote sendo a mao final do
  // torneio vencida pelo heroi marca a sessao inteira como campeao.
  // So promove pra true (nunca reverte aqui) — reimportar maos de um
  // torneio ja vencido nao deveria "desmarcar" a taca.
  const isChampion = (hands ?? []).some((h) => h.wonTournament && !!h.heroName && h.winner === h.heroName);
  if (isChampion) {
    const { error: champErr } = await supabase.from("hand_sessions").update({ champion: true }).eq("id", sessionId);
    if (champErr) throw champErr;
  }

  // 2o/3o lugar e FT: procura a mao de eliminacao do heroi no lote (a
  // que tem heroFinishPlace preenchido). So 1 mao deveria ter isso (a
  // ultima que ele jogou no torneio). Heuristica de FT: eliminado dentro
  // do tamanho da mesa final da propria mao (maxSeats) sem ser top-3 —
  // ver comentario em ParsedHand.heroFinishPlace sobre a cautela aqui.
  const finishHand = (hands ?? []).find((h) => h.heroFinishPlace != null);
  if (finishHand?.heroFinishPlace != null && !isChampion) {
    const place = finishHand.heroFinishPlace;
    const patch =
      place === 2 || place === 3
        ? { final_place: place }
        : finishHand.maxSeats != null && place <= finishHand.maxSeats
          ? { reached_ft: true }
          : null;
    if (patch) {
      const { error: placeErr } = await supabase.from("hand_sessions").update(patch).eq("id", sessionId);
      if (placeErr) throw placeErr;
    }
  }

  const tableSize = Math.max(0, ...(hands ?? []).map((h) => h.maxSeats ?? 0));
  if (tableSize > 0) {
    await supabase.from("hand_sessions").update({ table_size: tableSize }).eq("id", sessionId).is("table_size", null);
  }
  await recalcularRebuys(supabase, [sessionId]);

  await touchSession(sessionId);
}

// Cria (ou reaproveita) a sessão de banca correspondente a um torneio
// importado, ligando pelo mesmo campo que app/banca/page.tsx já usava só
// pro fluxo do agente (bankroll_sessions.imported_hand_session_id) --
// extraído pra cá pra ser reaproveitado também na importação manual
// (Análise/Revisor), que antes deixava o jogador sem nenhum jeito de
// preencher a Banca automaticamente a partir de uma mão colada.
//
// So' cria pra TORNEIO (buyin conhecido) -- cash game nao tem um
// "buyin"/"resultado" que de' pra inferir so' do hand history (falta
// duracao da sessao, por exemplo), entao fica de fora aqui, igual o
// fluxo do agente ja fazia.
//
// Buy-in/premiacao do hand history vem sempre em USD (mesma convencao
// documentada em app/banca/page.tsx) -- grava em USD mesmo, SEM
// converter pra BRL aqui (antes convertia e gravava currency:"BRL",
// perdendo a moeda original -- misturava com sessoes em reais no
// extrato por moeda). A conversao pra reais so acontece na consolidacao
// final (consolidarEmReais), igual ja acontecia com lancamento manual em
// moeda estrangeira. Rebuys (handSession.reentries) somam no custo total
// igual ja fazia o lancamento manual da Banca.
export async function linkOrCreateBankrollSessionForTournament(params: {
  userId: string;
  handSession: HandSession;
}): Promise<{ created: boolean; bankrollSessionId: string } | null> {
  // userId nao e' usado aqui -- addSession() resolve o dono via
  // getUserId() internamente (mesma convencao do resto do bankroll-service).
  const { handSession } = params;
  if (handSession.kind !== "tournament" || handSession.buyin == null) return null;

  const supabase = createClient();

  // Ja existe sessao de banca ligada a essa sessao de maos? Nao duplica --
  // so' retorna a existente (created:false).
  const { data: existing, error: existingErr } = await supabase
    .from("bankroll_sessions")
    .select("id")
    .eq("imported_hand_session_id", handSession.id)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) return { created: false, bankrollSessionId: existing[0].id };

  let cashoutUsd = 0;
  if (handSession.tournament_id_ps) {
    const payouts = await fetchTournamentPayouts();
    const payout = payouts.find((p) => p.tournamentIdPs === handSession.tournament_id_ps);
    cashoutUsd = payout?.heroPayoutAmount ?? 0;
  }

  // Lido de novo do banco: o objeto recebido pode ser de antes do detector
  // de rebuy rodar pras mãos recém-anexadas.
  const { data: atual } = await supabase.from("hand_sessions").select("reentries, table_size").eq("id", handSession.id).maybeSingle();
  const reentries = atual?.reentries ?? handSession.reentries ?? 0;
  const tableSize = atual?.table_size ?? handSession.table_size ?? null;

  // Bounties ganhos no torneio, somados das mãos (a Banca ainda confere
  // de novo a cada visita, ver sincronizarBounties em use-banca.ts).
  const bounties = await fetchBountiesDosTorneios()
    .then((m) => m.get(handSession.id) ?? 0)
    .catch(() => 0);

  const rawVenue = plataformaDoRotulo((handSession.label.split(" / ")[0] || "").trim());
  const saved = await addSession({
    date: handSession.updated_at?.slice(0, 10) || todayISO(),
    format: isSpinAndGo({ kind: handSession.kind, table_size: tableSize }) ? "Spin" : "MTT",
    buyIn: handSession.buyin ?? 0,
    reentries,
    cashout: cashoutUsd,
    bounties,
    stake: "",
    venue: rawVenue || undefined,
    currency: "USD",
    notes: `Importado via hand history — ${handSession.label}`,
    importedHandSessionId: handSession.id,
  });
  await linkHandSessionReviews(handSession.id, saved.id);

  return { created: true, bankrollSessionId: saved.id };
}

// Marca o torneio pra nunca mais ser recriado automaticamente na Gestão
// de Banca -- chamado quando o jogador exclui, na tela da Banca, uma
// sessão que tinha sido importada de um torneio (bankroll_sessions.
// imported_hand_session_id). Sem essa marcação, a sincronização
// automática agente->banca (ver app/banca/page.tsx, pendingAgentTournaments)
// via de volta e recriava a sessão no próximo carregamento, porque
// excluir da Banca nunca apaga o torneio/mãos no Revisor (pedido
// explícito, fontes de verdade separadas) -- então o torneio continuava
// aparecendo como "pendente de importar". Só afeta esse sync; Player
// Evolution e Revisor de Mãos continuam vendo o torneio normalmente.
export async function excludeSessionFromBankroll(handSessionId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("hand_sessions").update({ bankroll_excluded: true }).eq("id", handSessionId);
  if (error) throw error;
}
