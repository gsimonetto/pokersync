"use client";

import type { FinancialDay } from "@/lib/services/team-service";
import { BRL, BRL_CURTO } from "@/lib/format";

// Grafico financeiro reutilizavel: barras diarias de ganho/perda + linha
// de acumulado. Mesma leitura do Gestor de Banca (valor no eixo Y, data
// no eixo X) — usado na Visao Geral do painel e na ficha individual do
// jogador, para nao obrigar reaprender o formato em cada tela.
//
// Redesenho: antes era so barra + polyline sem escala (o usuario nao
// sabia "quanto" cada barra valia). Agora tem grid horizontal com
// valores em R$ (eixo Y) e datas no eixo X, mesmo padrao do
// EvolutionChart da Gestao de Banca.

const Y_TICKS = 4;

export function GraficoFinanceiro({
  dados,
  pronto,
  titulo = "Resultado no período",
  acao,
}: {
  dados: FinancialDay[];
  pronto: boolean;
  titulo?: string;
  /** Controles extras no header do card (ex: filtro de período) — mesmo padrão do Painel do Gestor de Banca. */
  acao?: React.ReactNode;
}) {
  const temDados = dados.some((d) => d.resultado !== 0);
  const acumFinal = dados.length ? dados[dados.length - 1].acumulado : 0;
  const maxAbs = Math.max(1, ...dados.map((d) => Math.abs(d.resultado)));

  const w = 640, h = 220, padL = 54, padR = 12, padT = 12, padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const acumMin = Math.min(0, ...dados.map((d) => d.acumulado));
  const acumMax = Math.max(0, ...dados.map((d) => d.acumulado));
  const spread = acumMax - acumMin || 1;
  const yMin = acumMin - spread * 0.08;
  const yMax = acumMax + spread * 0.08;
  const yRange = yMax - yMin || 1;

  const xAt = (i: number) => padL + (dados.length <= 1 ? 0 : (i / (dados.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;
  const yZero = yAt(0);

  const coords = dados.map((d, i) => ({ x: xAt(i), y: yAt(d.acumulado) }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const lastPoint = coords[coords.length - 1];

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + (yRange * i) / Y_TICKS);
  const xTickCount = Math.min(6, dados.length);
  const xTickIdx = dados.length
    ? Array.from({ length: xTickCount }, (_, i) =>
        xTickCount === 1 ? 0 : Math.round((i / (xTickCount - 1)) * (dados.length - 1))
      )
    : [];

  // Largura de cada barra no espaco do plot (dividido igualmente entre
  // os pontos), com uma folga pequena entre elas.
  const barSlot = dados.length ? plotW / dados.length : plotW;
  const barW = Math.max(2, barSlot * 0.6);

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

      {!temDados ? (
        <p className="mt-8 text-sm text-muted">Sem sessões registradas no período.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-56 w-full overflow-visible">
            {/* Grid + labels do eixo Y (R$ acumulado) */}
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

            {/* Labels do eixo X (datas) */}
            {xTickIdx.map((idx) => (
              <text key={idx} x={xAt(idx)} y={h - 8} textAnchor="middle" fontSize={9} fill="var(--color-muted)">
                {new Date(dados[idx].dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </text>
            ))}

            {/* Barras diarias de ganho/perda, ancoradas na linha do zero */}
            {dados.map((d, i) => {
              const x = xAt(i) - barW / 2;
              const alt = (Math.abs(d.resultado) / maxAbs) * (plotH / 2 - 4);
              const pos = d.resultado >= 0;
              const y = pos ? yZero - alt : yZero;
              return (
                <rect
                  key={d.dia}
                  x={x}
                  y={pronto ? y : yZero}
                  width={barW}
                  height={pronto ? alt : 0}
                  rx={1.5}
                  fill={pos ? "var(--color-positive, #22c55e)" : "var(--color-negative, #e0555a)"}
                  opacity={0.75}
                  style={{ transition: "height 600ms ease-out, y 600ms ease-out", transitionDelay: `${Math.min(i * 10, 350)}ms` }}
                >
                  <title>{`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${BRL.format(d.resultado)} · ${d.sessoes} sessão(ões)`}</title>
                </rect>
              );
            })}

            {/* Linha do zero, mais forte que o grid */}
            <line x1={padL} y1={yZero} x2={w - padR} y2={yZero} stroke="var(--color-hairline)" strokeWidth={1.4} />

            {/* Linha do acumulado */}
            <path
              d={path}
              fill="none"
              stroke="var(--color-evolution, #f59e0b)"
              strokeWidth={1.8}
              strokeLinejoin="round"
              style={{ opacity: pronto ? 1 : 0, transition: "opacity 700ms ease-out 300ms" }}
            />
            {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill="var(--color-evolution, #f59e0b)" />}
          </svg>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-positive/70" /> Ganho</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-negative/70" /> Perda</span>
              <span className="flex items-center gap-1.5"><span className="h-px w-3 bg-evolution" /> Acumulado</span>
            </span>
            <span className="tnum">pico {BRL_CURTO.format(maxAbs)}</span>
          </div>
        </>
      )}
    </div>
  );
}
