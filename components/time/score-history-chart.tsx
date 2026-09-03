"use client";

import type { PlayerScoreHistoryPoint } from "@/lib/services/team-service";

// Sparkline do Score de evolução -- deliberadamente mais simples que o
// EvolutionChart financeiro (sem hover, sem tooltip): aqui o que importa
// é a tendência de relance, não o valor exato de cada dia. Eixo fixo
// 0-100 (não min/max dos dados) com as três faixas de risco marcadas,
// porque comparar dois jogadores em escalas diferentes destrói a ideia
// de "score único e comparável".
export function ScoreHistoryChart({ dados }: { dados: PlayerScoreHistoryPoint[] }) {
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

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} className="w-full overflow-visible">
      <defs>
        <linearGradient id="scoreHistoryFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
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

      <path d={areaPath} fill="url(#scoreHistoryFill)" stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
      <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill="#fff" />
    </svg>
  );
}
