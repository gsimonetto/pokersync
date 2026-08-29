"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { EmptyState, revisorHandsHref } from "@/components/analysis/shared";
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
        Clique num leak pra abrir as mãos que geraram o alerta direto no Revisor.
      </p>
      {leaks.map((leak) => (
        <LeakCard key={leak.id} leak={leak} rows={rows} />
      ))}
    </div>
  );
}

function LeakCard({ leak, rows }: { leak: Leak; rows: AnalysisHandRow[] }) {
  const router = useRouter();
  const style = SEVERITY_STYLE[leak.severity];

  return (
    <button
      type="button"
      onClick={() => {
        const handIds = computeLeakHands(rows, leak.id).map((h) => h.handId);
        router.push(revisorHandsHref(handIds, leak.title));
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 ${style.border} ${style.bg}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className={`icon-glow mt-0.5 shrink-0 ${style.text}`} />
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
        <ArrowUpRight size={16} className="text-muted" />
      </div>
    </button>
  );
}
