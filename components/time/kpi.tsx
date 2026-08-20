import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";

// Card de KPI compartilhado entre a Visao Geral do painel e a ficha
// individual do jogador. `pronto`/`d` controlam a animacao de entrada
// (opcional — sem eles o card ja nasce visivel).
export function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tom,
  pronto = true,
  d = 0,
  destaque,
  tendencia,
  tendenciaSufixo = "%",
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tom?: "positivo" | "negativo";
  pronto?: boolean;
  d?: number;
  destaque?: boolean;
  tendencia?: number | null;
  tendenciaSufixo?: string;
}) {
  const cor = tom === "positivo" ? "text-positive" : tom === "negativo" ? "text-negative" : "text-ink";
  const TendIcon =
    tendencia === null || tendencia === undefined || tendencia === 0 ? Minus : tendencia > 0 ? TrendingUp : TrendingDown;
  const tendCor =
    tendencia === null || tendencia === undefined || tendencia === 0
      ? "text-muted"
      : tendencia > 0
      ? "text-positive"
      : "text-negative";
  return (
    <div
      className={`rounded-xl border bg-surface p-4 transition-all ease-out print:break-inside-avoid ${
        destaque ? "border-ink/20" : "border-hairline"
      }`}
      style={{
        opacity: pronto ? 1 : 0,
        transform: pronto ? "translateY(0)" : "translateY(6px)",
        transitionDuration: "450ms",
        transitionDelay: `${d}ms`,
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icon size={13} className={tom === "negativo" ? "text-negative" : ""} />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tnum ${cor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {tendencia !== undefined && (
        <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium tnum ${tendCor}`}>
          <TendIcon size={11} />
          {tendencia === null ? "sem comparação" : `${tendencia > 0 ? "+" : ""}${tendencia}${tendenciaSufixo} vs período anterior`}
        </p>
      )}
    </div>
  );
}
