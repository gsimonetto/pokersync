"use client";

import { useEffect, useMemo, useState } from "react";
import { Grid3x3, Trophy, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TabNav } from "@/components/ui/tab-nav";
import { AnalysisFilters } from "@/components/analysis/AnalysisFilters";
import { PreflopTab } from "@/components/analysis/PreflopMatrix";
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
  fetchTournamentSessions,
} from "@/lib/services/analysis-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { fetchTournamentPayouts, type TournamentPayout } from "@/lib/services/tournament-payout-service";
import {
  EMPTY_ANALYSIS_FILTERS,
  type AnalysisFilters as Filters,
  type AnalysisHandRow,
  type GameFormat,
  type StackDepthBucket,
  type HeroPosition,
  type TournamentMetrics,
} from "@/types/analysis";

type TabKey = "preflop" | "tournament" | "leaks";

const TABS: { value: TabKey; label: string; icon: typeof Grid3x3 }[] = [
  { value: "preflop", label: "Preflop & Postflop", icon: Grid3x3 },
  { value: "tournament", label: "Torneios", icon: Trophy },
  { value: "leaks", label: "Leak Finder", icon: AlertTriangle },
];

export default function AnalysisPage() {
  const [rows, setRows] = useState<AnalysisHandRow[]>([]);
  const [tournament, setTournament] = useState<TournamentMetrics | null>(null);
  const [tournamentSessions, setTournamentSessions] = useState<HandSession[]>([]);
  const [payouts, setPayouts] = useState<TournamentPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<TabKey>("preflop");
  const [filters, setFilters] = useState<Filters>(EMPTY_ANALYSIS_FILTERS);

  async function loadAll() {
    setErro("");
    try {
      const [r, tourn, sessions, po] = await Promise.all([
        fetchAnalysisHandRows(),
        fetchTournamentMetrics(),
        fetchTournamentSessions(),
        fetchTournamentPayouts(),
      ]);
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

  async function reloadPayouts() {
    try {
      setPayouts(await fetchTournamentPayouts());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao recarregar premiação.");
    }
  }

  // Depois de calcular cEV, os totais (chip_ev_total/net_ev_profit/etc)
  // vêm de fetchTournamentMetrics — reload separado do de payouts pra não
  // misturar os dois estados.
  async function reloadTournamentMetrics() {
    try {
      setTournament(await fetchTournamentMetrics());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao recarregar métricas de torneio.");
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
      <main className="w-full px-6 pb-10 pt-6 text-ink">
        {erro && <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>}

        {loading ? (
          <p className="text-sm text-muted">Carregando sua análise…</p>
        ) : (
          // Container único envolvendo filtros + abas + conteúdo — mesmo
          // padrão de toda ferramenta de tela única do produto (Treino,
          // Construtor de Ranges, Comparar, Equidade, Árvores), em vez de
          // caixas separadas competindo por hierarquia visual.
          <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
            <AnalysisFilters
              filters={filters}
              onChange={setFilters}
              availableFormats={availableFormats}
              availableStackDepths={availableStackDepths}
              availablePositions={availablePositions}
              onImported={loadAll}
              onSelectTournamentImport={() => setTab("tournament")}
            />

            <TabNav className="mt-4" value={tab} onChange={setTab} options={TABS} />

            <div className="mt-4">
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-muted">
                  Sem mãos com hand history estruturada ainda. Importe acima ou aguarde a sincronização do agente desktop —
                  as métricas aparecem aqui automaticamente assim que houver dado.
                </p>
              ) : (
                <>
                  {tab === "preflop" && (
                    <PreflopTab rows={filteredRows} metrics={preflop} byPosition={byPosition} postflopMetrics={postflop} />
                  )}
                  {tab === "tournament" && tournament && (
                    <TournamentTab
                      metrics={tournament}
                      tournamentSessions={tournamentSessions}
                      payouts={payouts}
                      onPayoutsChanged={reloadPayouts}
                      onCevComputed={reloadTournamentMetrics}
                    />
                  )}
                  {tab === "leaks" && <LeakFinderTab rows={filteredRows} leaks={leaks} />}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
