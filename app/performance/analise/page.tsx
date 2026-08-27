"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Grid3x3, Flame, Trophy, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppHeader } from "@/components/app-header";
import { TabNav } from "@/components/ui/tab-nav";
import { AnalysisFilters } from "@/components/analysis/AnalysisFilters";
import { OverviewTab } from "@/components/analysis/OverviewTab";
import { PreflopTab } from "@/components/analysis/PreflopMatrix";
import { PostflopTab } from "@/components/analysis/PostflopStats";
import { TournamentTab } from "@/components/analysis/TournamentTab";
import { LeakFinderTab } from "@/components/analysis/LeakFinderTab";
import {
  fetchAnalysisHandRows,
  applyAnalysisFilters,
  computePreflopMetrics,
  computePreflopByPosition,
  computePostflopMetrics,
  computeLeaks,
  fetchTournamentMetrics,
  fetchFinancialDaySeries,
} from "@/lib/services/analysis-service";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";
import type { FinancialDay } from "@/lib/services/team-service";
import {
  EMPTY_ANALYSIS_FILTERS,
  type AnalysisFilters as Filters,
  type AnalysisHandRow,
  type GameFormat,
  type StackDepthBucket,
  type HeroPosition,
  type TournamentMetrics,
} from "@/types/analysis";

type TabKey = "overview" | "preflop" | "postflop" | "tournament" | "leaks";

const TABS: { value: TabKey; label: string; icon: typeof LineChart }[] = [
  { value: "overview", label: "Visão Geral", icon: LineChart },
  { value: "preflop", label: "Preflop & Matriz", icon: Grid3x3 },
  { value: "postflop", label: "Postflop & Tendências", icon: Flame },
  { value: "tournament", label: "Torneios", icon: Trophy },
  { value: "leaks", label: "Leak Finder", icon: AlertTriangle },
];

export default function AnalysisPage() {
  const [rows, setRows] = useState<AnalysisHandRow[]>([]);
  const [performance, setPerformance] = useState<PlayerPerformance | null>(null);
  const [financialDays, setFinancialDays] = useState<FinancialDay[]>([]);
  const [tournament, setTournament] = useState<TournamentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<TabKey>("overview");
  const [filters, setFilters] = useState<Filters>(EMPTY_ANALYSIS_FILTERS);

  async function loadAll() {
    setErro("");
    try {
      const [r, perf, fin, tourn] = await Promise.all([
        fetchAnalysisHandRows(),
        fetchPlayerPerformance(),
        fetchFinancialDaySeries(),
        fetchTournamentMetrics(),
      ]);
      setRows(r);
      setPerformance(perf);
      setFinancialDays(fin);
      setTournament(tourn);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a análise.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredRows = useMemo(() => applyAnalysisFilters(rows, filters), [rows, filters]);
  const preflop = useMemo(() => computePreflopMetrics(filteredRows), [filteredRows]);
  const byPosition = useMemo(() => computePreflopByPosition(filteredRows), [filteredRows]);
  const postflop = useMemo(() => computePostflopMetrics(filteredRows), [filteredRows]);
  const leaks = useMemo(() => computeLeaks(preflop, postflop), [preflop, postflop]);

  const availableFormats = useMemo(() => new Set(rows.map((r) => r.format).filter((f): f is GameFormat => f !== null)), [rows]);
  const availableStackDepths = useMemo(
    () => new Set(rows.map((r) => r.stackDepthBucket).filter((s): s is StackDepthBucket => s !== null)),
    [rows]
  );
  const availablePositions = useMemo(
    () => new Set(rows.map((r) => r.heroPosition).filter((p): p is HeroPosition => p !== null)),
    [rows]
  );

  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        <AppHeader
          insideShell
          backHref="/performance"
          title="Análise"
          subtitle="Preflop, postflop, torneios e leak finder num só lugar — o melhor do HM3/PT4 em cima dos seus dados."
        />

        {erro && <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>}

        {loading ? (
          <p className="text-sm text-muted">Carregando sua análise…</p>
        ) : (
          <>
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <AnalysisFilters
                filters={filters}
                onChange={setFilters}
                availableFormats={availableFormats}
                availableStackDepths={availableStackDepths}
                availablePositions={availablePositions}
                onImported={loadAll}
              />
            </div>

            <TabNav className="mt-4" value={tab} onChange={setTab} options={TABS} />

            <div className="mt-4">
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-muted">
                  Sem mãos com hand history estruturada ainda. Importe acima ou aguarde a sincronização do agente desktop —
                  as métricas aparecem aqui automaticamente assim que houver dado.
                </p>
              ) : (
                <>
                  {tab === "overview" && (
                    <OverviewTab
                      performance={performance}
                      financialDays={financialDays}
                      handCount={filteredRows.length}
                      leaks={leaks}
                      onGoToLeaks={() => setTab("leaks")}
                    />
                  )}
                  {tab === "preflop" && <PreflopTab rows={filteredRows} metrics={preflop} byPosition={byPosition} />}
                  {tab === "postflop" && <PostflopTab metrics={postflop} />}
                  {tab === "tournament" && tournament && <TournamentTab metrics={tournament} />}
                  {tab === "leaks" && <LeakFinderTab rows={filteredRows} leaks={leaks} />}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
