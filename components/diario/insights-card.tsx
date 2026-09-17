"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import {
  fetchAnalysisHandRows,
  computeReferenceProfile,
  computeMetricTrend,
  PREFLOP_REFERENCE,
  type MetricRange,
} from "@/lib/services/analysis-service";
import { fetchSessions } from "@/lib/services/bankroll-service";
import { aggregate } from "@/lib/bankroll/calc";
import type { AnalysisHandRow } from "@/types/analysis";

// "Insights da semana" — substitui o antigo "O que mudou no seu jogo"
// (game-changes-card.tsx) por algo mais parecido com um diário: além dos
// 5 números lado a lado (VPIP/PFR/3-Bet/BB Defense + ROI do mês), uma
// frase de manchete conta a história do dado mais relevante PRA ESSE
// jogador -- pedido explícito: "isso será individual para cada
// jogador". A manchete é escolhida entre os candidatos reais (nunca
// inventada): prioriza um alerta (piorou) sobre uma melhora, e só cai
// pro ROI se nenhuma métrica de mão tiver mudança significativa.

interface MetricChange {
  label: string;
  oldPct: number;
  newPct: number;
  melhorou: boolean;
  piorou: boolean;
  magnitude: number; // |distAntes - distDepois| -- quanto maior, mais a métrica se moveu em relação à faixa saudável
  trend: number[]; // computeMetricTrend em blocos de volume -- alimenta o sparkline do tile
}

export type WeekMood = "positivo" | "atencao" | "neutro";

const MIN_HANDS_PER_METADE = 20; // amostra mínima em CADA metade pra não virar ruído

function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function distanciaDaFaixa(value: number, range: MetricRange): number {
  if (value >= range.min && value <= range.max) return 0;
  return value < range.min ? range.min - value : value - range.max;
}

function bbDefensePct(rows: AnalysisHandRow[]): number | null {
  const opp = rows.filter((r) => r.heroPosition === "BB" && r.blindDefenseOpportunity === true);
  return pct(opp.filter((r) => r.blindDefended === true).length, opp.length);
}

function buildChange(
  label: string,
  oldVal: number | null,
  newVal: number | null,
  range: MetricRange,
  trend: number[]
): MetricChange | null {
  if (oldVal === null || newVal === null) return null;
  const distAntes = distanciaDaFaixa(oldVal, range);
  const distDepois = distanciaDaFaixa(newVal, range);
  return {
    label,
    oldPct: oldVal,
    newPct: newVal,
    melhorou: distDepois < distAntes,
    // Limiar de ~2pp pra não marcar como "piorou" ruído de amostra
    // pequena migrando de lado dentro da própria faixa.
    piorou: distDepois > distAntes + 2,
    magnitude: Math.abs(distAntes - distDepois),
    trend,
  };
}

// Sparkline minimalista (stroke fino, sem eixo/grade) -- no lugar do
// "antes X%" cru, mostra a FORMA da tendência num piscar de olho.
// Precisa de 2+ pontos; com menos que isso (amostra pequena demais pro
// computeMetricTrend bucketar), simplesmente não renderiza nada.
function Sparkline({ values, positivo }: { values: number[]; positivo: boolean }) {
  if (values.length < 2) return null;
  const w = 56;
  const h = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const cor = positivo ? "var(--color-positive)" : "var(--color-evolution)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-1" aria-hidden="true">
      <polyline points={points} fill="none" stroke={cor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function headlineFor(c: MetricChange): string {
  if (c.piorou) {
    return `Atenção: seu ${c.label} foi de ${c.oldPct}% pra ${c.newPct}% — se afastando do esperado pro seu perfil.`;
  }
  return `Você está evoluindo: seu ${c.label} foi de ${c.oldPct}% pra ${c.newPct}%, mais perto da faixa ideal.`;
}

export function InsightsCard({ style, onMood }: { style?: React.CSSProperties; onMood?: (mood: WeekMood) => void }) {
  const [changes, setChanges] = useState<MetricChange[] | null>(null);
  const [insuficiente, setInsuficiente] = useState(false);
  const [roi, setRoi] = useState<{ value: number; n: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rows, sessions] = await Promise.all([fetchAnalysisHandRows(), fetchSessions().catch(() => [])]);
        if (!alive) return;

        const hoje = new Date();
        const mesAtual = sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
        });
        const agg = aggregate(mesAtual);
        setRoi({ value: Math.round(agg.roi * 10) / 10, n: agg.n });

        if (rows.length < MIN_HANDS_PER_METADE * 2) {
          setInsuficiente(true);
          setLoading(false);
          return;
        }
        const meio = Math.floor(rows.length / 2);
        const antes = rows.slice(0, meio);
        const depois = rows.slice(meio);
        const profile = computeReferenceProfile(rows);
        const ref = PREFLOP_REFERENCE[profile];

        const vpip = buildChange(
          "VPIP",
          pct(antes.filter((r) => r.vpip).length, antes.length),
          pct(depois.filter((r) => r.vpip).length, depois.length),
          ref.vpip,
          computeMetricTrend(rows, (subset) => pct(subset.filter((r) => r.vpip).length, subset.length), 5)
        );
        const pfr = buildChange(
          "PFR",
          pct(antes.filter((r) => r.pfr).length, antes.length),
          pct(depois.filter((r) => r.pfr).length, depois.length),
          ref.pfr,
          computeMetricTrend(rows, (subset) => pct(subset.filter((r) => r.pfr).length, subset.length), 5)
        );
        const threeBet = buildChange(
          "3-Bet",
          pct(antes.filter((r) => r.threeBet).length, antes.length),
          pct(depois.filter((r) => r.threeBet).length, depois.length),
          ref.threeBet,
          computeMetricTrend(rows, (subset) => pct(subset.filter((r) => r.threeBet).length, subset.length), 5)
        );
        const bbDefense = buildChange(
          "BB Defense",
          bbDefensePct(antes),
          bbDefensePct(depois),
          ref.foldToSteal,
          computeMetricTrend(rows, bbDefensePct, 5)
        );

        setChanges([vpip, pfr, threeBet, bbDefense].filter((c): c is MetricChange => c !== null));
      } catch {
        setInsuficiente(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Manchete: prioriza um alerta (piorou) sobre uma melhora, escolhendo
  // em cada grupo a de maior magnitude -- e só cai pro ROI se nenhuma
  // métrica de mão tiver mudança que valha a pena destacar.
  const alertas = (changes ?? []).filter((c) => c.piorou).sort((a, b) => b.magnitude - a.magnitude);
  const melhoras = (changes ?? []).filter((c) => c.melhorou).sort((a, b) => b.magnitude - a.magnitude);
  const destaque = alertas[0] ?? melhoras[0] ?? null;

  let headline: string | null = null;
  if (destaque) {
    headline = headlineFor(destaque);
  } else if (roi && roi.n > 0) {
    headline = `Seu ROI este mês está em ${roi.value >= 0 ? "+" : ""}${roi.value}% em ${roi.n} ${roi.n === 1 ? "sessão" : "sessões"}.`;
  }

  // "Humor da semana" pro container geral do Diário (ver InsightsCard
  // no app/inicio/page.tsx) -- um alerta pesa mais que qualquer melhora
  // (o jogador precisa notar isso primeiro), só cai pra positivo com
  // melhora real ou ROI positivo, neutro é o padrão sem sinal nenhum.
  useEffect(() => {
    if (loading || !onMood) return;
    if (alertas.length > 0) onMood("atencao");
    else if (melhoras.length > 0 || (roi && roi.n > 0 && roi.value >= 0)) onMood("positivo");
    else onMood("neutro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, alertas.length, melhoras.length, roi?.n, roi?.value]);

  return (
    <section className="fade-in-up rounded-2xl border border-hairline bg-surface p-5" style={style}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">Insights da semana</h2>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : (
        <>
          {headline ? (
            <p className="mt-3 text-[15px] font-medium leading-snug text-ink">{headline}</p>
          ) : insuficiente ? (
            <p className="mt-3 text-sm text-muted">Ainda não há mãos suficientes importadas pra comparar sua evolução.</p>
          ) : (
            <p className="mt-3 text-sm text-muted">Sem mudanças significativas essa semana — continue registrando mãos e sessões.</p>
          )}

          {(changes && changes.length > 0) || roi ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {(changes ?? []).map((c) => (
                <div key={c.label} className="rounded-lg border border-hairline bg-elevated p-2.5">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted/80">
                    {c.label}
                    {c.melhorou && <span aria-label="Melhorou">🔥</span>}
                    {c.piorou && <TriangleAlert size={11} className="text-evolution" aria-label="Piorou" />}
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-ink">{c.newPct}%</p>
                  {c.trend.length >= 2 ? (
                    <Sparkline values={c.trend} positivo={!c.piorou} />
                  ) : (
                    <p className="mt-0.5 text-[10px] text-muted/70">antes {c.oldPct}%</p>
                  )}
                </div>
              ))}
              {roi && (
                <div className="rounded-lg border border-hairline bg-elevated p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted/80">ROI do mês</p>
                  {roi.n > 0 ? (
                    <>
                      <p className={`mt-1.5 text-lg font-bold tabular-nums ${roi.value >= 0 ? "text-positive" : "text-negative"}`}>
                        {roi.value >= 0 ? "+" : ""}
                        {roi.value}%
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted/70">
                        {roi.n} {roi.n === 1 ? "sessão" : "sessões"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1.5 text-lg font-bold text-muted">—</p>
                      <Link href="/banca" className="mt-0.5 block text-[10px] font-semibold text-ink underline underline-offset-2 hover:text-training">
                        Registrar sessão
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
