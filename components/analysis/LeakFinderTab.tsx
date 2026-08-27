"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/analysis/shared";
import { computeLeakHands } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, Leak } from "@/types/analysis";

const SEVERITY_STYLE: Record<Leak["severity"], { border: string; bg: string; text: string; label: string }> = {
  critical: { border: "border-negative/40", bg: "bg-negative/10", text: "text-negative", label: "Crítico" },
  warning: { border: "border-evolution/40", bg: "bg-evolution/10", text: "text-evolution", label: "Atenção" },
  info: { border: "border-hairline", bg: "bg-elevated", text: "text-muted", label: "Info" },
};

export function LeakFinderTab({ rows, leaks }: { rows: AnalysisHandRow[]; leaks: Leak[] }) {
  if (leaks.length === 0) {
    return (
      <EmptyState texto="Nenhum leak detectado com a amostra atual. Isso não significa jogo perfeito — só que nenhuma métrica saiu da faixa de referência com amostra suficiente pra confiar." />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        Detecção automática por regra simples (métrica fora da faixa de referência comum, com amostra mínima) — não é output de
        solver. Cada leak abre a lista de mãos que geraram o alerta, prontas pra revisar no Replayer.
      </p>
      {leaks.map((leak) => (
        <LeakCard key={leak.id} leak={leak} rows={rows} />
      ))}
    </div>
  );
}

function LeakCard({ leak, rows }: { leak: Leak; rows: AnalysisHandRow[] }) {
  const [open, setOpen] = useState(false);
  const style = SEVERITY_STYLE[leak.severity];
  const hands = open ? computeLeakHands(rows, leak.id) : [];

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${style.text}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${style.text}`}>{leak.title}</p>
              <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${style.border} ${style.text}`}>
                {style.label}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink/80">{leak.description}</p>
            <p className="mt-1 text-[10.5px] text-muted/70">Amostra: {leak.sampleSize} mãos</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-xl font-bold tabular-nums ${style.text}`}>{leak.metricValue}%</span>
          <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-hairline/60 p-4 pt-3">
          {hands.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma mão individual isolada pra este leak ainda — ele foi calculado sobre o agregado.</p>
          ) : (
            <ul className="space-y-1.5">
              {hands.map((h) => (
                <li key={h.handId}>
                  <Link
                    href={`/revisor?shared=${h.handId}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-void px-3 py-2 text-xs text-ink transition-colors hover:border-ink/40"
                  >
                    <span className="flex items-center gap-2">
                      <PlayCircle size={13} className="text-review" />
                      {[h.position, h.format.toUpperCase()].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-muted">{new Date(h.playedAt).toLocaleDateString("pt-BR")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
