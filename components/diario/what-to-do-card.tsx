"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, Target } from "lucide-react";
import { fetchUserLeaksWithDrills } from "@/lib/services/hand-review-service";
import { fetchDrillFacets, suggestionHasDrills, type DrillFacet } from "@/lib/services/drill-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leak = any;

// "O que fazer agora" — CTA direto pro drill ligado ao leak mais
// recorrente (mesmo dado do Leak Finder logo acima, ver leaks-card.tsx),
// mas aqui é só uma ação, não a lista inteira de leaks.
export function WhatToDoCard({ style }: { style?: React.CSSProperties }) {
  const router = useRouter();
  const [leak, setLeak] = useState<Leak | null>(null);
  const [treinavel, setTreinavel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [leaks, facets] = await Promise.all([
          fetchUserLeaksWithDrills(30, 3),
          fetchDrillFacets().catch(() => [] as DrillFacet[]),
        ]);
        if (!alive) return;
        const top = leaks[0] ?? null;
        setLeak(top);
        setTreinavel(!!top && Boolean(top.drill_id) && suggestionHasDrills(top.filter_config, facets));
      } catch {
        // sem dados suficientes: card mostra estado vazio abaixo
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function comecarTreino() {
    if (!leak?.drill_id) return;
    router.push(`/treino?suggestionId=${leak.drill_id}`);
  }

  return (
    <section className="fade-in-up rounded-2xl border border-hairline bg-surface p-5" style={style}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">O que fazer agora</h2>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : !leak ? (
        <p className="mt-4 text-sm text-muted">Sem leak recorrente identificado ainda — continue revisando mãos.</p>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-review/40 bg-review/10 text-review">
            <Target size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{leak.reason_label}</p>
            <p className="text-xs text-muted">{leak.street?.toUpperCase()} · {leak.occurrences}x nos últimos 30 dias</p>
          </div>
          {treinavel && (
            <button
              onClick={comecarTreino}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-review/40 px-3 py-2 text-[12px] font-semibold text-review transition-colors hover:border-review hover:bg-review/10"
            >
              <PlayCircle size={15} />
              Treinar agora
            </button>
          )}
        </div>
      )}
    </section>
  );
}
