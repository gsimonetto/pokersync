"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PlayCircle } from "lucide-react";
import { fetchUserLeaksWithDrills } from "@/lib/services/hand-review-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leak = any;

export function LeaksCard({ onPractice }: { onPractice?: (leak: Leak) => void }) {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchUserLeaksWithDrills(30, 3);
        setLeaks(data);
      } catch {
        // silencioso: card some se nao houver dados suficientes
      }
      setLoading(false);
    })();
  }, []);

  if (loading || leaks.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-evolution/30 bg-gradient-to-b from-evolution/[0.08] to-review/[0.06] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle size={16} className="text-evolution" />
        <h3 className="text-[13px] font-semibold text-ink">Leaks recorrentes (30 dias)</h3>
      </div>
      <ul className="flex flex-col gap-2">
        {leaks.slice(0, 3).map((l, i) => (
          <li key={i} className="flex items-center justify-between rounded-lg bg-black/40 p-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-ink">{l.reason_label}</span>
              <span className="text-[10px] text-muted">
                {l.street.toUpperCase()} · {l.occurrences}x
              </span>
              {l.drill_title && <span className="mt-0.5 text-[11px] text-review">→ {l.drill_title}</span>}
            </div>
            {l.drill_id && onPractice && (
              <button onClick={() => onPractice(l)} className="flex shrink-0 p-1.5" aria-label="Praticar">
                <PlayCircle size={18} className="text-review" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
