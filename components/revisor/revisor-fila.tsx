"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Clock, CheckCircle2, PlayCircle, Trash2, Image as ImageIcon, Trophy, Coins, Flag, Search, X, Medal, Hash, HelpCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThumbUrl, deleteReview, fetchReviewSummary, type ReviewListItem, type ReviewSummary } from "@/lib/services/hand-review-service";
import { listSessionsWithCount, type HandSessionWithCount } from "@/lib/services/hand-session-service";
import { LeaksCard } from "./leaks-card";
import { useConfirm } from "@/components/confirm-dialog";
import { FilterChip } from "@/components/ui/filter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
  filterHandIds,
  filterLabel,
  onClearFilter,
}: {
  onNova: () => void;
  onOpen: (id: string) => void;
  onOpenSession: (sessionId: string) => void;
  // Deep-link "?hands=id1,id2&label=..." (vem de Análise: clicar numa
  // posição/matchup/leak leva direto pra cá já filtrado, em vez de expandir
  // uma lista solta na própria tela de Análise) — quando presente, substitui
  // as abas Sessões/Avulsas por uma lista flat só com essas mãos.
  filterHandIds?: string[];
  filterLabel?: string;
  onClearFilter?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessoes");

  // ---- Lista filtrada (deep-link de Análise) ----
  const [filteredItems, setFilteredItems] = useState<ReviewListItem[]>([]);
  const [filteredThumbs, setFilteredThumbs] = useState<Record<string, string | null>>({});
  const [filteredLoading, setFilteredLoading] = useState(true);
  const [filteredError, setFilteredError] = useState("");
  const hasFilter = !!filterHandIds && filterHandIds.length > 0;

  // Resumo consolidado (RPC ja existia pronta, nunca era chamada) --
  // Revisor era so uma lista de maos sem nenhum numero de topo, diferente
  // do resto do produto (Banca sempre teve Resultado/ROI/ITM).
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    fetchReviewSummary(30)
      .then(setSummary)
      .catch(() => {});
  }, []);

  // ---- Sessões ----
  const [sessionsList, setSessionsList] = useState<HandSessionWithCount[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  // Filtros da lista de torneios/sessoes (pedido explicito): chips
  // nao-exclusivos ("campeão" + "PKO" ativos ao mesmo tempo mostra
  // torneios que casam com QUALQUER um dos dois) + busca por texto no
  // nome do torneio/sessao.
  const [sessionChipFilters, setSessionChipFilters] = useState<Set<"campeao" | "pko" | "mystery">>(new Set());
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [sessionsError, setSessionsError] = useState("");

  // ---- Mãos avulsas (comportamento antigo) ----
  const [filter, setFilter] = useState("todas");
  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) setUserId(data.user.id);
        else {
          // Sem usuario autenticado: sai do "Carregando..." em vez de
          // travar pra sempre (as duas listas so' carregam quando
          // userId existe).
          setSessionsLoading(false);
          setLoading(false);
        }
      } catch {
        // createClient() lanca sincrono se as envs do Supabase nao
        // estiverem configuradas -- sem o catch a excecao escapava do
        // useEffect e o userId nunca era setado, deixando as duas
        // listas presas em "Carregando..." pra sempre (mesmo bug ja
        // corrigido em app/modulos, app/hub e components/top-nav.tsx).
        setSessionsError("Erro ao carregar torneios/sessões.");
        setSessionsLoading(false);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId || tab !== "sessoes" || hasFilter) return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab, hasFilter]);

  useEffect(() => {
    if (!userId || tab !== "avulsas" || hasFilter) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, tab, hasFilter]);

  useEffect(() => {
    if (!userId || !hasFilter) return;
    loadFiltered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filterHandIds?.join(",")]);

  async function loadFiltered() {
    setFilteredLoading(true);
    setFilteredError("");
    try {
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from("hand_reviews")
        .select(
          `
          id, title, free_text, status, created_at, updated_at, concluded_at,
          hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) ),
          hand_review_images ( id, storage_path, position )
        `
        )
        .eq("user_id", userId!)
        .in("id", filterHandIds!)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: ReviewListItem[] = (data ?? []).map((r: any) => ({
        ...r,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: (r.hand_review_tag_links ?? []).map((l: any) => l.hand_review_tags).filter(Boolean),
        thumb: r.hand_review_images?.[0]?.storage_path || null,
      }));
      setFilteredItems(rows);
      const urls: Record<string, string | null> = {};
      await Promise.all(
        rows.map(async (r) => {
          if (r.thumb) urls[r.id] = await getThumbUrl(r.thumb);
        })
      );
      setFilteredThumbs(urls);
    } catch {
      setFilteredError("Erro ao carregar as mãos desse filtro.");
    } finally {
      setFilteredLoading(false);
    }
  }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!(await confirm({ title: "Excluir mão", message: "Essa ação não pode ser desfeita.", confirmLabel: "Excluir" }))) return;
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

  function toggleSessionChip(chip: "campeao" | "pko" | "mystery") {
    setSessionChipFilters((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  const filteredSessions = useMemo(() => {
    const q = sessionSearchQuery.trim().toLowerCase();
    return sessionsList.filter((s) => {
      if (sessionChipFilters.size > 0) {
        const matches =
          (sessionChipFilters.has("campeao") && s.champion) ||
          (sessionChipFilters.has("pko") && s.format_type === "pko") ||
          (sessionChipFilters.has("mystery") && s.format_type === "mystery");
        if (!matches) return false;
      }
      if (q && !s.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sessionsList, sessionChipFilters, sessionSearchQuery]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { pendente: 0, em_revisao: 0, concluida: 0 };
    items.forEach((r) => {
      if (acc[r.status] !== undefined) acc[r.status]++;
    });
    return acc;
  }, [items]);

  if (hasFilter) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{filterLabel || "Mãos filtradas"}</p>
            <p className="text-[11px] text-muted">
              {filterHandIds!.length} {filterHandIds!.length === 1 ? "mão" : "mãos"} — vindas da Análise
            </p>
          </div>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              <X size={13} />
              Limpar filtro
            </button>
          )}
        </div>

        {filteredError && (
          <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{filteredError}</div>
        )}

        {filteredLoading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
            Carregando…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
            Nenhuma mão encontrada pra esse filtro.
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filteredItems.map((r, idx) => (
              <ReviewCard key={r.id} item={r} thumb={filteredThumbs[r.id]} onOpen={() => onOpen(r.id)} delayMs={Math.min(idx, 10) * 30} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      {summary && summary.totalReviews > 0 && (
        <div className="fade-in-up mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <SummaryStat icon={Hash} label="Mãos (30d)" value={String(summary.totalReviews)} accent="#5AA6E0" />
          <SummaryStat icon={CheckCircle2} label="Concluídas" value={String(summary.totalConcluded)} accent="#10b981" />
          <SummaryStat icon={CheckCircle2} label="Acertei" value={String(summary.totalCorrect)} accent="#10b981" />
          <SummaryStat icon={XCircle} label="Errei" value={String(summary.totalErrors)} accent="#ef4444" />
          <SummaryStat icon={HelpCircle} label="Dúvida" value={String(summary.totalDoubts)} accent="#f59e0b" />
        </div>
      )}
      {summary && (summary.worstStreet || summary.worstCategory) && (
        <p className="mb-4 text-xs text-muted">
          Pior rua nos últimos 30 dias:{" "}
          <span className="font-semibold text-ink">{summary.worstStreet ? summary.worstStreet.toUpperCase() : "—"}</span>
          {summary.worstCategory && (
            <>
              {" "}
              · categoria de erro mais comum: <span className="font-semibold text-ink">{summary.worstCategory}</span>
            </>
          )}
        </p>
      )}

      {/* Toolbar unica: abas + chips + busca + acao principal na mesma
          linha -- mesmo padrao do Funil (Time > Painel), em vez de cada
          grupo de filtro numa linha separada. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "sessoes", label: "Torneios e sessões" },
            { value: "avulsas", label: "Mãos avulsas" },
          ]}
        />

        {tab === "sessoes" && (
          <>
            <FilterChip
              label="Campeão"
              icon={<Trophy size={12} />}
              active={sessionChipFilters.has("campeao")}
              onClick={() => toggleSessionChip("campeao")}
            />
            <FilterChip label="PKO" active={sessionChipFilters.has("pko")} onClick={() => toggleSessionChip("pko")} />
            <FilterChip
              label="Mystery"
              active={sessionChipFilters.has("mystery")}
              onClick={() => toggleSessionChip("mystery")}
            />
            <button
              onClick={() => {
                setSessionSearchOpen((v) => !v);
                if (sessionSearchOpen) setSessionSearchQuery("");
              }}
              title="Buscar torneios/sessões"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                sessionSearchOpen ? "border-ink bg-ink text-void" : "border-hairline text-muted hover:border-ink/40 hover:text-ink"
              }`}
            >
              <Search size={13} />
            </button>
          </>
        )}

        {tab === "avulsas" &&
          FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}

        <button
          onClick={onNova}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-void"
        >
          <Plus size={16} />
          Nova mão
        </button>
      </div>

      {tab === "sessoes" && sessionSearchOpen && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-hairline bg-void px-3 py-2">
          <Search size={13} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={sessionSearchQuery}
            onChange={(e) => setSessionSearchQuery(e.target.value)}
            placeholder="Buscar pelo nome do torneio ou sessão"
            className="flex-1 bg-transparent text-[13px] text-ink outline-none"
          />
          {sessionSearchQuery && (
            <button onClick={() => setSessionSearchQuery("")}>
              <X size={13} className="text-muted" />
            </button>
          )}
        </div>
      )}

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
                Cole uma hand history em &quot;Nova mão&quot; (botão acima) — o torneio é criado automaticamente.
              </p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
              Nenhum torneio/sessão encontrado pra esse filtro.
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {filteredSessions.map((s, idx) => {
                const showsBounty = s.kind === "tournament" && (s.format_type === "pko" || s.format_type === "mystery");
                return (
                  <li
                    key={s.id}
                    onClick={() => onOpenSession(s.id)}
                    style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
                    className="fade-in-up flex cursor-pointer items-center gap-3 rounded-xl border border-hairline bg-surface p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-lg"
                  >
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-void">
                      {/* Icone generico de torneio virou "Flag" (pedido
                          explicito): a taca deixou de ser automatica pra
                          TODO torneio — agora so aparece (selo no canto)
                          quando a sessao realmente foi vencida pelo
                          heroi (s.champion, setado automaticamente ao
                          detectar ParsedHand.wonTournament no import). */}
                      {s.kind === "tournament" ? (
                        <Flag size={18} className="text-review" />
                      ) : (
                        <Coins size={18} className="text-evolution" />
                      )}
                      {s.champion && (
                        <span
                          title="Campeão do torneio"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-evolution shadow-[0_0_8px_rgba(245,158,11,.65)]"
                        >
                          <Trophy size={11} className="text-void" />
                        </span>
                      )}
                      {!s.champion && s.final_place === 2 && (
                        <span
                          title="2º lugar"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#C0C6CC] shadow-[0_0_8px_rgba(192,198,204,.55)]"
                        >
                          <Medal size={11} className="text-void" />
                        </span>
                      )}
                      {!s.champion && s.final_place === 3 && (
                        <span
                          title="3º lugar"
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#CD7F32] shadow-[0_0_8px_rgba(205,127,50,.55)]"
                        >
                          <Medal size={11} className="text-void" />
                        </span>
                      )}
                      {/* FT (mesa final): heroi eliminado dentro do tamanho
                          da mesa final da propria mao, mas fora do podio —
                          ver heuristica/cautela em heroFinishPlace no
                          hand-parser.ts. Selo em texto (nao tem icone
                          universal pra "final table"). */}
                      {!s.champion && s.final_place == null && s.reached_ft && (
                        <span
                          title="Chegou na mesa final"
                          className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 shadow-[0_0_8px_rgba(255,255,255,.35)]"
                        >
                          <span className="text-[8.5px] font-bold text-void">FT</span>
                        </span>
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
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((r, idx) => (
                <ReviewCard key={r.id} item={r} thumb={thumbs[r.id]} onOpen={() => onOpen(r.id)} onDelete={() => handleDelete(r.id)} delayMs={Math.min(idx, 10) * 30} />
              ))}
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

// Card de mão avulsa — usado tanto na aba "Mãos avulsas" quanto na lista
// filtrada vinda da Análise (deep-link ?hands=), pra não duplicar o mesmo
// bloco de ~70 linhas duas vezes. `onDelete` some (sem lixeira) na lista
// filtrada: excluir uma mão dali não é uma ação que faz sentido nesse
// contexto de "auditoria de um número".
function ReviewCard({
  item: r,
  thumb,
  onOpen,
  onDelete,
  delayMs = 0,
}: {
  item: ReviewListItem;
  thumb: string | null | undefined;
  onOpen: () => void;
  onDelete?: () => void;
  delayMs?: number;
}) {
  const meta = STATUS_META[r.status] || STATUS_META.pendente;
  const StatusIcon = meta.Icon;
  return (
    <li
      onClick={onOpen}
      style={{ animationDelay: `${delayMs}ms` }}
      className="fade-in-up flex cursor-pointer gap-3 rounded-xl border border-hairline bg-surface p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-lg"
    >
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-void">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
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
          <p className="mt-1.5 text-xs leading-relaxed text-muted">{r.free_text.length > 90 ? r.free_text.slice(0, 90) + "…" : r.free_text}</p>
        )}

        {r.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {r.tags.slice(0, 4).map((t) => (
              <span key={t.id} className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                {t.label}
              </span>
            ))}
            {r.tags.length > 4 && (
              <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">+{r.tags.length - 4}</span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted">{formatDate(r.created_at)}</span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 text-muted"
              aria-label="Excluir"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-lg border bg-surface p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: `${accent}30` }}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        <Icon size={11} className="icon-glow" style={{ color: accent }} />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}
