"use client";

import { useEffect, useId, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";

// Pentágono em holograma: o perfil flutua em luz ciano sobre um projetor,
// com feixes do projetor até cada ponta, anéis girando no chão e linhas
// de varredura na forma. É o único desenho de pentágono do produto -- Score
// (início), perfil de jogo (Performance) e ficha do jogador (Time).
//
// Cada ponta vai de 0 até o SEU teto (as escalas são muito diferentes: um
// 3-Bet de 8% e um c-bet de 60% não cabem na mesma régua) e não há faixa
// "ideal" desenhada -- não temos referência auditável. O número de verdade
// fica escrito no rótulo; a forma é a leitura rápida.

export type EixoPentagono = {
  chave: string;
  curto: string;
  titulo: string;
  oQueE: string;
  comoCalcula: string;
  teto: number;
  valor: number | null;
  /** Quantas vezes (ex.: "12 de 40 flops"), mostrado na explicação. */
  vezes?: string;
  /** Origem própria do eixo; sem isso vale a origem do gráfico. */
  origem?: string;
};

// Quadro (viewBox) e geometria.
const W = 600;
const H = 360;
const CX = 300;
const CY = 225;
const R = 150;
const K = 0.56; // achatamento = inclinação do chão
const ALT = 70; // altura em que o perfil flutua
const PROJ = CY + 40; // centro do projetor
const CIANO = "#22d3ee";
const ANEIS = [0.25, 0.5, 0.75, 1];
const VERMELHO = "#e0555a";

type P = { x: number; y: number };
const r2 = (n: number) => Math.round(n * 100) / 100;
const pts = (l: P[]) => l.map((p) => `${p.x},${p.y}`).join(" ");
const ang = (n: number, i: number) => ((-90 + (i * 360) / n) * Math.PI) / 180;
const no = (n: number, i: number, f: number): P => ({
  x: r2(CX + R * f * Math.cos(ang(n, i))),
  y: r2(CY - ALT + R * f * K * Math.sin(ang(n, i))),
});

const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export function PentagonoHolograma({
  eixos,
  amostra,
  formatar = fmtPct,
  rotuloValor = "Jogador",
  rotuloTeto = "Ponta do gráfico",
  unidadeTeto = "%",
  origem = "Mãos importadas do jogador no período",
  vazio = "Sem mãos importadas no período — o perfil aparece assim que o jogador importar o histórico.",
  destaque = null,
}: {
  eixos: EixoPentagono[];
  amostra: number;
  formatar?: (v: number | null) => string;
  rotuloValor?: string;
  rotuloTeto?: string;
  unidadeTeto?: string;
  origem?: string;
  vazio?: string;
  /** Índice do eixo em destaque (ponto fraco): ponta e feixe em vermelho. */
  destaque?: number | null;
}) {
  const uid = useId().replace(/:/g, "");
  const reduzir = useReducedMotion();
  const [cresc, setCresc] = useState(reduzir ? 1 : 0);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    if (reduzir) {
      setCresc(1);
      return;
    }
    const c = animate(0, 1, { duration: 1.2, ease: EASE, delay: 0.2, onUpdate: setCresc });
    return () => c.stop();
  }, [reduzir]);

  const n = eixos.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const temDado = amostra > 0 && eixos.some((e) => e.valor != null);
  const fr = eixos.map((e) => Math.max(0.03, Math.min(1, Math.max(0, (e.valor ?? 0) / e.teto)) * cresc));
  const topo = fr.map((f, i) => no(n, i, f));
  const anel = (f: number) => pts(idx.map((i) => no(n, i, f)));
  // Marcas da escala (0 · 25% · 50% · 75% · 100%) subindo pelo eixo de
  // cima -- só quando todas as pontas usam a mesma escala (Score, 0 a
  // 100). No perfil de jogo cada ponta tem o seu teto, e um "50%" ali
  // não diria a mesma coisa em cada eixo; os anéis continuam.
  const escalaUnica = n > 0 && eixos.every((e) => e.teto === eixos[0].teto);
  const corPonta = (i: number) => (destaque === i ? VERMELHO : ativo === i ? "#f0cf63" : "#cffafe");

  return (
    <div className="@container relative w-full select-none" onMouseLeave={() => setAtivo(null)}>
      <div className="relative mx-auto aspect-[600/360] w-full max-w-[660px]">
        <style>{`
          @keyframes holo-gira-${uid} { to { stroke-dashoffset: -64; } }
          @keyframes holo-flutua-${uid} { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          .holo-gira-${uid} { animation: holo-gira-${uid} 4s linear infinite; }
          .holo-flutua-${uid} { animation: holo-flutua-${uid} 3.2s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .holo-gira-${uid}, .holo-flutua-${uid} { animation: none; }
          }
        `}</style>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <radialGradient id={`disco-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={CIANO} stopOpacity="0.55" />
              <stop offset="100%" stopColor={CIANO} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`feixe-${uid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={CIANO} stopOpacity="0.6" />
              <stop offset="100%" stopColor={CIANO} stopOpacity="0.05" />
            </linearGradient>
            <pattern id={`scan-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="1.2" fill={CIANO} fillOpacity="0.35" />
            </pattern>
          </defs>

          {/* Projetor no chão, com anéis girando. */}
          <ellipse cx={CX} cy={PROJ} rx={R * 0.75} ry={R * 0.75 * K} fill={`url(#disco-${uid})`} opacity={temDado ? 1 : 0.5} />
          <ellipse cx={CX} cy={PROJ} rx={R * 0.62} ry={R * 0.62 * K} fill="none" stroke={CIANO} strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="10 6" className={`holo-gira-${uid}`} />
          <ellipse
            cx={CX}
            cy={PROJ}
            rx={R * 0.4}
            ry={R * 0.4 * K}
            fill="none"
            stroke={CIANO}
            strokeOpacity="0.45"
            strokeDasharray="4 8"
            className={`holo-gira-${uid}`}
            style={{ animationDirection: "reverse" }}
          />

          <g className={`holo-flutua-${uid}`}>
            {/* Grade flutuante: 25% · 50% · 75% · 100%, mais os raios. */}
            {ANEIS.map((f) => (
              <polygon
                key={f}
                points={anel(f)}
                fill="none"
                stroke={CIANO}
                strokeOpacity={f === 1 ? 0.5 : f === 0.5 ? 0.3 : 0.16}
                strokeDasharray={f === 1 ? undefined : "3 4"}
              />
            ))}
            {idx.map((i) => {
              const v = no(n, i, 1);
              return <line key={i} x1={CX} y1={CY - ALT} x2={v.x} y2={v.y} stroke={ativo === i ? "#f0cf63" : CIANO} strokeOpacity={ativo === i ? 0.8 : 0.2} />;
            })}
            {escalaUnica &&
              [0, ...ANEIS].map((f) => {
                const p = no(n, 0, f);
                return (
                  <text key={`marca-${f}`} x={p.x + 5} y={p.y + 3} fontSize="9" fontWeight="600" fill="#a5f3fc" fillOpacity="0.55" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {f === 0 ? "0" : `${f * 100}%`}
                  </text>
                );
              })}

            {temDado && (
              <g>
                {topo.map((p, i) => (
                  <polygon
                    key={`feixe-${i}`}
                    points={pts([{ x: CX - 6, y: PROJ }, { x: CX + 6, y: PROJ }, p])}
                    fill={destaque === i ? VERMELHO : `url(#feixe-${uid})`}
                    opacity={destaque === i ? 0.25 : ativo === i ? 0.85 : 0.5}
                  />
                ))}
                <polygon points={pts(topo)} fill={CIANO} fillOpacity="0.16" />
                <polygon points={pts(topo)} fill={`url(#scan-${uid})`} />
                <polygon points={pts(topo)} fill="none" stroke="#a5f3fc" strokeWidth="1.8" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${CIANO})` }} />
                {topo.map((p, i) =>
                  eixos[i].valor == null ? null : (
                    <circle
                      key={`no-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={ativo === i ? 5.5 : 4}
                      fill={corPonta(i)}
                      style={{ filter: `drop-shadow(0 0 5px ${destaque === i ? VERMELHO : CIANO})` }}
                    />
                  ),
                )}
              </g>
            )}
          </g>
        </svg>

        {/* Rótulos em HTML (texto nítido e explicação ao passar o mouse). */}
        {eixos.map((e, i) => {
          const a = ang(n, i);
          const c = Math.cos(a);
          const topoEixo = Math.sin(a) < -0.9;
          const p = no(n, i, topoEixo ? 1.3 : 1.2);
          const lado = Math.abs(c) < 0.2 ? "meio" : c > 0 ? "dir" : "esq";
          const itens = [
            { rotulo: rotuloValor, valor: formatar(e.valor) },
            ...(e.vezes ? [{ rotulo: "Quantas vezes", valor: e.vezes }] : []),
            { rotulo: rotuloTeto, valor: `0 a ${e.teto}${unidadeTeto}` },
          ];
          return (
            <InfoHover
              key={e.chave}
              explicacao={{ titulo: e.titulo, oQueE: e.oQueE, itens, origem: e.origem ?? origem, comoCalcula: e.comoCalcula }}
              className={`absolute -translate-y-1/2 ${lado === "meio" ? "-translate-x-1/2 text-center" : lado === "esq" ? "-translate-x-full text-right" : "text-left"}`}
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
            >
              <span
                className="block cursor-help rounded-lg px-1 py-0.5 transition-colors hover:bg-white/[0.05] @sm:px-1.5"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              >
                <span className="block whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.1em] text-muted @sm:text-[10.5px] @sm:tracking-[0.12em]">
                  {e.curto}
                </span>
                <span
                  className={`block text-[13px] font-bold leading-tight tabular-nums @sm:text-[17px] @lg:text-[19px] ${ativo === i ? "text-[#f0cf63]" : "text-ink"}`}
                  style={destaque === i && ativo !== i ? { color: "#f08a8e" } : undefined}
                >
                  {formatar(e.valor)}
                </span>
              </span>
            </InfoHover>
          );
        })}

        {!temDado && (
          <p className="absolute inset-x-0 top-[40%] mx-auto max-w-[220px] -translate-y-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[12px] text-muted backdrop-blur">
            {vazio}
          </p>
        )}
      </div>
    </div>
  );
}
