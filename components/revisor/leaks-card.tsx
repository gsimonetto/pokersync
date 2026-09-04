"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PlayCircle } from "lucide-react";
import { fetchUserLeaksWithDrills } from "@/lib/services/hand-review-service";
import { fetchDrillFacets, suggestionHasDrills, type DrillFacet } from "@/lib/services/drill-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leak = any;

export function LeaksCard({ onPractice }: { onPractice?: (leak: Leak) => void }) {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [facets, setFacets] = useState<DrillFacet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // As facets dizem quais combinacoes de drill existem de verdade na
        // base. Sem elas nao da pra saber se um leak e' treinavel — leaks de
        // preflop, por exemplo, nao tem nenhum drill correspondente hoje.
        const [data, f] = await Promise.all([
          fetchUserLeaksWithDrills(30, 3),
          fetchDrillFacets().catch(() => [] as DrillFacet[]),
        ]);
        setLeaks(data);
        setFacets(f);
      } catch {
        // silencioso: card some se nao houver dados suficientes
      }
      setLoading(false);
    })();
  }, []);

  if (loading || leaks.length === 0) return null;

  return (
    <div className="fade-in-up mb-4 rounded-xl border border-evolution/30 bg-gradient-to-b from-evolution/[0.08] to-review/[0.06] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle size={16} className="icon-glow text-evolution" />
        <h3 className="text-[13px] font-semibold text-ink">Leaks recorrentes (30 dias)</h3>
      </div>
      <ul className="flex flex-col gap-2">
        {leaks.slice(0, 3).map((l, i) => {
          // Botao so aparece quando existe drill de verdade pra esse leak:
          // precisa ter sugestao vinculada (drill_id) E a rua dela precisa
          // existir na base de drills. Mostrar botao que leva a uma tela
          // vazia seria pior do que nao mostrar botao nenhum.
          const treinavel = Boolean(l.drill_id) && suggestionHasDrills(l.filter_config, facets);
          return (
            <li
              key={i}
              style={{ animationDelay: `${i * 40}ms` }}
              className="fade-in-up flex items-center justify-between rounded-lg bg-black/40 p-2.5 transition-colors duration-150 hover:bg-black/55"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">{l.reason_label}</span>
                <span className="text-[10px] text-muted">
                  {l.street.toUpperCase()} · {l.occurrences}x
                </span>
                {l.drill_title && <span className="mt-0.5 text-[11px] text-review">→ {l.drill_title}</span>}
              </div>
              {treinavel && onPractice && (
                <button
                  onClick={() => onPractice(l)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-review/40 px-2.5 py-1.5 text-[11px] font-semibold text-review transition-colors hover:border-review hover:bg-review/10"
                  aria-label="Treinar esse leak"
                >
                  <PlayCircle size={15} />
                  Treinar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
