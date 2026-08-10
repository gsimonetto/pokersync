"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Clock, CheckCircle2, PlayCircle, Trash2, Image as ImageIcon, Trophy, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThumbUrl, deleteReview, type ReviewListItem } from "@/lib/services/hand-review-service";
import { listSessionsWithCount, type HandSessionWithCount } from "@/lib/services/hand-session-service";
import { LeaksCard } from "./leaks-card";

const FILTERS = [
  { id: "todas", label: "Todas", status: null as string | null },
  { id: "pendente", label: "Pendentes", status: "pendente" },
  { id: "em_revisao", label: "Em revisão", status: "em_revisao" },
  { id: "concluida", label: "Concluídas", status: "concluida" },
];

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof Clock }> = {
  pendente: { label: "Pendente", color: "#f59e0b", Icon: Clock },
  em_revisao: { label: "Em revisão", color: "#3b82f6", Icon: PlayCircle },
  concluida: { label: "Concluída", color: "#10b981", Icon: CheckCircle2 },
};

// Duas abas (2026-08 v2): "Sessões" — torneios/cash agrupados, virou a
// visao principal — e "Mãos avulsas" — o comportamento antigo (lista flat
// de hand_reviews), preservado pra maos manuais/print e importacoes
// antigas anteriores ao agrupamento (que ficam sem hand_session_id e
// deliberadamente nao aparecem em Sessões, por decisao: "ignorar antigas").
type Tab = "sessoes" | "avulsas";

export function RevisorFila({
  onNova,
  onOpen,
  onOpenSession,
}: {
  onNova: () => void;
  onOpen: (id: string) => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessoes");

  // ---- Sessões ----
  const [sessionsList, setSessionsList] = useState<HandSessionWithCount[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");

  // ---- Mãos avulsas (comportamento antigo) ----
  const [filter, setFilter] = useState("todas");
  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  useEffect(() => {
    if (!userId || tab !== "sessoes") return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  useEffect(() => {
    if (!userId || tab !== "avulsas") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, tab]);

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const rows = await listSessionsWithCount(userId!);
      setSessionsList(rows);
    } catch {
      setSessionsError("Erro ao carregar torneios/sessões.");
    } finally {
      setSessionsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const status = FILTERS.find((f) => f.id === filter)?.status;
      // Bug corrigido (2026-08): listReviews trazia TODAS as maos do
      // usuario, inclusive as ja vinculadas a um torneio/sessao — mao
      // importada aparecia duplicada aqui E na aba Sessoes. "Avulsas"
      // agora exclui explicitamente qualquer review com hand_session_id
      // preenchido, via query direta (listReviews nao expoe esse filtro).
      const supabase = createClient();
      let q = supabase
        .from("hand_reviews")
        .select(
          `
          id, title, free_text, status, created_at, updated_at, concluded_at,
          hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) ),
          hand_review_images ( id, storage_path, position )
        `
        )
        .eq("user_id", userId!)
        .is("hand_session_id", null)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: ReviewListItem[] = (data ?? []).map((r: any) => ({
        ...r,
        tags: (r.hand_review_tag_links ?? []).map((l: any) => l.hand_review_tags).filter(Boolean),
        thumb: r.hand_review_images?.[0]?.storage_path || null,
      }));
      setItems(rows);
      const urls: Record<string, string | null> = {};
      await Promise.all(
        rows.map(async (r) => {
          if (r.thumb) urls[r.id] = await getThumbUrl(r.thumb);
        })
      );
      setThumbs(urls);
    } catch {
      setError("Erro ao carregar mãos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta mão? Ação não pode ser desfeita.")) return;
    try {
      await deleteReview(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Erro ao excluir.");
    }
  }

  // Leva pro Modo Treino ja filtrado pela sugestao vinculada ao leak.
  // drill_id aqui e' o id de hand_review_drill_suggestions (confirmado na
  // definicao da RPC suggest_drills_for_user) — e' o que /treino espera.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePractice(leak: any) {
    if (!leak?.drill_id) return;
    router.push(`/treino?suggestionId=${leak.drill_id}`);
  }

  const counts = useMemo(() => {
    const acc: Record<string, number> = { pendente: 0, em_revisao: 0, concluida: 0 };
    items.forEach((r) => {
      if (acc[r.status] !== undefined) acc[r.status]++;
    });
    return acc;
  }, [items]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("sessoes")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              tab === "sessoes" ? "border-review bg-review text-void" : "border-hairline bg-transparent text-ink"
            }`}
          >
            Torneios e sessões
          </button>
          <button
            onClick={() => setTab("avulsas")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              tab === "avulsas" ? "border-review bg-review text-void" : "border-hairline bg-transparent text-ink"
            }`}
          >
            Mãos avulsas
          </button>
        </div>
        <button
          onClick={onNova}
          className="inline-flex items-center gap-1.5 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void"
        >
          <Plus size={16} />
          Nova mão
        </button>
      </div>

      {tab === "sessoes" && (
        <>
          {sessionsError && (
            <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
              {sessionsError}
            </div>
          )}

          {sessionsLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
              Carregando…
            </div>
          ) : sessionsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center">
              <Trophy size={32} className="text-elevated" />
              <p className="mt-3 text-muted">Nenhum torneio ou sessão de cash ainda.</p>
              <p className="mt-1 text-xs text-muted">
                Cole uma hand history em &quot;Nova mão&quot; — o torneio é criado automaticamente.
              </p>
              <button
                onClick={onNova}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void"
              >
                <Plus size={16} />
                Importar primeira mão
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {sessionsList.map((s) => {
                const showsBounty = s.kind === "tournament" && (s.format_type === "pko" || s.format_type === "mystery");
                return (
                  <li
                    key={s.id}
                    onClick={() => onOpenSession(s.id)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-review/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-void">
                      {s.kind === "tournament" ? (
                        <Trophy size={18} className="text-review" />
                      ) : (
                        <Coins size={18} className="text-evolution" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{s.label}</span>
                        {showsBounty && s.bounty_current != null && (
                          <span className="shrink-0 rounded-full border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FBBF24]">
                            Bounty ${s.bounty_current}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                        {s.kind === "tournament" && s.format_type && (
                          <span className="uppercase tracking-wide">
                            {s.format_type === "pko" ? "PKO" : s.format_type === "mystery" ? "Mystery" : "Regular"}
                          </span>
                        )}
                        <span>· {s.hand_count} mão{Number(s.hand_count) === 1 ? "" : "s"}</span>
                        <span>· {formatDate(s.updated_at)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "avulsas" && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active ? "border-review bg-review text-void" : "border-hairline bg-transparent text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
              {error}
            </div>
          )}

          <LeaksCard onPractice={handlePractice} />

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center">
              <BookOpen size={32} className="text-elevated" />
              <p className="mt-3 text-muted">Nenhuma mão avulsa aqui ainda.</p>
              <button
                onClick={onNova}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void"
              >
                <Plus size={16} />
                Registrar primeira mão
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pendente;
                const StatusIcon = meta.Icon;
                return (
                  <li
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className="flex cursor-pointer gap-3 rounded-xl border border-hairline bg-surface p-3 transition-colors hover:border-review/40"
                  >
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-void">
                      {thumbs[r.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbs[r.id]!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={22} className="text-elevated" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{r.title || "Mão sem título"}</span>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                          style={{ color: meta.color, borderColor: meta.color }}
                        >
                          <StatusIcon size={12} />
                          {meta.label}
                        </span>
                      </div>

                      {r.free_text && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">
                          {r.free_text.length > 90 ? r.free_text.slice(0, 90) + "…" : r.free_text}
                        </p>
                      )}

                      {r.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.tags.slice(0, 4).map((t) => (
                            <span
                              key={t.id}
                              className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review"
                            >
                              {t.label}
                            </span>
                          ))}
                          {r.tags.length > 4 && (
                            <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                              +{r.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted">{formatDate(r.created_at)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(r.id);
                          }}
                          className="p-1 text-muted"
                          aria-label="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {items.length > 0 && (
            <div className="mt-5 flex justify-around rounded-[10px] border border-hairline bg-void p-3 text-xs text-muted">
              <span>
                Pendentes: <b className="text-[#f59e0b]">{counts.pendente}</b>
              </span>
              <span>
                Em revisão: <b className="text-[#3b82f6]">{counts.em_revisao}</b>
              </span>
              <span>
                Concluídas: <b className="text-[#10b981]">{counts.concluida}</b>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
