"use client";

import { useState } from "react";
import type { FinancialDay } from "@/lib/services/team-service";
import { BRL, BRL_CURTO } from "@/lib/format";

// Mesmo grafico de evolucao do Gestor de Banca (linha com area em
// degrade, glow no ponto atual, tooltip ao passar o mouse) -- porta pra
// cima do financeiro do time/jogador (FinancialDay: dia/resultado/
// acumulado) em vez da sessao pessoal de banca. Substitui o antigo
// GraficoFinanceiro (barra + linha) na aba Estatisticas e na ficha do
// jogador, pra usar o mesmo grafico em todo canto que mostra resultado
// financeiro.

const Y_TICKS = 4;

export function EvolutionChart({
  dados,
  pronto = true,
  titulo = "Resultado no período",
  acao,
}: {
  dados: FinancialDay[];
  pronto?: boolean;
  titulo?: string;
  acao?: React.ReactNode;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const acumFinal = dados.length ? dados[dados.length - 1].acumulado : 0;

  return (
    <div
      className={`rounded-xl border border-hairline bg-surface p-5 transition-all duration-500 print:break-inside-avoid ${
        pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
          <span className={`text-sm font-semibold tnum ${acumFinal > 0 ? "text-positive" : acumFinal < 0 ? "text-negative" : "text-muted"}`}>
            {BRL.format(acumFinal)}
          </span>
        </div>
        {acao}
      </div>

      {dados.length < 2 ? (
        <p className="mt-8 text-sm text-muted">Sem jogos suficientes no período pra desenhar o gráfico.</p>
      ) : (
        <div className="mt-3">
          <ChartSvg dados={dados} hoverIdx={hoverIdx} onHover={setHoverIdx} />
        </div>
      )}
    </div>
  );
}

function ChartSvg({
  dados,
  hoverIdx,
  onHover,
}: {
  dados: FinancialDay[];
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const points = dados.map((d) => d.acumulado);
  const w = 640, h = 220, padL = 54, padR = 12, padT = 12, padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = max - min || 1;
  const yMin = min - spread * 0.08;
  const yMax = max + spread * 0.08;
  const yRange = yMax - yMin || 1;

  const xAt = (i: number) => padL + (dados.length === 1 ? 0 : (i / (dados.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const coords = points.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${padT + plotH} L${coords[0].x.toFixed(1)},${padT + plotH} Z`;

  const last = points[points.length - 1];
  const up = last >= (points[0] ?? 0);
  const color = up ? "#22c55e" : "#e0555a";
  const lastPoint = coords[coords.length - 1];
  const gradId = "teamEvolutionFill";
  const glowId = "teamEvolutionGlow";

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i) / Y_TICKS);
  const xTickCount = Math.min(6, dados.length);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (dados.length - 1))
  );

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
    onHover(nearest);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} className="w-full overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
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

      {yTicks.map((v, i) => {
        const y = yAt(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="var(--color-muted)">
              {BRL_CURTO.format(v)}
            </text>
          </g>
        );
      })}

      {xTickIdx.map((idx) => (
        <text key={idx} x={xAt(idx)} y={h - 8} textAnchor="middle" fontSize={9} fill="var(--color-muted)">
          {new Date(dados[idx].dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </text>
      ))}

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} filter={`url(#${glowId})`} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={color} filter={`url(#${glowId})`} opacity={0.9}>
        <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.45;0.9" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="#fff" />

      {hoverPoint && hoverData && (
        <g pointerEvents="none">
          <line x1={hoverPoint.x} y1={padT} x2={hoverPoint.x} y2={padT + plotH} stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
          <g transform={`translate(${Math.min(Math.max(hoverPoint.x - 46, padL), w - padR - 92)}, ${Math.max(hoverPoint.y - 46, padT)})`}>
            <rect width={92} height={34} rx={6} fill="var(--color-elevated)" stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={8} y={14} fontSize={9} fill="var(--color-muted)">
              {new Date(hoverData.dia).toLocaleDateString("pt-BR")}
            </text>
            <text x={8} y={26} fontSize={10.5} fontWeight={700} fill={hoverData.resultado >= 0 ? "#22c55e" : "#e0555a"}>
              {BRL.format(hoverData.acumulado)} ({hoverData.resultado >= 0 ? "+" : ""}
              {BRL.format(hoverData.resultado)})
            </text>
          </g>
        </g>
      )}

      <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => onHover(null)} />
    </svg>
  );
}
