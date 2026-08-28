"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Grid3x3, CornerUpLeft, Zap, Layers, ArrowUpRight, Shuffle } from "lucide-react";
import { Painel, StatList, HeroStrip, SubHeader, EmptyState, SampleBadge, toneFromRange, statBar, revisorHandsHref } from "@/components/analysis/shared";
import { PostflopTab } from "@/components/analysis/PostflopStats";
import { computeHandMatrix, computePreflopMetrics, computeMetricTrend, computeMatchupBreakdown } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PreflopMetrics, PreflopMetricsByPosition, PostflopMetrics } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

// Card 1 (preflop) + Card 2 (postflop, ver PostflopStats.tsx) numa única
// aba — mesma linguagem de lista nos dois, em vez de uma aba em grid de
// cards e outra em lista. "Por posição" e a matriz 13×13 seguem como
// cards adicionais, contexto que só faz sentido depois das frequências.
export function PreflopTab({
  rows,
  metrics,
  byPosition,
  postflopMetrics,
}: {
  rows: AnalysisHandRow[];
  metrics: PreflopMetrics;
  byPosition: PreflopMetricsByPosition[];
  postflopMetrics: PostflopMetrics;
}) {
  const matrix = useMemo(() => computeHandMatrix(rows), [rows]);
  // Maior volume primeiro — mais útil pra achar rápido onde a amostra é
  // grande o suficiente pra confiar no número, em vez da ordem canônica
  // UTG→BB (essa já está implícita no rótulo da posição).
  const byPositionSorted = useMemo(() => [...byPosition].sort((a, b) => b.hands - a.hands), [byPosition]);
  const matchups = useMemo(() => computeMatchupBreakdown(rows), [rows]);
  const router = useRouter();

  // Tendência por bloco de mãos (ver computeMetricTrend) — só nos 4
  // headliners de preflop (faixa de destaque), pra não transformar toda a
  // lista num gráfico.
  const vpipTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePreflopMetrics(chunk).vpip_pct), [rows]);
  const pfrTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePreflopMetrics(chunk).pfr_pct), [rows]);
  const threeBetTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePreflopMetrics(chunk).three_bet_pct), [rows]);
  const stealTrend = useMemo(() => computeMetricTrend(rows, (chunk) => computePreflopMetrics(chunk).steal_pct), [rows]);

  return (
    <div className="space-y-4">
      <Painel titulo="Frequências pré-flop" icone={<Target size={14} className="text-training" />} action={<SampleBadge hands={metrics.hands} />}>
        <HeroStrip
          items={[
            {
              label: "VPIP",
              value: fmtPct(metrics.vpip_pct),
              tone: toneFromRange(metrics.vpip_pct, 20, 28),
              trend: vpipTrend,
              hint: "Frequência que você entra na mão voluntariamente (call ou raise), sem contar blinds forçados.",
            },
            {
              label: "PFR",
              value: fmtPct(metrics.pfr_pct),
              tone: toneFromRange(metrics.pfr_pct, 15, 24),
              trend: pfrTrend,
              hint: "Frequência que você sobe (raise) no preflop — está sempre dentro do VPIP.",
            },
            {
              label: "3-Bet %",
              value: fmtPct(metrics.three_bet_pct),
              tone: toneFromRange(metrics.three_bet_pct, 6, 10),
              trend: threeBetTrend,
              hint: "Frequência de re-raise no preflop diante de um raise anterior.",
            },
            {
              label: "Steal %",
              value: fmtPct(metrics.steal_pct),
              tone: toneFromRange(metrics.steal_pct, 35, 55),
              trend: stealTrend,
              hint: "Frequência de open-raise a partir de CO/BTN/SB quando a ação chega foldada até você.",
            },
          ]}
        />

        <SubHeader>Outras frequências</SubHeader>
        <StatList
          items={[
            {
              label: "Fold to 3-Bet %",
              value: fmtPct(metrics.fold_to_3bet_pct),
              icon: CornerUpLeft,
              tone: toneFromRange(metrics.fold_to_3bet_pct, 55, 65),
              bar: statBar(metrics.fold_to_3bet_pct, 55, 65, 100),
              hint: "Frequência que você desiste depois de ser 3-betado, quando você tinha aberto o pote.",
            },
            { label: "4-Bet %", value: fmtPct(metrics.four_bet_pct), icon: Zap, hint: "Frequência de re-raise diante de um 3-bet adversário." },
            {
              label: "Fold to 4-Bet %",
              value: fmtPct(metrics.fold_to_4bet_pct),
              icon: CornerUpLeft,
              hint: "Frequência que você desiste depois de ser 4-betado, quando você tinha 3-betado.",
            },
            {
              label: "Squeeze %",
              value: fmtPct(metrics.squeeze_pct),
              icon: Layers,
              hint: "Frequência de 3-bet quando já houve um raise e pelo menos um call antes de você.",
            },
            {
              label: "Fold to Steal (SB vs BTN)",
              value: fmtPct(metrics.fold_to_steal_sb_vs_btn_pct),
              icon: CornerUpLeft,
              hint: "Frequência que você desiste no SB contra um open-raise do BTN.",
            },
            {
              label: "Fold to Steal (BB vs BTN)",
              value: fmtPct(metrics.fold_to_steal_bb_vs_btn_pct),
              icon: CornerUpLeft,
              hint: "Frequência que você desiste no BB contra um open-raise do BTN.",
            },
            {
              label: "Fold to Steal (BB vs SB)",
              value: fmtPct(metrics.fold_to_steal_bb_vs_sb_pct),
              icon: CornerUpLeft,
              hint: "Frequência que você desiste no BB contra um open-raise do SB.",
            },
            {
              label: "Limp-Fold %",
              value: null,
              locked: "Hand tags não isola fold pós-limp — no roadmap do pipeline de postflop",
            },
            {
              label: "Open Push %",
              value: null,
              locked: "Depende de classificar profundidade all-in no open — no roadmap do parser",
            },
          ]}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
          Cor e barra = faixa de referência comum pra 6-max/MTT (heurística de população, não output do motor GTO) — verde
          perto do consenso, vermelho bem fora dele. Métrica sem barra é métrica sem uma faixa amplamente aceita — mostramos
          só o número, sem inventar escala. O gráfico ao lado de VPIP/PFR/3-Bet% mostra a tendência ao longo do período
          filtrado (só aparece com pelo menos 30 mãos). Passe o mouse sobre qualquer linha pra ver a definição.
        </p>
      </Painel>

      <PostflopTab rows={rows} metrics={postflopMetrics} />

      <Painel titulo="Por posição" icone={<Target size={14} className="text-evolution" />}>
        {byPosition.length === 0 ? (
          <EmptyState texto="Sem mãos suficientes com posição identificada." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-elevated text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-3 py-2 text-left font-bold">Posição</th>
                  <th className="px-3 py-2 text-right font-bold">Mãos</th>
                  <th className="px-3 py-2 text-right font-bold">VPIP</th>
                  <th className="px-3 py-2 text-right font-bold">PFR</th>
                  <th className="px-3 py-2 text-right font-bold">3-Bet</th>
                  <th className="px-3 py-2 text-right font-bold">Steal</th>
                  <th className="px-3 py-2 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {byPositionSorted.map((p) => (
                  <tr
                    key={p.position}
                    onClick={() =>
                      router.push(
                        revisorHandsHref(
                          rows.filter((r) => r.heroPosition === p.position).map((r) => r.handReviewId),
                          `Posição ${p.position}`
                        )
                      )
                    }
                    className="cursor-pointer border-b border-hairline transition-colors last:border-b-0 hover:bg-elevated/60"
                  >
                    <td className="px-3 py-2 font-semibold text-ink">{p.position}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{p.hands}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.vpip_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.pfr_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.three_bet_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.steal_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <ArrowUpRight size={13} className="ml-auto text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted/70">Clique numa posição pra abrir essas mãos no Revisor.</p>
      </Painel>

      <Painel titulo="Matchups" icone={<Shuffle size={14} className="text-review" />}>
        {matchups.length === 0 ? (
          <EmptyState texto="Nenhum matchup heads-up até o flop identificado ainda — só entra aqui quando o pot fica você-vs-um-adversário até o flop." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-elevated text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-3 py-2 text-left font-bold">Matchup</th>
                  <th className="px-3 py-2 text-right font-bold">Mãos</th>
                  <th className="px-3 py-2 text-right font-bold">VPIP</th>
                  <th className="px-3 py-2 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {matchups.map((m) => (
                  <tr
                    key={m.matchup}
                    onClick={() =>
                      router.push(
                        revisorHandsHref(
                          rows.filter((r) => r.matchup === m.matchup).map((r) => r.handReviewId),
                          `Matchup ${m.matchup.replace("_vs_", " vs ")}`
                        )
                      )
                    }
                    className="cursor-pointer border-b border-hairline transition-colors last:border-b-0 hover:bg-elevated/60"
                  >
                    <td className="px-3 py-2 font-semibold text-ink">{m.matchup.replace("_vs_", " vs ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{m.hands}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.vpip_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <ArrowUpRight size={13} className="ml-auto text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted/70">
          Só cobre pots que ficaram heads-up (você contra um adversário) até o flop — é a única situação em que o motor
          identifica os dois lados do confronto com segurança. Clique num matchup pra abrir essas mãos no Revisor.
        </p>
      </Painel>

      <Painel titulo="Matriz posicional 13×13" icone={<Grid3x3 size={14} className="text-review" />}>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          Intensidade = % de vezes que você jogou (VPIP) cada combinação. O contorno tracejado mostra uma referência simplificada
          de range de abertura — não é output do motor GTO, é só escala visual (o solver próprio ainda não gera range por
          posição pra este grid — ver backlog).
        </p>
        {/* Só informativo (não é editável como o Construtor de Ranges) —
            mesmo teto de largura (580px) pra não dominar a tela à toa. */}
        <div style={{ maxWidth: 580 }}>
          <HandMatrixGrid cells={matrix} />
        </div>
      </Painel>
    </div>
  );
}

function HandMatrixGrid({ cells }: { cells: ReturnType<typeof computeHandMatrix> }) {
  const [hover, setHover] = useState<string | null>(null);
  const byKey = new Map(cells.map((c) => [`${c.row}-${c.col}`, c]));
  const hovered = hover ? byKey.get(hover) : null;

  function colorFor(playedPct: number | null, gtoPct: number | null): string {
    if (playedPct === null) return "rgba(255,255,255,0.04)";
    // Verde quando perto/acima da referência, âmbar levemente abaixo,
    // vermelho quando bem abaixo — mesma linguagem de cor do resto do
    // produto (positive/evolution/negative), não um heatmap arco-íris.
    const ref = gtoPct ?? 30;
    const ratio = ref > 0 ? playedPct / ref : 1;
    if (ratio >= 0.85) return "rgba(34,197,94,0.55)";
    if (ratio >= 0.5) return "rgba(245,158,11,0.5)";
    return "rgba(224,85,90,0.45)";
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px] rounded-xl border border-hairline bg-surface p-1.5">
        {cells.map((c) => (
          <div
            key={c.hand}
            onMouseEnter={() => setHover(`${c.row}-${c.col}`)}
            onMouseLeave={() => setHover((h) => (h === `${c.row}-${c.col}` ? null : h))}
            onClick={() => setHover((h) => (h === `${c.row}-${c.col}` ? null : `${c.row}-${c.col}`))}
            className="flex aspect-square cursor-pointer items-center justify-center rounded-[3px] text-[9px] font-semibold text-ink/80"
            style={{ backgroundColor: colorFor(c.playedPct, c.gtoPct), border: c.row === c.col ? "1px solid rgba(255,255,255,0.18)" : undefined }}
            title={`${c.hand} — ${c.playedPct !== null ? `${c.playedPct}% jogada (${c.sample} mãos)` : "sem amostra"}`}
          >
            {c.hand}
          </div>
        ))}
      </div>

      {hovered && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2 text-xs">
          <span className="font-bold text-ink">{hovered.hand}</span>
          <span className="text-muted">
            Jogada: <strong className="text-ink">{hovered.playedPct !== null ? `${hovered.playedPct}%` : "sem amostra"}</strong>
          </span>
          <span className="text-muted">
            Referência: <strong className="text-ink">{hovered.gtoPct}%</strong>
          </span>
          <span className="text-muted">
            Amostra: <strong className="text-ink">{hovered.sample}</strong> {hovered.sample === 1 ? "mão" : "mãos"}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted">
        <LegendDot color="rgba(34,197,94,0.55)" label="Na referência ou acima" />
        <LegendDot color="rgba(245,158,11,0.5)" label="Abaixo da referência" />
        <LegendDot color="rgba(224,85,90,0.45)" label="Bem abaixo da referência" />
        <LegendDot color="rgba(255,255,255,0.04)" label="Sem amostra" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
