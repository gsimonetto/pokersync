"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Layers,
  Award,
  Loader2,
  Sparkles,
  Hash,
  TrendingUp,
  CheckCircle2,
  Wallet,
  ArrowDownToLine,
  CalendarClock,
  CalendarCheck,
  Crown,
  Flag,
  Flame,
  Snowflake,
  ChevronDown,
  Monitor,
} from "lucide-react";
import { Painel, StatList, Bloqueado } from "@/components/analysis/shared";
import { FilterChip } from "@/components/ui/filter-chip";
import { TournamentPayoutsPanel } from "@/components/analysis/TournamentPayoutsPanel";
import { buyinBucketOf } from "@/lib/services/analysis-service";
import { fetchEligibleHandReviewIds, computeHandEvBatch } from "@/lib/services/hand-ev-service";
import { BUYIN_BUCKET_LABEL, type BuyinBucket, type TournamentMetrics } from "@/types/analysis";
import type { HandSession } from "@/lib/services/hand-session-service";
import type { TournamentPayout } from "@/lib/services/tournament-payout-service";
import type { FinancialDay } from "@/lib/services/team-service";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BUYIN_BUCKET_ORDER: BuyinBucket[] = ["0-10", "10-50", "50-200", "200+"];

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtMoney(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${BRL.format(v)}`;
}

function fmtMoneyPlain(v: number | null): string | null {
  return v === null ? null : BRL.format(v);
}

function fmtChips(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtSince(iso: string | null): string | null {
  return iso === null ? null : new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Aba "Estatísticas" — estilo SharkScope: números financeiros/resultado
// (quanto entrou, quanto voltou, desde quando joga), não repete VPIP/3-Bet/
// C-Bet — esses já têm aba própria (Preflop/Postflop). Reúne o que antes
// era a aba "Torneios" (ver TournamentTab, removida) + um resumo financeiro
// novo no topo, ver app/performance/page.tsx.
export function StatisticsTab({
  metrics,
  tournamentSessions,
  payouts,
  onPayoutsChanged,
  onCevComputed,
  focusPendingPayout,
  onFocusPendingPayoutConsumed,
  buyinFilter,
  onBuyinFilterChange,
  availableBuyinBuckets,
}: {
  metrics: TournamentMetrics;
  financialSeries: FinancialDay[];
  tournamentSessions: HandSession[];
  payouts: TournamentPayout[];
  onPayoutsChanged: () => void;
  onCevComputed: () => void;
  focusPendingPayout?: boolean;
  onFocusPendingPayoutConsumed?: () => void;
  buyinFilter: BuyinBucket[];
  onBuyinFilterChange: (next: BuyinBucket[]) => void;
  availableBuyinBuckets: Set<BuyinBucket>;
}) {
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [computeError, setComputeError] = useState("");
  const [summary, setSummary] = useState<{ computed: number; skipped: number } | null>(null);

  const hasCev = metrics.chip_ev_total !== null;

  // Painel de premiação/torneios (hand_sessions) filtrado pelo mesmo
  // corte de buy-in — fonte diferente das bankroll_sessions que alimentam
  // `metrics` (ver comentário em fetchTournamentMetrics), então a lista
  // abaixo é filtrada aqui no cliente em vez de recarregar do servidor.
  const filteredSessions =
    buyinFilter.length === 0 ? tournamentSessions : tournamentSessions.filter((s) => s.buyin != null && buyinFilter.includes(buyinBucketOf(s.buyin)));

  // Vitórias/Mesas finais — só conta nos torneios em que a mão final foi
  // importada e o parser reconheceu a colocação (champion/reached_ft/
  // final_place em hand_sessions); não é o total de torneios jogados, é
  // um subconjunto — por isso vive separado de `metrics` (que vem de
  // bankroll_sessions, lançamento manual, sem essa informação).
  const wins = useMemo(() => filteredSessions.filter((s) => s.champion).length, [filteredSessions]);
  const finalTables = useMemo(
    () => filteredSessions.filter((s) => s.champion || s.reached_ft || s.final_place != null).length,
    [filteredSessions]
  );

  function toggleBuyin(b: BuyinBucket) {
    onBuyinFilterChange(buyinFilter.includes(b) ? buyinFilter.filter((x) => x !== b) : [...buyinFilter, b]);
  }

  // Estrutura de premiação: por padrão só mostra a contagem
  // (registradas/pendentes) em vez do grid com 1 card por torneio — o
  // grid pesa muito nessa aba pra quem já tem dezenas de torneios
  // importados. Clicar num dos números expande e revela a lista de
  // verdade (mesmo componente TournamentPayoutsPanel, intacto). Expande
  // sozinho quando vem do fluxo "Importar → Torneio" (focusPendingPayout),
  // senão o alvo do scroll automático do painel nunca chega a existir no DOM.
  const [premiacaoOpen, setPremiacaoOpen] = useState(!!focusPendingPayout);
  useEffect(() => {
    if (focusPendingPayout) setPremiacaoOpen(true);
  }, [focusPendingPayout]);
  const payoutByTournament = useMemo(() => new Map(payouts.map((p) => [p.tournamentIdPs, p])), [payouts]);

  // Buy-ins investidos / Ganhos (premiação) / Torneios: pedido explícito
  // pra vir SÓ das mãos importadas (hand_sessions + tournament_payouts),
  // nunca de bankroll_sessions (Gestão de Banca) — são fontes de verdade
  // separadas de propósito, e excluir uma sessão na Banca não pode apagar
  // (nem mudar) esses números aqui. Por isso soma bruta (nunca subtrai
  // buy-in do ganho, ao contrário do lucro líquido que a Banca calcula).
  const totalBuyinImportado = useMemo(
    () => filteredSessions.reduce((acc, s) => acc + (s.buyin ?? 0), 0),
    [filteredSessions]
  );
  const totalGanhosImportado = useMemo(
    () =>
      filteredSessions.reduce((acc, s) => {
        const p = s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps) : undefined;
        return acc + (p?.heroPayoutAmount ?? 0);
      }, 0),
    [filteredSessions, payoutByTournament]
  );

  const payoutRegisteredCount = useMemo(
    () =>
      filteredSessions.filter((s) => {
        const p = s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps) : undefined;
        return p != null && (p.heroPayoutAmount != null || p.places.length > 0);
      }).length,
    [filteredSessions, payoutByTournament]
  );
  const payoutPendingCount = filteredSessions.length - payoutRegisteredCount;

  async function handleCompute() {
    if (computing) return;
    setComputing(true);
    setComputeError("");
    setSummary(null);
    try {
      const ids = await fetchEligibleHandReviewIds();
      if (ids.length === 0) {
        setSummary({ computed: 0, skipped: 0 });
        return;
      }
      setProgress({ done: 0, total: ids.length });
      const outcomes = await computeHandEvBatch(ids, (done, total) => setProgress({ done, total }));
      const computed = outcomes.filter((o) => o.computed).length;
      setSummary({ computed, skipped: outcomes.length - computed });
      onCevComputed();
    } catch (e) {
      setComputeError(e instanceof Error ? e.message : "Erro ao calcular cEV.");
    } finally {
      setComputing(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <Painel titulo="Resumo financeiro" icone={<Wallet size={14} className="icon-glow text-evolution" />}>
        <StatList
          items={[
            {
              label: "Buy-ins investidos",
              value: filteredSessions.length > 0 ? fmtMoneyPlain(totalBuyinImportado) : null,
              icon: ArrowDownToLine,
            },
            { label: "Torneios", value: filteredSessions.length > 0 ? String(filteredSessions.length) : null, icon: Hash },
            {
              label: "Ganhos (premiação)",
              value: filteredSessions.length > 0 ? fmtMoneyPlain(totalGanhosImportado) : null,
              icon: Trophy,
              tone: totalGanhosImportado > 0 ? "bom" : undefined,
            },
            { label: "Jogando desde", value: fmtSince(metrics.since), icon: CalendarClock },
            { label: "Último torneio", value: fmtSince(metrics.until), icon: CalendarCheck },
            {
              label: "Lucro total",
              value: fmtMoney(metrics.total_profit),
              icon: Wallet,
              tone: metrics.total_profit === null ? undefined : metrics.total_profit >= 0 ? "bom" : "acima",
            },
            {
              label: "Lucro médio / torneio",
              value: fmtMoney(metrics.avg_profit_per_game),
              icon: Wallet,
              tone: metrics.avg_profit_per_game === null ? undefined : metrics.avg_profit_per_game >= 0 ? "bom" : "acima",
            },
            { label: "Buy-in médio", value: fmtMoneyPlain(metrics.avg_buyin), icon: Hash },
            {
              label: "ROI %",
              value: fmtPct(metrics.roi_pct),
              icon: TrendingUp,
              tone: metrics.roi_pct === null ? undefined : metrics.roi_pct >= 0 ? "bom" : "acima",
            },
            {
              label: "ROI médio / torneio",
              value: fmtPct(metrics.avg_roi_pct),
              icon: TrendingUp,
              tone: metrics.avg_roi_pct === null ? undefined : metrics.avg_roi_pct >= 0 ? "bom" : "acima",
            },
            { label: "ITM %", value: fmtPct(metrics.itm_pct), icon: CheckCircle2 },
          ]}
        />
      </Painel>

      <Painel titulo="Ritmo & sequências" icone={<Flag size={14} className="icon-glow text-review" />}>
        <StatList
          items={[
            { label: "Dias ativos", value: metrics.active_days > 0 ? String(metrics.active_days) : null, icon: CalendarCheck },
            { label: "Torneios / dia", value: metrics.games_per_day !== null ? metrics.games_per_day.toFixed(1) : null, icon: Hash },
            {
              label: "Mais torneios num dia",
              value: metrics.busiest_day_count > 0 ? String(metrics.busiest_day_count) : null,
              icon: Hash,
            },
            {
              label: "Vitórias",
              value: wins > 0 ? String(wins) : null,
              icon: Crown,
              tone: wins > 0 ? "bom" : undefined,
            },
            { label: "Mesas finais", value: finalTables > 0 ? String(finalTables) : null, icon: Award },
            { label: "Dias vencendo", value: metrics.days_won > 0 ? String(metrics.days_won) : null, icon: TrendingUp, tone: metrics.days_won > 0 ? "bom" : undefined },
            {
              label: "Dias perdendo",
              value: metrics.days_lost > 0 ? String(metrics.days_lost) : null,
              icon: TrendingUp,
              tone: metrics.days_lost > 0 ? "acima" : undefined,
            },
            { label: "Maior sequência vencendo", value: metrics.max_win_streak > 0 ? `${metrics.max_win_streak} dias` : null, icon: Flame },
            { label: "Maior sequência perdendo", value: metrics.max_lose_streak > 0 ? `${metrics.max_lose_streak} dias` : null, icon: Snowflake },
          ]}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
          Vitórias e Mesas finais só contam torneios em que a mão final foi importada e o PokerSync reconheceu a colocação — pode
          ser menor que o total de torneios jogado se nem todo torneio teve a mão final anexada no Revisor.
        </p>
      </Painel>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">Buy-in</span>
        {BUYIN_BUCKET_ORDER.map((b) => (
          <FilterChip
            key={b}
            label={BUYIN_BUCKET_LABEL[b]}
            active={buyinFilter.includes(b)}
            disabled={!availableBuyinBuckets.has(b)}
            disabledReason="Sem torneio importado nessa faixa de buy-in ainda"
            onClick={() => toggleBuyin(b)}
          />
        ))}
        {buyinFilter.length > 0 && (
          <button type="button" onClick={() => onBuyinFilterChange([])} className="ml-1 text-[11.5px] font-semibold text-muted hover:text-ink">
            Limpar
          </button>
        )}
      </div>

      <Painel titulo="Estrutura de premiação" icone={<Award size={14} className="icon-glow text-training" />}>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Pré-requisito pro cálculo de cEV/ICM abaixo — sem saber quanto cada colocação pagou, não dá pra calcular quanto sua
          decisão &quot;deveria&quot; valer em $. Hoje é só manual; quando o agente desktop buscar isso sozinho, aparece aqui do mesmo jeito
          (mesmo torneio, sem tela nova).
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <button type="button" onClick={() => setPremiacaoOpen(true)} className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">Registradas</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-positive">{payoutRegisteredCount}</p>
          </button>
          <button type="button" onClick={() => setPremiacaoOpen(true)} className="text-left" disabled={payoutPendingCount === 0}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">Pendentes</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${payoutPendingCount > 0 ? "text-evolution" : "text-muted/30"}`}>
              {payoutPendingCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setPremiacaoOpen((v) => !v)}
            className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold text-muted hover:text-ink"
          >
            {premiacaoOpen ? "Recolher" : "Ver torneios"}
            <ChevronDown size={13} className={`transition-transform ${premiacaoOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {premiacaoOpen && (
          <div className="mt-3 border-t border-hairline pt-3">
            <TournamentPayoutsPanel
              sessions={filteredSessions}
              payouts={payouts}
              onChanged={onPayoutsChanged}
              focusPending={focusPendingPayout}
              onFocusConsumed={onFocusPendingPayoutConsumed}
            />
          </div>
        )}
      </Painel>

      <Painel
        titulo="cEV & ICM"
        icone={<Layers size={14} className="icon-glow text-review" />}
        action={
          <button
            onClick={handleCompute}
            disabled={computing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
          >
            {computing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="icon-glow" />}
            {computing && progress ? `Calculando ${progress.done}/${progress.total}` : "Calcular cEV"}
          </button>
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Cobre all-in no preflop com TODAS as mãos envolvidas mostradas no showdown (heads-up ou multiway), em torneios com
          premiação cadastrada acima — é o único caso que o motor GTO valida hoje (ver{" "}
          <code className="text-ink/70">pokersync-solver/engine/hand_cev.py</code>). Não é uma estimativa do torneio inteiro,
          é a soma exata dessas mãos específicas.
        </p>

        {/* Aviso não-bloqueante (pedido explícito): entrada manual continua
            funcionando normalmente (mão importada aqui já vincula ao
            torneio sozinha) -- isso só avisa que a experiência completa do
            Player Evolution (sincronização automática, sem precisar colar
            hand history) depende do agente desktop, sem tirar a opção
            manual de ninguém. */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-hairline bg-elevated/60 p-2.5 text-[11.5px] leading-relaxed text-muted">
          <Monitor size={14} className="mt-0.5 shrink-0 text-muted/70" />
          <span>
            Colar hand history manualmente já é suficiente pra calcular cEV. Pra ter a experiência completa do Player
            Evolution — sincronização automática, sem precisar importar nada na mão — instale o{" "}
            <span className="text-ink/80 font-semibold">agente desktop</span>.
          </span>
        </div>

        {computeError && <p className="mb-3 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{computeError}</p>}
        {summary && !computeError && (
          <p className="mb-3 text-xs text-muted">
            {summary.computed} mão{summary.computed === 1 ? "" : "s"} calculada{summary.computed === 1 ? "" : "s"}
            {summary.skipped > 0 && `, ${summary.skipped} não deu (sem premiação do torneio ou motor indisponível)`}.
          </p>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {hasCev ? (
            <>
              <div className="rounded-lg border border-hairline bg-elevated p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">Chip EV Total / cEV por game</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                  {fmtChips(metrics.chip_ev_total)} <span className="text-sm font-normal text-muted">chips</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{fmtChips(metrics.cev_per_game)} chips/game</p>
              </div>
              <div className="rounded-lg border border-hairline bg-elevated p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">Net Expected Profit / EV ROI</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${(metrics.net_ev_profit ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmtMoney(metrics.net_ev_profit)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{fmtPct(metrics.ev_roi_pct) ?? "—"} EV ROI</p>
              </div>
            </>
          ) : (
            <Bloqueado
              titulo="Chip EV Total, cEV/game, Net Expected Profit, EV ROI %"
              texto={'Clique em "Calcular cEV" acima — sem mão elegível calculada ainda (ou o motor GTO não está publicado neste ambiente).'}
            />
          )}
          <Bloqueado titulo="Desempenho por faixa de blind" texto="Existe a estrutura (hand_sessions), mas sem stack/blind por mão associado ao resultado." />
          <Bloqueado titulo="Situações de ICM (bolha, mesa final)" texto="tournament_phase e icm_pressure existem no schema, mas o parser ainda não os preenche." />
        </div>
      </Painel>
    </div>
  );
}
