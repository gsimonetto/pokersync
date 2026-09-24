"use client";

import { useEffect, useId, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { EASE } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";

// Pentágono do perfil de jogo em "placa de circuito" 3D: o chão é uma
// placa (anéis de 25/50/75/100% como trilhas, vias nos cruzamentos) vista
// em perspectiva, e o perfil do jogador sobe dela como um prisma de
// vidro dourado. Cada ponta sai da placa por uma trilha até o rótulo,
// com um pulso de luz correndo pelas trilhas.
//
// Mesma regra do pentágono da Performance: cada ponta vai de 0 até o
// SEU teto (as frequências vivem em escalas muito diferentes) e não há
// faixa "ideal" desenhada -- não temos referência auditável. O número de
// verdade fica escrito no rótulo; a forma é a leitura rápida.

export type EixoCircuito = {
  chave: string;
  curto: string;
  titulo: string;
  oQueE: string;
  comoCalcula: string;
  teto: number;
  valor: number | null;
};

// Quadro (viewBox) e geometria da placa.
const W = 600;
const H = 292;
const CX = 300;
const CY = 170;
const R = 150;
const K = 0.6; // achatamento vertical = inclinação da placa
const ELEV = 34; // altura do prisma
const PLACA = 9; // espessura da placa

const ANG = [0, 1, 2, 3, 4].map((i) => ((-90 + i * 72) * Math.PI) / 180);
const r2 = (n: number) => Math.round(n * 100) / 100;
const chao = (i: number, f: number) => ({ x: r2(CX + R * f * Math.cos(ANG[i])), y: r2(CY + R * f * K * Math.sin(ANG[i])) });
const pts = (lista: { x: number; y: number }[]) => lista.map((p) => `${p.x},${p.y}`).join(" ");

// Trilha de cada ponta até o rótulo (com dobras em 45°, estilo circuito)
// e onde o rótulo fica, em unidades do quadro.
type Saida = { trilha: { x: number; y: number }[]; rotulo: { x: number; y: number; lado: "esq" | "dir" } };
function saida(i: number): Saida {
  const v = chao(i, 1);
  switch (i) {
    case 0:
      return { trilha: [v, { x: v.x, y: 42 }, { x: v.x + 20, y: 22 }, { x: 372, y: 22 }], rotulo: { x: 380, y: 22, lado: "dir" } };
    case 1:
      return { trilha: [v, { x: v.x + 16, y: v.y - 16 }, { x: 486, y: v.y - 16 }], rotulo: { x: 494, y: v.y - 16, lado: "dir" } };
    case 2:
      return { trilha: [v, { x: v.x + 22, y: v.y + 22 }, { x: 486, y: v.y + 22 }], rotulo: { x: 494, y: v.y + 22, lado: "dir" } };
    case 3:
      return { trilha: [v, { x: v.x - 22, y: v.y + 22 }, { x: 114, y: v.y + 22 }], rotulo: { x: 106, y: v.y + 22, lado: "esq" } };
    default:
      return { trilha: [v, { x: v.x - 16, y: v.y - 16 }, { x: 114, y: v.y - 16 }], rotulo: { x: 106, y: v.y - 16, lado: "esq" } };
  }
}
const SAIDAS = [0, 1, 2, 3, 4].map(saida);
const caminho = (lista: { x: number; y: number }[]) => lista.map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

// Reusado em dois lugares: ficha do jogador (frequências em %) e tela
// inicial (os 5 pilares do Score, de 0 a 100). As props opcionais trocam
// só o texto -- a placa, o prisma e a animação são os mesmos.
export function PentagonoCircuito({
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
  eixos: EixoCircuito[];
  amostra: number;
  formatar?: (v: number | null) => string;
  rotuloValor?: string;
  rotuloTeto?: string;
  unidadeTeto?: string;
  origem?: string;
  vazio?: string;
  /** Índice do eixo em destaque (ponto fraco): nó e trilha em vermelho. */
  destaque?: number | null;
}) {
  const fmt = formatar;
  const uid = useId().replace(/:/g, "");
  const reduzir = useReducedMotion();
  const [cresc, setCresc] = useState(reduzir ? 1 : 0);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    if (reduzir) {
      setCresc(1);
      return;
    }
    const c = animate(0, 1, { duration: 1.1, ease: EASE, delay: 0.25, onUpdate: setCresc });
    return () => c.stop();
  }, [reduzir]);

  // Leve inclinação seguindo o mouse: reforça o 3D sem atrapalhar a leitura.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-1, 1], [-5, 5]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, [-1, 1], [4, -4]), { stiffness: 120, damping: 18 });

  const temDado = amostra > 0 && eixos.some((e) => e.valor != null);
  const fr = eixos.map((e) => Math.min(1, Math.max(0, (e.valor ?? 0) / e.teto)) * cresc);
  const piso = fr.map((f, i) => chao(i, Math.max(f, 0.02)));
  const elev = ELEV * cresc;
  const topo = piso.map((p) => ({ x: p.x, y: r2(p.y - elev) }));

  // Paredes do prisma: as de trás primeiro, pra frente cobrir o fundo.
  const paredes = [0, 1, 2, 3, 4]
    .map((i) => {
      const j = (i + 1) % 5;
      return { i, meio: (piso[i].y + piso[j].y) / 2, quad: [topo[i], topo[j], piso[j], piso[i]] };
    })
    .sort((a, b) => a.meio - b.meio);

  const anel = (f: number) => pts([0, 1, 2, 3, 4].map((i) => chao(i, f)));
  const bordaPlaca = [0, 1, 2, 3, 4].map((i) => chao(i, 1.08));

  return (
    <div
      className="@container relative w-full select-none"
      style={{ perspective: 1100 }}
      onMouseMove={(e) => {
        if (reduzir) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
        setAtivo(null);
      }}
    >
      <motion.div className="relative mx-auto aspect-[600/292] w-full max-w-[660px]" style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}>
        <style>{`
          @keyframes circ-pulso-${uid} { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
          .circ-pulso-${uid} { animation: circ-pulso-${uid} 2.8s linear infinite; }
          @keyframes circ-no-${uid} { 0%, 100% { opacity: 0.25; r: 6; } 50% { opacity: 0.6; r: 9; } }
          .circ-no-${uid} { animation: circ-no-${uid} 2.4s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .circ-pulso-${uid}, .circ-no-${uid} { animation: none; }
          }
        `}</style>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`topo-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0cf63" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#4a90d9" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id={`parede-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id={`placa-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.045" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.015" />
            </linearGradient>
            <radialGradient id={`brilho-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
            </radialGradient>
            <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`sombra-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Placa: espessura (laterais da frente) + face de cima. */}
          {[0, 1, 2, 3, 4].map((i) => {
            const j = (i + 1) % 5;
            const a = bordaPlaca[i];
            const b = bordaPlaca[j];
            if ((a.y + b.y) / 2 < CY - 10) return null;
            return (
              <polygon
                key={`lat-${i}`}
                points={pts([a, b, { x: b.x, y: b.y + PLACA }, { x: a.x, y: a.y + PLACA }])}
                fill="rgba(255,255,255,0.035)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.8}
              />
            );
          })}
          <polygon points={pts(bordaPlaca)} fill={`url(#placa-${uid})`} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          <ellipse cx={CX} cy={CY} rx={R * 0.9} ry={R * K * 0.9} fill={`url(#brilho-${uid})`} />

          {/* Trilhas da placa: anéis de 25/50/75/100% e os raios. */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={anel(f)}
              fill="none"
              stroke={f === 1 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)"}
              strokeWidth={f === 1 ? 1.1 : 0.9}
              strokeDasharray={f === 1 ? undefined : "3 4"}
            />
          ))}
          {ANG.map((_, i) => {
            const v = chao(i, 1);
            const aceso = ativo === i;
            return (
              <g key={`raio-${i}`}>
                <line x1={CX} y1={CY} x2={v.x} y2={v.y} stroke={aceso ? "rgba(212,175,55,0.7)" : "rgba(255,255,255,0.1)"} strokeWidth={1} />
                {[0.25, 0.5, 0.75].map((f) => {
                  const p = chao(i, f);
                  return <circle key={f} cx={p.x} cy={p.y} r={1.8} fill="#0d0d0d" stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />;
                })}
              </g>
            );
          })}

          {/* Trilhas até os rótulos, com o pulso de luz. */}
          {SAIDAS.map((s, i) => {
            const d = caminho([{ x: CX, y: CY }, ...s.trilha]);
            const fim = s.trilha[s.trilha.length - 1];
            const aceso = ativo === i;
            return (
              <g key={`saida-${i}`}>
                <path
                  d={caminho(s.trilha)}
                  fill="none"
                  stroke={aceso ? "rgba(212,175,55,0.8)" : destaque === i ? "rgba(224,85,90,0.55)" : "rgba(255,255,255,0.18)"}
                  strokeWidth={1.1}
                  strokeLinejoin="round"
                />
                {s.trilha.slice(1, -1).map((p, j) => (
                  <circle key={j} cx={p.x} cy={p.y} r={1.6} fill="rgba(255,255,255,0.3)" />
                ))}
                <circle cx={fim.x} cy={fim.y} r={3.4} fill="#0d0d0d" stroke={aceso ? "#d4af37" : "rgba(255,255,255,0.35)"} strokeWidth={1.2} />
                {temDado && (
                  <path
                    d={d}
                    pathLength={100}
                    fill="none"
                    stroke="#f0cf63"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeDasharray="3 97"
                    className={`circ-pulso-${uid}`}
                    style={{ animationDelay: `${i * 0.55}s`, filter: `url(#glow-${uid})` }}
                  />
                )}
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={3} fill="#d4af37" filter={`url(#glow-${uid})`} />

          {temDado && (
            <g>
              {/* Sombra do prisma na placa. */}
              <polygon points={pts(piso)} fill="rgba(0,0,0,0.55)" filter={`url(#sombra-${uid})`} />
              {paredes.map((p) => (
                <polygon key={`par-${p.i}`} points={pts(p.quad)} fill={`url(#parede-${uid})`} stroke="rgba(212,175,55,0.35)" strokeWidth={0.7} strokeLinejoin="round" />
              ))}
              {piso.map((p, i) => (
                <line key={`pino-${i}`} x1={p.x} y1={p.y} x2={topo[i].x} y2={topo[i].y} stroke="rgba(240,207,99,0.55)" strokeWidth={0.8} strokeDasharray="2 2" />
              ))}
              <polygon
                points={pts(topo)}
                fill={`url(#topo-${uid})`}
                stroke="#f0cf63"
                strokeWidth={1.8}
                strokeLinejoin="round"
                filter={`url(#glow-${uid})`}
              />
              {topo.map((p, i) =>
                eixos[i].valor == null ? null : (
                  <g key={`no-${i}`}>
                    <circle cx={p.x} cy={p.y} r={6} fill={destaque === i ? "#e0555a" : "#f0cf63"} className={`circ-no-${uid}`} style={{ animationDelay: `${i * 0.3}s` }} />
                    <circle cx={p.x} cy={p.y} r={ativo === i ? 5 : 3.8} fill={destaque === i ? "#e0555a" : "#f0cf63"} stroke="#0d0d0d" strokeWidth={1.6} />
                  </g>
                ),
              )}
            </g>
          )}
        </svg>

        {/* Rótulos em HTML (texto nítido e com explicação ao passar o mouse). */}
        {eixos.map((e, i) => {
          const s = SAIDAS[i].rotulo;
          return (
            <InfoHover
              key={e.chave}
              explicacao={{
                titulo: e.titulo,
                oQueE: e.oQueE,
                itens: [
                  { rotulo: rotuloValor, valor: fmt(e.valor) },
                  { rotulo: rotuloTeto, valor: `0 a ${e.teto}${unidadeTeto}` },
                ],
                origem,
                comoCalcula: e.comoCalcula,
              }}
              className={`absolute -translate-y-1/2 ${s.lado === "esq" ? "-translate-x-full text-right" : "text-left"}`}
              style={{ left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` }}
            >
              <span className="block cursor-help rounded-lg px-1 py-0.5 @sm:px-1.5 transition-colors hover:bg-white/[0.05]" onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
                <span className="block whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.1em] text-muted @sm:text-[10.5px] @sm:tracking-[0.12em]">{e.curto}</span>
                <span
                  className={`block text-[13px] font-bold leading-tight tabular-nums @sm:text-[17px] @lg:text-[19px] ${ativo === i ? "text-[#f0cf63]" : "text-ink"}`}
                  style={destaque === i && ativo !== i ? { color: "#f08a8e" } : undefined}
                >
                  {fmt(e.valor)}
                </span>
              </span>
            </InfoHover>
          );
        })}

        {!temDado && (
          <p className="absolute inset-x-0 top-1/2 mx-auto max-w-[260px] -translate-y-1/2 rounded-xl bg-black/60 px-3 py-2 text-center text-[12px] text-muted backdrop-blur">
            {vazio}
          </p>
        )}
      </motion.div>
    </div>
  );
}
