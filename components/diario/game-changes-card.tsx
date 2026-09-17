"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { fetchAnalysisHandRows, computeReferenceProfile, PREFLOP_REFERENCE, type MetricRange } from "@/lib/services/analysis-service";
import type { AnalysisHandRow } from "@/types/analysis";

// "O que mudou no seu jogo" — compara a primeira metade contra a segunda
// metade do histórico de mãos importadas (mesma fonte que o módulo de
// Análise usa, fetchAnalysisHandRows — ordenada cronologicamente
// ascendente) pra ver se cada métrica está se aproximando ou se
// afastando da faixa de referência (não é só "subiu"/"desceu" cru: pra
// VPIP/PFR/3-bet/BB Defense, "melhor" é ficar dentro da faixa saudável,
// não necessariamente aumentar).

interface MetricChange {
  label: string;
  oldPct: number;
  newPct: number;
  melhorou: boolean;
  piorou: boolean;
}

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

function buildChange(label: string, oldVal: number | null, newVal: number | null, range: MetricRange): MetricChange | null {
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
  };
}

export function GameChangesCard({ style }: { style?: React.CSSProperties }) {
  const [changes, setChanges] = useState<MetricChange[] | null>(null);
  const [insuficiente, setInsuficiente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAnalysisHandRows();
        if (!alive) return;
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
          ref.vpip
        );
        const pfr = buildChange(
          "PFR",
          pct(antes.filter((r) => r.pfr).length, antes.length),
          pct(depois.filter((r) => r.pfr).length, depois.length),
          ref.pfr
        );
        const threeBet = buildChange(
          "3-Bet",
          pct(antes.filter((r) => r.threeBet).length, antes.length),
          pct(depois.filter((r) => r.threeBet).length, depois.length),
          ref.threeBet
        );
        const bbDefense = buildChange("BB Defense", bbDefensePct(antes), bbDefensePct(depois), ref.foldToSteal);

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

  return (
    <section className="fade-in-up rounded-2xl border border-hairline bg-surface p-5" style={style}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">O que mudou no seu jogo</h2>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : insuficiente || !changes || changes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Ainda não há mãos suficientes importadas pra comparar sua evolução.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {changes.map((c) => (
            <div key={c.label} className="rounded-lg border border-hairline bg-elevated p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted/80">
                {c.label}
                {c.melhorou && <span aria-label="Melhorou">🔥</span>}
                {c.piorou && <TriangleAlert size={11} className="text-evolution" aria-label="Piorou" />}
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-ink">{c.newPct}%</p>
              <p className="mt-0.5 text-[10px] text-muted/70">antes {c.oldPct}%</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
