"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Target, Flame, BarChart3, MapPin, Radar as RadarIcon, Lock, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AnalysisFilters } from "@/components/analysis/AnalysisFilters";
import { StatisticsTab } from "@/components/analysis/StatisticsTab";
import { RadarPanel } from "@/components/analysis/RadarPanel";
import { PainelVisual } from "@/components/dashboard/kit";
import { EASE } from "@/components/painel/painel-card";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { FiltrosAtivos } from "@/components/performance/filtros-ativos";
import { ResumoPerformance } from "@/components/performance/resumo";
import { MatrizMaos } from "@/components/performance/graficos/matriz-maos";
import { LinhaSemanal } from "@/components/performance/graficos/linha-semanal";
import { Decisoes } from "@/components/performance/graficos/decisoes";
import { DecisoesPosflop } from "@/components/performance/graficos/decisoes-posflop";
import { CbetTextura } from "@/components/performance/graficos/cbet-textura";
import { ShowdownAgressao } from "@/components/performance/graficos/showdown-agressao";
import { BarrasPosicao } from "@/components/performance/graficos/barras-posicao";
import { FunilRuas } from "@/components/performance/graficos/funil-ruas";
import { CurvaLucro } from "@/components/performance/graficos/curva-lucro";
import { Eliminacao } from "@/components/performance/graficos/eliminacao";
import { RoiBuyin } from "@/components/performance/graficos/roi-buyin";
import { fetchSessions } from "@/lib/services/bankroll-service";
import type { Session } from "@/lib/bankroll/types";
import { fetchMyPlanState } from "@/lib/services/plan-service";
import { fetchHasActiveTeamAccess } from "@/lib/services/team-service";
import { isAddonUnlockedFor } from "@/lib/plans/plans-data";
import { useCurrencyPreference } from "@/lib/hooks/use-currency-preference";
import { RadarModuleMenu } from "@/components/radar/radar-module-menu";
import { fetchRadarModuleScope } from "@/lib/services/radar-module-scope-service";
import {
  fetchAnalysisHandRows,
  applyAnalysisFilters,
  computePreflopMetrics,
  computePreflopByPosition,
  computePostflopMetrics,
  buyinBucketOf,
  fetchTournamentMetrics,
  fetchTournamentSessions,
  resetPerformanceStats,
} from "@/lib/services/analysis-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { fetchTournamentPayouts, type TournamentPayout } from "@/lib/services/tournament-payout-service";
import {
  EMPTY_ANALYSIS_FILTERS,
  type AnalysisFilters as Filters,
  type AnalysisHandRow,
  type StackDepthBucket,
  type HeroPosition,
  type TournamentMetrics,
  type BuyinBucket,
} from "@/types/analysis";

type TabKey = "geral" | "preflop" | "postflop" | "estatisticas" | "posicao" | "radar";

const TABS: { value: TabKey; label: string; icon: typeof Target }[] = [
  { value: "geral", label: "Visão geral", icon: LayoutGrid },
  { value: "preflop", label: "Preflop", icon: Target },
  { value: "postflop", label: "Postflop", icon: Flame },
  { value: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  { value: "posicao", label: "Por posição", icon: MapPin },
  { value: "radar", label: "Radar", icon: RadarIcon },
];

export default function PerformancePage() {
  const [rows, setRows] = useState<AnalysisHandRow[]>([]);
  const [tournament, setTournament] = useState<TournamentMetrics | null>(null);
  const [tournamentSessions, setTournamentSessions] = useState<HandSession[]>([]);
  const [payouts, setPayouts] = useState<TournamentPayout[]>([]);
  // Sessões da Gestão de Banca: curva de lucro e ROI por buy-in (mesma
  // fonte do Lucro total/ROI da aba Estatísticas).
  const [sessoesBanca, setSessoesBanca] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTabState] = useState<TabKey>("geral");
  // Direção da troca de aba: o conteúdo novo entra pelo lado da aba
  // clicada (à direita = vem da direita), que é o que o olho espera.
  const [direcao, setDirecao] = useState(1);
  function setTab(nova: TabKey) {
    const de = TABS.findIndex((t) => t.value === tab);
    const para = TABS.findIndex((t) => t.value === nova);
    if (para !== de) setDirecao(para > de ? 1 : -1);
    setTabState(nova);
  }
  const [filters, setFilters] = useState<Filters>(EMPTY_ANALYSIS_FILTERS);
  // Filtro de buy-in — só afeta a aba Estatísticas (Total Games/ROI/ITM/
  // Lucro total, que vêm de hand_sessions + tournament_payouts; cEV/ICM
  // não têm buy-in associado, ver comentário em fetchTournamentMetrics),
  // por isso vive separado do `filters` de cima (que filtra mãos
  // preflop/postflop).
  const [tournamentBuyinFilter, setTournamentBuyinFilter] = useState<BuyinBucket[]>([]);
  // Buy-in/premiação importados sempre vêm em USD (ver
  // use-currency-preference.ts) — o jogador escolhe se quer ver em dólar
  // cru ou convertido pra real, um só lugar controlando os dois painéis
  // que mostram dinheiro na aba Estatísticas.
  const { currency, setCurrency, formatUsd } = useCurrencyPreference();
  // Radar PokerSync e' addon, nao vem liberado por padrao em nenhum plano
  // -- a aba existe pra todo mundo (pedido: "radar pokersync deve ficar
  // dentro do player evolution"), mas o conteudo so' aparece pra quem tem
  // o addon (mesma logica de lib/plans/plans-data.ts usada em app-shell.tsx).
  const [radarUnlocked, setRadarUnlocked] = useState<boolean | null>(null);
  // Corte do botão do Radar (ver components/radar/radar-module-menu.tsx) --
  // só afeta Preflop/Postflop/Por posição (fetchAnalysisHandRows). A aba
  // Estatísticas (Total Games/ROI/ITM/Lucro) vem de fetchTournamentMetrics/
  // fetchTournamentSessions, que ainda não respeitam esse corte.
  const [radarSince, setRadarSince] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMyPlanState(), fetchHasActiveTeamAccess()])
      .then(([{ plan, radarAddon }, hasTeamAccess]) => {
        setRadarUnlocked(isAddonUnlockedFor(plan, "radar", radarAddon, hasTeamAccess));
      })
      .catch(() => setRadarUnlocked(false));
    fetchRadarModuleScope("performance")
      .then((s) => setRadarSince(s.scope === "from_now" ? s.since : null))
      .catch(() => {});
  }, []);

  async function loadAll(since: string | null = radarSince) {
    setErro("");
    try {
      const [r, tourn, sessions, po, banca] = await Promise.all([
        fetchAnalysisHandRows(since),
        fetchTournamentMetrics(tournamentBuyinFilter),
        fetchTournamentSessions(),
        fetchTournamentPayouts(),
        // Sem sessão de banca a tela segue normal (só os gráficos de
        // torneio ficam vazios).
        fetchSessions().catch(() => [] as Session[]),
      ]);
      setSessoesBanca(banca);
      setRows(r);
      setTournament(tourn);
      setTournamentSessions(sessions);
      setPayouts(po);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a análise.");
    } finally {
      setLoading(false);
    }
  }

  // Depois de calcular cEV, os totais (chip_ev_total/net_ev_profit/etc)
  // vêm de fetchTournamentMetrics — reload separado do de payouts pra não
  // misturar os dois estados.
  async function reloadTournamentMetrics(buyinFilter: BuyinBucket[] = tournamentBuyinFilter) {
    try {
      setTournament(await fetchTournamentMetrics(buyinFilter));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao recarregar métricas de torneio.");
    }
  }

  function handleBuyinFilterChange(next: BuyinBucket[]) {
    setTournamentBuyinFilter(next);
    reloadTournamentMetrics(next);
  }

  useEffect(() => {
    loadAll();
    // Carrega so' uma vez, ao montar -- loadAll muda de referencia a cada
    // render (nao esta em useCallback) e mudanca de filtro ja tem reload
    // proprio (handleBuyinFilterChange -> reloadTournamentMetrics), entao
    // incluir loadAll aqui causaria recarregar tudo de novo sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => applyAnalysisFilters(rows, filters), [rows, filters]);
  const preflop = useMemo(() => computePreflopMetrics(filteredRows), [filteredRows]);
  const byPosition = useMemo(() => computePreflopByPosition(filteredRows), [filteredRows]);
  const postflop = useMemo(() => computePostflopMetrics(filteredRows), [filteredRows]);

  const availableStackDepths = useMemo(
    () => new Set(rows.map((r) => r.stackDepthBucket).filter((s): s is StackDepthBucket => s !== null)),
    [rows]
  );
  const availablePositions = useMemo(
    () => new Set(rows.map((r) => r.heroPosition).filter((p): p is HeroPosition => p !== null)),
    [rows]
  );
  // Buckets disponíveis pro filtro de buy-in — aproximação a partir de
  // tournamentSessions (hand_sessions, o que já está carregado aqui),
  // não das bankroll_sessions que efetivamente alimentam ROI/ITM/Lucro
  // total (essas não são expostas fora de fetchTournamentMetrics hoje).
  const availableBuyinBuckets = useMemo(
    () => new Set(tournamentSessions.map((s) => (s.buyin != null ? buyinBucketOf(s.buyin) : null)).filter((b): b is BuyinBucket => b !== null)),
    [tournamentSessions]
  );

  const filtrosModal = (
    <AnalysisFilters
      filters={filters}
      onChange={setFilters}
      availableStackDepths={availableStackDepths}
      availablePositions={availablePositions}
    />
  );
  const semMaos = rows.length === 0;

  return (
    <AppShell>
      {/* Mesmo visual da tela inicial (vidro, números que contam, entrada
          em sequência, explicação ao passar o mouse), sem a imagem de
          fundo. PainelVisual="vidro" faz os painéis antigos das abas
          (frequências, estatísticas...) usarem o mesmo card de vidro. */}
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6">
            <PerfEstilos />

            {/* Cabeçalho: título + filtros ativos à vista (chips com "x")
                e os botões de filtro e de importação do Radar. */}
            <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Performance</h1>
                <p className="mt-1 text-[12.5px] text-muted">
                  Suas estatísticas de jogo, mão a mão. Passe o mouse em qualquer número pra saber o que é.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FiltrosAtivos filters={filters} onChange={setFilters} />
                {filtrosModal}
                <RadarModuleMenu
                  module="performance"
                  moduleLabel="o Performance"
                  onScopeChange={({ since }) => {
                    setRadarSince(since);
                    loadAll(since);
                  }}
                  onReset={async () => {
                    await resetPerformanceStats();
                    setRadarSince(null);
                    await loadAll(null);
                  }}
                />
              </div>
            </header>

            {/* Abas logo abaixo do título, como nos outros módulos; ficam
                presas no topo ao rolar. */}
            <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/[0.06] bg-black/70 px-4 pt-2 backdrop-blur-xl md:-mx-6 md:px-6">
              <AbasAnimadas value={tab} onChange={setTab} options={TABS} />
            </div>

            {erro && (
              <p className="mb-4 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
            )}

            {loading ? (
              // Esqueleto no formato da tela: a página não "pula" quando os
              // dados chegam.
              <div className="grid gap-3.5">
                <div className="painel-esqueleto h-[290px] rounded-3xl" />
                <div className="grid gap-3.5 lg:grid-cols-2">
                  <div className="painel-esqueleto h-[360px] rounded-3xl" />
                  <div className="painel-esqueleto h-[360px] rounded-3xl" />
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-clip">
                  <AnimatePresence mode="wait" custom={direcao} initial={false}>
                    <motion.div
                      key={tab}
                      custom={direcao}
                      initial={{ opacity: 0, x: 28 * direcao }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -28 * direcao }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="grid gap-3.5"
                    >
                      {semMaos && tab !== "radar" && tab !== "estatisticas" && tab !== "geral" ? (
                        <p className="painel-vidro rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">
                          Sem mãos com hand history estruturada ainda. Aguarde a sincronização do agente desktop (Radar
                          PokerSync) — as métricas aparecem aqui automaticamente assim que houver dado.
                        </p>
                      ) : (
                        <>
                          {tab === "geral" && (
                            <>
                              <ResumoPerformance rows={filteredRows} preflop={preflop} tournament={tournament} sessoes={sessoesBanca} ordem={0} />
                              <LinhaSemanal rows={filteredRows} ordem={1} />
                            </>
                          )}
                          {tab === "preflop" && (
                            <>
                              {/* Matriz com largura limitada (células de ~40px) e, ao
                                  lado, o que você faz em cada situação -- no lugar do
                                  antigo "Frequências pré-flop", que repetia o resumo e
                                  usava faixas sem fonte confiável. */}
                              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,580px)_minmax(0,1fr)]">
                                <MatrizMaos rows={filteredRows} ordem={1} />
                                <Decisoes rows={filteredRows} ordem={2} />
                              </div>
                            </>
                          )}
                          {tab === "postflop" && (
                            <>
                              {/* Mesma leitura do pré-flop: funil (quando você
                                  aposta), o que você faz quando apostam em você,
                                  c-bet por tipo de flop e showdown/agressão. Sai o
                                  painel antigo "Tendências pós-flop" (repetia o
                                  funil e usava faixas sem fonte confiável). */}
                              <FunilRuas rows={filteredRows} ordem={1} />
                              <DecisoesPosflop rows={filteredRows} ordem={2} />
                              <div className="grid gap-3.5 lg:grid-cols-2">
                                <CbetTextura rows={filteredRows} ordem={3} />
                                <ShowdownAgressao rows={filteredRows} metrics={postflop} ordem={4} />
                              </div>
                            </>
                          )}
                          {tab === "posicao" && <BarrasPosicao rows={filteredRows} byPosition={byPosition} ordem={1} />}
                          {tab === "estatisticas" && (
                            <>
                              <CurvaLucro sessoes={sessoesBanca} ordem={1} />
                              <div className="grid items-start gap-3.5 lg:grid-cols-2">
                                <Eliminacao payouts={payouts} ordem={2} />
                                <RoiBuyin sessoes={sessoesBanca} ordem={3} />
                              </div>
                              {tournament && (
                                <StatisticsTab
                                  metrics={tournament}
                                  tournamentSessions={tournamentSessions}
                                  payouts={payouts}
                                  buyinFilter={tournamentBuyinFilter}
                                  onBuyinFilterChange={handleBuyinFilterChange}
                                  availableBuyinBuckets={availableBuyinBuckets}
                                  currency={currency}
                                  onCurrencyChange={setCurrency}
                                  formatUsd={formatUsd}
                                />
                              )}
                            </>
                          )}
                          {tab === "radar" &&
                            (radarUnlocked ? (
                              <RadarPanel onReset={loadAll} />
                            ) : (
                              <div className="painel-vidro mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-dashed border-white/10 p-8 text-center">
                                <div className="grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted">
                                  <Lock size={20} />
                                </div>
                                <p className="text-sm font-semibold text-ink">Radar PokerSync é um complemento avulso</p>
                                <p className="text-xs text-muted">
                                  Sincronize suas mãos automaticamente direto do seu computador, sem colar hand history na
                                  mão.
                                </p>
                                <Link
                                  href="/planos"
                                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e2c35a] active:scale-[0.97]"
                                >
                                  Ver planos e complementos
                                </Link>
                              </div>
                            ))}
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            )}
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}
