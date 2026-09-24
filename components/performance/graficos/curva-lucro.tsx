"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { evolutionSeries } from "@/lib/bankroll/calc";
import type { Session } from "@/lib/bankroll/types";
import { PainelCard } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import { COR_NEGATIVO, COR_POSITIVO, COR_UNICA, DicaGrafico, SeloAmostra } from "./base";
import { formatadorMoeda, torneiosNumaMoeda } from "./torneios";
import { useLargura } from "./usar-largura";

// Curva de lucro acumulado, torneio a torneio -- o gráfico que todo
// grinder quer ver e que a aba Estatísticas não tinha (era só lista). Uma
// série (dourado), linha de 2px com a área suave embaixo, linha do zero
// tracejada. Passar o mouse mostra a data, o resultado daquele torneio e
// o acumulado até ali.

const ALTURA = 220;
const M = { t: 14, r: 16, b: 26, l: 64 };

export function CurvaLucro({ sessoes, ordem = 0 }: { sessoes: Session[]; ordem?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const largura = useLargura(caixa);
  const [foco, setFoco] = useState<number | null>(null);
  const { lista, moeda } = useMemo(() => torneiosNumaMoeda(sessoes), [sessoes]);
  const serie = useMemo(() => evolutionSeries(lista), [lista]);
  const fmt = useMemo(() => formatadorMoeda(moeda), [moeda]);
  const fmtEixo = useMemo(() => formatadorMoeda(moeda, true), [moeda]);

  const valores = serie.map((p) => p.value);
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const folga = (max - min) * 0.08 || 1;
  const lo = min - folga;
  const hi = max + folga;
  const w = Math.max(0, largura - M.l - M.r);
  const h = ALTURA - M.t - M.b;
  const x = (i: number) => M.l + (serie.length <= 1 ? w / 2 : (i / (serie.length - 1)) * w);
  const y = (v: number) => M.t + h - ((v - lo) / (hi - lo)) * h;
  const linha = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = serie.length ? `${linha} L${x(serie.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z` : "";
  const final = serie[serie.length - 1]?.value ?? 0;
  // Lucro sem os 3 maiores prêmios: mostra se o resultado vem de ganhar
  // com consistência ou de uma ou duas forras grandes. Só com amostra
  // mínima (com 5 torneios, tirar 3 não diz nada).
  const top3 = [...serie.map((x) => x.net)].sort((a, b) => b - a).slice(0, 3).filter((v) => v > 0);
  const semTop3 = serie.length >= 15 && top3.length > 0 ? final - top3.reduce((a, b) => a + b, 0) : null;
  const grade = [lo, (lo + hi) / 2, hi];

  function mover(e: React.MouseEvent<SVGSVGElement>) {
    if (!serie.length) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = Math.round(((px - M.l) / Math.max(1, w)) * (serie.length - 1));
    setFoco(Math.max(0, Math.min(serie.length - 1, i)));
  }
  const p = foco != null ? serie[foco] : null;

  return (
    <PainelCard
      title="Lucro acumulado em torneios"
      icon={<TrendingUp size={15} />}
      ordem={ordem}
      rolagem={false}
      action={<SeloAmostra n={serie.length} minimo={50} unidade="torneios" />}
    >
      <div ref={caixa} className="relative w-full" onMouseLeave={() => setFoco(null)}>
        {serie.length < 2 ? (
          <p className="text-sm text-muted">Registre ou importe pelo menos 2 torneios na Gestão de Banca pra ver a curva.</p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: final >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {final > 0 ? "+" : ""}
                {fmt(final)}
              </span>
              <span className="text-[11px] text-muted">em {serie.length} torneios ({moeda})</span>
              {semTop3 != null && (
                <InfoHover
                  className="ml-auto"
                  explicacao={{
                    titulo: "Sem os 3 maiores prêmios",
                    oQueE: "Seu lucro se tirarmos os 3 melhores resultados. Positivo = você ganha com consistência; negativo = o lucro depende de poucas forras grandes (normal em MTT, mas mostra o tamanho da variância).",
                    origem: "Gestão de Banca · sessões de torneio",
                    comoCalcula: `Lucro total − (${top3.map((v) => fmt(v)).join(" + ")}).`,
                  }}
                >
                  <span className="text-[11.5px] text-muted">
                    Sem os 3 maiores:{" "}
                    <span className="font-semibold tabular-nums" style={{ color: semTop3 >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                      {semTop3 > 0 ? "+" : ""}
                      {fmt(semTop3)}
                    </span>
                  </span>
                </InfoHover>
              )}
            </div>
            {largura > 0 && (
              <svg width={largura} height={ALTURA} onMouseMove={mover} role="img" aria-label="Lucro acumulado por torneio">
                <defs>
                  <linearGradient id="curva-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={COR_UNICA} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COR_UNICA} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {grade.map((g, i) => (
                  <g key={i}>
                    <line x1={M.l} x2={M.l + w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
                    <text x={M.l - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                      {fmtEixo(g)}
                    </text>
                  </g>
                ))}
                <line x1={M.l} x2={M.l + w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                <motion.path d={area} fill="url(#curva-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.9 }} />
                <motion.path
                  d={linha}
                  fill="none"
                  stroke={COR_UNICA}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                />
                {[0, serie.length - 1].map((i) => (
                  <text key={i} x={x(i)} y={ALTURA - 8} textAnchor={i === 0 ? "start" : "end"} fontSize={10} fill="rgba(255,255,255,0.4)">
                    {serie[i].date.split("-").reverse().slice(0, 2).join("/")}
                  </text>
                ))}
                {p && foco != null && (
                  <g>
                    <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                    <circle cx={x(foco)} cy={y(p.value)} r={4.5} fill={COR_UNICA} stroke="#141414" strokeWidth={2} />
                  </g>
                )}
              </svg>
            )}
            <DicaGrafico aberta={!!p} x={foco != null ? x(foco) : 0} y={p ? y(p.value) + 30 : 0} largura={largura}>
              {p && (
                <>
                  <p className="font-semibold text-ink">{p.date.split("-").reverse().join("/")} · {p.format}</p>
                  <p className="tabular-nums" style={{ color: p.net >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    Torneio: {p.net > 0 ? "+" : ""}
                    {fmt(p.net)}
                  </p>
                  <p className="tabular-nums text-ink/90">Acumulado: {fmt(p.value)}</p>
                </>
              )}
            </DicaGrafico>
          </>
        )}
      </div>
    </PainelCard>
  );
}
