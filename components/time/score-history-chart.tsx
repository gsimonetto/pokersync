"use client";

import { useState } from "react";
import type { PlayerScoreHistoryPoint } from "@/lib/services/team-service";

// Mesmo tratamento visual do EvolutionChart (glow no ponto atual +
// tooltip ao passar o mouse, ver components/time/evolution-chart.tsx) --
// antes esse grafico era deliberadamente mais simples (sem hover, sem
// glow), mas isso deixava ele visualmente atrasado em relacao ao resto
// do modulo depois que o financeiro ganhou o tratamento completo. Eixo
// continua fixo 0-100 com as faixas de risco marcadas: comparar dois
// jogadores em escalas diferentes destrói a ideia de "score único e
// comparável", isso não muda.
export function ScoreHistoryChart({ dados }: { dados: PlayerScoreHistoryPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (dados.length < 2) {
    return (
      <p className="text-sm text-muted">
        Ainda sem histórico suficiente pra desenhar a tendência — o score passou a ser guardado dia a dia a partir de agora.
      </p>
    );
  }

  const w = 640;
  const h = 140;
  const padL = 28;
  const padR = 12;
  const padT = 10;
  const padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (i: number) => padL + (dados.length === 1 ? 0 : (i / (dados.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / 100) * plotH;

  const coords = dados.map((d, i) => ({ x: xAt(i), y: yAt(d.score) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${padT + plotH} L${coords[0].x.toFixed(1)},${padT + plotH} Z`;

  const subindo = dados[dados.length - 1].score >= dados[0].score;
  const color = subindo ? "#2FB89A" : "#e0555a";
  const lastPoint = coords[coords.length - 1];
  const gradId = "scoreHistoryFill";
  const glowId = "scoreHistoryGlow";

  const hoverPoint = hoverIdx != null ? coords[hoverIdx] : null;
  const hoverData = hoverIdx != null ? dados[hoverIdx] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} className="w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0, 40, 70, 100].map((v) => (
        <g key={v}>
          <line x1={padL} y1={yAt(v)} x2={w - padR} y2={yAt(v)} stroke="var(--color-hairline)" strokeWidth={1} />
          <text x={padL - 6} y={yAt(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="var(--color-muted)">
            {v}
          </text>
        </g>
      ))}

      <text x={xAt(0)} y={h - 4} textAnchor="start" fontSize={9} fill="var(--color-muted)">
        {new Date(dados[0].dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
      </text>
      <text x={xAt(dados.length - 1)} y={h - 4} textAnchor="end" fontSize={9} fill="var(--color-muted)">
        {new Date(dados[dados.length - 1].dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
      </text>

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} filter={`url(#${glowId})`} opacity={0.9}>
        <animate attributeName="r" values="3.5;5.5;3.5" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.45;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill="#fff" />

      {hoverPoint && hoverData && (
        <g pointerEvents="none">
          <line x1={hoverPoint.x} y1={padT} x2={hoverPoint.x} y2={padT + plotH} stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
          <g transform={`translate(${Math.min(Math.max(hoverPoint.x - 46, padL), w - padR - 100)}, ${Math.max(hoverPoint.y - 44, padT)})`}>
            <rect width={100} height={36} rx={6} fill="var(--color-elevated)" stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={8} y={15} fontSize={9} fill="var(--color-muted)">
              {new Date(hoverData.dia).toLocaleDateString("pt-BR")}
            </text>
            <text x={8} y={29} fontSize={12} fontWeight={700} fill="var(--color-ink)">
              Score {hoverData.score}
            </text>
          </g>
        </g>
      )}

      <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} />
    </svg>
  );
}
