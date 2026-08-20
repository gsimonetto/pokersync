"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send, Loader2, Ban } from "lucide-react";
import {
  addShareComment,
  fetchShareComments,
  fetchShareThreads,
  markShareViewed,
  revokeHandShare,
  type ShareComment,
  type ShareThread,
} from "@/lib/services/hand-review-service";

// Conversa da mao compartilhada. So aparece se existir compartilhamento
// envolvendo quem esta olhando — jogador que enviou ou coach/admin que
// recebeu. Se a mao foi enviada pra mais de uma pessoa, cada conversa e'
// separada (o coach nao ve o que o jogador falou com outro coach).

export function CoachThread({ reviewId, reviewTitle }: { reviewId: string; reviewTitle: string }) {
  const [threads, setThreads] = useState<ShareThread[]>([]);
  const [ativo, setAtivo] = useState<ShareThread | null>(null);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [revogando, setRevogando] = useState(false);
  const [confirmarRevogar, setConfirmarRevogar] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchShareThreads(reviewId);
        setThreads(t);
        setAtivo(t[0] ?? null);
        const meuLado = t.find((x) => x.iAmCoach);
        if (meuLado) markShareViewed(meuLado.shareId).catch(() => {});
      } catch {
        // sem compartilhamento ou sem permissao: componente nao aparece
      } finally {
        setLoading(false);
      }
    })();
  }, [reviewId]);

  useEffect(() => {
    if (!ativo) return;
    fetchShareComments(ativo.shareId)
      .then(setComments)
      .catch(() => setComments([]));
  }, [ativo]);

  async function enviar() {
    if (!ativo || !texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      const novo = await addShareComment(ativo, texto, reviewId, reviewTitle);
      setComments((prev) => [...prev, novo]);
      setTexto("");
    } catch {
      setErro("Não foi possível enviar o comentário.");
    } finally {
      setEnviando(false);
    }
  }

  async function revogar() {
    if (!ativo || ativo.iAmCoach) return;
    setRevogando(true);
    setErro("");
    try {
      await revokeHandShare(ativo.shareId);
      const restantes = threads.filter((t) => t.shareId !== ativo.shareId);
      setThreads(restantes);
      setAtivo(restantes[0] ?? null);
      setConfirmarRevogar(false);
    } catch {
      setErro("Não foi possível revogar o compartilhamento.");
    } finally {
      setRevogando(false);
    }
  }

  if (loading || threads.length === 0 || !ativo) return null;

  return (
    <section className="mb-3.5 rounded-xl border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <MessageSquare size={14} className="text-training" />
          {ativo.iAmCoach ? `Análise para ${ativo.counterpartName}` : "Conversa com o coach"}
        </h3>

        {!ativo.iAmCoach && (
          confirmarRevogar ? (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-negative">Revogar acesso do coach a esta mão?</span>
              <button
                onClick={revogar}
                disabled={revogando}
                className="rounded-md bg-negative px-2 py-1 font-semibold text-void disabled:opacity-50"
              >
                {revogando ? "Revogando…" : "Confirmar"}
              </button>
              <button onClick={() => setConfirmarRevogar(false)} className="rounded-md border border-hairline px-2 py-1 text-muted">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmarRevogar(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-negative"
              aria-label="Revogar compartilhamento"
            >
              <Ban size={12} /> Revogar
            </button>
          )
        )}

        {threads.length > 1 && (
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {threads.map((t) => (
              <button
                key={t.shareId}
                onClick={() => setAtivo(t)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  ativo.shareId === t.shareId ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}
              >
                {t.counterpartName}
              </button>
            ))}
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          {ativo.iAmCoach
            ? "Escreva sua análise — o jogador é avisado assim que você enviar."
            : `Aguardando a análise de ${ativo.counterpartName}.`}
        </p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg border px-3 py-2 ${
                c.isMine ? "border-hairline bg-elevated" : "border-training/30 bg-training/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink">{c.isMine ? "Você" : c.authorName}</span>
                <span className="text-[10px] text-muted">
                  {new Date(c.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="mt-2 text-[12px] text-negative">{erro}</p>}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder={ativo.iAmCoach ? "Escreva sua análise…" : "Responder ao coach…"}
          className="min-w-0 flex-1 resize-none rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-training/50"
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          aria-label="Enviar comentário"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-void transition-transform hover:scale-105 disabled:opacity-40"
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </section>
  );
}
