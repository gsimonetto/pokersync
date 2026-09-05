"use client";

import { useEffect, useState } from "react";
import { Save, CheckCircle2, Lightbulb, Target, Loader2, Scale, Share2, Trophy, Tag as TagIcon, Plus, Link2, Wallet, Gauge, Bookmark } from "lucide-react";
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
import { RevisorHandTable } from "./revisor-hand-table";
import { CoachThread } from "./coach-thread";
import { ShareHandModal } from "./share-hand-modal";

const FORMATS = ["MTT", "Cash", "SNG", "Spin"];
const ACTIONS = ["Fold", "Call", "Raise", "Check", "Bet", "All-in"];

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
  // Qual street esta expandida no fluxo unificado abaixo. null = segue o
  // padrao automatico (primeira street ainda sem nota); um numero fixa a
  // escolha manual do jogador; -1 = tudo recolhido (fluxo concluido ou
  // fechado por vontade propria). Existe pra permitir avancar sozinho
  // (toque na nota = ja abre a proxima) sem travar o jogador se ele quiser
  // voltar numa street anterior.
  const [openIdx, setOpenIdx] = useState<number | null>(null);
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
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
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
    try {
      const r = await getReview(reviewId);
      setReview(r);
      setLearning(r.learning_note || "");
      setDrill(r.drill_suggestion || "");

      if (r.parsed_data?.kind === "parsed") {
        setParsedHandForTable(r.parsed_data as ParsedHand);
        setObjectiveVerdict(r.parsed_data.objectiveVerdict ?? null);
      } else if (r.hand_history) {
        try {
          const parsed = parseHand(r.hand_history);
          setParsedHandForTable(parsed);
        } catch (e) {
          setParsedHandForTable(null);
          if (!(e instanceof HandParseError)) {
            console.warn("[RevisorDetalhe] hand history nao parseavel:", e);
          }
        }
        setObjectiveVerdict(null);
      } else {
        setParsedHandForTable(null);
        setObjectiveVerdict(null);
      }

      const existing = r.answers || [];
      const questions = existing.length
        ? existing.map((a) => ({ question: a.question, answer: a.answer || "" }))
        : suggestGuidedQuestions(
            r.tags,
            r.parsed_data?.kind === "parsed" ? { board: r.parsed_data.board, heroPosition: r.parsed_data.heroPosition } : null
          ).map((q) => ({ question: q, answer: "" }));
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

  if (loading) return <p className="text-muted">Carregando…</p>;
  if (!review) return <p className="text-muted">Mão não encontrada.</p>;

  const answeredCount = qas.filter((q) => q.answer.trim()).length;
  const canConclude = learning.trim().length > 0;
  // Fluxo unificado de autoavaliacao (rating + pergunta guiada por street,
  // sem modal): a street aberta e' a escolha manual do jogador (openIdx),
  // ou por padrao a primeira ainda sem nota -- assim que ele bate uma nota
  // a proxima abre sozinha (a "acao rapida": um toque avanca, nao precisa
  // abrir/fechar nada a parte). O gate de "so' pode enviar ao coach com
  // as 4 streets avaliadas" mora dentro do proprio ShareHandModal agora
  // (ver share-hand-modal.tsx) -- essa tela so' precisa abrir a modal.
  const firstUnratedIdx = streetEvals.findIndex((e) => !e.self_rating);
  const effectiveOpenIdx = openIdx !== null ? openIdx : firstUnratedIdx;
  const isPrintOnly = review.source === "print" || (!review.hand_history && review.parsed_data?.kind !== "parsed");

  // Secoes mais compactas (pedido explicito: "diminua as perguntas") —
  // padding p-4->p-3, margens mb-3.5->mb-2.5, chips e textarea menores.
  // Objetivo: sobrar mais espaco visual pra coluna da mesa, que ficou
  // maior (ver grid abaixo).
  const secondaryContent = (
    <>
      {imgUrls.length > 0 && (
        <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
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

      {isPrintOnly && (
        <section className="mb-2.5 rounded-xl border border-evolution/40 bg-evolution/[0.06] p-3">
          <h3 className="m-0 text-sm font-semibold text-ink">Ficha rápida</h3>
          <p className="mb-3 mt-1 text-xs text-muted">
            Sem hand history pra ancorar o contexto — classifique em 3 toques pra essa mão entrar nas suas
            estatísticas de leak.
          </p>

          <div className="mb-3">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Formato / stake</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => saveTicket({ ...ticket, format: f })}
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
                  className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
                    ticket.action === a ? "border-evolution bg-evolution text-void" : "border-hairline bg-void text-ink"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {ticketSaved && ticket.format && ticket.action && (
            <p className="mt-3 text-[11px] text-positive">Ficha salva.</p>
          )}
        </section>
      )}

      {/* Fluxo unificado (pedido explicito): antes eram tres pecas soltas
          -- rating por street aqui, perguntas guiadas atras de um botao que
          abria modal, compartilhar com coach atras de outro botao com
          dropdown. Virou uma coisa so: cada street e' um cartao que abre
          sozinho na sequencia (bate a nota, avanca pra proxima -- a "acao
          rapida" pedida, sem precisar abrir/fechar nada a parte), com a
          pergunta guiada correspondente ja dentro do cartao (texto sempre
          visivel, sem o gesto extra de clicar pra revelar). O botao de
          enviar ao coach aparece no final, depois que as 4 streets tem
          nota -- e' a conclusao natural do fluxo, nao mais uma acao solta
          no cabecalho. */}
      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale size={15} className="icon-glow text-review" />
            <h3 className="m-0 text-sm font-semibold text-ink">Avaliação por street</h3>
          </div>
          {qas.length > 0 && (
            <span className="text-[10.5px] text-muted">
              {answeredCount}/{qas.length} perguntas
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {streetEvals.map((ev, idx) => {
            const isOpen = effectiveOpenIdx === idx;
            const rating = RATINGS.find((r) => r.code === ev.self_rating);
            const question = qas[idx];

            return (
              <div key={ev.street} className="overflow-hidden rounded-lg border border-hairline bg-void">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                >
                  <span className="text-xs font-semibold uppercase text-ink/85">{ev.street}</span>
                  {rating ? (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: rating.color, color: "#000" }}
                    >
                      {rating.label}
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-muted">Toque pra avaliar</span>
                  )}
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 border-t border-hairline p-2.5">
                    <div className="flex gap-1.5">
                      {RATINGS.map((r) => {
                        const active = ev.self_rating === r.code;
                        return (
                          <button
                            key={r.code}
                            type="button"
                            onClick={() => {
                              setStreetEvals((prev) => prev.map((e, i) => (i === idx ? { ...e, self_rating: r.code } : e)));
                              // So' "errei" fica esperando o motivo antes de
                              // avancar -- as outras notas ja levam direto
                              // pra proxima street, um toque = feito.
                              if (r.code !== "errei") setOpenIdx(idx + 1 < STREETS.length ? idx + 1 : -1);
                            }}
                            className="flex-1 rounded-md border px-1.5 py-1 text-[11px] transition-colors"
                            style={{
                              borderColor: active ? r.color : "#2a2a2a",
                              background: active ? r.color : "transparent",
                              color: active ? "#000" : "#fff",
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>

                    {ev.self_rating === "errei" && (
                      <select
                        value={ev.reason_code}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStreetEvals((prev) => prev.map((x, i) => (i === idx ? { ...x, reason_code: val } : x)));
                          if (val) setOpenIdx(idx + 1 < STREETS.length ? idx + 1 : -1);
                        }}
                        className="w-full rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[11.5px] text-ink outline-none"
                      >
                        <option value="">Motivo do erro…</option>
                        {reasons.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Veredito objetivo do solver, so' quando a mao veio da
                        Aderencia a Range -- compara sua autoavaliacao com o
                        que o GTO realmente recomenda, em vez de confiar so
                        no auto-relato. */}
                    {ev.street === "preflop" && objectiveVerdict && (
                      <div
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px]"
                        style={{ borderColor: `${verdictColor(objectiveVerdict.verdict)}40`, background: `${verdictColor(objectiveVerdict.verdict)}12` }}
                      >
                        <Gauge size={11} style={{ color: verdictColor(objectiveVerdict.verdict) }} />
                        <span style={{ color: verdictColor(objectiveVerdict.verdict) }} className="font-semibold">
                          GTO: {objectiveVerdict.verdict.replace("_", " ")}
                        </span>
                        <span className="text-muted">
                          fold {objectiveVerdict.decision.fold}% · call {objectiveVerdict.decision.call}% · raise{" "}
                          {objectiveVerdict.decision.raise}%
                          {objectiveVerdict.rangeName ? ` · vs ${objectiveVerdict.rangeName} (${objectiveVerdict.position})` : ""}
                        </span>
                      </div>
                    )}

                    {question && (
                      <div>
                        <p className="text-[11.5px] font-medium text-ink/80">{question.question}</p>
                        <textarea
                          value={question.answer}
                          onChange={(e) => updateAnswer(idx, e.target.value)}
                          rows={2}
                          placeholder="Sua análise…"
                          className="mt-1 w-full resize-y rounded-lg border border-hairline bg-surface p-2 text-[12px] text-ink outline-none focus:border-ink/40"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Perguntas extras (baseadas em marcadores como ICM/3-bet/PKO) que
            sobram das 4 primeiras, ja distribuidas 1 por street acima --
            ficam aqui como aprofundamento opcional, sempre visiveis (sem
            clique pra revelar). */}
        {qas.length > STREETS.length && (
          <div className="mt-2 flex flex-col gap-2 border-t border-hairline pt-2">
            <span className="text-[10.5px] uppercase tracking-wide text-muted">Aprofundamento (opcional)</span>
            {qas.slice(STREETS.length).map((q, i) => {
              const idx = i + STREETS.length;
              return (
                <div key={idx}>
                  <p className="text-[11.5px] font-medium text-ink/80">{q.question}</p>
                  <textarea
                    value={q.answer}
                    onChange={(e) => updateAnswer(idx, e.target.value)}
                    rows={2}
                    placeholder="Sua análise…"
                    className="mt-1 w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12px] text-ink outline-none focus:border-ink/40"
                  />
                </div>
              );
            })}
          </div>
        )}

      </section>

      <ShareHandModal
        open={shareModalOpen}
        reviewId={reviewId}
        onClose={() => setShareModalOpen(false)}
        onShared={() => {
          // As respostas foram salvas pela propria modal (mesmo reviewId) --
          // recarrega pra essa tela refletir o que acabou de ser enviado
          // (ex: CoachThread aparecendo com a conversa nova).
          load();
        }}
      />

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb size={15} className="icon-glow text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Registro de aprendizado</h3>
        </div>
        <textarea
          value={learning}
          onChange={(e) => setLearning(e.target.value)}
          rows={2}
          placeholder="Ex.: Subestimei blockers do vilão no river em spot 3B pot OOP."
          className="w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-ink/40"
        />
      </section>

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Target size={15} className="icon-glow text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Sugestão de drill</h3>
        </div>
        <textarea
          value={drill}
          onChange={(e) => setDrill(e.target.value)}
          rows={2}
          placeholder="Ex.: BB defense vs BTN open — 20–30bb."
          className="w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-ink/40"
        />
      </section>

      {error && (
        <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
          {error}
        </div>
      )}

      <footer className="mt-4 flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          <button
            onClick={() => persist("em_revisao")}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-hairline px-4 py-3 text-sm text-ink disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar rascunho
          </button>
          <button
            onClick={() => persist("concluida")}
            disabled={saving || !canConclude}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-ink px-4 py-3 text-sm font-semibold text-void disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Concluir revisão
          </button>
        </div>
      </footer>
    </>
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg text-ink">{review.title || "Mão sem título"}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {review.tags.map((t) => (
              <span key={t.id} className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                {t.label}
              </span>
            ))}
            {/* Marcadores totalmente editaveis (pedido explicito) — abre
                o mesmo padrao de chip usado na criacao da mao avulsa,
                agora tambem disponivel aqui na revisao. */}
            <button
              onClick={() => setTagEditorOpen((v) => !v)}
              className="flex items-center gap-1 rounded border border-dashed border-hairline px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:border-ink/40 hover:text-review"
            >
              <TagIcon size={10} /> {review.tags.length === 0 ? "Marcar" : "Editar"}
            </button>
          </div>

          {tagEditorOpen && (
            <div className="mt-2 rounded-lg border border-hairline bg-void p-2.5">
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
                <button
                  onClick={handleCreateTag}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-void"
                >
                  <Plus size={11} /> Criar
                </button>
              </div>
            </div>
          )}

          {/* Vinculo com sessao de banca -- editavel a qualquer momento
              agora (antes so' dava pra escolher na criacao da mao, sem
              jeito de corrigir depois). */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {linkedSession ? (
              <Link
                href="/banca"
                className="flex items-center gap-1 rounded border border-training/30 bg-training/[0.12] px-1.5 py-0.5 text-training transition-colors hover:border-training/60"
              >
                <Wallet size={10} />
                {[linkedSession.format, linkedSession.stake, linkedSession.date].filter(Boolean).join(" · ")}
              </Link>
            ) : (
              <span className="text-muted">Sem sessão de banca vinculada</span>
            )}
            <button
              onClick={() => setSessionEditorOpen((v) => !v)}
              className="flex items-center gap-1 rounded border border-dashed border-hairline px-1.5 py-0.5 text-muted transition-colors hover:border-training/50 hover:text-training"
            >
              <Link2 size={10} /> {linkedSession ? "Trocar" : "Vincular"}
            </button>
          </div>

          {sessionEditorOpen && (
            <div className="mt-2 rounded-lg border border-hairline bg-void p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {recentSessions.length === 0 && <p className="text-[11px] text-muted">Nenhuma sessão recente encontrada.</p>}
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
              {linkedSession && (
                <button
                  onClick={() => handleLinkSession(null)}
                  disabled={savingSession}
                  className="mt-2 text-[11px] text-negative disabled:opacity-50"
                >
                  Desvincular
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Salvar spot -- maos que valeram a pena guardar pra rever
              depois, com biblioteca propria (aba "Salvos"). */}
          <button
            onClick={toggleSaved}
            disabled={savingSpot}
            title={review.saved ? "Remover dos salvos" : "Salvar spot pra rever depois"}
            className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
              review.saved ? "border-ink bg-ink text-void" : "border-hairline bg-elevated text-muted hover:border-ink/40 hover:text-ink"
            }`}
          >
            <Bookmark size={15} fill={review.saved ? "currentColor" : "none"} />
          </button>

          {/* Compartilhar -- unico jeito de compartilhar mao nessa tela
              agora (pedido explicito: "existem 2 botões de compartilhar"
              -- o botao generico de compartilhamento nativo saiu, essa e'
              a MESMA modal usada em toda a Revisor de Mãos, ver
              share-hand-modal.tsx). Ela mesma busca os coaches do time e
              mostra um aviso se nao houver nenhum -- essa tela nao
              precisa checar isso de antemao. */}
          <button
            onClick={() => setShareModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </div>
      </div>

      {/* Conversa do compartilhamento: so renderiza se existir share
          envolvendo quem esta olhando (o proprio componente decide). */}
      <CoachThread reviewId={reviewId} reviewTitle={review.title || "Mão sem título"} />

      {/* Coluna da mesa aumentada (pedido explicito: "aumente a tela
          aqui") — era 1fr/1.3fr, agora 0.8fr/1.5fr. Perguntas ficaram
          mais compactas (ver secondaryContent) pra compensar o espaco
          menor. */}
      {parsedHandForTable ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.5fr]">
          <div>{secondaryContent}</div>
          <div>
            {/* Sem reviewId/onOpenHand aqui de proposito -- essa tela JA
                É "Analisar mão" (destino do botão "Analisar mão" da
                mesa em outros contextos), então os botões "Salvar" e
                "Compartilhar" nativos da mesa ficam ocultos (o header
                acima já tem os seus próprios). Evita duplicar a mesma
                ação duas vezes na mesma tela. */}
            <RevisorHandTable parsedHand={parsedHandForTable} />
          </div>
        </div>
      ) : (
        <>
          {(review.free_text || review.hand_history) && (
            <section className="mb-3.5 rounded-xl border border-hairline bg-surface p-4">
              <h3 className="m-0 text-sm font-semibold text-ink">Contexto</h3>
              {review.free_text && <p className="mt-2 text-[13px] leading-relaxed text-ink/85">{review.free_text}</p>}
              {review.hand_history && (
                <pre className="mt-2.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-void p-2.5 font-mono text-[11px] text-muted">
                  {review.hand_history}
                </pre>
              )}
            </section>
          )}
          {secondaryContent}
        </>
      )}

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
