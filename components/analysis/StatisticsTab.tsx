"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Layers,
  Award,
  Loader2,
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
import { Painel, StatList, Bloqueado } from "@/components/dashboard/kit";
import { FilterChip } from "@/components/ui/filter-chip";
import { TournamentPayoutsPanel } from "@/components/analysis/TournamentPayoutsPanel";
import { buyinBucketOf } from "@/lib/services/analysis-service";
import { fetchEligibleHandReviewIds, computeHandEvBatch } from "@/lib/services/hand-ev-service";
import { BUYIN_BUCKET_LABEL, type BuyinBucket, type TournamentMetrics } from "@/types/analysis";
import type { HandSession } from "@/lib/services/hand-session-service";
import type { TournamentPayout } from "@/lib/services/tournament-payout-service";
import type { FinancialDay } from "@/lib/services/team-service";
import type { DisplayCurrency } from "@/lib/hooks/use-currency-preference";

const BUYIN_BUCKET_ORDER: BuyinBucket[] = ["0-10", "10-50", "50-200", "200+"];

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
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
  onCevComputed,
  buyinFilter,
  onBuyinFilterChange,
  availableBuyinBuckets,
  currency,
  onCurrencyChange,
  formatUsd,
}: {
  metrics: TournamentMetrics;
  financialSeries: FinancialDay[];
  tournamentSessions: HandSession[];
  payouts: TournamentPayout[];
  onCevComputed: () => void;
  buyinFilter: BuyinBucket[];
  onBuyinFilterChange: (next: BuyinBucket[]) => void;
  availableBuyinBuckets: Set<BuyinBucket>;
  currency: DisplayCurrency;
  onCurrencyChange: (next: DisplayCurrency) => void;
  formatUsd: (amountUsd: number | null) => string | null;
}) {
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [computeError, setComputeError] = useState("");
  const [summary, setSummary] = useState<{ computed: number; skipped: number } | null>(null);

  const hasCev = metrics.chip_ev_total !== null;

  // Todo valor de dinheiro aqui vem em USD (buy-in/premiação importados
  // só reconhecem "$X ... USD" — ver hand-session-service.ts); formatUsd
  // já resolve a moeda escolhida pelo jogador (ver use-currency-preference.ts).
  function fmtMoney(v: number | null): string | null {
    if (v === null) return null;
    const formatted = formatUsd(v);
    return formatted === null ? null : `${v >= 0 ? "+" : ""}${formatted}`;
  }
  const fmtMoneyPlain = formatUsd;

  // Painel de premiação/torneios (hand_sessions) filtrado pelo mesmo
  // corte de buy-in que `metrics` já aplica no servidor (ver
  // fetchTournamentMetrics) — filtrado aqui de novo no cliente pra não
  // precisar recarregar tournamentSessions/payouts do servidor a cada
  // troca de filtro.
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
  // verdade (mesmo componente TournamentPayoutsPanel).
  const [premiacaoOpen, setPremiacaoOpen] = useState(false);
  const payoutByTournament = useMemo(() => new Map(payouts.map((p) => [p.tournamentIdPs, p])), [payouts]);

  // Torneios importados só via Tournament Summary (tournament_payouts),
  // sem NENHUMA mão sincronizada pra esse torneio ainda -- pedido
  // explícito: "total de torneios devem vir dos torneios importados e nao
  // do hand history". Antes o total só contava hand_sessions, então um
  // torneio cujo agente só mandou o resumo (sem hand history) nunca
  // aparecia em lugar nenhum. Só entra no total SEM filtro de buy-in
  // ativo -- tournament_payouts não guarda buy-in (isso só vem do hand
  // history, ver extractTournamentInfo em hand-session-service.ts), então
  // não dá pra classificar esses torneios numa faixa quando o filtro está
  // ativo.
  const tournamentIdsFromSessions = useMemo(
    () => new Set(filteredSessions.map((s) => s.tournament_id_ps).filter((id): id is string => id != null)),
    [filteredSessions]
  );
  const payoutOnlyList = useMemo(
    () => (buyinFilter.length > 0 ? [] : payouts.filter((p) => !tournamentIdsFromSessions.has(p.tournamentIdPs))),
    [payouts, tournamentIdsFromSessions, buyinFilter]
  );
  const totalTorneiosCount = filteredSessions.length + payoutOnlyList.length;

  // Buy-ins investidos / Ganhos (premiação) / Torneios: pedido explícito
  // pra vir SÓ das mãos importadas (hand_sessions + tournament_payouts),
  // nunca de bankroll_sessions (Gestão de Banca) — são fontes de verdade
  // separadas de propósito, e excluir uma sessão na Banca não pode apagar
  // (nem mudar) esses números aqui. Por isso soma bruta (nunca subtrai
  // buy-in do ganho, ao contrário do lucro líquido que a Banca calcula).
  // Buy-in em si não soma nada dos torneios só-de-payout (não tem esse
  // dado, ver comentário acima) — só Ganhos e as contagens de premiação
  // ganham os torneios extras.
  const totalBuyinImportado = useMemo(
    () => filteredSessions.reduce((acc, s) => acc + (s.buyin ?? 0), 0),
    [filteredSessions]
  );
  const totalGanhosImportado = useMemo(
    () =>
      filteredSessions.reduce((acc, s) => {
        const p = s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps) : undefined;
        return acc + (p?.heroPayoutAmount ?? 0);
      }, 0) + payoutOnlyList.reduce((acc, p) => acc + (p.heroPayoutAmount ?? 0), 0),
    [filteredSessions, payoutByTournament, payoutOnlyList]
  );

  const payoutRegisteredCount = useMemo(
    () =>
      filteredSessions.filter((s) => {
        const p = s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps) : undefined;
        return p != null && (p.heroPayoutAmount != null || p.places.length > 0);
      }).length +
      // Torneio só-de-payout é, por definição, já registrado (é o único
      // dado que ele tem).
      payoutOnlyList.length,
    [filteredSessions, payoutByTournament, payoutOnlyList]
  );
  const payoutPendingCount = totalTorneiosCount - payoutRegisteredCount;

  // cEV calcula sozinho ao entrar na aba, sem botão -- mesmo padrão de
  // trackers como Hold'em Manager/PokerTracker (stats saem automáticas do
  // import, sem clique). Roda em segundo plano, sem travar a navegação:
  // o jogador pode usar o resto da tela normalmente enquanto calcula por
  // trás. Só uma vez por visita à aba (StatisticsTab desmonta ao trocar
  // de aba — ver AnimatePresence key={tab} em app/performance/page.tsx —
  // então reentrar já dispara de novo se houver mão nova elegível).
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setComputing(true);
      setComputeError("");
      setSummary(null);
      try {
        const ids = await fetchEligibleHandReviewIds();
        if (ids.length === 0) return;
        setProgress({ done: 0, total: ids.length });
        const outcomes = await computeHandEvBatch(ids, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (cancelled) return;
        const computed = outcomes.filter((o) => o.computed).length;
        setSummary({ computed, skipped: outcomes.length - computed });
        onCevComputed();
      } catch (e) {
        if (!cancelled) setComputeError(e instanceof Error ? e.message : "Erro ao calcular cEV.");
      } finally {
        if (!cancelled) {
          setComputing(false);
          setProgress(null);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Painel
        titulo="Resumo financeiro"
        icone={<Wallet size={14} className="icon-glow text-evolution" />}
        action={
          <div className="flex items-center gap-1 rounded-lg border border-hairline p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => onCurrencyChange("usd")}
              className={`rounded-md px-2 py-1 transition-colors ${currency === "usd" ? "bg-ink text-void" : "text-muted hover:text-ink"}`}
            >
              US$
            </button>
            <button
              type="button"
              onClick={() => onCurrencyChange("brl")}
              className={`rounded-md px-2 py-1 transition-colors ${currency === "brl" ? "bg-ink text-void" : "text-muted hover:text-ink"}`}
            >
              R$
            </button>
          </div>
        }
      >
        <p className="mb-3 -mt-1 text-[11px] leading-relaxed text-muted/70">
          Buy-in e premiação são sempre importados em dólar (hand history/resumo de torneio) — escolha acima se quer ver os
          valores em dólar ou convertidos pra real na cotação do dia.
        </p>
        <StatList
          items={[
            {
              label: "Buy-ins investidos",
              value: filteredSessions.length > 0 ? fmtMoneyPlain(totalBuyinImportado) : null,
              icon: ArrowDownToLine,
            },
            { label: "Torneios", value: totalTorneiosCount > 0 ? String(totalTorneiosCount) : null, icon: Hash },
            {
              label: "Ganhos (premiação)",
              value: totalTorneiosCount > 0 ? fmtMoneyPlain(totalGanhosImportado) : null,
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
          decisão &quot;deveria&quot; valer em $. Vem automaticamente do agente desktop (Radar PokerSync) sincronizando o resumo de
          cada torneio.
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
            <TournamentPayoutsPanel sessions={filteredSessions} payouts={payouts} formatUsd={formatUsd} />
          </div>
        )}
      </Painel>

      <Painel
        titulo="cEV & ICM"
        icone={<Layers size={14} className="icon-glow text-review" />}
        action={
          computing ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
              <Loader2 size={13} className="animate-spin" />
              {progress ? `Calculando ${progress.done}/${progress.total}` : "Calculando…"}
            </span>
          ) : undefined
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Cobre all-in no preflop com TODAS as mãos envolvidas mostradas no showdown (heads-up ou multiway), em torneios com
          premiação cadastrada acima — é o único caso que o motor GTO valida hoje (ver{" "}
          <code className="text-ink/70">pokersync-solver/engine/hand_cev.py</code>). Não é uma estimativa do torneio inteiro,
          é a soma exata dessas mãos específicas.
        </p>

        <div className="mb-3 flex items-start gap-2 rounded-lg border border-hairline bg-elevated/60 p-2.5 text-[11.5px] leading-relaxed text-muted">
          <Monitor size={14} className="mt-0.5 shrink-0 text-muted/70" />
          <span>
            Todas as mãos e torneios do Player Evolution vêm do{" "}
            <span className="text-ink/80 font-semibold">agente desktop (Radar PokerSync)</span> sincronizando sozinho — não
            existe mais importação manual nessa tela.
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
              texto="Sem mão elegível calculada ainda (all-in preflop com premiação cadastrada) — calcula sozinho assim que houver uma, ou o motor GTO não está publicado neste ambiente."
            />
          )}
        </div>
      </Painel>
    </div>
  );
}
