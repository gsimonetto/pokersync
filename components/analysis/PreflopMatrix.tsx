"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Target, Flame, MapPin, CornerUpLeft, Zap, Layers, ArrowUpRight, Shuffle } from "lucide-react";
import {
  Painel,
  StatCardGrid,
  HeroStrip,
  HealthGauge,
  SubHeader,
  EmptyState,
  SampleBadge,
  ReferenceProfileBadge,
  CategoryLegend,
  toneFromRange,
  toneTextClass,
  rangeCoaching,
  statBar,
  revisorHandsHref,
} from "@/components/analysis/shared";
import { TabNav } from "@/components/ui/tab-nav";
import { PostflopTab } from "@/components/analysis/PostflopStats";
import { computePreflopMetrics, computeMetricTrend, computeMatchupBreakdown, PREFLOP_REFERENCE } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PreflopMetrics, PreflopMetricsByPosition, PostflopMetrics, ReferenceProfile } from "@/types/analysis";

function fmtPct(v: number | null): string | null {
  return v === null ? null : `${v.toFixed(1)}%`;
}

type SubTab = "preflop" | "postflop" | "posicao" | "matchups";

const SUB_TABS: { value: SubTab; label: string; icon: typeof Target }[] = [
  { value: "preflop", label: "Preflop", icon: Target },
  { value: "postflop", label: "Postflop", icon: Flame },
  { value: "posicao", label: "Por posição", icon: MapPin },
  { value: "matchups", label: "Matchups", icon: Shuffle },
];

// Card 1 (preflop) + Card 2 (postflop, ver PostflopStats.tsx) + Por
// posição/Matchups/Matriz — antes tudo empilhado numa rolagem só com
// âncoras (SectionNav), o que deixava a aba "Preflop & Postflop" densa
// demais. Agora são sub-abas de verdade (mesmo TabNav do resto do
// produto): só uma seção na tela por vez, com crossfade ao trocar.
export function PreflopTab({
  rows,
  metrics,
  byPosition,
  postflopMetrics,
  referenceProfile,
}: {
  rows: AnalysisHandRow[];
  metrics: PreflopMetrics;
  byPosition: PreflopMetricsByPosition[];
  postflopMetrics: PostflopMetrics;
  referenceProfile: ReferenceProfile;
}) {
  const [subTab, setSubTab] = useState<SubTab>("preflop");
  const ref = PREFLOP_REFERENCE[referenceProfile];
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
    <div>
      <TabNav value={subTab} onChange={setSubTab} options={SUB_TABS} />

      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-4"
        >
          {subTab === "preflop" && (
            <Painel
              titulo="Frequências pré-flop"
              icone={<Target size={14} className="icon-glow text-training" />}
              action={
                <div className="flex items-center gap-2">
                  <ReferenceProfileBadge profile={referenceProfile} />
                  <SampleBadge hands={metrics.hands} />
                </div>
              }
            >
              <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
                <HealthGauge
                  items={[
                    { value: metrics.vpip_pct, min: ref.vpip.min, max: ref.vpip.max },
                    { value: metrics.pfr_pct, min: ref.pfr.min, max: ref.pfr.max },
                    { value: metrics.three_bet_pct, min: ref.threeBet.min, max: ref.threeBet.max },
                    { value: metrics.steal_pct, min: ref.steal.min, max: ref.steal.max },
                  ]}
                />
                <HeroStrip
                  items={[
                    {
                      label: "VPIP",
                      value: fmtPct(metrics.vpip_pct),
                      tone: toneFromRange(metrics.vpip_pct, ref.vpip.min, ref.vpip.max),
                      trend: vpipTrend,
                      bar: statBar(metrics.vpip_pct, ref.vpip.min, ref.vpip.max, 100),
                      hint: "Frequência que você entra na mão voluntariamente (call ou raise), sem contar blinds forçados.",
                      coaching: rangeCoaching(
                        metrics.vpip_pct,
                        ref.vpip.min,
                        ref.vpip.max,
                        "Você está entrando em poucas mãos. Quando a ação chega foldada até você perto do fim da rodada, dá pra jogar mais mãos com segurança — você está deixando isso passar.",
                        "Você está entrando em mãos demais, inclusive fracas. Isso te deixa em decisões difíceis depois que as cartas da mesa aparecem, principalmente quando ainda faltam jogadores pra agir depois de você."
                      ),
                    },
                    {
                      label: "PFR",
                      value: fmtPct(metrics.pfr_pct),
                      tone: toneFromRange(metrics.pfr_pct, ref.pfr.min, ref.pfr.max),
                      trend: pfrTrend,
                      bar: statBar(metrics.pfr_pct, ref.pfr.min, ref.pfr.max, 100),
                      hint: "Frequência que você sobe (raise) no preflop — está sempre dentro do VPIP.",
                      coaching: rangeCoaching(
                        metrics.pfr_pct,
                        ref.pfr.min,
                        ref.pfr.max,
                        "Quando você decide entrar na mão, prefere só pagar em vez de apostar mais. Isso entrega o controle da mão pro adversário — se a mão é boa o suficiente pra jogar, geralmente também é boa o suficiente pra você apostar mais.",
                        "Você está apostando mais do que deveria em relação a quantas mãos joga. Reveja se não está fazendo isso com mãos fracas quando ainda tem gente pra agir depois de você."
                      ),
                    },
                    {
                      label: "3-Bet %",
                      value: fmtPct(metrics.three_bet_pct),
                      tone: toneFromRange(metrics.three_bet_pct, ref.threeBet.min, ref.threeBet.max),
                      trend: threeBetTrend,
                      bar: statBar(metrics.three_bet_pct, ref.threeBet.min, ref.threeBet.max, 100),
                      hint: "Frequência de re-raise no preflop diante de um raise anterior.",
                      coaching: rangeCoaching(
                        metrics.three_bet_pct,
                        ref.threeBet.min,
                        ref.threeBet.max,
                        "Quase nunca você aposta mais em cima de quem já apostou antes de você. Os outros jogadores vão perceber e vão te respeitar cada vez menos.",
                        "Você está apostando mais em cima de quem já apostou com frequência alta demais. Cuidado — fica fácil de identificar e virar alvo de um contra-ataque."
                      ),
                    },
                    {
                      label: "Steal %",
                      value: fmtPct(metrics.steal_pct),
                      tone: toneFromRange(metrics.steal_pct, ref.steal.min, ref.steal.max),
                      trend: stealTrend,
                      bar: statBar(metrics.steal_pct, ref.steal.min, ref.steal.max, 100),
                      hint: "Frequência de open-raise a partir de CO/BTN/SB quando a ação chega foldada até você.",
                      coaching: rangeCoaching(
                        metrics.steal_pct,
                        ref.steal.min,
                        ref.steal.max,
                        "Quando ninguém entrou na mão antes de chegar em você perto do fim da rodada, você quase não aproveita pra tentar ficar com o pote. Está deixando dinheiro fácil na mesa.",
                        "Você tenta ficar com o pote com ninguém tendo entrado antes com frequência alta demais. Jogadores atentos já perceberam e estão passando a te desafiar de volta."
                      ),
                    },
                  ]}
                />
              </div>

              <SubHeader>Outras frequências</SubHeader>
              <div className="mb-2 flex justify-end">
                <CategoryLegend categories={["defesa", "agressao", "posicional"]} />
              </div>
              <StatCardGrid
                items={[
                  {
                    label: "Fold to 3-Bet %",
                    value: fmtPct(metrics.fold_to_3bet_pct),
                    icon: CornerUpLeft,
                    tone: toneFromRange(metrics.fold_to_3bet_pct, ref.foldTo3bet.min, ref.foldTo3bet.max),
                    bar: statBar(metrics.fold_to_3bet_pct, ref.foldTo3bet.min, ref.foldTo3bet.max, 100),
                    hint: "Frequência que você desiste depois de ser 3-betado, quando você tinha aberto o pote.",
                    category: "defesa",
                  },
                  {
                    label: "4-Bet %",
                    value: fmtPct(metrics.four_bet_pct),
                    icon: Zap,
                    hint: "Frequência de re-raise diante de um 3-bet adversário.",
                    category: "agressao",
                  },
                  {
                    label: "Fold to 4-Bet %",
                    value: fmtPct(metrics.fold_to_4bet_pct),
                    icon: CornerUpLeft,
                    hint: "Frequência que você desiste depois de ser 4-betado, quando você tinha 3-betado.",
                    category: "defesa",
                  },
                  {
                    label: "Squeeze %",
                    value: fmtPct(metrics.squeeze_pct),
                    icon: Layers,
                    hint: "Frequência de 3-bet quando já houve um raise e pelo menos um call antes de você.",
                    category: "agressao",
                  },
                  {
                    label: "Fold to Steal (SB vs BTN)",
                    value: fmtPct(metrics.fold_to_steal_sb_vs_btn_pct),
                    icon: CornerUpLeft,
                    tone: toneFromRange(metrics.fold_to_steal_sb_vs_btn_pct, ref.foldToSteal.min, ref.foldToSteal.max),
                    bar: statBar(metrics.fold_to_steal_sb_vs_btn_pct, ref.foldToSteal.min, ref.foldToSteal.max, 100),
                    hint: "Frequência que você desiste no SB contra um open-raise do BTN.",
                    category: "posicional",
                  },
                  {
                    label: "Fold to Steal (BB vs BTN)",
                    value: fmtPct(metrics.fold_to_steal_bb_vs_btn_pct),
                    icon: CornerUpLeft,
                    tone: toneFromRange(metrics.fold_to_steal_bb_vs_btn_pct, ref.foldToSteal.min, ref.foldToSteal.max),
                    bar: statBar(metrics.fold_to_steal_bb_vs_btn_pct, ref.foldToSteal.min, ref.foldToSteal.max, 100),
                    hint: "Frequência que você desiste no BB contra um open-raise do BTN.",
                    category: "posicional",
                  },
                  {
                    label: "Fold to Steal (BB vs SB)",
                    value: fmtPct(metrics.fold_to_steal_bb_vs_sb_pct),
                    icon: CornerUpLeft,
                    tone: toneFromRange(metrics.fold_to_steal_bb_vs_sb_pct, ref.foldToSteal.min, ref.foldToSteal.max),
                    bar: statBar(metrics.fold_to_steal_bb_vs_sb_pct, ref.foldToSteal.min, ref.foldToSteal.max, 100),
                    hint: "Frequência que você desiste no BB contra um open-raise do SB.",
                    category: "posicional",
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
            </Painel>
          )}

          {subTab === "postflop" && <PostflopTab rows={rows} metrics={postflopMetrics} referenceProfile={referenceProfile} />}

          {subTab === "posicao" && (
            <Painel
              titulo="Por posição"
              icone={<MapPin size={14} className="icon-glow text-evolution" />}
              action={<ReferenceProfileBadge profile={referenceProfile} />}
            >
              {byPosition.length === 0 ? (
                <EmptyState texto="Sem mãos suficientes com posição identificada." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-hairline">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hairline">
                        {["Posição", "VPIP", "PFR", "PFR : VPIP", "3-Bet", "Steal", "Mãos", ""].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted/80">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byPositionSorted.map((p, i) => {
                        const ratio = p.vpip_pct && p.vpip_pct > 0 && p.pfr_pct !== null ? Math.round((p.pfr_pct / p.vpip_pct) * 100) : null;
                        return (
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
                            className={`cursor-pointer bg-elevated/0 transition-colors hover:bg-elevated ${
                              i < byPositionSorted.length - 1 ? "border-b border-hairline" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-elevated px-1.5 text-[11px] font-bold text-ink">
                                {p.position}
                              </span>
                            </td>
                            <td className={`px-4 py-3 font-semibold tabular-nums ${toneTextClass(toneFromRange(p.vpip_pct, ref.vpip.min, ref.vpip.max))}`}>
                              {fmtPct(p.vpip_pct) ?? "—"}
                            </td>
                            <td className={`px-4 py-3 font-semibold tabular-nums ${toneTextClass(toneFromRange(p.pfr_pct, ref.pfr.min, ref.pfr.max))}`}>
                              {fmtPct(p.pfr_pct) ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              {ratio !== null ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-1 w-14 rounded-full bg-void/40">
                                    <div className="h-full rounded-full bg-training" style={{ width: `${Math.min(100, ratio)}%` }} />
                                  </div>
                                  <span className="text-[11px] tabular-nums text-muted">{ratio}%</span>
                                </div>
                              ) : (
                                <span className="text-muted/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted">{fmtPct(p.three_bet_pct) ?? "—"}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted">{fmtPct(p.steal_pct) ?? "—"}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted">{p.hands}</td>
                            <td className="px-4 py-3">
                              <ArrowUpRight size={13} className="text-muted" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted/70">
                PFR : VPIP é quanto do seu VPIP virou raise — quanto mais perto de 100%, menos você entra só de call. Clique numa
                posição pra abrir essas mãos no Revisor.
              </p>
            </Painel>
          )}

          {subTab === "matchups" && (
            <Painel titulo="Matchups" icone={<Shuffle size={14} className="icon-glow text-review" />}>
              {matchups.length === 0 ? (
                <EmptyState texto="Nenhum matchup heads-up até o flop identificado ainda — só entra aqui quando o pot fica você-vs-um-adversário até o flop." />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {matchups.map((m) => (
                    <button
                      key={m.matchup}
                      type="button"
                      onClick={() =>
                        router.push(
                          revisorHandsHref(
                            rows.filter((r) => r.matchup === m.matchup).map((r) => r.handReviewId),
                            `Matchup ${m.matchup.replace("_vs_", " vs ")}`
                          )
                        )
                      }
                      className="rounded-lg border border-hairline bg-elevated p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{m.matchup.replace("_vs_", " vs ")}</span>
                        <ArrowUpRight size={13} className="shrink-0 text-muted" />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{m.hands} {m.hands === 1 ? "mão" : "mãos"}</p>
                      <p className="mt-2.5 text-[11px] text-muted">
                        VPIP <b className="text-ink">{fmtPct(m.vpip_pct) ?? "—"}</b>
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
                Só cobre pots que ficaram heads-up (você contra um adversário) até o flop — é a única situação em que o motor
                identifica os dois lados do confronto com segurança. Clique num matchup pra abrir essas mãos no Revisor.
              </p>
            </Painel>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
