"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LineChart } from "lucide-react";
import { PainelCard } from "@/components/painel/painel-card";
import type { AnalysisHandRow } from "@/types/analysis";
import { COR_PFR, COR_UNICA, COR_VPIP, DicaGrafico, Legenda } from "./base";
import { useLargura, useTamanho } from "./usar-largura";

// Tendência semana a semana -- responde "estou corrigindo o leak ou
// piorando?". Dá pra trocar a métrica (VPIP e PFR juntos, 3-Bet, roubo
// de blinds, c-bet, fold to c-bet, ida ao showdown). Em VPIP e PFR, a faixa entre as duas linhas fica
// sombreada: é o quanto você entra só pagando. Embaixo, uma faixinha de
// barras com as mãos de cada semana (gráfico separado, mesmo eixo de
// datas -- nunca um segundo eixo Y no mesmo gráfico).
//
// Semana com menos de MIN_SEMANA mãos fica de fora (um ponto com 5 mãos só
// faria a linha pular sem motivo). Nas métricas que dependem de uma
// situação (3-bet, roubo, c-bet, fold to c-bet, showdown), a semana com menos de MIN_SITUACAO chances fica
// sem ponto. Últimas 12 semanas com dado.

const MIN_SEMANA = 20;
const MIN_SITUACAO = 5;
// Compacto de propósito: é a leitura de direção, não o gráfico principal.
const ALTURA_MIN = 190;
const ALTURA_VOLUME = 26;
const M = { t: 12, r: 44, b: 26, l: 34 };

type Metrica = "vpfr" | "3bet" | "roubo" | "cbet" | "foldcbet" | "sd";
const METRICAS: { valor: Metrica; rotulo: string }[] = [
  { valor: "vpfr", rotulo: "VPIP e PFR" },
  { valor: "3bet", rotulo: "3-Bet" },
  { valor: "roubo", rotulo: "Roubo" },
  { valor: "cbet", rotulo: "C-bet" },
  { valor: "foldcbet", rotulo: "Fold to c-bet" },
  { valor: "sd", rotulo: "Showdown" },
];

type Conta = { sim: number; base: number };
type Semana = { inicio: Date; n: number; vpip: Conta; pfr: Conta; tresBet: Conta; roubo: Conta; cbet: Conta; foldCbet: Conta; sd: Conta };

function inicioDaSemana(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dia);
  return x;
}

const nova = (inicio: Date): Semana => ({
  inicio,
  n: 0,
  vpip: { sim: 0, base: 0 },
  pfr: { sim: 0, base: 0 },
  tresBet: { sim: 0, base: 0 },
  roubo: { sim: 0, base: 0 },
  cbet: { sim: 0, base: 0 },
  foldCbet: { sim: 0, base: 0 },
  sd: { sim: 0, base: 0 },
});

function porSemana(rows: AnalysisHandRow[]): Semana[] {
  const mapa = new Map<number, Semana>();
  for (const r of rows) {
    const ini = inicioDaSemana(new Date(r.playedAt));
    const s = mapa.get(ini.getTime()) ?? nova(ini);
    s.n += 1;
    s.vpip.base += 1;
    s.pfr.base += 1;
    if (r.vpip) s.vpip.sim += 1;
    if (r.pfr) s.pfr.sim += 1;
    // 3-Bet: base = as vezes em que alguém abriu antes de você.
    if (r.threeBetOpportunity === true) {
      s.tresBet.base += 1;
      if (r.threeBet) s.tresBet.sim += 1;
    }
    if (r.stealOpportunity === true) {
      s.roubo.base += 1;
      if (r.stealAttempt) s.roubo.sim += 1;
    }
    // Pós-flop: base = as vezes em que a situação aconteceu (histórico).
    const p = r.posflop;
    if (p?.cbet.flop != null) {
      s.cbet.base += 1;
      if (p.cbet.flop) s.cbet.sim += 1;
    }
    if (p?.respostaCbet.flop != null) {
      s.foldCbet.base += 1;
      if (p.respostaCbet.flop === "fold") s.foldCbet.sim += 1;
    }
    if (p?.viu.flop) {
      s.sd.base += 1;
      if (r.wentToShowdown) s.sd.sim += 1;
    }
    mapa.set(ini.getTime(), s);
  }
  return [...mapa.values()]
    .filter((s) => s.n >= MIN_SEMANA)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .slice(-12);
}

const taxa = (c: Conta, minimo = 1) => (c.base >= minimo ? (c.sim / c.base) * 100 : null);
const dataCurta = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

type Serie = { chave: string; rotulo: string; cor: string; valores: (number | null)[]; contas: Conta[] };

function series(semanas: Semana[], m: Metrica): Serie[] {
  const s = (chave: string, rotulo: string, cor: string, pega: (x: Semana) => Conta, minimo = 1): Serie => ({
    chave,
    rotulo,
    cor,
    contas: semanas.map(pega),
    valores: semanas.map((x) => taxa(pega(x), minimo)),
  });
  if (m === "vpfr") return [s("vpip", "VPIP", COR_VPIP, (x) => x.vpip), s("pfr", "PFR", COR_PFR, (x) => x.pfr)];
  if (m === "3bet") return [s("3bet", "3-Bet", COR_UNICA, (x) => x.tresBet, MIN_SITUACAO)];
  if (m === "roubo") return [s("roubo", "Roubo", COR_UNICA, (x) => x.roubo, MIN_SITUACAO)];
  if (m === "cbet") return [s("cbet", "C-bet no flop", COR_UNICA, (x) => x.cbet, MIN_SITUACAO)];
  if (m === "foldcbet") return [s("foldcbet", "Fold to c-bet no flop", COR_UNICA, (x) => x.foldCbet, MIN_SITUACAO)];
  return [s("sd", "Vai ao showdown (dos flops vistos)", COR_UNICA, (x) => x.sd, MIN_SITUACAO)];
}

export function LinhaSemanal({ rows, ordem = 0 }: { rows: AnalysisHandRow[]; ordem?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const largura = useLargura(caixa);
  const [foco, setFoco] = useState<number | null>(null);
  const [metrica, setMetrica] = useState<Metrica>("vpfr");
  const semanas = useMemo(() => porSemana(rows), [rows]);
  const lista = useMemo(() => series(semanas, metrica), [semanas, metrica]);
  const alturaArea = useTamanho(area, semanas.length >= 2).altura;
  const ALTURA = Math.max(ALTURA_MIN, alturaArea) - ALTURA_VOLUME;
  const duas = metrica === "vpfr";

  const todos = lista.flatMap((l) => l.valores).filter((v): v is number => v != null);
  const topo = Math.max(...todos.map((v) => v + 5), 20);
  const maxY = Math.min(100, Math.ceil(topo / 4) * 4);
  const w = Math.max(0, largura - M.l - M.r);
  const h = ALTURA - M.t - M.b;
  const x = (i: number) => M.l + (semanas.length <= 1 ? w / 2 : (i / (semanas.length - 1)) * w);
  const y = (v: number) => M.t + h - (v / maxY) * h;
  // Linha com buraco onde a semana não tem ponto (poucas chances).
  const caminho = (vs: (number | null)[]) =>
    vs.map((v, i) => (v == null ? "" : `${i === 0 || vs[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const maiorSemana = Math.max(1, ...semanas.map((s) => s.n));

  // Faixa entre VPIP e PFR = o quanto você entra só pagando.
  const vaoVpipPfr = (() => {
    if (!duas || lista.length < 2) return "";
    const [a, b] = lista;
    const idx = semanas.map((_, i) => i).filter((i) => a.valores[i] != null && b.valores[i] != null);
    if (idx.length < 2) return "";
    const ida = idx.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(a.valores[i]!).toFixed(1)}`).join(" ");
    const volta = [...idx].reverse().map((i) => `L${x(i).toFixed(1)},${y(b.valores[i]!).toFixed(1)}`).join(" ");
    return `${ida} ${volta} Z`;
  })();

  // Última semana x a anterior, pra dar a direção de cara.
  const principal = lista[0];
  const ultimos = principal ? principal.valores.filter((v): v is number => v != null) : [];
  const atual = ultimos.length ? ultimos[ultimos.length - 1] : null;
  const anterior = ultimos.length > 1 ? ultimos[ultimos.length - 2] : null;
  const delta = atual != null && anterior != null ? atual - anterior : null;

  function mover(e: React.MouseEvent<SVGSVGElement>) {
    if (semanas.length === 0) return;
    const bx = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - bx.left;
    let melhor = 0;
    for (let i = 1; i < semanas.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    setFoco(melhor);
  }

  const s = foco != null ? semanas[foco] : null;
  const valoresFoco = foco != null ? lista.map((l) => l.valores[foco]).filter((v): v is number => v != null) : [];

  return (
    <PainelCard title="Sua tendência por semana" icon={<LineChart size={15} />} ordem={ordem} rolagem={false}>
      {/* Contêiner medido sempre existe (mesmo sem dado), pra largura já
          estar certa quando um filtro fizer o gráfico aparecer. */}
      <div ref={caixa} className="relative flex w-full flex-1 flex-col" onMouseLeave={() => setFoco(null)}>
        {semanas.length < 2 ? (
          <p className="text-sm text-muted">
            Precisa de pelo menos 2 semanas com {MIN_SEMANA}+ mãos pra desenhar a tendência. Continue importando.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="Métrica" className="flex max-w-full overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-0.5 [scrollbar-width:none]">
                {METRICAS.map((m) => {
                  const ativo = m.valor === metrica;
                  return (
                    <button
                      key={m.valor}
                      type="button"
                      role="tab"
                      aria-selected={ativo}
                      onClick={() => setMetrica(m.valor)}
                      className={`relative shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${ativo ? "text-black" : "text-muted hover:text-ink"}`}
                    >
                      {ativo && (
                        <motion.span layoutId="semana-metrica" className="absolute inset-0 rounded-full bg-[#d4af37]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <span className="relative">{m.rotulo}</span>
                    </button>
                  );
                })}
              </div>
              {atual != null && (
                <span className="flex items-baseline gap-2 text-[11px] text-muted">
                  última semana
                  <b className="text-[15px] font-bold tabular-nums text-ink">{Math.round(atual)}%</b>
                  {delta != null && Math.round(delta) !== 0 && (
                    <span className="tabular-nums text-ink/80">
                      {delta > 0 ? "↑" : "↓"} {Math.abs(Math.round(delta))} pts
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              {duas ? (
                <Legenda itens={lista.map((l) => ({ rotulo: l.rotulo, cor: l.cor }))} />
              ) : (
                <span className="text-[11px] text-muted/70">{principal?.rotulo}</span>
              )}
              <span className="text-[11px] text-muted/70">
                {duas ? "Entre as linhas = entradas só pagando" : "Semana sem ponto = poucas chances"}
              </span>
            </div>
            {/* O SVG fica por cima (absoluto) da área medida, pra altura dele
                não empurrar a medida de volta. */}
            <div ref={area} className="relative w-full flex-1" style={{ minHeight: ALTURA_MIN }}>
              {largura > 0 && (
                <svg
                  width={largura}
                  height={ALTURA + ALTURA_VOLUME}
                  className="absolute inset-x-0 top-0"
                  onMouseMove={mover}
                  role="img"
                  aria-label={`${principal?.rotulo ?? ""} por semana`}
                >
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
                  {vaoVpipPfr && (
                    <motion.path key={`vao-${metrica}`} d={vaoVpipPfr} fill={COR_VPIP} initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 0.6, delay: 0.8 }} />
                  )}
                  {lista.map((l) => (
                    <g key={`${metrica}-${l.chave}`}>
                      <motion.path
                        d={caminho(l.valores)}
                        fill="none"
                        stroke={l.cor}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                      />
                      {l.valores.map((v, i) =>
                        v == null ? null : (
                          <motion.circle
                            key={i}
                            cx={x(i)}
                            cy={y(v)}
                            r={3}
                            fill={l.cor}
                            stroke="#141414"
                            strokeWidth={1.5}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 + i * 0.05 }}
                          />
                        ),
                      )}
                    </g>
                  ))}
                  {/* rótulo direto no fim de cada linha */}
                  {lista.map((l) => {
                    const i = l.valores.map((v, k) => (v == null ? -1 : k)).filter((k) => k >= 0).pop();
                    if (i == null) return null;
                    return (
                      <text key={l.chave} x={x(i) + 8} y={y(l.valores[i]!)} dominantBaseline="middle" fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.85)">
                        {Math.round(l.valores[i]!)}%
                      </text>
                    );
                  })}
                  {/* volume: mãos por semana, barras pequenas embaixo */}
                  {semanas.map((sm, i) => {
                    const alt = Math.max(2, (sm.n / maiorSemana) * (ALTURA_VOLUME - 12));
                    const larg = Math.max(4, Math.min(18, (w / Math.max(1, semanas.length)) * 0.5));
                    return (
                      <rect
                        key={i}
                        x={x(i) - larg / 2}
                        y={ALTURA + ALTURA_VOLUME - alt - 2}
                        width={larg}
                        height={alt}
                        rx={2}
                        fill={foco === i ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.14)"}
                      />
                    );
                  })}
                  <text x={M.l - 14} y={ALTURA + ALTURA_VOLUME - 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.35)">
                    mãos
                  </text>
                  {/* mira + marcadores da semana em foco */}
                  {s && foco != null && (
                    <g>
                      <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                      {lista.map((l) =>
                        l.valores[foco] == null ? null : (
                          <circle key={l.chave} cx={x(foco)} cy={y(l.valores[foco]!)} r={4.5} fill={l.cor} stroke="#141414" strokeWidth={2} />
                        ),
                      )}
                    </g>
                  )}
                </svg>
              )}
              <DicaGrafico aberta={!!s} x={foco != null ? x(foco) : 0} y={valoresFoco.length ? y(Math.max(...valoresFoco)) : M.t + h / 2} largura={largura}>
                {s && foco != null && (
                  <>
                    <p className="font-semibold text-ink">Semana de {dataCurta(s.inicio)}</p>
                    {lista.map((l) => (
                      <p key={l.chave} className="tabular-nums text-ink/90">
                        <span style={{ color: l.cor }}>●</span> {l.rotulo}{" "}
                        {l.valores[foco] == null ? "—" : `${l.valores[foco]!.toFixed(1)}%`}
                        {!duas && <span className="text-muted"> ({l.contas[foco].sim} de {l.contas[foco].base})</span>}
                      </p>
                    ))}
                    {duas && linhaSoPagando(lista, foco)}
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

// Na dica de VPIP/PFR: quanto das entradas foi só pagando.
function linhaSoPagando(lista: Serie[], i: number) {
  const [a, b] = lista;
  const va = a?.valores[i];
  const vb = b?.valores[i];
  if (va == null || vb == null) return null;
  return <p className="tabular-nums text-muted">Só pagando: {(va - vb).toFixed(1)} pts</p>;
}
