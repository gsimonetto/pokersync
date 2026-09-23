"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LineChart } from "lucide-react";
import { PainelCard } from "@/components/painel/painel-card";
import { PREFLOP_REFERENCE } from "@/lib/services/analysis-service";
import type { AnalysisHandRow, ReferenceProfile } from "@/types/analysis";
import { COR_PFR, COR_VPIP, DicaGrafico, Legenda } from "./base";
import { useLargura, useTamanho } from "./usar-largura";

// VPIP e PFR semana a semana, com a faixa ideal de cada um sombreada atrás
// -- responde "estou corrigindo o leak ou piorando?". Semana com menos de
// MIN_SEMANA mãos fica de fora (um ponto com 5 mãos só faria a linha
// pular sem motivo). Últimas 12 semanas com dado.

const MIN_SEMANA = 20;
// Altura mínima; no desktop o gráfico estica até a altura da matriz ao lado.
const ALTURA_MIN = 280;
const M = { t: 12, r: 44, b: 26, l: 34 };

type Semana = { inicio: Date; n: number; vpip: number; pfr: number };

function inicioDaSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dia);
  return x;
}

function porSemana(rows: AnalysisHandRow[]): Semana[] {
  const mapa = new Map<number, { inicio: Date; n: number; v: number; p: number }>();
  for (const r of rows) {
    const ini = inicioDaSemana(new Date(r.playedAt));
    const k = ini.getTime();
    const s = mapa.get(k) ?? { inicio: ini, n: 0, v: 0, p: 0 };
    s.n += 1;
    if (r.vpip) s.v += 1;
    if (r.pfr) s.p += 1;
    mapa.set(k, s);
  }
  return [...mapa.values()]
    .filter((s) => s.n >= MIN_SEMANA)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .slice(-12)
    .map((s) => ({ inicio: s.inicio, n: s.n, vpip: (s.v / s.n) * 100, pfr: (s.p / s.n) * 100 }));
}

const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function LinhaSemanal({ rows, referenceProfile, ordem = 0 }: { rows: AnalysisHandRow[]; referenceProfile: ReferenceProfile; ordem?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const largura = useLargura(caixa);
  const [foco, setFoco] = useState<number | null>(null);
  const semanas = useMemo(() => porSemana(rows), [rows]);
  const ALTURA = Math.max(ALTURA_MIN, useTamanho(area, semanas.length >= 2).altura);
  const ref = PREFLOP_REFERENCE[referenceProfile];

  const maxY = Math.max(ref.vpip.max + 8, ...semanas.map((s) => s.vpip + 5), 20);
  const w = Math.max(0, largura - M.l - M.r);
  const h = ALTURA - M.t - M.b;
  const x = (i: number) => M.l + (semanas.length <= 1 ? w / 2 : (i / (semanas.length - 1)) * w);
  const y = (v: number) => M.t + h - (v / maxY) * h;
  const caminho = (k: "vpip" | "pfr") => semanas.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(" ");
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  function mover(e: React.MouseEvent<SVGSVGElement>) {
    if (semanas.length === 0) return;
    const bx = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - bx.left;
    let melhor = 0;
    for (let i = 1; i < semanas.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    setFoco(melhor);
  }

  const s = foco != null ? semanas[foco] : null;

  return (
    <PainelCard title="VPIP e PFR por semana" icon={<LineChart size={15} />} ordem={ordem} rolagem={false}>
      {/* Contêiner medido sempre existe (mesmo sem dado), pra largura já
          estar certa quando um filtro fizer o gráfico aparecer. */}
      <div ref={caixa} className="relative flex w-full flex-1 flex-col" onMouseLeave={() => setFoco(null)}>
      {semanas.length < 2 ? (
        <p className="text-sm text-muted">
          Precisa de pelo menos 2 semanas com {MIN_SEMANA}+ mãos pra desenhar a tendência. Continue importando.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Legenda itens={[{ rotulo: "VPIP", cor: COR_VPIP }, { rotulo: "PFR", cor: COR_PFR }]} />
            <span className="text-[11px] text-muted/70">Faixas sombreadas = faixa ideal</span>
          </div>
          {/* O SVG fica por cima (absoluto) da área medida, pra altura dele
              não empurrar a medida de volta. */}
          <div ref={area} className="relative w-full flex-1" style={{ minHeight: ALTURA_MIN }}>
            {largura > 0 && (
              <svg width={largura} height={ALTURA} className="absolute inset-x-0 top-0" onMouseMove={mover} role="img" aria-label="VPIP e PFR por semana">
                {/* faixas ideais */}
                <rect x={M.l} width={w} y={y(ref.vpip.max)} height={y(ref.vpip.min) - y(ref.vpip.max)} fill={COR_VPIP} opacity={0.09} />
                <rect x={M.l} width={w} y={y(ref.pfr.max)} height={y(ref.pfr.min) - y(ref.pfr.max)} fill={COR_PFR} opacity={0.1} />
                {/* grade recessiva */}
                {grade.map((g) => (
                  <g key={g}>
                    <line x1={M.l} x2={M.l + w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" />
                    <text x={M.l - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                      {g}%
                    </text>
                  </g>
                ))}
                {semanas.map((sm, i) =>
                  semanas.length <= 6 || i % Math.ceil(semanas.length / 6) === 0 || i === semanas.length - 1 ? (
                    <text key={i} x={x(i)} y={ALTURA - 8} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                      {dataCurta(sm.inicio)}
                    </text>
                  ) : null,
                )}
                {/* linhas desenhando da esquerda pra direita */}
                {(["vpip", "pfr"] as const).map((k) => (
                  <motion.path
                    key={k}
                    d={caminho(k)}
                    fill="none"
                    stroke={k === "vpip" ? COR_VPIP : COR_PFR}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  />
                ))}
                {/* rótulo direto no fim de cada linha */}
                {(["vpip", "pfr"] as const).map((k) => {
                  const ult = semanas[semanas.length - 1];
                  return (
                    <text key={k} x={x(semanas.length - 1) + 8} y={y(ult[k])} dominantBaseline="middle" fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.85)">
                      {Math.round(ult[k])}%
                    </text>
                  );
                })}
                {/* mira + marcadores da semana em foco */}
                {s && foco != null && (
                  <g>
                    <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                    {(["vpip", "pfr"] as const).map((k) => (
                      <circle key={k} cx={x(foco)} cy={y(s[k])} r={4.5} fill={k === "vpip" ? COR_VPIP : COR_PFR} stroke="#141414" strokeWidth={2} />
                    ))}
                  </g>
                )}
              </svg>
            )}
            <DicaGrafico aberta={!!s} x={foco != null ? x(foco) : 0} y={s ? y(Math.max(s.vpip, s.pfr)) : 0} largura={largura}>
              {s && (
                <>
                  <p className="font-semibold text-ink">Semana de {dataCurta(s.inicio)}</p>
                  <p className="tabular-nums text-ink/90">
                    <span style={{ color: COR_VPIP }}>●</span> VPIP {s.vpip.toFixed(1)}%
                  </p>
                  <p className="tabular-nums text-ink/90">
                    <span style={{ color: COR_PFR }}>●</span> PFR {s.pfr.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-muted">{s.n} mãos</p>
                </>
              )}
            </DicaGrafico>
          </div>
        </>
      )}
      </div>
    </PainelCard>
  );
}
