import { createClient } from "@/lib/supabase/client";
import type { HandSession } from "@/lib/services/hand-session-service";
import { fetchHandEvResults } from "@/lib/services/hand-ev-service";
import { fetchTournamentPayouts } from "@/lib/services/tournament-payout-service";
import {
  type AnalysisFilters,
  type AnalysisHandRow,
  type GameFormat,
  type HeroPosition,
  type StackDepthBucket,
  type PotType,
  type PreflopMetrics,
  type PreflopMetricsByPosition,
  type PostflopMetrics,
  type TournamentMetrics,
  type BuyinBucket,
  type PosflopDaMao,
  type RespostaAposta,
  type RuaPosflop,
  HERO_POSITION_ORDER,
  PREFLOP_ACTION_TO_POT_TYPE,
} from "@/types/analysis";

// Sem faixas de referência ("ideal") aqui de propósito: as que existiam
// eram heurística sem fonte auditável, e o produto não mostra faixa que
// não consiga validar. Os números aparecem com a amostra ("x de y").

// ============================================================
// Fonte crua: hand_tags (uma linha por mão, já classificada pelo trigger
// sync_hand_tags) embutido com hand_reviews (data + cartas do herói).
// Tudo daqui pra baixo neste arquivo é derivado no cliente em cima dessa
// lista — sem RPC nova, sem recálculo no banco. RLS de hand_tags e
// hand_reviews já restringe a linhas do próprio usuário.
// ============================================================

function normalizeFormat(raw: string | null | undefined): GameFormat | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "mtt" || v === "torneio") return "mtt";
  if (v === "cash") return "cash";
  if (v === "sng") return "sng";
  if (v === "spin" || v === "spin & go" || v === "hyper") return "spin";
  return null;
}

type AcaoParseada = { player: string; action: string };
type ContextoPreflop = Pick<AnalysisHandRow, "openerPosition" | "rouboLimpo" | "squeezeOpportunity" | "threeBetOpportunity">;

// Lê o preflop do histórico parseado (mesmas regras do hand-parser: o
// "posts" do blind não é decisão). Sem histórico/herói -> tudo null, e a
// mão simplesmente não entra nessas contas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contextoPreflop(parsed: any): ContextoPreflop {
  const vazio: ContextoPreflop = { openerPosition: null, rouboLimpo: null, squeezeOpportunity: null, threeBetOpportunity: null };
  const heroi: string | null = parsed?.heroName ?? null;
  const assentos: { playerName: string; position: string | null }[] = Array.isArray(parsed?.seats) ? parsed.seats : [];
  const rua = Array.isArray(parsed?.streets) ? parsed.streets.find((s: { name: string }) => s.name === "preflop") : null;
  const acoes: AcaoParseada[] = Array.isArray(rua?.actions) ? rua.actions : [];
  if (!heroi || acoes.length === 0) return vazio;

  const posicao = (jogador: string) => assentos.find((a) => a.playerName === jogador)?.position ?? null;
  const iRaise = acoes.findIndex((a) => a.action === "raises");
  const iHeroi = acoes.findIndex((a) => a.player === heroi && a.action !== "posts");
  const openerPosition = iRaise >= 0 ? posicao(acoes[iRaise].player) : null;
  if (iHeroi < 0) return { ...vazio, openerPosition };

  const antes = acoes.slice(0, iHeroi);
  const raisesAntes = antes.filter((a) => a.action === "raises");
  const umRaiseDeOutro = raisesAntes.length === 1 && iRaise >= 0 && iRaise < iHeroi && acoes[iRaise].player !== heroi;
  const entreOpenEHeroi = umRaiseDeOutro ? acoes.slice(iRaise + 1, iHeroi) : [];
  const semLimpAntesDoOpen = iRaise >= 0 && !acoes.slice(0, iRaise).some((a) => a.action === "calls");

  return {
    openerPosition,
    rouboLimpo: umRaiseDeOutro && semLimpAntesDoOpen && entreOpenEHeroi.every((a) => a.action === "folds"),
    squeezeOpportunity: umRaiseDeOutro && entreOpenEHeroi.some((a) => a.action === "calls"),
    threeBetOpportunity: umRaiseDeOutro,
  };
}

// Pós-flop a partir do histórico. Regras (mesmas dos trackers):
// - c-bet: o agressor pré-flop aposta primeiro na rua, sem ninguém ter
//   apostado antes dele; turn/river só contam se ele apostou nas ruas
//   anteriores (2º e 3º tiro).
// - enfrentar c-bet: o agressor pré-flop (outro jogador) faz a primeira
//   aposta da rua, com a linha dele viva; vale a PRÓXIMA ação do herói.
// - donk: herói sem a iniciativa, age antes do agressor no flop e aposta.
// - check-raise: herói dá check, alguém aposta, herói aumenta.
// "allin" conta como aposta/aumento.
const RUAS: RuaPosflop[] = ["flop", "turn", "river"];
const agressiva = (a: string) => a === "bets" || a === "raises" || a === "allin";
const resposta = (a: string | undefined): RespostaAposta | null =>
  a === "folds" ? "fold" : a === "calls" ? "call" : a && agressiva(a) ? "raise" : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contextoPosflop(parsed: any): PosflopDaMao | null {
  const heroi: string | null = parsed?.heroName ?? null;
  const ruas: { name: string; board?: string[]; actions?: AcaoParseada[] }[] = Array.isArray(parsed?.streets) ? parsed.streets : [];
  if (!heroi || ruas.length === 0) return null;
  const acoesDe = (nome: string) =>
    (ruas.find((r) => r.name === nome)?.actions ?? []).filter((a) => a.action !== "uncalled_return" && a.action !== "posts");
  const temRua = (nome: string) => ruas.some((r) => r.name === nome);

  const pre = acoesDe("preflop");
  const raisesPre = pre.filter((a) => agressiva(a.action));
  const agressor = raisesPre.length ? raisesPre[raisesPre.length - 1].player : null;
  const heroiAgressor = agressor === heroi;
  let foldou = pre.some((a) => a.player === heroi && a.action === "folds");

  const viu = { flop: false, turn: false, river: false };
  const cbet: PosflopDaMao["cbet"] = { flop: null, turn: null, river: null };
  const respostaCbet: PosflopDaMao["respostaCbet"] = { flop: null, turn: null, river: null };
  const checkRaise: PosflopDaMao["checkRaise"] = { flop: null, turn: null, river: null };
  let donk: boolean | null = null;
  let linhaHeroi = heroiAgressor;
  let linhaVilao = !!agressor && !heroiAgressor;

  for (const rua of RUAS) {
    if (!temRua(rua) || foldou) {
      linhaHeroi = linhaVilao = false;
      continue;
    }
    viu[rua] = true;
    const acoes = acoesDe(rua);
    const iHeroi = acoes.findIndex((a) => a.player === heroi);
    const iAposta = acoes.findIndex((a) => agressiva(a.action));

    // Herói como agressor: c-bet / 2º / 3º tiro.
    if (linhaHeroi && iHeroi >= 0 && (iAposta < 0 || iAposta >= iHeroi)) {
      cbet[rua] = agressiva(acoes[iHeroi].action);
    }
    linhaHeroi = cbet[rua] === true;

    // Agressor pré-flop (outro) apostando: o que o herói fez em seguida.
    // Só conta se ninguém aumentou no meio (aí o herói já responde a um
    // raise, não à c-bet).
    if (linhaVilao && iAposta >= 0 && acoes[iAposta].player === agressor) {
      const iResp = acoes.findIndex((a, i) => i > iAposta && a.player === heroi);
      const raiseNoMeio = iResp > 0 && acoes.slice(iAposta + 1, iResp).some((a) => agressiva(a.action));
      if (iResp > 0 && !raiseNoMeio) respostaCbet[rua] = resposta(acoes[iResp].action);
    }
    linhaVilao = linhaVilao && iAposta >= 0 && acoes[iAposta].player === agressor;

    // Donk: só no flop, sem a iniciativa, agindo antes do agressor.
    if (rua === "flop" && agressor && !heroiAgressor && iHeroi >= 0) {
      const iAgressor = acoes.findIndex((a) => a.player === agressor);
      if (iAgressor > iHeroi && (iAposta < 0 || iAposta >= iHeroi)) donk = agressiva(acoes[iHeroi].action);
    }

    // Check-raise: check, alguém aposta, e a próxima ação do herói.
    if (iHeroi >= 0 && acoes[iHeroi].action === "checks") {
      const iBetDepois = acoes.findIndex((a, i) => i > iHeroi && agressiva(a.action));
      if (iBetDepois >= 0) {
        const prox = acoes.slice(iBetDepois + 1).find((a) => a.player === heroi);
        if (prox) checkRaise[rua] = agressiva(prox.action);
      }
    }

    if (acoes.some((a) => a.player === heroi && a.action === "folds")) foldou = true;
  }

  const flopRua = ruas.find((r) => r.name === "flop");
  const flop = Array.isArray(flopRua?.board) && flopRua!.board!.length >= 3 ? flopRua!.board!.slice(0, 3) : null;
  return { viu, heroiAgressor, cbet, respostaCbet, donk, checkRaise, flop };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAnalysisHand(r: any): AnalysisHandRow {
  const hr = r.hand_reviews;
  const parsed = hr?.parsed_data ?? null;
  const cards = Array.isArray(parsed?.heroCards) && parsed.heroCards.length === 2 ? (parsed.heroCards as [string, string]) : null;
  return {
    handReviewId: r.hand_review_id,
    playedAt: hr?.created_at ?? r.computed_at,
    format: normalizeFormat(parsed?.format ?? null),
    stakes: parsed?.stakes ?? null,
    heroCards: cards,
    potType: (r.pot_type as PotType) ?? null,
    heroPosition: (r.hero_position as HeroPosition) ?? null,
    matchup: r.matchup ?? null,
    stackDepthBucket: (r.stack_depth_bucket as StackDepthBucket) ?? null,
    tournamentStage: null, // motor ainda não popula tournament_phase (ver docs/cockpit/ROADMAP.md, item MAIN-008)
    vpip: r.vpip,
    pfr: r.pfr,
    threeBet: r.three_bet,
    inPosition: r.in_position,
    isPreflopAggressor: r.is_preflop_aggressor,
    cbetFlop: r.cbet_flop,
    cbetTurn: r.cbet_turn,
    cbetRiver: r.cbet_river,
    doubleBarrel: r.double_barrel,
    tripleBarrel: r.triple_barrel,
    donkBetFlop: r.donk_bet_flop,
    checkRaise: r.check_raise,
    checkRaiseFlop: r.check_raise_flop,
    checkRaiseTurn: r.check_raise_turn,
    checkRaiseRiver: r.check_raise_river,
    foldToCbetFlop: r.fold_to_cbet_flop,
    foldToCbetTurn: r.fold_to_cbet_turn,
    foldToCbetRiver: r.fold_to_cbet_river,
    postflopBetCount: r.postflop_bet_count,
    postflopRaiseCount: r.postflop_raise_count,
    postflopCallCount: r.postflop_call_count,
    postflopFoldCount: r.postflop_fold_count,
    wentToShowdown: r.went_to_showdown,
    wonShowdown: r.won_showdown,
    heroOpenRaise: r.hero_open_raise,
    stealOpportunity: r.steal_opportunity,
    stealAttempt: r.steal_attempt,
    stealSuccess: r.steal_success,
    facedThreeBet: r.hero_faced_3bet,
    foldToThreeBet: r.hero_fold_to_3bet,
    callThreeBet: r.hero_call_3bet,
    madeFourBet: r.hero_made_4bet,
    facedFourBet: r.hero_faced_4bet,
    foldToFourBet: r.hero_fold_to_4bet,
    blindDefenseOpportunity: r.blind_defense_opportunity,
    blindDefended: r.blind_defended,
    reSteal: r.re_steal,
    squeeze: r.squeeze,
    ...contextoPreflop(parsed),
    posflop: contextoPosflop(parsed),
  };
}

// Fontes de hand_reviews que contam como "mão importada" pro Player
// Evolution — pedido explícito: as estatísticas só podem vir de mão/
// torneio importado, nunca de lançamento manual. "agent" é o Radar
// PokerSync sincronizando sozinho; "import" é a importação em lote (ex:
// os arquivos de hand history anexados numa sessão anterior). "manual"
// (colar hand history à mão em Revisor de Mãos → Nova Mão) e "print"
// (upload de print) continuam funcionando normalmente ali — servem pra
// revisar UMA mão pontual — mas não entram nas métricas agregadas daqui.
const IMPORTED_HAND_SOURCES = ["agent", "import"] as const;

// `since` -- corte do botão do Radar dentro do Performance (aba "a partir
// de agora"): quando presente, só entram mãos importadas cujo
// hand_reviews.created_at seja igual ou posterior a esse instante. null/
// undefined = sem corte, comportamento de sempre (mostra tudo importado).
export async function fetchAnalysisHandRows(since?: string | null): Promise<AnalysisHandRow[]> {
  const supabase = createClient();
  // Sem paginação: hoje a base tem ~200 mãos por usuário. Quando o volume
  // crescer (agente desktop em produção), isto precisa virar RPC agregada
  // no Postgres — não filtrar 50k linhas no cliente.
  let query = supabase
    .from("hand_tags")
    .select(
      "hand_review_id, pot_type, hero_position, stack_depth_bucket, matchup, vpip, pfr, three_bet, computed_at, " +
        "in_position, is_preflop_aggressor, cbet_flop, cbet_turn, cbet_river, double_barrel, triple_barrel, donk_bet_flop, " +
        "check_raise, check_raise_flop, check_raise_turn, check_raise_river, " +
        "fold_to_cbet_flop, fold_to_cbet_turn, fold_to_cbet_river, " +
        "postflop_bet_count, postflop_raise_count, postflop_call_count, postflop_fold_count, " +
        "went_to_showdown, won_showdown, " +
        "hero_open_raise, steal_opportunity, steal_attempt, steal_success, hero_faced_3bet, " +
        "hero_fold_to_3bet, hero_call_3bet, hero_made_4bet, hero_faced_4bet, hero_fold_to_4bet, " +
        "blind_defense_opportunity, blind_defended, re_steal, squeeze, " +
        "hand_reviews!inner(created_at, parsed_data, source)"
    )
    .in("hand_reviews.source", IMPORTED_HAND_SOURCES as unknown as string[])
    .order("computed_at", { ascending: true });
  if (since) query = query.gte("hand_reviews.created_at", since);
  const { data, error } = await query;
  if (error) throw error;
  // Filtro do lado do cliente como rede de segurança — o filtro acima em
  // "hand_reviews.source" depende do PostgREST aplicar corretamente num
  // embed com !inner; sem essa segunda checagem, uma mão "manual"/"print"
  // vazaria pras estatísticas se esse filtro não pegar por algum motivo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = (data ?? []).filter((r: any) =>
    (IMPORTED_HAND_SOURCES as readonly string[]).includes(r.hand_reviews?.source)
  );
  return filtered.map(rowToAnalysisHand);
}

// ============================================================
// Filtros
// ============================================================
export function applyAnalysisFilters(rows: AnalysisHandRow[], filters: AnalysisFilters): AnalysisHandRow[] {
  const potTypes: PotType[] = filters.preflopActions.map((a) => PREFLOP_ACTION_TO_POT_TYPE[a]);
  return rows.filter((r) => {
    if (filters.dateRange.from && r.playedAt < filters.dateRange.from) return false;
    if (filters.dateRange.to && r.playedAt > filters.dateRange.to) return false;
    if (filters.formats.length > 0 && (!r.format || !filters.formats.includes(r.format))) return false;
    if (filters.stackDepths.length > 0 && (!r.stackDepthBucket || !filters.stackDepths.includes(r.stackDepthBucket))) return false;
    if (filters.stages.length > 0 && (!r.tournamentStage || !filters.stages.includes(r.tournamentStage))) return false;
    if (filters.positions.length > 0 && (!r.heroPosition || !filters.positions.includes(r.heroPosition))) return false;
    if (potTypes.length > 0 && (!r.potType || !potTypes.includes(r.potType))) return false;
    return true;
  });
}

// ============================================================
// Preflop
// ============================================================
function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function countIf<T>(rows: T[], pred: (r: T) => boolean | null | undefined): number {
  return rows.reduce((acc, r) => acc + (pred(r) ? 1 : 0), 0);
}

export function computePreflopMetrics(rows: AnalysisHandRow[]): PreflopMetrics {
  const hands = rows.length;
  // faced_3bet/faced_4bet/blind_defense_opportunity/steal_opportunity são
  // flags de OPORTUNIDADE — sempre true/false quando o herói foi
  // identificado na mão (null só nas ~poucas mãos sem herói reconhecido).
  // O gate certo é "=== true", não "!== null": filtrar por "!== null"
  // incluiria também as oportunidades que deram false, inflando o
  // denominador com mãos onde a situação nunca aconteceu.
  const stealOpp = rows.filter((r) => r.stealOpportunity === true);
  const stealAttempts = countIf(rows, (r) => r.stealAttempt);
  const facedThreeBet = rows.filter((r) => r.facedThreeBet === true);
  const facedFourBet = rows.filter((r) => r.facedFourBet === true);
  // Fold to steal: o herói no blind, o roubo veio da posição certa e
  // chegou limpo nele (só folds no meio). A posição de quem abriu vem do
  // histórico da mão -- antes usava `matchup`, que só existe quando a mão
  // chega heads-up ao flop, então as vezes em que o herói DESISTIU nunca
  // entravam e o número saía sempre 0%.
  const rouboContra = (heroi: string, ladrao: string) =>
    rows.filter(
      (r) =>
        r.heroPosition === heroi &&
        r.openerPosition === ladrao &&
        r.rouboLimpo === true &&
        r.blindDefenseOpportunity === true,
    );
  const stealVsSbBtn = rouboContra("SB", "BTN");
  const stealVsBbBtn = rouboContra("BB", "BTN");
  const stealVsBbSb = rouboContra("BB", "SB");
  const squeezeOpp = rows.filter((r) => r.squeezeOpportunity === true);
  // 3-Bet % = das vezes em que alguém abriu antes de você (1 raise na
  // mesa na sua vez), quantas você re-aumentou -- convenção HM3/PT4.
  // Antes dividia pelo total de mãos, o que achatava o número.
  const threeBetOpp = rows.filter((r) => r.threeBetOpportunity === true);
  return {
    hands,
    vpip_pct: pct(countIf(rows, (r) => r.vpip), hands),
    pfr_pct: pct(countIf(rows, (r) => r.pfr), hands),
    three_bet_pct: pct(countIf(threeBetOpp, (r) => r.threeBet), threeBetOpp.length),
    fold_to_3bet_pct: pct(countIf(facedThreeBet, (r) => r.foldToThreeBet), facedThreeBet.length),
    // 4-Bet % = quantas vezes o herói 4-betou dado que enfrentou um 3-bet
    // (mesma base de fold_to_3bet/call_3bet, convenção HM3/PT4).
    four_bet_pct: pct(countIf(facedThreeBet, (r) => r.madeFourBet), facedThreeBet.length),
    fold_to_4bet_pct: pct(countIf(facedFourBet, (r) => r.foldToFourBet), facedFourBet.length),
    steal_pct: pct(stealAttempts, stealOpp.length),
    // Defesa de blind já vem separada por posição do herói em
    // blind_defense_opportunity/blind_defended — "fold to steal" é o
    // complemento (1 - defendeu) na mesma amostra.
    fold_to_steal_sb_vs_btn_pct: pct(stealVsSbBtn.length - countIf(stealVsSbBtn, (r) => r.blindDefended), stealVsSbBtn.length),
    fold_to_steal_bb_vs_btn_pct: pct(stealVsBbBtn.length - countIf(stealVsBbBtn, (r) => r.blindDefended), stealVsBbBtn.length),
    fold_to_steal_bb_vs_sb_pct: pct(stealVsBbSb.length - countIf(stealVsBbSb, (r) => r.blindDefended), stealVsBbSb.length),
    // Squeeze % = das vezes em que teve open + call(s) antes de você,
    // quantas você aumentou (antes dividia pelo total de mãos).
    squeeze_pct: pct(countIf(squeezeOpp, (r) => r.squeeze), squeezeOpp.length),
    limp_fold_pct: null, // hand_tags não marca fold pós-limp isoladamente
    open_push_pct: null, // depende de profundidade all-in no open — não classificado no parser ainda
  };
}

export function computePreflopByPosition(rows: AnalysisHandRow[]): PreflopMetricsByPosition[] {
  return HERO_POSITION_ORDER.map((position) => {
    const subset = rows.filter((r) => r.heroPosition === position);
    return { position, ...computePreflopMetrics(subset) };
  }).filter((p) => p.hands > 0);
}

// Tendência de uma métrica ao longo do período filtrado — divide as mãos
// (já ordenadas cronologicamente por fetchAnalysisHandRows) em blocos de
// tamanho igual e recalcula a métrica em cada um, no espírito do
// "Graphing" do HM3/PT4. Bloco por volume de mãos, não por data — sessões
// desiguais no calendário não viram ruído no gráfico. Amostra mínima de
// 30 mãos pro total pra cada ponto ter uma base decente.
export function computeMetricTrend(rows: AnalysisHandRow[], metricFn: (subset: AnalysisHandRow[]) => number | null, buckets = 6): number[] {
  if (rows.length < 30) return [];
  const chunkSize = Math.ceil(rows.length / buckets);
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const value = metricFn(rows.slice(i, i + chunkSize));
    if (value !== null) out.push(value);
  }
  return out;
}

// ============================================================
// Postflop
// ============================================================
// Cada % usa como base só as mãos em que a situação ACONTECEU (lido do
// histórico, ver contextoPosflop). Antes a base eram todas as mãos do
// agressor/não-agressor -- inclusive as que nem viram o flop --, o que
// derrubava c-bet, fold to c-bet, donk, check-raise e ida ao showdown.
export function computePostflopMetrics(rows: AnalysisHandRow[]): PostflopMetrics {
  const com = rows.filter((r) => r.posflop != null);
  const taxaSim = (lista: (boolean | null)[]) => {
    const base = lista.filter((v) => v !== null);
    return pct(base.filter((v) => v === true).length, base.length);
  };
  const cbet = (rua: RuaPosflop) => taxaSim(com.map((r) => r.posflop!.cbet[rua]));
  const foldCbet = (rua: RuaPosflop) => {
    const base = com.map((r) => r.posflop!.respostaCbet[rua]).filter((v) => v !== null);
    return pct(base.filter((v) => v === "fold").length, base.length);
  };
  const checkRaise = (rua: RuaPosflop) => taxaSim(com.map((r) => r.posflop!.checkRaise[rua]));

  const betRaise = rows.reduce((acc, r) => acc + (r.postflopBetCount ?? 0) + (r.postflopRaiseCount ?? 0), 0);
  const calls = rows.reduce((acc, r) => acc + (r.postflopCallCount ?? 0), 0);
  const folds = rows.reduce((acc, r) => acc + (r.postflopFoldCount ?? 0), 0);

  // WTSD = das vezes que viu o flop, quantas foi ao showdown (convenção
  // HM3/PT4); W$SD = dos showdowns, quantos ganhou.
  const viuFlop = com.filter((r) => r.posflop!.viu.flop);
  const reachedShowdown = viuFlop.filter((r) => r.wentToShowdown === true);

  return {
    hands: rows.length,
    cbet_flop_pct: cbet("flop"),
    cbet_turn_pct: cbet("turn"),
    cbet_river_pct: cbet("river"),
    fold_to_cbet_flop_pct: foldCbet("flop"),
    fold_to_cbet_turn_pct: foldCbet("turn"),
    fold_to_cbet_river_pct: foldCbet("river"),
    check_raise_flop_pct: checkRaise("flop"),
    check_raise_turn_pct: checkRaise("turn"),
    check_raise_river_pct: checkRaise("river"),
    donk_bet_pct: taxaSim(com.map((r) => r.posflop!.donk)),
    // AF = (bet+raise) / call. Com 0 calls o AF tradicionalmente não tem
    // teto definido — fica null em vez de Infinity/0 fabricado.
    aggression_factor: calls > 0 ? Math.round((betRaise / calls) * 100) / 100 : null,
    // AFq = (bet+raise) / (bet+raise+call+fold) — convenção HM3/PT4,
    // checks ficam fora do denominador (não são decisão de apostar).
    aggression_frequency_pct: pct(betRaise, betRaise + calls + folds),
    wsd_pct: pct(reachedShowdown.length, viuFlop.length),
    wsd_won_pct: pct(countIf(reachedShowdown, (r) => r.wonShowdown), reachedShowdown.length),
  };
}

// ============================================================
// Torneios — pedido explícito: "total de torneios devem vir dos
// torneios importados e nao do hand history" (leia-se: de tudo que foi
// importado — mãos E resumos de torneio — nunca de bankroll_sessions,
// que é lançamento manual da Gestão de Banca, uma fonte de verdade
// separada). Buy-in vem de hand_sessions (extraído do hand history, em
// USD — ver extractTournamentInfo em hand-session-service.ts); premiação
// vem de tournament_payouts (agente desktop sincronizando o Tournament
// Summary, também em USD).
//
// ROI/ITM/Lucro médio/Torneios por dia/sequências só entram torneios com
// buy-in CONHECIDO (hand_sessions) — um torneio "órfão" (só resumo
// sincronizado, sem mão anexada, sem buy-in) não tem o que comparar a
// premiação, então ficaria como ruído nessas contas. "Torneios"/"Ganhos"
// (que somam TUDO, órfão incluído — pedido explícito de contar todo
// torneio importado) são calculados à parte em StatisticsTab, não aqui.
//
// Limitação assumida: sem linha em tournament_payouts pro torneio, não
// dá pra distinguir "ainda não sincronizou a premiação" de "não fez
// dinheiro" — tratamos como $0 (mesmo critério já usado em StatisticsTab
// pra "Ganhos"), então ROI/ITM/Lucro tendem a ficar um pouco pessimistas
// até o agente sincronizar todos os resumos. Não há contagem de
// re-entry (hand_sessions não modela isso — um torneio com múltiplos
// buy-ins ainda é uma linha só, com um buy-in só).
// cEV/ICM ficam null quando não há hand_ev_results: motor não grava
// chip-equity por mão pra todo torneio (ver docs/cockpit/ROADMAP.md,
// item SOLVER-013).
// ============================================================

// Corte fixo em USD (ver BuyinBucket em types/analysis.ts) — mesmo
// espírito do StackDepthBucket: faixa redonda, não um valor por torneio.
export function buyinBucketOf(buyin: number): BuyinBucket {
  if (buyin <= 10) return "0-10";
  if (buyin <= 50) return "10-50";
  if (buyin <= 200) return "50-200";
  return "200+";
}

// Uma linha de torneio com buy-in conhecido (hand_sessions) — torneio
// "órfão" (só resumo sincronizado, sem mão anexada, sem hand_sessions)
// fica de fora daqui de propósito: sem buy-in não dá pra calcular ROI/
// lucro/ITM daquele torneio (não tem o que comparar a premiação), então
// entraria como ruído nessas métricas. "Torneios"/"Ganhos" (que somam
// TUDO, órfão incluído) são calculados à parte em StatisticsTab.
interface ImportedTournament {
  buyin: number;
  payout: number | null;
  date: string;
}

export async function fetchTournamentMetrics(buyinBuckets: BuyinBucket[] = []): Promise<TournamentMetrics> {
  const [sessionsAll, payouts, evResults, totalBountiesWon] = await Promise.all([
    fetchTournamentSessions(),
    fetchTournamentPayouts(),
    fetchHandEvResults(),
    fetchTotalBountiesWon(),
  ]);
  const payoutByTournament = new Map(payouts.map((p) => [p.tournamentIdPs, p]));

  const tournaments: ImportedTournament[] = sessionsAll
    .filter((s): s is typeof s & { buyin: number } => s.buyin != null)
    .filter((s) => buyinBuckets.length === 0 || buyinBuckets.includes(buyinBucketOf(s.buyin)))
    .map((s) => ({
      buyin: s.buyin,
      payout: (s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps)?.heroPayoutAmount : null) ?? null,
      date: s.updated_at.slice(0, 10),
    }));

  const invested = tournaments.reduce((acc, t) => acc + t.buyin, 0);
  const returned = tournaments.reduce((acc, t) => acc + (t.payout ?? 0), 0);
  const itmCount = tournaments.filter((t) => (t.payout ?? 0) > 0).length;
  // "Jogando desde" / "último torneio" — datas extremas da amostra
  // filtrada, pro resumo financeiro estilo SharkScope (não é a data de
  // cadastro da conta, é desde quando há torneio importado).
  const since = tournaments.reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
  const until = tournaments.reduce<string | null>((max, t) => (max === null || t.date > max ? t.date : max), null);

  // ROI médio é a média do ROI de cada torneio individual, diferente do
  // roi_pct acima (que é o ROI agregado do total investido/total
  // devolvido) — os dois contam histórias diferentes: um pondera pelo
  // tamanho do buy-in, o outro não.
  const avgBuyin = tournaments.length > 0 ? tournaments.reduce((acc, t) => acc + t.buyin, 0) / tournaments.length : null;
  const perGameRois = tournaments
    .map((t) => (t.buyin > 0 ? (((t.payout ?? 0) - t.buyin) / t.buyin) * 100 : null))
    .filter((r): r is number => r !== null);
  const avgRoiPct = perGameRois.length > 0 ? perGameRois.reduce((a, b) => a + b, 0) / perGameRois.length : null;

  // Dias ativos / jogos por dia / dia com mais torneios — agrupado pela
  // data resolvida acima (YYYY-MM-DD), sem depender de horário.
  const gamesByDay = new Map<string, number>();
  const netByDay = new Map<string, number>();
  for (const t of tournaments) {
    gamesByDay.set(t.date, (gamesByDay.get(t.date) ?? 0) + 1);
    const net = (t.payout ?? 0) - t.buyin;
    netByDay.set(t.date, (netByDay.get(t.date) ?? 0) + net);
  }
  const activeDays = gamesByDay.size;
  const busiestDayCount = gamesByDay.size > 0 ? Math.max(...gamesByDay.values()) : 0;

  // Sequências de dias ganhando/perdendo — mesmo espírito do "streak" do
  // SharkScope, dia a dia (não torneio a torneio), em ordem cronológica.
  const dayResults = [...netByDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, net]) => net);
  let daysWon = 0,
    daysLost = 0,
    daysFlat = 0,
    maxWinStreak = 0,
    maxLoseStreak = 0,
    curWinStreak = 0,
    curLoseStreak = 0;
  for (const net of dayResults) {
    if (net > 0) {
      daysWon++;
      curWinStreak++;
      curLoseStreak = 0;
    } else if (net < 0) {
      daysLost++;
      curLoseStreak++;
      curWinStreak = 0;
    } else {
      daysFlat++;
      curWinStreak = 0;
      curLoseStreak = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWinStreak);
    maxLoseStreak = Math.max(maxLoseStreak, curLoseStreak);
  }

  // cEV/$EV só cobre as mãos que passaram por hand_ev_results (all-in
  // heads-up preflop, ambas mostradas, com premiação cadastrada — ver
  // app/api/hand-ev/compute). Amostra pequena de propósito: é só o que
  // dá pra provar com o motor validado hoje, não uma estimativa pro
  // torneio inteiro. Não tem buy-in associado direto (hand_ev_results
  // não guarda isso), então `buyinBuckets` não filtra esses dois números
  // — só Total Games/ROI/ITM/Lucro total, que vêm de `tournaments`.
  const chipEvTotal = evResults.reduce((acc, r) => acc + (r.heroExpectedChipDelta ?? 0), 0);
  const netEvProfit = evResults.reduce((acc, r) => acc + (r.heroExpectedIcmDeltaDollars ?? 0), 0);

  return {
    total_games: tournaments.length,
    roi_pct: invested > 0 ? Math.round(((returned - invested) / invested) * 1000) / 10 : null,
    itm_pct: tournaments.length > 0 ? pct(itmCount, tournaments.length) : null,
    total_profit: tournaments.length > 0 ? Math.round((returned - invested) * 100) / 100 : null,
    total_invested: tournaments.length > 0 ? Math.round(invested * 100) / 100 : null,
    total_cashout: tournaments.length > 0 ? Math.round(returned * 100) / 100 : null,
    since,
    until,
    avg_profit_per_game: tournaments.length > 0 ? Math.round(((returned - invested) / tournaments.length) * 100) / 100 : null,
    avg_buyin: avgBuyin !== null ? Math.round(avgBuyin * 100) / 100 : null,
    avg_roi_pct: avgRoiPct !== null ? Math.round(avgRoiPct * 10) / 10 : null,
    active_days: activeDays,
    games_per_day: activeDays > 0 ? Math.round((tournaments.length / activeDays) * 10) / 10 : null,
    busiest_day_count: busiestDayCount,
    days_won: daysWon,
    days_lost: daysLost,
    days_flat: daysFlat,
    max_win_streak: maxWinStreak,
    max_lose_streak: maxLoseStreak,
    net_ev_profit: evResults.length > 0 ? Math.round(netEvProfit * 100) / 100 : null,
    chip_ev_total: evResults.length > 0 ? Math.round(chipEvTotal * 100) / 100 : null,
    cev_per_game: evResults.length > 0 && tournaments.length > 0 ? Math.round((chipEvTotal / tournaments.length) * 100) / 100 : null,
    ev_roi_pct: evResults.length > 0 && invested > 0 ? Math.round((netEvProfit / invested) * 1000) / 10 : null,
    total_bounties_won: totalBountiesWon.count,
    total_bounty_cash_won: Math.round(totalBountiesWon.cash * 100) / 100,
  };
}

// Soma heroBountiesWon de TODAS as mãos importadas (hand_reviews) do
// jogador — cada mão de torneio PKO/Mystery Bounty em que o herói
// eliminou alguém conta o valor extraído em extractHeroBountiesWon
// (hand-parser.ts). Independe de buy-in/sessão: mãos avulsas coladas
// manualmente no Revisor também contam, mesmo espírito de "Torneios"/
// "Ganhos" (conta tudo que foi importado). Mão sem heroBountiesWon
// (ainda não reprocessada, ou parsed_data nulo) soma 0, nunca quebra.
async function fetchTotalBountiesWon(): Promise<{ count: number; cash: number }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hand_reviews")
    .select("count:parsed_data->>heroBountiesWon, cash:parsed_data->>heroBountyCashWon");
  if (error) throw error;
  return (data ?? []).reduce(
    (acc, row) => {
      const r = row as { count: string | null; cash: string | null };
      return { count: acc.count + (Number(r.count) || 0), cash: acc.cash + (Number(r.cash) || 0) };
    },
    { count: 0, cash: 0 }
  );
}

// Sessões de torneio (hand_sessions, mesmo agrupador do Revisor) — é onde
// a estrutura de premiação se ancora (por tournament_id_ps), pra aparecer
// junto do torneio que o jogador já reconhece, não como tela separada.
//
// Mesma regra de fetchAnalysisHandRows: uma sessão só entra aqui se tiver
// pelo menos uma mão vinculada com source importado (agent/import) --
// colar hand history à mão em Revisor de Mãos → Nova Mão cria/anexa a
// uma hand_sessions do mesmo jeito que uma mão do agente, então sem esse
// filtro um torneio inteiro entraria no Player Evolution (Torneios,
// buy-ins investidos, Estrutura de premiação) só por causa de UMA mão
// colada manualmente. Duas consultas em vez de embed+!inner porque
// PostgREST devolveria uma linha de hand_sessions por hand_review
// batendo no filtro (duplicando sessão com mais de uma mão elegível).
// ============================================================
// Resetar Performance — pedido explícito: "se o jogador quiser começar
// do zero, ele tem essa escolha". Apaga só hand_tags (a fonte crua de
// TODAS as métricas computadas neste arquivo) — as mãos continuam
// existindo no Revisor de Mãos e os torneios na Gestão de Banca, então
// esse reset é só do que o Performance mostra, não um apagão geral.
// Junto, limpa profiles.radar_import_scope pra o Radar voltar a
// perguntar o escopo de importação (pedido explícito: "volta a
// perguntar" — combina com "começar do zero", especialmente se o
// jogador quer mudar de ideia sobre importar histórico completo ou não).
//
// hand_tags NÃO fica "morto" pra sempre: qualquer edição futura na
// mesma mão em hand_reviews (ex: editar marcador, salvar spot) dispara
// de novo o trigger hand_reviews_sync_tags_trigger → sync_hand_tags(),
// recriando a linha daquela mão específica. Isso é esperado (mesmo
// mecanismo que já existe pro resto do produto), não um bug do reset.
export async function resetPerformanceStats(): Promise<void> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) throw new Error("NAO_AUTENTICADO");

  const { error: eTags } = await supabase.from("hand_tags").delete().eq("user_id", userData.user.id);
  if (eTags) throw eTags;

  const { error: eProfile } = await supabase
    .from("profiles")
    // radar_scope_performance/_since junto: mesmo pedido de "volta a
    // perguntar" agora vale também pro corte de exibição do botão do
    // Radar dentro do Performance (ver radar-module-scope-service.ts).
    .update({ radar_import_scope: null, radar_scope_performance: null, radar_scope_performance_since: null })
    .eq("id", userData.user.id);
  if (eProfile) throw eProfile;
}

export async function fetchTournamentSessions(): Promise<HandSession[]> {
  const supabase = createClient();
  const [{ data, error }, { data: importedReviews, error: eReviews }] = await Promise.all([
    supabase.from("hand_sessions").select("*").eq("kind", "tournament").not("tournament_id_ps", "is", null).order("updated_at", { ascending: false }),
    supabase.from("hand_reviews").select("hand_session_id").not("hand_session_id", "is", null).in("source", IMPORTED_HAND_SOURCES as unknown as string[]),
  ]);
  if (error) throw error;
  if (eReviews) throw eReviews;
  const importedSessionIds = new Set((importedReviews ?? []).map((r) => r.hand_session_id as string));
  return ((data ?? []) as HandSession[]).filter((s) => importedSessionIds.has(s.id));
}

