"use client";

import type { AdherenceRunPoint } from "@/lib/services/range-adherence-history-service";

// Escala fixa 0-100% (e' sempre uma porcentagem, ao contrario do
// grafico de banca que precisa de min/max dinamico pra dinheiro).
export function AdherenceHistoryChart({ points }: { points: AdherenceRunPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        {points.length === 0
          ? "Nenhuma análise registrada ainda pra esse range/posição."
          : "Precisa de pelo menos 2 análises pra desenhar a tendência — essa foi a primeira."}
      </p>
    );
  }

  const w = 560,
    h = 160,
    padL = 34,
    padR = 12,
    padT = 12,
    padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (i: number) => padL + (i / (points.length - 1)) * plotW;
  const yAt = (v: number) => padT + plotH - (v / 100) * plotH;

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.accuracyPct) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const first = points[0].accuracyPct;
  const last = points[points.length - 1].accuracyPct;
  const color = last >= first ? "#22c55e" : "#e0555a";

  const xTickCount = Math.min(5, points.length);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (points.length - 1))
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={padL} y1={yAt(v)} x2={w - padR} y2={yAt(v)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <text x={padL - 6} y={yAt(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#c4c7c8">
            {v}%
          </text>
        </g>
      ))}

      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={2.5} fill={color} />
      ))}

      {xTickIdx.map((idx) => (
        <text
          key={idx}
          x={xAt(idx)}
          y={h - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#c4c7c8"
        >
          {new Date(points[idx].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </text>
      ))}
    </svg>
  );
}
