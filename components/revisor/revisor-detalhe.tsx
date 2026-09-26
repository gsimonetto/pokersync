"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, CheckCircle2, Check, Loader2, Scale, Share2, Trophy, Tag as TagIcon, Plus, Wallet, Gauge, Bookmark } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import {
  getReview,
  getThumbUrl,
  suggestGuidedQuestions,
  saveAnswers,
  updateReviewProgress,
  saveMinimalTicket,
  STREETS,
  RATINGS,
  fetchReasons,
  fetchStreetEvals,
  saveStreetEvals,
  registerReviewEvent,
  fetchTags,
  createUserTag,
  updateReviewTags,
  fetchRecentBankrollSessions,
  fetchBankrollSessionById,
  linkReviewToSession,
  setSpotSaved,
  type ReviewDetail,
  type ReviewAnswer,
  type StreetEval,
  type Reason,
  type Street,
  type ManualTicket,
  type Tag,
  type BankrollSessionOption,
} from "@/lib/services/hand-review-service";
import { parseHand, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { findEligibleAllInConfrontation } from "@/lib/poker/hand-ev-eligibility";
import { computeHandEv, fetchHandEvResult, type HandEvResult } from "@/lib/services/hand-ev-service";
import { CoachThread } from "./coach-thread";
import { ResumoDaMao } from "./resumo-da-mao";
import { CartaTexto, NOME_RUA, nomesDosRaises, rotuloAcao } from "./linha-do-tempo";
import { projectHandAtStep } from "@/lib/poker/hand-replay-projector";
import { ShareHandModal } from "./share-hand-modal";

const FORMATS = ["MTT", "Cash", "SNG", "Spin"];

// Ruas em que o heroi DECIDIU alguma coisa (acao alem de blind/ante) --
// so' essas pedem avaliacao. All-in no pre-flop, fold no pre-flop etc.
// deixam flop/turn/river de fora (o board ate' sai, mas nao ha decisao
// sua pra avaliar). Pre-flop sempre conta. Sem hand history: as 4.
function ruasComDecisao(mao: ParsedHand | null): string[] {
  if (!mao?.heroName || !mao.streets) return [...STREETS];
  const comAcao = new Set(
    mao.streets.filter((st) => st.actions.some((a) => a.player === mao.heroName && a.action !== "posts")).map((st) => st.name)
  );
  return STREETS.filter((s, i) => i === 0 || comAcao.has(s));
}
const ACTIONS = ["Fold", "Call", "Raise", "Check", "Bet", "All-in"];
// Notas da autoavaliação (mesmos códigos de sempre). "N/A" não aparece mais
// como opção: rua sem decisão sua já entra sozinha como N/A e nem aparece.
const OPCOES_AVALIACAO = RATINGS.filter((r) => r.code !== "nao_se_aplica").map((r) =>
  r.code === "duvida" ? { ...r, label: "Fiquei na dúvida" } : { ...r }
);

export function RevisorDetalhe({ reviewId, onBack }: { reviewId: string; onBack: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [qas, setQas] = useState<ReviewAnswer[]>([]);
  const [learning, setLearning] = useState("");
  const [drill, setDrill] = useState("");
  const [imgUrls, setImgUrls] = useState<(string | null)[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [streetEvals, setStreetEvals] = useState<StreetEval[]>(
    STREETS.map((s) => ({ street: s, self_rating: "", reason_code: "", notes: "" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xpFeedback, setXpFeedback] = useState<{ xp: number; missions: any[] } | null>(null);
  // Ultima mao de torneio vencida pelo heroi (ParsedHand.wonTournament +
  // heroi = quem levou o pote) — dispara a animacao de taca antes de
  // voltar pra tabela de torneios.
  const [showChampion, setShowChampion] = useState(false);

  const [parsedHandForTable, setParsedHandForTable] = useState<ParsedHand | null>(null);
  // Teste da ponte produto -> pokersync-solver (16/09/2026): botao manual
  // pra calcular cEV/ICM de mao all-in elegivel -- so' aparece quando
  // findEligibleAllInConfrontation(parsedHandForTable) acha um confronto
  // de verdade. evEligible fica memorizado no proprio estado (nao e'
  // recalculado a cada render) porque parsedHandForTable so muda quando a
  // mao carrega.
  const [evResult, setEvResult] = useState<HandEvResult | null>(null);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState("");
  // So existe quando a mao veio da aba Aderencia a Range (ver
  // aderencia-range.tsx) -- ja' calculado la' contra o range+posicao que
  // o jogador escolheu explicitamente, nunca inferido aqui.
  const [objectiveVerdict, setObjectiveVerdict] = useState<{
    verdict: Verdict;
    heroAction: string;
    decision: { fold: number; call: number; raise: number };
    rangeName: string | null;
    position: string;
  } | null>(null);

  const [ticket, setTicket] = useState<ManualTicket>({ format: "", street: "preflop" as Street, action: "" });
  const [ticketSaved, setTicketSaved] = useState(false);

  // Marcadores editaveis (pedido explicito) — antes so' dava pra
  // escolher na criacao da mao avulsa; agora edita direto na tela de
  // revisao, reusando o mesmo padrao de chip.
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [reviewTagIds, setReviewTagIds] = useState<string[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  // Modal de compartilhamento com o coach do time (base minima de Times:
  // role coach/jogador em team_members) -- unico jeito de compartilhar
  // mao nessa tela agora (pedido explicito: "existem 2 botões de
  // compartilhar" -- o botao generico de compartilhamento nativo do
  // aparelho saiu, so' sobra esse). A propria modal (ShareHandModal) ja
  // busca os coaches do time e mostra um aviso se o jogador nao tiver
  // nenhum vinculado, entao essa tela nao precisa saber disso de antemao.
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Vinculo com sessao de banca -- antes era write-only na criacao da
  // mao, sem jeito de corrigir/desvincular depois nem de ver aqui qual
  // sessao ja estava vinculada.
  const [linkedSession, setLinkedSession] = useState<BankrollSessionOption | null>(null);
  const [recentSessions, setRecentSessions] = useState<BankrollSessionOption[]>([]);
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  // "Salvar spot" -- mãos que valeram a pena guardar pra rever depois,
  // com biblioteca própria (ver RevisorSpotsSalvos) separada da fila
  // normal. Otimista: atualiza a tela na hora, desfaz se a chamada falhar.
  const [savingSpot, setSavingSpot] = useState(false);
  async function toggleSaved() {
    if (!review || savingSpot) return;
    const next = !review.saved;
    setReview({ ...review, saved: next });
    setSavingSpot(true);
    try {
      await setSpotSaved(review.id, next);
    } catch {
      setReview((r) => (r ? { ...r, saved: !next } : r));
      setError("Erro ao salvar o spot.");
    } finally {
      setSavingSpot(false);
    }
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id || null;
      setUserId(uid);
      await load();
      if (uid) {
        fetchTags()
          .then(setAllTags)
          .catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]);

  async function load() {
    setLoading(true);
    setEvResult(null);
    setEvError("");
    try {
      const r = await getReview(reviewId);
      setReview(r);
      setLearning(r.learning_note || "");
      setDrill(r.drill_suggestion || "");

      // Reparseia o hand history bruto quando existe (mesma regra da tela
      // da sessao: correcoes do parser chegam nas maos ja importadas) e so'
      // cai no parsed_data salvo quando nao ha texto.
      let mao: ParsedHand | null = null;
      if (r.hand_history) {
        try {
          mao = parseHand(r.hand_history);
        } catch (e) {
          if (!(e instanceof HandParseError)) {
            console.warn("[RevisorDetalhe] hand history nao parseavel:", e);
          }
        }
      }
      if (!mao && r.parsed_data?.kind === "parsed") mao = r.parsed_data as ParsedHand;
      setParsedHandForTable(mao);
      setObjectiveVerdict(r.parsed_data?.kind === "parsed" ? r.parsed_data.objectiveVerdict ?? null : null);
      if (mao && findEligibleAllInConfrontation(mao)) {
        fetchHandEvResult(reviewId)
          .then(setEvResult)
          .catch(() => {});
      }

      const existing = r.answers || [];
      const questions = existing.length
        ? existing.map((a) => ({ question: a.question, answer: a.answer || "" }))
        : suggestGuidedQuestions(r.tags, mao ? { board: mao.board, heroPosition: mao.heroPosition } : null).map((q) => ({
            question: q,
            answer: "",
          }));
      setQas(questions);
      setReviewTagIds(r.tags.map((t) => t.id));

      const [rs, existingEvals] = await Promise.all([fetchReasons(), fetchStreetEvals(reviewId)]);
      setReasons(rs);
      if (existingEvals.length) {
        setStreetEvals(
          STREETS.map((s) => {
            const found = existingEvals.find((e) => e.street === s);
            return found
              ? {
                  street: s,
                  self_rating: found.self_rating,
                  reason_code: found.reason_code || "",
                  notes: found.notes || "",
                }
              : { street: s, self_rating: "", reason_code: "", notes: "" };
          })
        );
      }
      // Rua sem decisao sua (a mao acabou antes, ou voce ja estava
      // all-in) entra como "N/A" sozinha -- a tela nem mostra o cartao
      // dela, e a "avaliacao completa" passa a depender so' das ruas em
      // que voce agiu.
      if (mao) {
        const jogadas = ruasComDecisao(mao);
        setStreetEvals((prev) => prev.map((e) => (!jogadas.includes(e.street) && !e.self_rating ? { ...e, self_rating: "nao_se_aplica" } : e)));
      }

      const urls = await Promise.all(r.images.map((im) => getThumbUrl(im.storage_path)));
      setImgUrls(urls);

      if (r.parsed_data?.kind === "manual_ticket") {
        setTicket({
          format: r.parsed_data.format || "",
          street: r.parsed_data.street || "preflop",
          action: r.parsed_data.action || "",
        });
        setTicketSaved(true);
      }

      if (r.session_id) {
        fetchBankrollSessionById(r.session_id)
          .then(setLinkedSession)
          .catch(() => {});
      } else {
        setLinkedSession(null);
      }
    } catch {
      setError("Erro ao carregar a mão.");
    } finally {
      setLoading(false);
    }
  }

  function updateAnswer(idx: number, val: string) {
    setQas((prev) => prev.map((q, i) => (i === idx ? { ...q, answer: val } : q)));
  }

  async function toggleReviewTag(tagId: string) {
    if (!userId) return;
    const backup = reviewTagIds;
    const next = reviewTagIds.includes(tagId) ? reviewTagIds.filter((id) => id !== tagId) : [...reviewTagIds, tagId];
    setReviewTagIds(next);
    setSavingTags(true);
    try {
      await updateReviewTags(reviewId, userId, next);
      setReview((prev) => (prev ? { ...prev, tags: allTags.filter((t) => next.includes(t.id)) } : prev));
    } catch {
      setReviewTagIds(backup);
      setError("Não foi possível salvar o marcador.");
    } finally {
      setSavingTags(false);
    }
  }

  async function handleCreateTag() {
    if (!userId || !newTagLabel.trim()) return;
    try {
      const tag = await createUserTag(userId, newTagLabel.trim());
      setAllTags((prev) => [...prev, tag]);
      setNewTagLabel("");
      await toggleReviewTag(tag.id);
    } catch {
      setError("Não foi possível criar o marcador.");
    }
  }

  useEffect(() => {
    if (!sessionEditorOpen || recentSessions.length > 0) return;
    fetchRecentBankrollSessions(5)
      .then(setRecentSessions)
      .catch(() => {});
  }, [sessionEditorOpen, recentSessions.length]);

  async function handleLinkSession(sessionId: string | null) {
    setSavingSession(true);
    try {
      await linkReviewToSession(reviewId, sessionId);
      const next = sessionId ? recentSessions.find((s) => s.id === sessionId) ?? (await fetchBankrollSessionById(sessionId)) : null;
      setLinkedSession(next);
      setSessionEditorOpen(false);
    } catch {
      setError("Não foi possível atualizar o vínculo com a sessão.");
    } finally {
      setSavingSession(false);
    }
  }

  async function saveTicket(next: ManualTicket) {
    setTicket(next);
    if (!next.format || !next.action) return;
    try {
      await saveMinimalTicket(reviewId, next);
      setTicketSaved(true);
    } catch {
      // silencioso
    }
  }

  async function persist(nextStatus?: string) {
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      await saveAnswers(reviewId, userId, qas);
      await saveStreetEvals(reviewId, userId, streetEvals);

      const patch: Record<string, unknown> = {
        learning_note: learning.trim() || null,
        drill_suggestion: drill.trim() || null,
      };
      if (nextStatus) patch.status = nextStatus;
      // concluded_at nunca era gravado (campo buscado em 3 queries, sempre
      // nulo) -- sem isso, nao tem como medir "tempo ate revisar a mao".
      if (nextStatus === "concluida") patch.concluded_at = new Date().toISOString();
      const updated = await updateReviewProgress(reviewId, patch);
      setReview((prev) => (prev ? { ...prev, ...updated } : prev));

      const events: string[] = [];
      const allStreetsRated = streetEvals.length === 4 && streetEvals.every((e) => e.self_rating && e.self_rating !== "");
      if (allStreetsRated) events.push("full_self_eval");

      const allAnswered = qas.length > 0 && qas.every((q) => (q.answer || "").trim().length > 0);
      if (allAnswered) events.push("all_questions_answered");

      if (nextStatus === "concluida") events.push("concluded");

      let totalXp = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let missionsCompleted: any[] = [];
      for (const ev of events) {
        const xp = await registerReviewEvent(ev, reviewId);
        if (xp?.xp_final) totalXp += xp.xp_final;
        if (xp?.missions_completed?.length) {
          missionsCompleted = missionsCompleted.concat(xp.missions_completed);
        }
      }

      if (totalXp > 0 || missionsCompleted.length > 0) {
        setXpFeedback({ xp: totalXp, missions: missionsCompleted });
        setTimeout(() => setXpFeedback(null), 4000);
      }

      if (nextStatus === "concluida") {
        const isChampion =
          !!parsedHandForTable?.wonTournament &&
          !!parsedHandForTable?.heroName &&
          parsedHandForTable.winner === parsedHandForTable.heroName;
        if (isChampion) {
          // Espera o toast de XP sumir antes de cobrir a tela com a taca,
          // pra nao competir visualmente com ele.
          setTimeout(() => setShowChampion(true), missionsCompleted.length ? 2000 : 500);
          setTimeout(() => onBack(), missionsCompleted.length ? 5200 : 3700);
        } else {
          setTimeout(() => onBack(), missionsCompleted.length ? 2000 : 500);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComputeEv() {
    setEvLoading(true);
    setEvError("");
    try {
      const outcome = await computeHandEv(reviewId);
      if (!outcome.ok || !outcome.computed) {
        setEvError(outcome.message || "Não foi possível calcular agora.");
      } else if (outcome.result) {
        setEvResult(outcome.result);
      }
    } catch {
      setEvError("Não foi possível calcular agora. Verifique sua conexão e tente de novo.");
    } finally {
      setEvLoading(false);
    }
  }

  // Mão de OUTRA pessoa (o coach abrindo a mão que o jogador compartilhou
  // com ele): a análise é do jogador e aparece só pra ler -- sem salvar,
  // compartilhar, calcular EV (gravaria no nome do coach e travaria o
  // cálculo do jogador), marcadores ou Banca. A conversa (CoachThread)
  // continua liberada: é ali que o coach escreve.
  const somenteLeitura = !!userId && !!review && review.user_id !== userId;
  const heroNome = somenteLeitura ? "Jogador" : "Você";

  // O que aconteceu em cada rua até a sua última decisão nela, sem os
  // folds dos outros: "MP raise 2,4 · CO all-in 23,8 · Você all-in 50,8".
  // É o que o passo 1 avalia -- antes a tela só dizia "Pré-flop".
  const lancesPorRua = useMemo(() => {
    const mapa: Record<string, { texto: string; voce: boolean }[]> = {};
    if (!parsedHandForTable) return mapa;
    try {
      const st = projectHandAtStep(parsedHandForTable, Number.MAX_SAFE_INTEGER);
      const heroPos = st.seatLayout.find((sl) => sl.isHero)?.posLabel;
      for (const r of st.tableHand.history) {
        const acoes = r.actions.filter((a) => !a.label.startsWith("posts"));
        const nomes = nomesDosRaises(r.street, acoes);
        const ultimaMinha = acoes.map((a) => a.pos).lastIndexOf(heroPos ?? "");
        if (ultimaMinha < 0) continue;
        const inicio = Math.max(0, acoes.findIndex((a) => a.label !== "fold"));
        mapa[r.street.toLowerCase()] = acoes
          .map((a, i) => ({ ...a, nome: nomes[i] }))
          .slice(inicio, ultimaMinha + 1)
          .filter((a) => a.label !== "fold" || a.pos === heroPos)
          .map((a) => ({ texto: `${a.pos === heroPos ? heroNome : a.pos} ${rotuloAcao(a.label, a.nome)}`, voce: a.pos === heroPos }));
      }
    } catch {
      // replay não montou -- o passo 1 mostra só o nome da rua
    }
    return mapa;
  }, [parsedHandForTable, heroNome]);

  if (loading) return <p className="text-muted">Carregando…</p>;
  if (!review) return <p className="text-muted">Mão não encontrada.</p>;

  const ruasJogadas = ruasComDecisao(parsedHandForTable);
  // Sugestao automatica de drill (em vez de so' um campo de texto em
  // branco): posicao + stack do heroi viram um atalho pro Modo Treino
  // ja no stack certo (?stack=, que o Treino ja entende).
  const heroSeat = parsedHandForTable?.seats?.find((s) => s.playerName === parsedHandForTable.heroName);
  const heroStackBb =
    heroSeat && parsedHandForTable?.bigBlind ? heroSeat.startingChips / parsedHandForTable.bigBlind : null;
  // Stacks que o Modo Treino cobre (mesma lista dos filtros do drill) --
  // mao mais funda que o maior deles fica sem sugestao, em vez de mandar
  // pro Treino um spot que nao existe.
  const STACKS_DO_TREINO = [10, 15, 20, 25, 30, 40, 50, 60];
  const stackDoTreino =
    heroStackBb != null && heroStackBb <= 65
      ? STACKS_DO_TREINO.reduce((melhor, st) => (Math.abs(st - heroStackBb) < Math.abs(melhor - heroStackBb) ? st : melhor))
      : null;
  const drillAuto =
    stackDoTreino != null && parsedHandForTable?.heroPosition
      ? {
          texto: `Decisões pré-flop do ${parsedHandForTable.heroPosition} com ${stackDoTreino} bb`,
          href: `/treino?stack=${stackDoTreino}`,
        }
      : null;
  const canConclude = learning.trim().length > 0;
  const isPrintOnly = review.source === "print" || (!review.hand_history && review.parsed_data?.kind !== "parsed");

  // Os 3 passos da análise (pedido explícito: a tela antiga era "confusa e
  // sem nexo" -- avaliação por street com "toque pra avaliar", N/A, dois
  // campos de texto soltos e um "Concluir" apagado sem dizer por quê):
  // 1. Como você jogou -- uma linha por rua em que VOCÊ decidiu algo,
  //    mostrando o que aconteceu nela ("MP raise 2,4 · CO all-in 23,8 ·
  //    Você all-in 50,8"), com Acertei / Errei / Fiquei na dúvida;
  // 2. O que você leva dessa mão -- a frase que conclui a análise;
  // 3. Treinar o spot -- atalho pro Modo Treino (opcional).
  const ruasParaAvaliar = streetEvals.map((ev, idx) => ({ ev, idx })).filter(({ ev }) => ruasJogadas.includes(ev.street));
  const passo1Ok = ruasParaAvaliar.length > 0 && ruasParaAvaliar.every(({ ev }) => ev.self_rating && ev.self_rating !== "nao_se_aplica");
  const passo2Ok = canConclude;
  const passosFeitos = (passo1Ok ? 1 : 0) + (passo2Ok ? 1 : 0);
  const cartasDaRua = (street: string): string[] => {
    const board = parsedHandForTable?.board ?? [];
    return street === "flop" ? board.slice(0, 3) : street === "turn" ? board.slice(3, 4) : street === "river" ? board.slice(4, 5) : [];
  };

  const avaliarRua = (idx: number, code: string) =>
    setStreetEvals((prev) => prev.map((e, i) => (i === idx ? { ...e, self_rating: code, reason_code: code === "errei" ? e.reason_code : "" } : e)));

  const passo1 = (
    <Passo numero={1} titulo={somenteLeitura ? "Como o jogador jogou?" : "Como você jogou?"} feito={passo1Ok}>
      {ruasParaAvaliar.map(({ ev, idx }) => {
        const lances = lancesPorRua[ev.street] ?? [];
        const cartas = cartasDaRua(ev.street);
        const question = qas[idx];
        return (
          <div key={ev.street} className="painel-bloco rounded-xl border border-white/5 p-3">
            <div className="flex items-baseline gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
              {NOME_RUA[ev.street.toUpperCase()] ?? ev.street}
              {cartas.length > 0 && (
                <span className="flex gap-1.5 text-[12px] normal-case tracking-normal">
                  {cartas.map((c) => (
                    <CartaTexto key={c} card={c} />
                  ))}
                </span>
              )}
            </div>
            {/* O que aconteceu nessa rua até a sua última decisão -- é
                isso que está sendo avaliado. */}
            {lances.length > 0 ? (
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink/85">
                {lances.map((l, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted"> · </span>}
                    <span className={l.voce ? "font-semibold text-[#d4af37]" : undefined}>{l.texto}</span>
                  </span>
                ))}
              </p>
            ) : somenteLeitura ? null : (
              <p className="m-0 mt-1 text-[12px] text-muted">Avalie pelo que você lembra da sua decisão nessa rua.</p>
            )}

            {somenteLeitura && (!ev.self_rating || ev.self_rating === "nao_se_aplica") ? (
              <p className="m-0 mt-2 text-[12px] text-muted">O jogador não deu nota nessa rua.</p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`Decisão no ${NOME_RUA[ev.street.toUpperCase()] ?? ev.street}`}>
                {OPCOES_AVALIACAO.map((r) => {
                  const ativo = ev.self_rating === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      aria-pressed={ativo}
                      disabled={somenteLeitura}
                      onClick={() => avaliarRua(idx, r.code)}
                      className="flex-1 rounded-lg border px-2 py-1.5 text-[12px] transition-colors disabled:cursor-default"
                      style={{
                        borderColor: ativo ? r.color : "rgba(255,255,255,0.12)",
                        background: ativo ? r.color : "transparent",
                        color: ativo ? "#000" : "#fff",
                        fontWeight: ativo ? 700 : 500,
                        opacity: somenteLeitura && !ativo ? 0.35 : 1,
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}

            {ev.self_rating === "errei" && (!somenteLeitura || ev.reason_code) && (
              <select
                value={ev.reason_code}
                disabled={somenteLeitura}
                onChange={(e) => {
                  const val = e.target.value;
                  setStreetEvals((prev) => prev.map((x, i) => (i === idx ? { ...x, reason_code: val } : x)));
                }}
                className="mt-2 w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink outline-none disabled:opacity-80"
              >
                <option value="">O que deu errado? (opcional)</option>
                {reasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}

            {/* Veredito objetivo do solver, so' quando a mao veio da
                Aderencia a Range -- compara sua autoavaliacao com o que o
                GTO realmente recomenda, em vez de confiar so no auto-relato. */}
            {ev.street === "preflop" && objectiveVerdict && (
              <div
                className="mt-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px]"
                style={{ borderColor: `${verdictColor(objectiveVerdict.verdict)}40`, background: `${verdictColor(objectiveVerdict.verdict)}12` }}
              >
                <Gauge size={11} style={{ color: verdictColor(objectiveVerdict.verdict) }} />
                <span style={{ color: verdictColor(objectiveVerdict.verdict) }} className="font-semibold">
                  GTO: {objectiveVerdict.verdict.replace("_", " ")}
                </span>
                <span className="text-muted">
                  fold {objectiveVerdict.decision.fold}% · call {objectiveVerdict.decision.call}% · raise {objectiveVerdict.decision.raise}%
                  {objectiveVerdict.rangeName ? ` · vs ${objectiveVerdict.rangeName} (${objectiveVerdict.position})` : ""}
                </span>
              </div>
            )}

            {/* "Por quê?" só depois de escolher -- a pergunta guiada vira a
                dica do campo, em vez de mais um bloco de texto na tela. */}
            {ev.self_rating && question && (!somenteLeitura || question.answer.trim()) && (
              <label className="mt-2 block">
                <span className="text-[11px] text-muted">{somenteLeitura ? "Por quê" : "Por quê? (opcional)"}</span>
                <textarea
                  value={question.answer}
                  readOnly={somenteLeitura}
                  onChange={(e) => updateAnswer(idx, e.target.value)}
                  rows={2}
                  placeholder={question.question}
                  className="mt-1 w-full resize-y rounded-lg border border-hairline bg-surface p-2 text-[12px] text-ink outline-none focus:border-ink/40"
                />
              </label>
            )}
          </div>
        );
      })}

      {/* Perguntas extras (marcadores como ICM/3-bet/PKO) -- recolhidas,
          pra não pesar a tela de quem só quer avaliar e seguir. */}
      {qas.length > STREETS.length && (
        <details className="group rounded-xl border border-white/5 px-3 py-2">
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-muted transition-colors hover:text-ink">
            Perguntas extras pra aprofundar (opcional)
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {qas.slice(STREETS.length).map((q, i) => {
              const idx = i + STREETS.length;
              return (
                <label key={idx} className="block">
                  <span className="text-[11.5px] font-medium text-ink/80">{q.question}</span>
                  <textarea
                    value={q.answer}
                    readOnly={somenteLeitura}
                    onChange={(e) => updateAnswer(idx, e.target.value)}
                    rows={2}
                    placeholder={somenteLeitura ? "Sem resposta." : "Sua resposta…"}
                    className="mt-1 w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12px] text-ink outline-none focus:border-ink/40"
                  />
                </label>
              );
            })}
          </div>
        </details>
      )}
    </Passo>
  );

  const analise = (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale size={15} className="icon-glow text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">{somenteLeitura ? "Análise do jogador" : "Sua análise"}</h3>
        </div>
        <span className="tnum text-[11px] text-muted">{passosFeitos} de 2 passos</span>
      </header>
      <p className="m-0 mt-1 text-[12px] leading-snug text-muted">
        {somenteLeitura
          ? "O que o jogador marcou em cada rua e o que ele aprendeu com a mão. Só pra ler."
          : "Avalie o que você fez e escreva o que aprendeu. O treino no fim é opcional."}
      </p>

      <div className="mt-3.5 flex flex-col gap-4">
        {passo1}

        <Passo numero={2} titulo={somenteLeitura ? "O que o jogador levou dessa mão?" : "O que você leva dessa mão?"} feito={passo2Ok}>
          {somenteLeitura && !learning.trim() ? (
            <p className="m-0 text-[12px] text-muted">O jogador ainda não escreveu.</p>
          ) : (
            <textarea
              value={learning}
              readOnly={somenteLeitura}
              onChange={(e) => setLearning(e.target.value)}
              rows={2}
              placeholder="Uma frase curta. Ex.: com KK no BTN, all-in em cima de shove curto é sempre call."
              className="w-full resize-y rounded-lg border border-hairline bg-void p-2.5 text-[12.5px] text-ink outline-none focus:border-ink/40"
            />
          )}
          {!somenteLeitura && (
            <p className="m-0 text-[11px] text-muted">É essa frase que conclui a análise e fica guardada pra você rever depois.</p>
          )}
        </Passo>

        {somenteLeitura ? (
          drill.trim() && (
            <Passo numero={3} titulo="Spot que o jogador quer treinar" opcional>
              <p className="m-0 text-[12.5px] leading-relaxed text-ink/85">{drill}</p>
            </Passo>
          )
        ) : (
        <Passo numero={3} titulo="Treinar esse spot" opcional>
          {drillAuto ? (
            <Link
              href={drillAuto.href}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/[0.08] px-3 py-2.5 text-[12.5px] text-ink transition hover:border-[#d4af37]/60"
            >
              <span className="min-w-0 truncate">{drillAuto.texto}</span>
              <span className="shrink-0 text-[12px] font-semibold text-[#d4af37]">Treinar →</span>
            </Link>
          ) : (
            <p className="m-0 text-[12px] text-muted">Ainda não tem treino pronto pra esse spot.</p>
          )}
          <details className="group" open={drill.trim().length > 0}>
            <summary className="cursor-pointer list-none text-[11.5px] text-muted transition-colors hover:text-ink">
              + Anotar outro spot pra treinar
            </summary>
            <textarea
              value={drill}
              onChange={(e) => setDrill(e.target.value)}
              rows={2}
              placeholder="Ex.: BB defendendo contra open do BTN, 20–30 bb."
              className="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-ink/40"
            />
          </details>
        </Passo>
        )}
      </div>

      {error && <div className="mt-3 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{error}</div>}

      {!somenteLeitura && (
      <footer className="mt-4 flex flex-col gap-2">
        {!canConclude && <p className="m-0 text-center text-[11.5px] text-muted">Pra concluir, falta o passo 2: escrever o que você aprendeu.</p>}
        <div className="flex gap-2.5">
          <button
            onClick={() => persist("em_revisao")}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink transition hover:border-white/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar e continuar depois
          </button>
          <button
            onClick={() => persist("concluida")}
            disabled={saving || !canConclude}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#e2c35a] disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Concluir análise
          </button>
        </div>
      </footer>
      )}
    </section>
  );

  // Coisas da mão que não são a análise em si: prints, EV/ICM do all-in,
  // ficha rápida (mão só com print) e, recolhidos no fim, marcadores e
  // vínculo com a Banca (antes ficavam no topo, competindo com o título).
  const extras = (
    <>
      {/* some(Boolean): print que não abre (ex.: o coach não tem acesso à
          pasta de prints do jogador) não deixa mais uma caixa vazia. */}
      {imgUrls.some(Boolean) && (
        <section className="painel-vidro rounded-2xl border border-white/10 p-3.5">
          <h3 className="m-0 text-sm font-semibold text-ink">Prints</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {imgUrls.map(
              (u, i) =>
                u && (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-void">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </a>
                )
            )}
          </div>
        </section>
      )}

      {!somenteLeitura && parsedHandForTable && findEligibleAllInConfrontation(parsedHandForTable) && (
        <section className="painel-vidro rounded-2xl border border-white/10 p-3.5">
          <div className="flex items-center gap-2">
            <Gauge size={15} className="icon-glow text-review" />
            <h3 className="m-0 text-sm font-semibold text-ink">Esse all-in foi bom no longo prazo?</h3>
          </div>
          <p className="mb-2.5 mt-1 text-xs text-muted">Sua chance de ganhar e o valor em $ considerando a premiação do torneio (ICM).</p>

          {evError && <p className="mb-2.5 text-xs text-negative">{evError}</p>}

          {evResult ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-hairline bg-void p-2">
                <span className="block text-[10px] uppercase tracking-wide text-muted">Chance de ganhar</span>
                <span className="font-semibold text-ink">{evResult.heroEquityPct?.toFixed(1)}%</span>
              </div>
              <div className="rounded-lg border border-hairline bg-void p-2">
                <span className="block text-[10px] uppercase tracking-wide text-muted">Fichas em risco</span>
                <span className="font-semibold text-ink">{evResult.chipsAtRisk}</span>
              </div>
              <div className="rounded-lg border border-hairline bg-void p-2">
                <span className="block text-[10px] uppercase tracking-wide text-muted">$ esperado (ICM)</span>
                <span className="font-semibold text-ink">${evResult.heroExpectedIcmDollars?.toFixed(2)}</span>
              </div>
              <div className="rounded-lg border border-hairline bg-void p-2">
                <span className="block text-[10px] uppercase tracking-wide text-muted">Ganho/perda esperado</span>
                <span className="font-semibold text-ink">
                  {evResult.heroExpectedIcmDeltaDollars != null && evResult.heroExpectedIcmDeltaDollars >= 0 ? "+" : ""}${evResult.heroExpectedIcmDeltaDollars?.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleComputeEv}
                disabled={evLoading}
                className="col-span-2 mt-1 rounded-lg border border-hairline px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
              >
                {evLoading ? "Recalculando…" : "Recalcular"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleComputeEv}
              disabled={evLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-ink transition hover:border-white/30 disabled:opacity-50"
            >
              {evLoading ? <Loader2 size={13} className="animate-spin" /> : <Gauge size={13} />}
              {evLoading ? "Calculando…" : "Calcular"}
            </button>
          )}
        </section>
      )}

      {isPrintOnly && (!somenteLeitura || ticketSaved) && (
        <section className="rounded-xl border border-evolution/40 bg-evolution/[0.06] p-3">
          <h3 className="m-0 text-sm font-semibold text-ink">Ficha rápida</h3>
          <p className="mb-3 mt-1 text-xs text-muted">
            {somenteLeitura
              ? "Como o jogador classificou essa mão."
              : "Sem hand history pra ancorar o contexto — classifique em 3 toques pra essa mão entrar nas suas estatísticas de leak."}
          </p>

          <div className="mb-3">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Formato / stake</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => saveTicket({ ...ticket, format: f })}
                  disabled={somenteLeitura}
                  className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
                    ticket.format === f ? "border-evolution bg-evolution text-void" : "border-hairline bg-void text-ink"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Street da decisão</span>
            <div className="flex flex-wrap gap-1.5">
              {STREETS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveTicket({ ...ticket, street: s })}
                  disabled={somenteLeitura}
                  className={`rounded-full border px-2.5 py-1.5 text-xs capitalize transition-colors ${
                    ticket.street === s ? "border-evolution bg-evolution text-void" : "border-hairline bg-void text-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Sua ação</span>
            <div className="flex flex-wrap gap-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => saveTicket({ ...ticket, action: a })}
                  disabled={somenteLeitura}
                  className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
                    ticket.action === a ? "border-evolution bg-evolution text-void" : "border-hairline bg-void text-ink"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {ticketSaved && ticket.format && ticket.action && <p className="mt-3 text-[11px] text-positive">Ficha salva.</p>}
        </section>
      )}

      {!somenteLeitura && (
      <details
        className="painel-vidro group rounded-2xl border border-white/10 px-3.5 py-3"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) setSessionEditorOpen(true);
        }}
      >
        <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-muted transition-colors hover:text-ink">
          Marcadores e sessão da Banca
          <span className="ml-1.5 font-normal">
            {review.tags.length > 0 ? `· ${review.tags.length} marcador${review.tags.length > 1 ? "es" : ""}` : ""}
            {linkedSession ? " · vinculada à Banca" : ""}
          </span>
        </summary>

        <div className="mt-2.5 flex flex-col gap-3">
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">
              <TagIcon size={11} /> Marcadores
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const active = reviewTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleReviewTag(t.id)}
                    disabled={savingTags}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                      active ? "border-ink bg-ink text-void" : "border-hairline bg-transparent text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                placeholder="Criar marcador"
                className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-ink outline-none focus:border-ink/40"
              />
              <button onClick={handleCreateTag} className="flex shrink-0 items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-void">
                <Plus size={11} /> Criar
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">
              <Wallet size={11} /> Sessão da Banca
            </span>
            {linkedSession && (
              <Link
                href="/banca"
                className="mb-1.5 inline-flex items-center gap-1 rounded border border-training/30 bg-training/[0.12] px-1.5 py-0.5 text-[11px] text-training transition-colors hover:border-training/60"
              >
                <Wallet size={10} />
                {[linkedSession.format, linkedSession.stake, linkedSession.date].filter(Boolean).join(" · ")}
              </Link>
            )}
            <div className="flex flex-wrap gap-1.5">
              {recentSessions.length === 0 && <p className="m-0 text-[11px] text-muted">Nenhuma sessão recente na Banca.</p>}
              {recentSessions.map((s) => {
                const active = linkedSession?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleLinkSession(active ? null : s.id)}
                    disabled={savingSession}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                      active ? "border-training bg-training text-void" : "border-hairline bg-transparent text-ink"
                    }`}
                  >
                    {[s.format, s.stake, s.date].filter(Boolean).join(" · ")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>
      )}
    </>
  );

  return (
    <div>
      {/* Cabeçalho enxuto: o nome da mão e as duas ações (salvar spot e
          mandar pro coach). Marcadores e Banca foram pro fim da tela. */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-xl font-semibold tracking-tight text-ink">{review.title || "Mão sem título"}</h2>
          {somenteLeitura && (
            <p className="m-0 mt-1 text-[12.5px] text-muted">Mão do jogador, só pra ler. A sua análise vai na conversa logo abaixo.</p>
          )}
          {review.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {review.tags.map((t) => (
                <span key={t.id} className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {!somenteLeitura && (
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Salvar spot -- maos que valeram a pena guardar pra rever
              depois, com biblioteca propria (aba "Salvos"). */}
          <button
            onClick={toggleSaved}
            disabled={savingSpot}
            title={review.saved ? "Remover dos salvos" : "Salvar spot pra rever depois"}
            className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
              review.saved ? "border-ink bg-ink text-void" : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-ink"
            }`}
          >
            <Bookmark size={15} fill={review.saved ? "currentColor" : "none"} />
          </button>

          {/* Compartilhar com o coach -- a mesma modal de toda a Revisor
              de Mãos (share-hand-modal.tsx), que já avisa se não houver
              coach no time. */}
          <button
            onClick={() => setShareModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-ink transition hover:border-white/20"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>
        )}
      </div>

      {/* Conversa do compartilhamento: so renderiza se existir share
          envolvendo quem esta olhando (o proprio componente decide). */}
      <CoachThread reviewId={reviewId} reviewTitle={review.title || "Mão sem título"} />

      <ShareHandModal
        open={shareModalOpen && !somenteLeitura}
        reviewId={reviewId}
        onClose={() => setShareModalOpen(false)}
        onShared={() => {
          // As respostas foram salvas pela propria modal (mesmo reviewId) --
          // recarrega pra essa tela refletir o que acabou de ser enviado
          // (ex: CoachThread aparecendo com a conversa nova).
          load();
        }}
      />

      {/* Computador: a mão à esquerda (resumo + extras) e a análise à
          direita, do começo ao fim. Celular: uma coluna na ordem de uso --
          resumo da mão, análise, e só depois os extras. */}
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-2.5 lg:col-start-1 lg:row-start-1">
          {parsedHandForTable && <ResumoDaMao hand={parsedHandForTable} historicoBruto={review.hand_history} hero={heroNome} />}
          {(review.free_text || (!parsedHandForTable && review.hand_history)) && (
            <section className="painel-vidro rounded-2xl border border-white/10 p-4">
              <h3 className="m-0 text-sm font-semibold text-ink">Contexto</h3>
              {review.free_text && <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{review.free_text}</p>}
              {!parsedHandForTable && review.hand_history && (
                <pre className="mt-2.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-2.5 font-mono text-[11px] text-muted">
                  {review.hand_history}
                </pre>
              )}
            </section>
          )}
        </div>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">{analise}</div>
        <div className="flex min-w-0 flex-col gap-2.5 lg:col-start-1 lg:row-start-2">{extras}</div>
      </div>

      {xpFeedback && (
        <div className="fixed bottom-5 left-1/2 z-[1000] flex -translate-x-1/2 flex-col items-center gap-1 rounded-xl bg-positive px-5 py-3 font-semibold text-void shadow-[0_8px_24px_rgba(34,197,94,0.4)]">
          <span className="text-base">+{xpFeedback.xp} XP</span>
          {xpFeedback.missions.map((m, i) => (
            <span key={i} className="text-[11px] opacity-90">
              🎯 Missão completa: +{m.xp_reward} XP
            </span>
          ))}
        </div>
      )}

      {showChampion && <ChampionOverlay />}
    </div>
  );
}

// Um passo da análise: número (vira ✓ quando feito), título e o conteúdo.
function Passo({
  numero,
  titulo,
  feito = false,
  opcional = false,
  children,
}: {
  numero: number;
  titulo: string;
  feito?: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          feito ? "bg-positive text-void" : "border border-white/20 text-muted"
        }`}
        aria-hidden
      >
        {feito ? <Check size={13} strokeWidth={3} /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h4 className="m-0 text-[13px] font-semibold text-ink">
          {titulo}
          {opcional && <span className="ml-1.5 text-[11px] font-normal text-muted">(opcional)</span>}
        </h4>
        {children}
      </div>
    </div>
  );
}

// Animacao de taca — so dispara na ultima mao de um torneio vencida pelo
// heroi (ver ParsedHand.wonTournament). Cobre a tela inteira por alguns
// segundos antes de voltar pra tabela de torneios (onBack), como pedido.
// Confete simples via divs posicionadas caindo (sem lib externa).
function ChampionOverlay() {
  const confetti = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["#f59e0b", "#22c55e", "#a855f7", "#3b82f6", "#e0555a"];
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center overflow-hidden bg-void/90 backdrop-blur-sm">
      {confetti.map((i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${(i * 137) % 100}%`,
            width: 7,
            height: 12,
            background: colors[i % colors.length],
            borderRadius: 2,
            animation: `championConfetti ${1.6 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.12}s forwards`,
            opacity: 0.9,
          }}
        />
      ))}
      <div style={{ animation: "championPop 700ms cubic-bezier(.34,1.56,.64,1) both" }}>
        <Trophy size={84} className="text-evolution" style={{ filter: "drop-shadow(0 0 24px rgba(245,158,11,.65))" }} />
      </div>
      <p
        className="mt-4 text-2xl font-bold text-ink"
        style={{ animation: "fadeInUp 500ms ease-out 300ms both" }}
      >
        Campeão do torneio!
      </p>
      <p className="mt-1 text-sm text-muted" style={{ animation: "fadeInUp 500ms ease-out 450ms both" }}>
        Voltando pra tabela de torneios…
      </p>
      <style jsx global>{`
        @keyframes championPop {
          0% {
            opacity: 0;
            transform: scale(0.4) rotate(-8deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes championConfetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.9;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
