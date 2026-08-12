"use client";

import { useEffect, useState } from "react";
import { Save, CheckCircle2, HelpCircle, Lightbulb, Target, Loader2, Scale, Share2, Check as CheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  type ReviewDetail,
  type ReviewAnswer,
  type StreetEval,
  type Reason,
  type Street,
  type ManualTicket,
} from "@/lib/services/hand-review-service";
import { parseHand, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { RevisorHandTable } from "./revisor-hand-table";

const FORMATS = ["MTT", "Cash", "SNG", "Spin"];
const ACTIONS = ["Fold", "Call", "Raise", "Check", "Bet", "All-in"];

function ShareButton({ review, parsedHand }: { review: ReviewDetail; parsedHand: ParsedHand | null }) {
  const [copied, setCopied] = useState(false);

  function buildShareText(): string {
    const lines: string[] = [];
    lines.push(review.title || "Mão de poker — PokerSync");
    if (parsedHand) {
      if (parsedHand.heroPosition) lines.push(`Posição: ${parsedHand.heroPosition}`);
      if (parsedHand.smallBlind && parsedHand.bigBlind) lines.push(`Blinds: ${parsedHand.smallBlind}/${parsedHand.bigBlind}`);
      if (parsedHand.board.length) lines.push(`Board: ${parsedHand.board.join(" ")}`);
      if (parsedHand.pot != null) lines.push(`Pote: ${parsedHand.pot}`);
    }
    if (review.learning_note) lines.push(`\nAprendizado: ${review.learning_note}`);
    lines.push("\nRevisado no PokerSync");
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildShareText();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: review.title || "Mão de poker", text });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencioso
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink"
    >
      {copied ? <CheckIcon size={14} className="text-positive" /> : <Share2 size={14} />}
      {copied ? "Copiado" : "Compartilhar"}
    </button>
  );
}

function GuidedQuestionChip({
  index,
  question,
  answer,
  onChange,
}: {
  index: number;
  question: string;
  answer: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const answered = answer.trim().length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[12px] transition-colors ${
          answered ? "border-review/50 bg-review/10 text-ink" : "border-hairline bg-void text-ink/85"
        }`}
      >
        <span
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8.5px] font-bold ${
            answered ? "bg-review text-void" : "border border-hairline text-muted"
          }`}
        >
          {answered ? "✓" : index + 1}
        </span>
        <span className="flex-1 truncate">{question}</span>
      </button>
      {open && (
        <textarea
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Sua análise…"
          className="mt-1.5 w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-review"
        />
      )}
    </div>
  );
}

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

  const [parsedHandForTable, setParsedHandForTable] = useState<ParsedHand | null>(null);

  const [ticket, setTicket] = useState<ManualTicket>({ format: "", street: "preflop" as Street, action: "" });
  const [ticketSaved, setTicketSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
      await load();
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
      } else {
        setParsedHandForTable(null);
      }

      const existing = r.answers || [];
      const questions = existing.length
        ? existing.map((a) => ({ question: a.question, answer: a.answer || "" }))
        : suggestGuidedQuestions(
            r.tags,
            r.parsed_data?.kind === "parsed" ? { board: r.parsed_data.board, heroPosition: r.parsed_data.heroPosition } : null
          ).map((q) => ({ question: q, answer: "" }));
      setQas(questions);

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
    } catch {
      setError("Erro ao carregar a mão.");
    } finally {
      setLoading(false);
    }
  }

  function updateAnswer(idx: number, val: string) {
    setQas((prev) => prev.map((q, i) => (i === idx ? { ...q, answer: val } : q)));
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
        setTimeout(() => onBack(), missionsCompleted.length ? 2000 : 500);
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
  const isPrintOnly = review.source === "print" || (!review.hand_history && review.parsed_data?.kind !== "parsed");

  // Secoes mais compactas (pedido explicito: "diminua as perguntas") —
  // padding p-4->p-3, margens mb-3.5->mb-2.5, chips e textarea menores
  // (ver GuidedQuestionChip acima). Objetivo: sobrar mais espaco visual
  // pra coluna da mesa, que ficou maior (ver grid abaixo).
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

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-review" />
            <h3 className="m-0 text-sm font-semibold text-ink">Perguntas guiadas</h3>
          </div>
          <span className="text-[11px] text-muted">
            {answeredCount}/{qas.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {qas.map((q, i) => (
            <GuidedQuestionChip
              key={i}
              index={i}
              question={q.question}
              answer={q.answer}
              onChange={(val) => updateAnswer(i, val)}
            />
          ))}
        </div>
      </section>

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Scale size={15} className="text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Auto-avaliação por street</h3>
        </div>

        <div className="flex flex-col gap-2">
          {streetEvals.map((ev, idx) => (
            <div key={ev.street} className="rounded-lg border border-hairline bg-void p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-ink/85">{ev.street}</span>
                <div className="flex gap-1">
                  {RATINGS.map((r) => {
                    const active = ev.self_rating === r.code;
                    return (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() =>
                          setStreetEvals((prev) => prev.map((e, i) => (i === idx ? { ...e, self_rating: r.code } : e)))
                        }
                        className="rounded-md border px-1.5 py-0.5 text-[10.5px] transition-colors"
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
              </div>

              {ev.self_rating === "errei" && (
                <select
                  value={ev.reason_code}
                  onChange={(e) =>
                    setStreetEvals((prev) => prev.map((x, i) => (i === idx ? { ...x, reason_code: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-hairline bg-void px-2 py-1.5 text-[11.5px] text-ink outline-none"
                >
                  <option value="">Motivo do erro…</option>
                  {reasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb size={15} className="text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Registro de aprendizado</h3>
        </div>
        <textarea
          value={learning}
          onChange={(e) => setLearning(e.target.value)}
          rows={2}
          placeholder="Ex.: Subestimei blockers do vilão no river em spot 3B pot OOP."
          className="w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-review"
        />
      </section>

      <section className="mb-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Target size={15} className="text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Sugestão de drill</h3>
        </div>
        <textarea
          value={drill}
          onChange={(e) => setDrill(e.target.value)}
          rows={2}
          placeholder="Ex.: BB defense vs BTN open — 20–30bb."
          className="w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-review"
        />
      </section>

      {error && (
        <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
          {error}
        </div>
      )}

      <footer className="mt-4 flex gap-2.5">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-review px-4 py-3 text-sm font-semibold text-void disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Concluir revisão
        </button>
      </footer>
    </>
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg text-ink">{review.title || "Mão sem título"}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {review.tags.map((t) => (
              <span key={t.id} className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <ShareButton review={review} parsedHand={parsedHandForTable} />
      </div>

      {/* Coluna da mesa aumentada (pedido explicito: "aumente a tela
          aqui") — era 1fr/1.3fr, agora 0.8fr/1.5fr. Perguntas ficaram
          mais compactas (ver secondaryContent) pra compensar o espaco
          menor. */}
      {parsedHandForTable ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.5fr]">
          <div>{secondaryContent}</div>
          <div>
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
        <div className="fixed bottom-5 left-1/2 z-[1000] flex -translate-x-1/2 flex-col items-center gap-1 rounded-xl bg-gradient-to-br from-review to-[#7c3aed] px-5 py-3 font-semibold text-white shadow-[0_8px_24px_rgba(168,85,247,0.4)]">
          <span className="text-base">+{xpFeedback.xp} XP</span>
          {xpFeedback.missions.map((m, i) => (
            <span key={i} className="text-[11px] opacity-90">
              🎯 Missão completa: +{m.xp_reward} XP
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
