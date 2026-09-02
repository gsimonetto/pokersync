"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getReview,
  suggestGuidedQuestions,
  saveAnswers,
  fetchTeamCoaches,
  fetchStreetEvals,
  shareReviewWithCoach,
  STREETS,
  RATINGS,
  type ReviewAnswer,
  type TeamCoach,
  type StreetEval,
} from "@/lib/services/hand-review-service";

// Modal de compartilhamento (pedido explicito, 2026-08): "ao clicar no
// compartilhar, abrir a modal das mesmas perguntas que tem hoje no
// analisar mao, mantendo as perguntas de selecao obrigatorias e as
// outras opcionais, no final ter o botao compartilhar com coach".
//
// Reusa DIRETO a infraestrutura ja existente em producao (descoberta ao
// ler revisor-detalhe.tsx): hand_review_shares + hand_review_share_comments
// + shareReviewWithCoach() + fetchTeamCoaches() — mesmo mecanismo que
// "Analisar mao" ja usa pro botao "Coach". NAO cria tabela nova (uma
// tentativa anterior criou uma tabela shared_hands paralela sem saber
// que isso ja existia — foi revertida). O coach ve as respostas porque
// abre a MESMA tela (RevisorDetalhe) da mao compartilhada, que ja
// carrega qas/tags/learning_note normalmente.
//
// Obrigatorio vs opcional (pedido explicito, revisado): a autoavaliacao
// por street (pre-flop/flop/turn/river, ver STREETS) e' a UNICA coisa
// obrigatoria pra enviar -- mesmo requisito usado pelo botao "Enviar ao
// coach" no rodape do RevisorDetalhe. As perguntas guiadas abaixo sao
// sempre opcionais (o jogador pode compartilhar so' com as streets
// avaliadas, sem escrever nada extra).

export function ShareHandModal({
  open,
  reviewId,
  onClose,
  onShared,
}: {
  open: boolean;
  reviewId: string;
  onClose: () => void;
  // Chamado apos compartilhar com sucesso (alem do onClose automatico) —
  // consumidor pode usar pra mostrar um toast proprio, por exemplo.
  onShared?: () => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qas, setQas] = useState<ReviewAnswer[]>([]);
  const [streetEvals, setStreetEvals] = useState<StreetEval[]>([]);
  const [title, setTitle] = useState("Mão sem título");
  const [coaches, setCoaches] = useState<TeamCoach[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSentTo(null);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        if (cancelled) return;
        setUserId(uid);

        // Mesma logica de carregamento de perguntas do RevisorDetalhe:
        // reusa respostas ja salvas se existirem, senao sugere um set
        // novo com base nas tags/board/posicao da mao.
        const r = await getReview(reviewId);
        if (cancelled) return;
        setTitle(r.title || "Mão sem título");

        const existing = r.answers || [];
        const questions = existing.length
          ? existing.map((a) => ({ question: a.question, answer: a.answer || "" }))
          : suggestGuidedQuestions(
              r.tags,
              r.parsed_data?.kind === "parsed" ? { board: r.parsed_data.board, heroPosition: r.parsed_data.heroPosition } : null
            ).map((q) => ({ question: q, answer: "" }));
        setQas(questions);

        const evals = await fetchStreetEvals(reviewId).catch(() => []);
        if (cancelled) return;
        setStreetEvals(
          STREETS.map((s) => evals.find((e) => e.street === s) ?? { street: s, self_rating: "", reason_code: "", notes: "" })
        );

        if (uid) {
          const cs = await fetchTeamCoaches(uid).catch(() => []);
          if (!cancelled) setCoaches(cs);
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a mão.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reviewId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function updateAnswer(idx: number, val: string) {
    setQas((prev) => prev.map((q, i) => (i === idx ? { ...q, answer: val } : q)));
  }

  const allStreetsRated = streetEvals.length === STREETS.length && streetEvals.every((e) => e.self_rating);

  async function handleShare(coach: TeamCoach) {
    if (!userId || !allStreetsRated) return;
    setSaving(true);
    setError("");
    try {
      // Salva as respostas ANTES de compartilhar — o coach, ao abrir a
      // mesma mao (RevisorDetalhe), ja ve tudo preenchido.
      await saveAnswers(reviewId, userId, qas);
      await shareReviewWithCoach(reviewId, coach.userId, title);
      setSentTo(coach.name);
      setTimeout(() => {
        onShared?.();
        onClose();
      }, 1400);
    } catch {
      setError("Não foi possível compartilhar com o coach.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 px-4 pb-8 pt-16 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Compartilhar com o coach</h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center text-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {/* Resumo das streets (obrigatorio) -- a avaliacao em si e'
                feita em "Analisar mao" (fica "do jeito que esta", sem
                duplicar essa UI aqui); a modal so' mostra o status e
                trava o envio se faltar alguma. */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-wide text-muted">Avaliação por street (obrigatória)</p>
              <div className="flex flex-wrap gap-1.5">
                {streetEvals.map((ev) => {
                  const rating = RATINGS.find((r) => r.code === ev.self_rating);
                  return (
                    <span
                      key={ev.street}
                      className="flex items-center gap-1.5 rounded-md border border-hairline bg-void px-2 py-1 text-[11px]"
                    >
                      <span className="uppercase text-ink/70">{ev.street}</span>
                      {rating ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: rating.color, color: "#000" }}>
                          {rating.label}
                        </span>
                      ) : (
                        <span className="text-negative">pendente</span>
                      )}
                    </span>
                  );
                })}
              </div>
              {!allStreetsRated && (
                <p className="text-[11.5px] text-negative">Avalie as 4 streets em &quot;Analisar mão&quot; antes de enviar.</p>
              )}
            </div>

            {qas.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Perguntas guiadas (opcional)</p>
                {qas.map((q, idx) => (
                  <div key={idx}>
                    <p className="text-[12.5px] font-semibold text-ink/90">{q.question}</p>
                    <textarea
                      value={q.answer}
                      onChange={(e) => updateAnswer(idx, e.target.value)}
                      rows={2}
                      placeholder="Sua análise (opcional)…"
                      className="mt-1 w-full resize-y rounded-lg border border-hairline bg-void p-2 text-[12.5px] text-ink outline-none focus:border-ink/40"
                    />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-[12.5px] text-negative">{error}</p>}

            <div className="border-t border-hairline pt-3">
              {coaches.length === 0 ? (
                <p className="text-[12.5px] text-muted">Você precisa estar vinculado a um time pra compartilhar com um coach.</p>
              ) : sentTo ? (
                <p className="text-[12.5px] text-positive">Mão compartilhada com {sentTo}!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {coaches.map((c) => (
                    <button
                      key={c.userId}
                      onClick={() => handleShare(c)}
                      disabled={saving || !allStreetsRated}
                      className="flex items-center justify-center gap-2 rounded-[10px] bg-ink px-4 py-3 text-sm font-semibold text-void disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                      Compartilhar com {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
