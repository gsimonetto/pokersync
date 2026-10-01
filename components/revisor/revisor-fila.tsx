"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Clock, CheckCircle2, PlayCircle, Trash2, Image as ImageIcon, Trophy, Spade, Search, X, Eye, ChevronRight, PenLine, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThumbUrl, deleteReview, type ReviewListItem } from "@/lib/services/hand-review-service";
import { excluirTorneio, listSessionsWithCount, type HandSessionWithCount } from "@/lib/services/hand-session-service";
import { useConfirm } from "@/components/confirm-dialog";
import { FilterChip } from "@/components/ui/filter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fetchRadarModuleScope } from "@/lib/services/radar-module-scope-service";
import { fetchTournamentPayouts } from "@/lib/services/tournament-payout-service";
import { fetchBountiesDosTorneios } from "@/lib/services/bankroll-service";
import {
  CardTorneio,
  diaDoTorneio,
  estadoDaRevisao,
  rotuloDoDia,
  resultadoDoTorneio,
  type ColocacaoTorneio,
  type ProgressoTorneio,
} from "@/components/revisor/lista-torneios";
import {
  BotaoFiltros,
  FILTROS_VAZIOS,
  PainelFiltros,
  faixaDoBuyin,
  faixaDoStack,
  temFiltroDeMao,
  totalDeFiltros,
  type FiltrosFila,
  type FormatoTorneio,
} from "@/components/revisor/filtros-fila";
import { HalfCard } from "@/components/drill/card";

const IMPORTED_HAND_SOURCES = ["agent", "import"];

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

const CHAVE_FILTROS = "revisor:filtros-fila";

// Mão lida pros filtros de posição/stack/all-in (só os campos que eles usam).
interface MaoFiltravel {
  id: string;
  sessao: string | null;
  titulo: string | null;
  posicao: string | null;
  stackBb: number | null;
  allIn: boolean;
  cartas: string[];
}

export function RevisorFila({
  onNova,
  onOpen,
  onOpenSession,
  onOpenMaos,
}: {
  onNova: () => void;
  onOpen: (id: string) => void;
  onOpenSession: (sessionId: string) => void;
  /** Abre na mesa as mãos que bateram nos filtros, a partir da clicada. */
  onOpenMaos: (reviewIds: string[], selectedId: string) => void;
}) {
  const confirm = useConfirm();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessoes");

  // ---- Sessões ----
  const [sessionsList, setSessionsList] = useState<HandSessionWithCount[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  // Busca por texto no nome do torneio/sessao (chips de Campeão/PKO/Mystery
  // removidos, pedido explicito: "esse filtro pode tirar, manter apenas a
  // lupa").
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  // Colocação/prêmio (resumo do torneio, por id da sala) e bounties ganhos
  // (por torneio) -- complementos do card; se falharem, o card mostra "—".
  const [colocacoes, setColocacoes] = useState<Map<string, ColocacaoTorneio>>(new Map());
  const [bountiesGanhos, setBountiesGanhos] = useState<Map<string, number>>(new Map());
  const [filtroRevisao, setFiltroRevisao] = useState<"todos" | "pendentes" | "revisados">("todos");
  // Os filtros sobrevivem à ida pra mesa e à volta (a Fila remonta):
  // ficam guardados nesta aba do navegador.
  const [filtros, setFiltrosEstado] = useState<FiltrosFila>(FILTROS_VAZIOS);
  const setFiltros = (f: FiltrosFila) => {
    setFiltrosEstado(f);
    try {
      sessionStorage.setItem(CHAVE_FILTROS, JSON.stringify(f));
    } catch {
      // sem armazenamento: o filtro vale só enquanto a tela está aberta
    }
  };
  const [painelFiltros, setPainelFiltros] = useState(false);
  // Lido depois de montar (no servidor não existe sessionStorage).
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(CHAVE_FILTROS);
      if (!salvo) return;
      const f = { ...FILTROS_VAZIOS, ...JSON.parse(salvo) } as FiltrosFila;
      setFiltrosEstado(f);
      if (totalDeFiltros(f) > 0) setPainelFiltros(true);
    } catch {
      // filtro salvo ilegível: começa sem filtro
    }
  }, []);
  // Mãos pros filtros de mão: lidas uma vez, só quando um deles é ligado.
  const [maosFiltraveis, setMaosFiltraveis] = useState<MaoFiltravel[] | null>(null);
  const [carregandoMaos, setCarregandoMaos] = useState(false);

  // ---- Mãos avulsas (comportamento antigo) ----
  const [filter, setFilter] = useState("todas");
  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Corte do botão do Radar (ver components/radar/radar-module-menu.tsx) --
  // quando setado, esconde mão/sessão IMPORTADA pelo Radar de antes desse
  // instante. Mão colada/print à mão nunca é escondida.
  const [radarSince, setRadarSince] = useState<string | null>(null);
  // Ids de hand_sessions visíveis dado o corte -- null = sem corte, todas
  // visíveis. Uma sessão só é escondida se TODAS as suas mãos forem
  // importadas e anteriores ao corte (sessão com pelo menos 1 mão manual
  // ou 1 mão recente continua aparecendo).
  const [radarVisibleSessionIds, setRadarVisibleSessionIds] = useState<Set<string> | null>(null);

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
    fetchRadarModuleScope("revisor")
      .then((s) => setRadarSince(s.scope === "from_now" ? s.since : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId || tab !== "sessoes") return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tab]);

  // Recalcula quais torneios/sessões ficam visíveis sempre que a lista ou
  // o corte mudam -- consulta enxuta (só hand_session_id/source/created_at),
  // não duplica o que listSessionsWithCount já trouxe.
  // Mesma consulta enxuta alimenta tambem o PROGRESSO de cada torneio
  // (quantas maos ja foram vistas na mesa / analisadas) -- sem isso o
  // resumo do topo so' sabia contar maos importadas, nao revisadas.
  const [progresso, setProgresso] = useState<Record<string, ProgressoTorneio>>({});
  useEffect(() => {
    if (!userId || sessionsList.length === 0) {
      setRadarVisibleSessionIds(null);
      setProgresso({});
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from("hand_reviews")
        .select("hand_session_id, source, created_at, viewed_in_replayer_at, status, data:parsed_data->>date")
        .eq("user_id", userId)
        .in(
          "hand_session_id",
          sessionsList.map((s) => s.id)
        );
      if (qErr) {
        setRadarVisibleSessionIds(null);
        return;
      }
      const visible = new Set<string>();
      const prog: Record<string, ProgressoTorneio> = {};
      for (const row of data ?? []) {
        const sessionId = row.hand_session_id as string;
        const isImported = IMPORTED_HAND_SOURCES.includes(row.source as string);
        const recentEnough = !radarSince || !isImported || (row.created_at as string) >= radarSince;
        if (recentEnough) visible.add(sessionId);
        const p = (prog[sessionId] ??= { vistas: 0, total: 0, concluidas: 0, inicio: null, fim: null });
        p.total++;
        if (row.viewed_in_replayer_at) p.vistas++;
        if (row.status === "concluida") p.concluidas++;
        // "AAAA/MM/DD HH:MM:SS ..." compara certo como texto.
        const quando = typeof row.data === "string" ? row.data : null;
        if (quando && (!p.inicio || quando < p.inicio)) p.inicio = quando;
        if (quando && (!p.fim || quando > p.fim)) p.fim = quando;
      }
      setRadarVisibleSessionIds(radarSince ? visible : null);
      setProgresso(prog);
    })();
  }, [userId, radarSince, sessionsList]);

  const filtroDeMao = temFiltroDeMao(filtros);
  useEffect(() => {
    if (!userId || !filtroDeMao || maosFiltraveis || carregandoMaos) return;
    setCarregandoMaos(true);
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: qErr } = await supabase
          .from("hand_reviews")
          .select(
            "id, hand_session_id, title, kind:parsed_data->>kind, pos:parsed_data->>heroPosition, heroi:parsed_data->>heroName, bb:parsed_data->bigBlind, seats:parsed_data->seats, preflop:parsed_data->streets->0, cartas:parsed_data->heroCards",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        if (qErr) throw qErr;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lidas = ((data ?? []) as any[]).map((r): MaoFiltravel => {
          const parsed = r.kind === "parsed";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assento = parsed && Array.isArray(r.seats) ? r.seats.find((s: any) => s.playerName === r.heroi) : null;
          const bb = Number(r.bb) || 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const acoes: any[] = parsed && r.preflop?.name === "preflop" && Array.isArray(r.preflop.actions) ? r.preflop.actions : [];
          return {
            id: r.id,
            sessao: r.hand_session_id ?? null,
            titulo: r.title ?? null,
            posicao: parsed ? r.pos : null,
            stackBb: assento && bb > 0 ? Number(assento.startingChips) / bb : null,
            allIn: acoes.some((a) => a.player === r.heroi && a.isAllIn),
            cartas: Array.isArray(r.cartas) ? r.cartas.filter((c: unknown) => typeof c === "string") : [],
          };
        });
        setMaosFiltraveis(lidas);
      } catch {
        setSessionsError("Erro ao carregar as mãos pros filtros.");
      } finally {
        setCarregandoMaos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filtroDeMao]);

  // Mãos que batem com os filtros de mão (posição, stack, all-in).
  const maosQueBatem = useMemo(() => {
    if (!filtroDeMao || !maosFiltraveis) return [];
    return maosFiltraveis.filter((m) => {
      if (filtros.soAllIn && !m.allIn) return false;
      if (filtros.posicoes.length > 0 && !filtros.posicoes.includes(m.posicao as never)) return false;
      if (filtros.stacks.length > 0 && (m.stackBb == null || !filtros.stacks.includes(faixaDoStack(m.stackBb)))) return false;
      return true;
    });
  }, [filtroDeMao, maosFiltraveis, filtros]);
  const maosPorSessao = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of maosQueBatem) if (x.sessao) m.set(x.sessao, (m.get(x.sessao) ?? 0) + 1);
    return m;
  }, [maosQueBatem]);
  const nomeDaSessao = useMemo(() => new Map(sessionsList.map((s) => [s.id, s.label])), [sessionsList]);

  useEffect(() => {
    if (!userId || tab !== "avulsas") return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, tab, radarSince]);

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError("");
    fetchTournamentPayouts()
      .then((ps) => {
        const m = new Map<string, ColocacaoTorneio>();
        for (const x of ps) if (x.tournamentIdPs) m.set(x.tournamentIdPs, { lugar: x.heroFinishPlace ?? null, inscritos: x.totalEntrants ?? null, premio: x.heroPayoutAmount ?? null });
        setColocacoes(m);
      })
      .catch(() => {});
    fetchBountiesDosTorneios()
      .then(setBountiesGanhos)
      .catch(() => {});
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
          id, title, free_text, status, source, created_at, updated_at, concluded_at,
          hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) ),
          hand_review_images ( id, storage_path, position )
        `
        )
        .eq("user_id", userId!)
        .is("hand_session_id", null)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      if (radarSince) q = q.or(`created_at.gte.${radarSince},source.not.in.(${IMPORTED_HAND_SOURCES.join(",")})`);
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

  async function excluirUmTorneio(s: HandSessionWithCount) {
    const ok = await confirm({
      title: "Excluir torneio",
      message: `Apagar "${s.label}" e as ${s.hand_count} mãos dele do Revisor, com as análises e anotações? Isso não pode ser desfeito. A sessão na Gestão de Banca continua lá.`,
      confirmLabel: "Excluir torneio",
    });
    if (!ok) return;
    try {
      await excluirTorneio(s.id);
      setSessionsList((prev) => prev.filter((x) => x.id !== s.id));
      setMaosFiltraveis((prev) => (prev ? prev.filter((m) => m.sessao !== s.id) : prev));
    } catch {
      setSessionsError("Não consegui excluir o torneio. Tente de novo.");
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

  const filteredSessions = useMemo(() => {
    const q = sessionSearchQuery.trim().toLowerCase();
    return sessionsList.filter((s) => {
      if (radarVisibleSessionIds && !radarVisibleSessionIds.has(s.id)) return false;
      if (q && !s.label.toLowerCase().includes(q)) return false;
      if (filtroRevisao !== "todos") {
        const revisado = estadoDaRevisao(progresso[s.id], Number(s.hand_count || 0)) === "revisado";
        if (filtroRevisao === "revisados" ? !revisado : revisado) return false;
      }
      if (filtros.formatos.length > 0) {
        const formato: FormatoTorneio =
          s.kind !== "tournament" ? "cash" : s.table_size === 3 ? "spin" : s.format_type === "pko" ? "pko" : s.format_type === "mystery" ? "mystery" : "regular";
        if (!filtros.formatos.includes(formato)) return false;
      }
      if (filtros.buyins.length > 0 && (s.buyin == null || !filtros.buyins.includes(faixaDoBuyin(Number(s.buyin))))) return false;
      if (filtros.resultados.length > 0) {
        const c = s.tournament_id_ps ? colocacoes.get(s.tournament_id_ps) : undefined;
        const r = resultadoDoTorneio(s, c, bountiesGanhos.get(s.id) ?? 0);
        const bate = filtros.resultados.some((x) =>
          x === "lucro"
            ? r != null && r > 0
            : x === "prejuizo"
              ? r != null && r < 0
              : x === "itm"
                ? (c?.premio ?? 0) > 0 || s.champion
                : s.champion || s.reached_ft || s.final_place != null,
        );
        if (!bate) return false;
      }
      // Filtro de mão ligado: só os torneios que têm mão batendo.
      if (filtroDeMao && !maosPorSessao.has(s.id)) return false;
      return true;
    });
  }, [sessionsList, sessionSearchQuery, radarVisibleSessionIds, filtroRevisao, progresso, filtros, colocacoes, bountiesGanhos, filtroDeMao, maosPorSessao]);

  // Quantos torneios faltam revisar / já revisados (contagem dos filtros).
  const contagemRevisao = useMemo(() => {
    let revisados = 0;
    for (const s of sessionsList) if (estadoDaRevisao(progresso[s.id], Number(s.hand_count || 0)) === "revisado") revisados++;
    return { revisados, pendentes: sessionsList.length - revisados };
  }, [sessionsList, progresso]);

  // Cards agrupados por dia jogado (mais recente primeiro).
  const gruposPorDia = useMemo(() => {
    const grupos: { chave: string; rotulo: string; itens: HandSessionWithCount[] }[] = [];
    const ordenadas = [...filteredSessions].sort((a, b) => diaDoTorneio(b, progresso[b.id]).getTime() - diaDoTorneio(a, progresso[a.id]).getTime());
    for (const s of ordenadas) {
      const d = diaDoTorneio(s, progresso[s.id]);
      const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let g = grupos.find((x) => x.chave === chave);
      if (!g) grupos.push((g = { chave, rotulo: rotuloDoDia(d), itens: [] }));
      g.itens.push(s);
    }
    return grupos;
  }, [filteredSessions, progresso]);

  // "Continuar de onde parei": o torneio mais recente que já começou a
  // rever e não terminou; sem nenhum assim, o mais recente ainda por ver.
  const proximoTorneio = useMemo(() => {
    const ordenadas = [...sessionsList].sort((a, b) => diaDoTorneio(b, progresso[b.id]).getTime() - diaDoTorneio(a, progresso[a.id]).getTime());
    const estado = (s: HandSessionWithCount) => estadoDaRevisao(progresso[s.id], Number(s.hand_count || 0));
    return ordenadas.find((s) => estado(s) === "andamento") ?? ordenadas.find((s) => estado(s) === "novo") ?? null;
  }, [sessionsList, progresso]);

  // "Quantos torneios e quantas maos foram revisadas" -- pedido explicito
  // pra substituir o resumo antigo (Acertei/Errei/Duvida, que media
  // autoavaliacao de "Analisar mao", nao volume de revisao de verdade).
  // Antes o numero de "revisadas" somava TODAS as maos importadas; agora
  // separa o total das maos de fato vistas na mesa.
  const totalHands = useMemo(
    () => sessionsList.reduce((sum, s) => sum + Number(s.hand_count || 0), 0),
    [sessionsList]
  );
  const resumoProgresso = useMemo(() => {
    let vistas = 0;
    let concluidas = 0;
    for (const p of Object.values(progresso)) {
      vistas += p.vistas;
      concluidas += p.concluidas;
    }
    return { vistas, concluidas };
  }, [progresso]);
  const nTorneios = sessionsList.filter((s) => s.kind === "tournament").length;
  const nCash = sessionsList.length - nTorneios;

  const counts = useMemo(() => {
    const acc: Record<string, number> = { pendente: 0, em_revisao: 0, concluida: 0 };
    items.forEach((r) => {
      if (acc[r.status] !== undefined) acc[r.status]++;
    });
    return acc;
  }, [items]);

  const pctVistas = totalHands > 0 ? Math.round((resumoProgresso.vistas / totalHands) * 100) : 0;

  return (
    <div>
      {/* Resumo do topo num painel só: quanto da revisão já foi feito e
          um atalho pro torneio que falta terminar (antes eram 3 cards
          grandes com pouca informação). */}
      {!sessionsLoading && sessionsList.length > 0 && (
        <div className="painel-vidro fade-in-up mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Sua revisão</p>
            <p className="tnum mt-1 text-[22px] font-bold leading-none tracking-[-0.02em] text-ink">
              {resumoProgresso.vistas} <span className="text-[14px] font-medium text-muted">de {totalHands} mãos vistas</span>
            </p>
            <div className="mt-2.5 h-1.5 max-w-[420px] overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#5AA6E0] to-[#34D399]" style={{ width: `${pctVistas}%` }} />
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
              <span>
                <Eye size={11} className="mr-1 inline" />
                {pctVistas}% revisado
              </span>
              <span>
                <Spade size={11} className="mr-1 inline" />
                {nTorneios} {nTorneios === 1 ? "torneio" : "torneios"}
                {nCash > 0 ? ` · ${nCash} cash` : ""}
              </span>
              <span>
                <CheckCircle2 size={11} className="mr-1 inline" />
                {resumoProgresso.concluidas} {resumoProgresso.concluidas === 1 ? "análise concluída" : "análises concluídas"}
              </span>
            </p>
          </div>
          {proximoTorneio && (
            <button
              type="button"
              onClick={() => onOpenSession(proximoTorneio.id)}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-[#E0B24C]/30 bg-[#E0B24C]/[0.08] px-4 py-2.5 text-left transition hover:border-[#E0B24C]/60 hover:bg-[#E0B24C]/[0.14]"
            >
              <PlayCircle size={20} className="shrink-0 text-[#E0B24C]" />
              <span className="min-w-0">
                <span className="block text-[11px] text-muted">Continuar de onde parou</span>
                <span className="block max-w-[220px] truncate text-[13.5px] font-semibold text-ink">{proximoTorneio.label}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-[#E0B24C]" />
            </button>
          )}
        </div>
      )}
      {/* Toolbar unica: abas + chips + busca na mesma linha -- mesmo
          padrao do Funil (Time > Painel), em vez de cada grupo de filtro
          numa linha separada. "Nova mão" e o menu do Radar subiram pro
          cabecalho da pagina (igual a Gestao de Banca). */}
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
            <BotaoFiltros aberto={painelFiltros} ativos={totalDeFiltros(filtros)} onClick={() => setPainelFiltros((v) => !v)} />
            <button
              onClick={() => {
                setSessionSearchOpen((v) => !v);
                if (sessionSearchOpen) setSessionSearchQuery("");
              }}
              title="Buscar torneios/sessões"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                sessionSearchOpen ? "border-ink bg-ink text-void" : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-ink"
              }`}
            >
              <Search size={13} />
            </button>
            <FilterChip label={`Todos (${sessionsList.length})`} active={filtroRevisao === "todos"} onClick={() => setFiltroRevisao("todos")} />
            <FilterChip label={`Para revisar (${contagemRevisao.pendentes})`} active={filtroRevisao === "pendentes"} onClick={() => setFiltroRevisao("pendentes")} />
            <FilterChip label={`Revisados (${contagemRevisao.revisados})`} active={filtroRevisao === "revisados"} onClick={() => setFiltroRevisao("revisados")} />
          </>
        )}

        {tab === "avulsas" &&
          FILTERS.map((f) => (
            <FilterChip key={f.id} label={f.label} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
      </div>

      {tab === "sessoes" && sessionSearchOpen && (
        <div className="painel-vidro mb-4 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
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

      {tab === "sessoes" && painelFiltros && <PainelFiltros f={filtros} onChange={setFiltros} />}

      {/* Filtro de mão ligado: as mãos que batem, pra abrir direto na mesa
          (o que antes ficava na aba "Filtros avançados"). */}
      {tab === "sessoes" && filtroDeMao && (
        <section className="painel-vidro fade-in-up mb-4 rounded-2xl border border-review/25 p-4">
          {carregandoMaos || !maosFiltraveis ? (
            <p className="text-[13px] text-muted">Procurando as mãos…</p>
          ) : maosQueBatem.length === 0 ? (
            <p className="text-[13px] text-muted">Nenhuma mão sua bate com esses filtros.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-ink">
                  <b className="tnum">{maosQueBatem.length}</b> {maosQueBatem.length === 1 ? "mão bate" : "mãos batem"} com o filtro
                  <span className="text-muted">
                    {" "}
                    · em {maosPorSessao.size} {maosPorSessao.size === 1 ? "torneio" : "torneios"}
                    {maosQueBatem.some((m) => !m.sessao) ? " e mãos avulsas" : ""}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => onOpenMaos(maosQueBatem.map((m) => m.id), maosQueBatem[0].id)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#E0B24C] px-3 py-2 text-[12.5px] font-semibold text-[#111] transition hover:brightness-110"
                >
                  Ver na mesa <ChevronRight size={14} />
                </button>
              </div>
              <ul className="flex max-h-[260px] flex-wrap gap-2 overflow-y-auto pr-1">
                {maosQueBatem.slice(0, 60).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpenMaos(maosQueBatem.map((x) => x.id), m.id)}
                      title={m.sessao ? nomeDaSessao.get(m.sessao) : m.titulo ?? "Mão avulsa"}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
                    >
                      {m.cartas.length === 2 && (
                        <span className="flex gap-0.5">
                          {m.cartas.map((c) => (
                            <HalfCard key={c} card={c} size="mini" />
                          ))}
                        </span>
                      )}
                      <span className="text-[11.5px] leading-tight">
                        <span className="block font-semibold text-ink">
                          {m.posicao ?? "—"}
                          {m.stackBb != null && <span className="font-normal text-muted"> · {Math.round(m.stackBb)}bb</span>}
                          {m.allIn && <Zap size={10} className="ml-1 inline text-[#F87171]" />}
                        </span>
                        <span className="block max-w-[130px] truncate text-muted">{m.sessao ? nomeDaSessao.get(m.sessao) ?? "Torneio" : "Mão avulsa"}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {maosQueBatem.length > 60 && (
                  <li className="self-center px-2 text-[12px] text-muted">e mais {maosQueBatem.length - 60} na mesa</li>
                )}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "sessoes" && (
        <>
          {sessionsError && (
            <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
              {sessionsError}
            </div>
          )}

          {sessionsLoading ? (
            <div className="painel-vidro flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center text-muted">
              Carregando…
            </div>
          ) : sessionsList.length === 0 ? (
            <div className="painel-vidro flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <Trophy size={32} className="text-elevated" />
              <p className="mt-3 text-muted">Nenhum torneio ou sessão de cash ainda.</p>
              <p className="mt-1 text-xs text-muted">Cole uma hand history — o torneio é criado automaticamente.</p>
              <button
                onClick={onNova}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-ink/90 transition hover:border-white/20"
              >
                <Plus size={15} /> Colar hand history
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="painel-vidro flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center text-muted">
              Nenhum torneio/sessão encontrado pra esse filtro.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {gruposPorDia.map((g) => (
                <section key={g.chave}>
                  <h3 className="mb-2.5 flex items-baseline gap-2 text-[12.5px] font-semibold capitalize text-ink/90">
                    {g.rotulo}
                    <span className="font-normal normal-case text-muted">
                      · {g.itens.length} {g.itens.length === 1 ? "torneio" : "torneios"}
                    </span>
                  </h3>
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {g.itens.map((s, idx) => (
                      <CardTorneio
                        key={s.id}
                        s={s}
                        progresso={progresso[s.id]}
                        colocacao={s.tournament_id_ps ? colocacoes.get(s.tournament_id_ps) : undefined}
                        bounties={bountiesGanhos.get(s.id) ?? 0}
                        onAbrir={() => onOpenSession(s.id)}
                        onExcluir={() => excluirUmTorneio(s)}
                        indice={idx}
                        maosNoFiltro={filtroDeMao ? maosPorSessao.get(s.id) : undefined}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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

          {/* O card "Leaks recorrentes" (Leak Finder) que ficava aqui foi
              para o AI Coach da tela inicial, com o mesmo botão "Treinar". */}

          {loading ? (
            <div className="painel-vidro flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center text-muted">
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="painel-vidro flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
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
            <div className="painel-vidro mt-5 flex justify-around rounded-2xl border border-white/10 p-3 text-xs text-muted">
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
      className="painel-vidro fade-in-up flex cursor-pointer gap-3 rounded-2xl border border-white/10 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg"
    >
      {/* Miniatura so' quando existe print de verdade -- antes toda mao
          sem imagem ganhava um quadrado vazio de 72px com um icone
          apagado, que so' ocupava espaco. */}
      {thumb ? (
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-muted ring-1 ring-inset ring-white/[0.08]">
          {(r as ReviewListItem & { source?: string }).source === "print" ? <ImageIcon size={16} /> : <PenLine size={16} />}
        </span>
      )}

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
