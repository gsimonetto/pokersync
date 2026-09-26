"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";

// ============================================================
// Emblema de patente -- cada faixa de 10 níveis é desenhada como o
// material de verdade (pedido explícito: "mais realista, de acordo com o
// que é cada coisa, e o Lendário precisa ser algo supremo").
//
// A forma conta a história antes da cor (e funciona pra quem não
// distingue cores):
//   Bronze    escudo de bronze fundido: marteladinho, rebites e pátina
//             esverdeada nas bordas (o azinhavre do bronze velho)
//   Prata     escudo de prata polida, espelhado, com borda serrilhada
//   Ouro      brasão de ouro com coroa de louros
//   Esmeralda pedra em lapidação "esmeralda" (degraus), cravada em ouro
//   Safira    safira oval lapidada, com auréola de brilhantes em ouro branco
//   Ametista  drusa: cristais brutos saindo da rocha, como a pedra nasce
//   Rubi      rubi em lapidação almofada (quadrado de cantos macios), vermelho
//             "sangue de pombo", cravado em ouro, pulsando
//   Platina   escudo de platina escovada com um brilhante cravado no topo
//   Diamante  brilhante incolor visto de cima, em 6 garras de platina, com
//             o "fogo" -- as faíscas de arco-íris que a lapidação solta
//   Lendário  o anel de campeão visto de cima: ônix polido com o número em ouro,
//             auréola de diamantes e raios de sol girando atrás -- o troféu
//             máximo do poker. As nove pedras da jornada (Bronze ao
//             Diamante) ficam cravadas no aro: quem chega lá carrega a
//             jornada inteira no dedo.
//
// Nível de detalhe por tamanho: abaixo de 60px somem textura, rebites e
// partículas (viram ruído); fica a silhueta e o material.
//
// Tudo em SVG + CSS (sem imagem). Quem pediu menos movimento no sistema
// vê o emblema parado.
// ============================================================

export type Faixa = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export function faixaDoNivel(nivel: number): Faixa {
  return Math.min(9, Math.max(0, Math.ceil(nivel / 10) - 1)) as Faixa;
}

/** IV (acabou de entrar) = 1 marca ... I (prestes a subir) = 4 marcas. */
export function marcasDaDivisao(nivel: number): number {
  return { IV: 1, III: 2, II: 3, I: 4 }[levelSubTier(nivel)] ?? 1;
}

// ---------- Geometria e cor (calculadas uma vez, no carregamento) ----------

type P = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const poli = (pts: P[]) => "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(" L") + " Z";

function hexRgb(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function misturar(a: string, b: string, t: number) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}
/** Cor ao longo da paleta [profundo .. reflexo] para brilho t (0..1). */
function rampa(pal: string[], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(x));
  return misturar(pal[i], pal[i + 1], x - i);
}

interface Faceta {
  d: string;
  t: number;
}

// Luz vindo de cima-esquerda: faceta virada pra ela acende, a oposta apaga.
const LUZ = (-135 * Math.PI) / 180;
function luz(c: P, pts: P[], ganho = 0.42) {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return 0.5 + ganho * Math.cos(Math.atan2(y - c[1], x - c[0]) - LUZ);
}

/** Lapidação brilhante vista de cima: mesa, estrelas, "pipas" e facetas da cintura. */
function brilhante(p: (t: number, s: number) => P, n: number, sMesa = 0.5, sEstrela = 0.76) {
  const c = p(0, 0);
  const T = (k: number) => p(k / n, sMesa);
  const S = (k: number) => p((k + 0.5) / n, sEstrela);
  const G = (k: number) => p(k / n, 1);
  const M = (k: number) => p((k + 0.5) / n, 1);
  const facetas: Faceta[] = [];
  const add = (pts: P[], vies: number) => facetas.push({ d: poli(pts), t: luz(c, pts) + vies });
  for (let k = 0; k < n; k++) {
    add([T(k), T(k + 1), S(k)], 0.14);
    add([T(k), S(k - 1), G(k), S(k)], k % 2 ? -0.2 : 0.04);
    add([S(k), G(k), M(k)], 0.18 * (((k * 7) % 3) - 1));
    add([S(k), M(k), G(k + 1)], -0.18 * (((k * 5) % 3) - 1));
  }
  const mesa = poli(Array.from({ length: n }, (_, k) => T(k)));
  const contorno = poli(Array.from({ length: 64 }, (_, k) => p(k / 64, 1)));
  return { facetas, mesa, contorno };
}

/** Lapidação em degraus (esmeralda): anéis concêntricos, claro/escuro alternado. */
function degraus(contorno: P[], c: P, escalas: number[]) {
  const aneis = escalas.map((s) => contorno.map(([x, y]) => [c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s] as P));
  const facetas: Faceta[] = [];
  for (let j = 0; j < aneis.length - 1; j++) {
    for (let i = 0; i < contorno.length; i++) {
      const i2 = (i + 1) % contorno.length;
      const pts: P[] = [aneis[j][i], aneis[j][i2], aneis[j + 1][i2], aneis[j + 1][i]];
      facetas.push({
        d: poli(pts),
        t: luz(c, pts, 0.36) + (j % 2 ? -0.24 : 0.1),
      });
    }
  }
  return {
    facetas,
    mesa: poli(aneis[aneis.length - 1]),
    contorno: poli(contorno),
  };
}

// Esmeralda: retângulo de cantos chanfrados, em pé.
const ESMERALDA = degraus(
  [[42, 13], [78, 13], [92, 27], [92, 93], [78, 107], [42, 107], [28, 93], [28, 27]],
  [60, 60],
  [1, 0.86, 0.72, 0.58],
);

// Safira: oval.
const SAFIRA = brilhante((t, s) => {
  const a = t * Math.PI * 2 - Math.PI / 2;
  return [60 + s * 29 * Math.cos(a), 60 + s * 36 * Math.sin(a)];
}, 8);

// Rubi: almofada (superelipse -- quadrado com os cantos arredondados).
const RUBI = brilhante((t, s) => {
  const a = t * Math.PI * 2 - Math.PI / 2;
  const q = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 3.4);
  return [60 + s * 36 * q(Math.cos(a)), 60 + s * 36 * q(Math.sin(a))];
}, 8);

// Brilhantes redondos (Diamante e topo da Platina).
const redondo = (cx: number, cy: number, r: number) =>
  brilhante((t, s) => {
    const a = t * Math.PI * 2 - Math.PI / 2;
    return [cx + s * r * Math.cos(a), cy + s * r * Math.sin(a)];
  }, 8);
const BRILHANTE_PLATINA = redondo(60, 21, 9);
const BRILHANTE_DIAMANTE = redondo(60, 60, 40);

// Ametista: cristais hexagonais saindo da rocha (drusa).
function cristal(cx: number, base: number, w: number, h: number, ponta: number, graus: number) {
  const ang = (graus * Math.PI) / 180;
  const rot = ([x, y]: P): P => {
    const dx = x - cx;
    const dy = y - base;
    return [cx + dx * Math.cos(ang) - dy * Math.sin(ang), base + dx * Math.sin(ang) + dy * Math.cos(ang)];
  };
  const topo = base - h + ponta;
  const ap: P = [cx + w * 0.06, base - h];
  const L: P = [cx - w / 2, topo];
  const l: P = [cx - w / 4, topo + 2.5];
  const r: P = [cx + w / 4, topo + 2.5];
  const R: P = [cx + w / 2, topo];
  const faces: [P[], number][] = [
    [[L, l, [cx - w / 4, base], [cx - w / 2, base - 2]], 0.32],
    [[l, r, [cx + w / 4, base], [cx - w / 4, base]], 0.62],
    [[r, R, [cx + w / 2, base - 2], [cx + w / 4, base]], 0.44],
    [[L, l, ap], 0.78],
    [[l, r, ap], 0.98],
    [[r, R, ap], 0.56],
  ];
  return {
    faces: faces.map(([pts, t]) => ({ d: poli(pts.map(rot)), t })),
    contorno: poli(([L, ap, R, [cx + w / 2, base - 2], [cx - w / 2, base - 2]] as P[]).map(rot)),
    ponta: rot(ap),
  };
}
const CRISTAIS = [
  cristal(33, 100, 13, 30, 8, -40),
  cristal(88, 100, 12, 28, 7, 42),
  cristal(43, 101, 20, 54, 12, -19),
  cristal(78, 101, 20, 58, 12, 17),
  cristal(60, 103, 30, 90, 18, 0),
];
const DRUSA = [[26, 101], [32, 97], [40, 103], [50, 99], [56, 104], [68, 100], [74, 104], [84, 99], [92, 102], [46, 106], [64, 107], [80, 106]];

// Louros do Ouro: folhas ao longo de um ramo curvo, alternando os lados.
const LOUROS = (() => {
  const A: P = [57, 112];
  const C: P = [14, 106];
  const B: P = [17, 50];
  const folhas: { x: number; y: number; r: number }[] = [];
  for (let k = 1; k <= 8; k++) {
    const u = k / 9;
    const x = (1 - u) ** 2 * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0];
    const y = (1 - u) ** 2 * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1];
    const tx = 2 * (1 - u) * (C[0] - A[0]) + 2 * u * (B[0] - C[0]);
    const ty = 2 * (1 - u) * (C[1] - A[1]) + 2 * u * (B[1] - C[1]);
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
    const lado = k % 2 ? 1 : -1;
    const nx = (-ty / Math.hypot(tx, ty)) * 3.2 * lado;
    const ny = (tx / Math.hypot(tx, ty)) * 3.2 * lado;
    folhas.push({ x: r1(x + nx), y: r1(y + ny), r: r1(ang + 32 * lado) });
  }
  return { ramo: `M${A[0]} ${A[1]} Q${C[0]} ${C[1]} ${B[0]} ${B[1]}`, folhas };
})();

// Raios de sol do Lendário (longos e curtos alternados).
const RAIOS = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  const R = i % 2 ? 46 : 59;
  const d = i % 2 ? 0.04 : 0.06;
  const p = (ang: number, r: number): P => [60 + r * Math.cos(ang), 60 + r * Math.sin(ang)];
  return poli([p(a - d, 18), p(a, R), p(a + d, 18)]);
}).join(" ");

// Cores do "fogo" do diamante (a luz branca se abrindo em arco-íris).
const FOGO = ["#7cd8ff", "#fff27c", "#9dffb0", "#c9a0ff", "#ffb07c"];

// Anel do Lendário: auréola de 22 diamantes. As nove pedras da jornada
// (Bronze -> Diamante) tomam o lugar das nove de baixo e se leem da
// esquerda pra direita, na ordem em que foram conquistadas.
const JORNADA = ["#c98d52", "#aeb6bf", "#f2c94c", "#12a15a", "#2f63e0", "#9a4ee0", "#d42a3c", "#bfe9f2", "#ffffff"];
const AUREOLA = Array.from({ length: 22 }, (_, i) => {
  const a = ((i + 0.5) / 22) * Math.PI * 2;
  return { x: r1(60 + 40 * Math.cos(a)), y: r1(60 + 40 * Math.sin(a)), cor: i >= 1 && i <= 9 ? JORNADA[9 - i] : null };
});

// ---------- Materiais ----------

interface Material {
  claro: string;
  base: string;
  escuro: string;
}

const MATERIAIS: Material[] = [
  { claro: "#F1C694", base: "#B08D57", escuro: "#4B2A10" }, // Bronze
  { claro: "#FFFFFF", base: "#C0C6CC", escuro: "#3F474F" }, // Prata
  { claro: "#FFF1B8", base: "#E0B24C", escuro: "#6B4306" }, // Ouro
  { claro: "#A7F3C4", base: "#22c55e", escuro: "#02301A" }, // Esmeralda
  { claro: "#BFDBFE", base: "#3b82f6", escuro: "#050D3D" }, // Safira
  { claro: "#E9D5FF", base: "#A855F7", escuro: "#2A0A4A" }, // Ametista
  { claro: "#FECDD3", base: "#e0555a", escuro: "#3A0008" }, // Rubi
  { claro: "#ECFEFF", base: "#22d3ee", escuro: "#243640" }, // Platina
  { claro: "#FFFFFF", base: "#f472b6", escuro: "#1E2530" }, // Diamante
  { claro: "#FFF8DC", base: "#F5D48C", escuro: "#2A1A02" }, // Lendário
];

// Reflexo de metal: claro em cima, "horizonte" escuro no meio, volta a
// clarear embaixo -- é o que faz metal polido parecer metal.
const METAL: Record<string, [number, string][]> = {
  bronze: [[0, "#f3c48c"], [0.18, "#c4864a"], [0.46, "#6b3d19"], [0.54, "#4a290e"], [0.78, "#9a602e"], [1, "#351d08"]],
  prata: [[0, "#ffffff"], [0.28, "#e3e8ed"], [0.47, "#a3acb6"], [0.53, "#6c7680"], [0.74, "#d2d8de"], [1, "#78818a"]],
  ouro: [[0, "#fff6cc"], [0.22, "#f5cf55"], [0.48, "#bd851c"], [0.55, "#9a6512"], [0.78, "#ecba42"], [1, "#6e4506"]],
  platina: [[0, "#fbfdff"], [0.26, "#dfe8ee"], [0.48, "#aebcc6"], [0.54, "#8b9ba6"], [0.78, "#d6e2e9"], [1, "#6f7f8a"]],
  lendario: [[0, "#fffbe6"], [0.2, "#ffe391"], [0.46, "#d9a431"], [0.55, "#a36b0e"], [0.8, "#f9d36e"], [1, "#6a4204"]],
};
const ARO: Record<string, string[]> = {
  bronze: ["#ffdcae", "#b07a41", "#35190a"],
  prata: ["#ffffff", "#aab2ba", "#3f474f"],
  ouro: ["#fff6cf", "#d9a531", "#5a3804"],
  platina: ["#ffffff", "#b4c2cc", "#46545e"],
  lendario: ["#fffbe6", "#e6b441", "#4d2f02"],
};

// Paletas das gemas: [profundo, escuro, base, claro, reflexo]
const GEMA = {
  esmeralda: ["#012616", "#06603a", "#12a15a", "#6ee7a8", "#eafff3"],
  safira: ["#040b36", "#0f2a8f", "#2f63e0", "#93b8ff", "#f0f5ff"],
  ametista: ["#230842", "#57209a", "#9a4ee0", "#d6b3ff", "#fbf3ff"],
  rubi: ["#1c0003", "#640612", "#b3122a", "#f24b5e", "#ffd2d7"],
  diamante: ["#0b1017", "#46526a", "#b9c8d8", "#f3f8fd", "#ffffff"],
  gelo: ["#0a3f4d", "#3a98ad", "#a7ecf7", "#eafcff", "#ffffff"],
};

const ESCUDO = {
  bronze: "M24 22 Q60 12 96 22 V58 C96 84 80 99 60 108 C40 99 24 84 24 58 Z",
  prata: "M22 20 Q42 22 60 11 Q78 22 98 20 V58 C98 85 81 100 60 110 C39 100 22 85 22 58 Z",
  ouro: "M27 24 Q35 14 45 20 Q52 10 60 9 Q68 10 75 20 Q85 14 93 24 V58 C93 84 78 99 60 108 C42 99 27 84 27 58 Z",
  platina: "M26 24 Q60 13 94 24 V60 C94 85 79 99 60 108 C41 99 26 85 26 60 Z",
};

const VEL_VARRE = ["7s", "3.4s", "4.6s", "5s", "6s", "5.5s", "4.5s", "3.8s", "3.2s", "3.6s"];
const NUMERO_Y = [62, 62, 62, 62, 62, 66, 62, 66, 62, 62];

export function EmblemaEstilos() {
  return (
    <style>{`
      /* Só os elementos animados giram/escalam em torno do próprio centro;
         uma regra geral mexeria também nos transform="" fixos (louros
         espelhados) e os tiraria do lugar. */
      .emb-sobe, .emb-pulsa, .emb-estrela { transform-box: fill-box; transform-origin: center; }
      @keyframes embVarre { 0% { transform: translateX(-90px) skewX(-18deg); } 60%, 100% { transform: translateX(200px) skewX(-18deg); } }
      @keyframes embSobe { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-38px) scale(.3); opacity: 0; } }
      @keyframes embPisca { 0%, 100% { opacity: 0; } 50% { opacity: .55; } }
      @keyframes embOnda { from { transform: translateX(0); } to { transform: translateX(-60px); } }
      @keyframes embGira { to { transform: rotate(360deg); } }
      @keyframes embPulsa { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.06); } 24% { transform: scale(.99); } 36% { transform: scale(1.04); } 50% { transform: scale(1); } }
      @keyframes embEstrela { 0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; } 50% { transform: scale(1) rotate(45deg); opacity: 1; } }
      @keyframes embAura { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      @keyframes embIris { from { transform: rotate(0deg); filter: hue-rotate(0deg); } to { transform: rotate(360deg); filter: hue-rotate(360deg); } }
      @keyframes embFlutua { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      .emb-varre { animation: embVarre var(--vel, 5s) ease-in-out infinite; }
      .emb-sobe { animation: embSobe var(--vel, 2.6s) ease-out infinite; }
      .emb-pisca { animation: embPisca var(--vel, 2.8s) ease-in-out infinite; }
      .emb-onda { animation: embOnda 3.2s linear infinite; }
      .emb-gira { animation: embGira var(--vel, 12s) linear infinite; transform-box: view-box; transform-origin: 60px 60px; }
      .emb-pulsa { animation: embPulsa 1.6s ease-in-out infinite; }
      .emb-estrela { animation: embEstrela var(--vel, 2.2s) ease-in-out infinite; }
      .emb-aura { animation: embAura 2.8s ease-in-out infinite; }
      .emb-iris { animation: embIris 8s linear infinite; }
      .emb-flutua { animation: embFlutua 4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .emb-varre, .emb-sobe, .emb-pisca, .emb-onda, .emb-gira, .emb-pulsa, .emb-estrela, .emb-iris, .emb-aura, .emb-flutua { animation: none !important; }
      }
    `}</style>
  );
}

// ---------- Peças reutilizáveis ----------

interface Ctx {
  id: (s: string) => string;
  a: boolean;
  det: boolean;
  /** Miniatura (selo da foto): número bem maior e contorno grosso pra continuar legível. */
  mini: boolean;
}

// Largura livre (no quadro de 120) na altura do número, por patente -- o
// número da miniatura nunca passa disso, pra não vazar pra fora da peça.
const LARGURA_NUMERO = [56, 58, 52, 50, 44, 48, 56, 52, 58, 48];

/** Tamanho e contorno do número. Na miniatura ele cresce até caber na largura livre da peça. */
function numero(c: Ctx, nivel: number, faixa: Faixa) {
  if (!c.mini) return { fontSize: nivel >= 10 ? 30 : 34, strokeWidth: 4 };
  const traco = 6;
  const porDigito = 0.62; // largura média de um algarismo em negrito, em "em"
  const cabe = (LARGURA_NUMERO[faixa] - traco) / (porDigito * String(nivel).length);
  return { fontSize: Math.min(44, Math.floor(cabe)), strokeWidth: traco };
}

const vel = (v: string) => ({ ["--vel" as string]: v }) as CSSProperties;

function GradMetal({ id, stops }: { id: string; stops: [number, string][] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2=".25" y2="1">
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
}
function GradAro({ id, cores }: { id: string; cores: string[] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={cores[0]} />
      <stop offset=".45" stopColor={cores[1]} />
      <stop offset="1" stopColor={cores[2]} />
    </linearGradient>
  );
}

/** Volume: luz especular em cima-esquerda e sombra embaixo -- o metal "abaula". */
function Domo({ d, id, forca = 1 }: { d: string; id: string; forca?: number }) {
  return (
    <>
      <radialGradient id={id} cx=".32" cy=".2" r=".95">
        <stop offset="0" stopColor="#fff" stopOpacity={0.42 * forca} />
        <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        <stop offset=".72" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity={0.45 * forca} />
      </radialGradient>
      <path d={d} fill={`url(#${id})`} />
    </>
  );
}

const reduz = (k: number, cx = 60, cy = 60) => `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`;

/** Escudo de metal: aro chanfrado + face polida + volume. */
function EscudoMetal({ c, d, metal, aro, k = 0.9, cy = 60 }: { c: Ctx; d: string; metal: string; aro: string; k?: number; cy?: number }) {
  return (
    <>
      <path d={d} fill={`url(#${c.id("aro")})`} stroke={ARO[aro][2]} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={d} transform={reduz(k, 60, cy)} fill={`url(#${c.id("metal")})`} stroke={ARO[aro][2]} strokeOpacity=".7" strokeWidth=".9" />
      <g transform={reduz(k, 60, cy)}>
        <Domo d={d} id={c.id("domo")} />
      </g>
      <defs>
        <GradMetal id={c.id("metal")} stops={METAL[metal]} />
        <GradAro id={c.id("aro")} cores={ARO[aro]} />
      </defs>
    </>
  );
}

function Rebite({ x, y, id, r = 2.3 }: { x: number; y: number; id: string; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill={`url(#${id})`} stroke="#000" strokeOpacity=".45" strokeWidth=".5" />;
}

function Facetas({ facetas, pal, c, piscar = 4, velPisca = "3s" }: { facetas: Faceta[]; pal: string[]; c: Ctx; piscar?: number; velPisca?: string }) {
  return (
    <>
      <g stroke={pal[3]} strokeOpacity=".28" strokeWidth=".35" strokeLinejoin="round">
        {facetas.map((f, i) => (
          <path key={i} d={f.d} fill={rampa(pal, f.t)} />
        ))}
      </g>
      {c.a &&
        c.det &&
        facetas.map((f, i) =>
          i % piscar === 1 ? (
            <path key={`p${i}`} d={f.d} fill="#fff" className="emb-pisca" style={{ animationDelay: `${(i * 0.37) % 3}s`, ...vel(velPisca) }} />
          ) : null,
        )}
    </>
  );
}

/** Mesa da pedra: plana, com o reflexo diagonal da luz. */
function Mesa({ d, pal, c }: { d: string; pal: string[]; c: Ctx }) {
  return (
    <>
      <path d={d} fill={rampa(pal, 0.6)} stroke={pal[4]} strokeOpacity=".45" strokeWidth=".5" />
      <path d={d} fill={`url(#${c.id("mesa")})`} />
      <defs>
        <linearGradient id={c.id("mesa")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".38" stopColor="#fff" stopOpacity=".06" />
          <stop offset=".6" stopColor="#000" stopOpacity=".12" />
          <stop offset="1" stopColor="#fff" stopOpacity=".18" />
        </linearGradient>
      </defs>
    </>
  );
}

function Estrela4({ x, y, r = 6, c, atraso = 0, v }: { x: number; y: number; r?: number; c: Ctx; atraso?: number; v?: string }) {
  if (!c.a || !c.det) return null;
  const q = r / 4;
  return (
    <path
      className="emb-estrela"
      d={`M${x} ${y - r} L${x + q} ${y - q} L${x + r} ${y} L${x + q} ${y + q} L${x} ${y + r} L${x - q} ${y + q} L${x - r} ${y} L${x - q} ${y - q} Z`}
      fill="#fff"
      style={{ animationDelay: `${atraso}s`, ...(v ? vel(v) : {}) }}
    />
  );
}

/** Faixa de luz que atravessa a peça. */
function Varredura({ c, clip, faixa, forca }: { c: Ctx; clip: ReactNode; faixa: Faixa; forca: number }) {
  if (!c.a) return null;
  return (
    <>
      <defs>
        <clipPath id={c.id("clip")}>{clip}</clipPath>
        <linearGradient id={c.id("brilho")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity={forca} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${c.id("clip")})`} style={{ mixBlendMode: "screen" }}>
        <rect className="emb-varre" x="0" y="-10" width="34" height="140" fill={`url(#${c.id("brilho")})`} style={vel(VEL_VARRE[faixa])} />
      </g>
    </>
  );
}

function Particulas({ c, cor, xs, y = 100, r = 1.4, v = "3s" }: { c: Ctx; cor: string | string[]; xs: number[]; y?: number; r?: number; v?: string }) {
  if (!c.a || !c.det) return null;
  return (
    <>
      {xs.map((x, i) => (
        <circle
          key={x}
          className="emb-sobe"
          cx={x + (i % 2 ? 3 : -3)}
          cy={y}
          r={r}
          fill={Array.isArray(cor) ? cor[i % cor.length] : cor}
          style={{ animationDelay: `${(i * 0.43) % 2.6}s`, ...vel(v) }}
        />
      ))}
    </>
  );
}

function Filtros({ c }: { c: Ctx }) {
  return (
    <defs>
      <filter id={c.id("sombra")} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity=".75" />
      </filter>
    </defs>
  );
}

// ---------- As dez patentes ----------

function Bronze({ c }: { c: Ctx }) {
  const d = ESCUDO.bronze;
  return (
    <>
      <EscudoMetal c={c} d={d} metal="bronze" aro="bronze" />
      {c.det && (
        <>
          <defs>
            {/* Marteladinho: relevo irregular iluminado de cima-esquerda */}
            <filter id={c.id("martelo")} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency=".16" numOctaves="2" seed="7" result="n" />
              <feDiffuseLighting in="n" surfaceScale="1.8" lightingColor="#fff" result="l">
                <feDistantLight azimuth="225" elevation="52" />
              </feDiffuseLighting>
              <feComposite in="l" in2="SourceGraphic" operator="in" />
            </filter>
            {/* Pátina: manchas verde-azuladas que se juntam nas bordas */}
            <filter id={c.id("patina")} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="3" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 .25  0 0 0 0 .62  0 0 0 0 .52  4.2 0 0 0 -1.55" result="m" />
              <feComposite in="m" in2="SourceGraphic" operator="in" />
            </filter>
            <radialGradient id={c.id("borda")} cx=".5" cy=".45" r=".6">
              <stop offset=".55" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" stopOpacity="1" />
            </radialGradient>
            <radialGradient id={c.id("rebite")} cx=".35" cy=".3" r=".8">
              <stop offset="0" stopColor="#ffe2b8" />
              <stop offset=".5" stopColor="#a86c35" />
              <stop offset="1" stopColor="#3a1f08" />
            </radialGradient>
          </defs>
          <path d={d} transform={reduz(0.9)} fill="#fff" filter={`url(#${c.id("martelo")})`} opacity=".2" style={{ mixBlendMode: "overlay" }} />
          <path d={d} fill={`url(#${c.id("borda")})`} filter={`url(#${c.id("patina")})`} opacity=".75" />
          {(
            [
              [31, 27],
              [89, 27],
              [30, 60],
              [90, 60],
              [60, 100],
            ] as P[]
          ).map(([x, y]) => (
            <Rebite key={`${x}-${y}`} x={x} y={y} id={c.id("rebite")} />
          ))}
        </>
      )}
      <Varredura c={c} faixa={0} forca={0.3} clip={<path d={d} />} />
    </>
  );
}

function Prata({ c }: { c: Ctx }) {
  const d = ESCUDO.prata;
  return (
    <>
      <EscudoMetal c={c} d={d} metal="prata" aro="prata" k={0.91} />
      {/* Borda serrilhada (contas) e filete gravado */}
      <path
        d={d}
        transform={reduz(0.83)}
        fill="none"
        stroke="#fff"
        strokeOpacity=".85"
        strokeWidth={c.det ? 1.7 : 1}
        strokeDasharray={c.det ? "0 3.1" : undefined}
        strokeLinecap="round"
      />
      {c.det && (
        <>
          <path d={d} transform={reduz(0.77)} fill="none" stroke="#3f474f" strokeOpacity=".55" strokeWidth=".7" />
          <path d={d} transform={`translate(.5 .6) ${reduz(0.77)}`} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".5" />
        </>
      )}
      <Estrela4 x={34} y={30} r={7} c={c} v="2.6s" />
      <Varredura c={c} faixa={1} forca={0.85} clip={<path d={d} />} />
    </>
  );
}

function Ouro({ c }: { c: Ctx }) {
  const d = ESCUDO.ouro;
  const louros = (
    <g>
      <path d={LOUROS.ramo} fill="none" stroke="#8a5a0a" strokeWidth="1.4" strokeLinecap="round" />
      {LOUROS.folhas.map((f, i) => (
        <ellipse
          key={i}
          cx={f.x}
          cy={f.y}
          rx="5.4"
          ry="2.2"
          transform={`rotate(${f.r} ${f.x} ${f.y})`}
          fill={`url(#${c.id("folha")})`}
          stroke="#6b4306"
          strokeWidth=".45"
        />
      ))}
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id={c.id("folha")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#e0a932" />
          <stop offset="1" stopColor="#7a4f08" />
        </linearGradient>
      </defs>
      {louros}
      <g transform="translate(120 0) scale(-1 1)">{louros}</g>
      <EscudoMetal c={c} d={d} metal="ouro" aro="ouro" k={0.9} />
      <path
        d={d}
        transform={reduz(0.84)}
        fill="none"
        stroke="#fff4c4"
        strokeOpacity=".8"
        strokeWidth={c.det ? 1.8 : 1.1}
        strokeDasharray={c.det ? "0 3" : undefined}
        strokeLinecap="round"
      />
      <path d={d} transform={reduz(0.78)} fill="none" stroke="#6b4306" strokeOpacity=".55" strokeWidth=".8" />
      <Estrela4 x={36} y={30} r={6} c={c} />
      <Estrela4 x={86} y={86} r={4} c={c} atraso={1.1} />
      <Varredura c={c} faixa={2} forca={0.6} clip={<path d={d} />} />
      <Particulas c={c} cor="#fff1b8" xs={[22, 38, 54, 70, 86, 100]} />
    </>
  );
}

/** Garras de metal que prendem a pedra. */
function Garras({ pts, id, r = 3 }: { pts: P[]; id: string; r?: number }) {
  return (
    <>
      {pts.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={`url(#${id})`} stroke="#000" strokeOpacity=".4" strokeWidth=".45" />
      ))}
    </>
  );
}
function GradGarra({ id, cores }: { id: string; cores: [string, string, string] }) {
  return (
    <radialGradient id={id} cx=".35" cy=".3" r=".8">
      <stop offset="0" stopColor={cores[0]} />
      <stop offset=".5" stopColor={cores[1]} />
      <stop offset="1" stopColor={cores[2]} />
    </radialGradient>
  );
}

/** Luz que "sai" de dentro da pedra. */
function LuzInterna({ d, id, cor, cx = ".5", cy = ".55" }: { d: string; id: string; cor: string; cx?: string; cy?: string }) {
  return (
    <>
      <radialGradient id={id} cx={cx} cy={cy} r=".55">
        <stop offset="0" stopColor={cor} stopOpacity=".45" />
        <stop offset="1" stopColor={cor} stopOpacity="0" />
      </radialGradient>
      <path d={d} fill={`url(#${id})`} style={{ mixBlendMode: "screen" }} />
    </>
  );
}

function Esmeralda({ c }: { c: Ctx }) {
  const g = ESMERALDA;
  const pal = GEMA.esmeralda;
  return (
    <>
      <defs>
        <GradAro id={c.id("bezel")} cores={ARO.ouro} />
        <GradGarra id={c.id("garra")} cores={["#fff6cf", "#d9a531", "#5a3804"]} />
      </defs>
      {/* Engaste de ouro */}
      <path d={g.contorno} fill="none" stroke={`url(#${c.id("bezel")})`} strokeWidth="6" strokeLinejoin="round" />
      <path d={g.contorno} fill={pal[1]} />
      <Facetas facetas={g.facetas} pal={pal} c={c} piscar={3} velPisca="2.6s" />
      <Mesa d={g.mesa} pal={pal} c={c} />
      {/* "Jardim": as inclusões que toda esmeralda natural tem */}
      {c.det && (
        <g stroke="#b6f5d2" strokeOpacity=".22" strokeWidth=".5" fill="none" strokeLinecap="round">
          <path d="M50 44 q4 3 9 1 t8 3" />
          <path d="M66 78 q-3 2 -7 1" />
          <path d="M47 70 l3 -2" />
        </g>
      )}
      <LuzInterna d={g.mesa} id={c.id("interna")} cor="#9dffc9" />
      <path d={g.contorno} fill="none" stroke="#012616" strokeOpacity=".7" strokeWidth=".8" />
      <Garras
        id={c.id("garra")}
        pts={[[35, 20], [85, 20], [85, 100], [35, 100]]}
      />
      <Estrela4 x={40} y={28} r={7} c={c} v="2.4s" />
      <Varredura c={c} faixa={3} forca={0.35} clip={<path d={g.contorno} />} />
    </>
  );
}

function Safira({ c }: { c: Ctx }) {
  const g = SAFIRA;
  const pal = GEMA.safira;
  // Auréola de pequenos brilhantes em volta, como nos anéis clássicos de safira.
  const aureola = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return [r1(60 + 37 * Math.cos(a)), r1(60 + 44 * Math.sin(a))] as P;
  });
  return (
    <>
      <defs>
        <GradAro id={c.id("ouroBranco")} cores={ARO.prata} />
        <radialGradient id={c.id("pedrinha")} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#dfe8f5" />
          <stop offset="1" stopColor="#7f8b99" />
        </radialGradient>
        <GradGarra id={c.id("garra")} cores={["#ffffff", "#c9d0d7", "#56606a"]} />
      </defs>
      <ellipse cx="60" cy="60" rx="37" ry="44" fill="none" stroke={`url(#${c.id("ouroBranco")})`} strokeWidth="9" />
      {aureola.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={c.det ? 3.2 : 3.6} fill={`url(#${c.id("pedrinha")})`} stroke="#56606a" strokeWidth=".4" />
          {c.a && c.det && i % 3 === 0 && (
            <circle cx={x - 0.8} cy={y - 0.8} r="1.2" fill="#fff" className="emb-pisca" style={{ animationDelay: `${i * 0.21}s`, ...vel("1.8s") }} />
          )}
        </g>
      ))}
      <path d={g.contorno} fill={pal[1]} />
      <Facetas facetas={g.facetas} pal={pal} c={c} piscar={5} velPisca="3.4s" />
      <Mesa d={g.mesa} pal={pal} c={c} />
      {/* Luz ondulando dentro da pedra */}
      {c.a && (
        <g clipPath={`url(#${c.id("oval")})`}>
          <clipPath id={c.id("oval")}>
            <path d={g.contorno} />
          </clipPath>
          <path className="emb-onda" d="M-20 74 Q0 64 20 74 T60 74 T100 74 T140 74 T180 74 V130 H-20 Z" fill={pal[3]} opacity=".16" />
        </g>
      )}
      <LuzInterna d={g.contorno} id={c.id("interna")} cor="#7fb0ff" cy=".6" />
      <path d={g.contorno} fill="none" stroke="#040b36" strokeOpacity=".8" strokeWidth=".8" />
      <Garras
        id={c.id("garra")}
        r={2.4}
        pts={[[60, 23], [89, 60], [60, 97], [31, 60]]}
      />
      <Estrela4 x={46} y={34} r={7} c={c} />
      <Varredura c={c} faixa={4} forca={0.3} clip={<path d={g.contorno} />} />
    </>
  );
}

function Ametista({ c }: { c: Ctx }) {
  const pal = GEMA.ametista;
  const rocha = "M14 104 C18 93 30 88 42 93 C50 86 70 86 78 92 C90 87 102 93 106 104 C90 112 30 112 14 104 Z";
  return (
    <>
      <defs>
        <linearGradient id={c.id("zona")} x1="0" y1="20" x2="0" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a0535" stopOpacity=".25" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#f3e6ff" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id={c.id("rocha")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4a63" />
          <stop offset=".5" stopColor="#2e2334" />
          <stop offset="1" stopColor="#140e18" />
        </linearGradient>
      </defs>
      {CRISTAIS.map((k, i) => (
        <g key={i}>
          <g stroke={pal[4]} strokeOpacity=".3" strokeWidth=".4" strokeLinejoin="round">
            {k.faces.map((f, j) => (
              <path key={j} d={f.d} fill={rampa(pal, f.t - (i < 2 ? 0.12 : 0))} />
            ))}
          </g>
          {/* Zoneamento de cor: roxo profundo na ponta, clareando pra base */}
          <path d={k.contorno} fill={`url(#${c.id("zona")})`} />
          <path d={k.contorno} fill="none" stroke={pal[0]} strokeOpacity=".7" strokeWidth=".6" strokeLinejoin="round" />
        </g>
      ))}
      <path d={rocha} fill={`url(#${c.id("rocha")})`} stroke="#0b070d" strokeWidth=".8" />
      {c.det && DRUSA.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.3} fill={i % 2 ? "#c9a4f2" : "#8a5cc4"} opacity=".85" />)}
      {CRISTAIS.slice(2).map((k, i) => (
        <Estrela4 key={i} x={k.ponta[0]} y={k.ponta[1] + 2} r={i === 2 ? 7 : 5} c={c} atraso={i * 0.7} v="2.8s" />
      ))}
      <Varredura c={c} faixa={5} forca={0.3} clip={<path d={CRISTAIS.map((k) => k.contorno).join(" ")} />} />
    </>
  );
}

function Rubi({ c }: { c: Ctx }) {
  const g = RUBI;
  const pal = GEMA.rubi;
  return (
    <>
      <defs>
        <GradAro id={c.id("bezel")} cores={ARO.ouro} />
        <GradGarra id={c.id("garra")} cores={["#fff6cf", "#d9a531", "#5a3804"]} />
      </defs>
      <path d={g.contorno} fill="none" stroke={`url(#${c.id("bezel")})`} strokeWidth="5.5" strokeLinejoin="round" />
      <path d={g.contorno} fill={pal[1]} />
      <Facetas facetas={g.facetas} pal={pal} c={c} piscar={7} velPisca="1.6s" />
      <Mesa d={g.mesa} pal={pal} c={c} />
      <LuzInterna d={g.contorno} id={c.id("interna")} cor="#ff4058" cy=".55" />
      <path d={g.contorno} fill="none" stroke="#2e0006" strokeOpacity=".8" strokeWidth=".8" />
      <Garras
        id={c.id("garra")}
        pts={[[31, 31], [89, 31], [89, 89], [31, 89]]}
      />
      <Estrela4 x={42} y={40} r={7} c={c} v="1.6s" />
      <Varredura c={c} faixa={6} forca={0.35} clip={<path d={g.contorno} />} />
    </>
  );
}

function Platina({ c }: { c: Ctx }) {
  const d = ESCUDO.platina;
  const b = BRILHANTE_PLATINA;
  return (
    <>
      <EscudoMetal c={c} d={d} metal="platina" aro="platina" k={0.9} />
      {c.det && (
        <>
          <defs>
            {/* Escovado: riscos finos na horizontal, típico da platina */}
            <filter id={c.id("escovado")} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency=".008 .9" numOctaves="2" seed="11" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.4 0 0 0 -.9" result="m" />
              <feComposite in="m" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <path d={d} transform={reduz(0.9)} fill="#fff" filter={`url(#${c.id("escovado")})`} opacity=".35" />
        </>
      )}
      {/* Reflexo gelado */}
      <path d={d} transform={reduz(0.9)} fill="#22d3ee" opacity=".1" style={{ mixBlendMode: "screen" }} />
      <path d={d} transform={reduz(0.8)} fill="none" stroke="#46545e" strokeOpacity=".5" strokeWidth=".8" />
      <path d={d} transform={`translate(.5 .6) ${reduz(0.8)}`} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".5" />
      {/* Brilhante cravado no topo */}
      <defs>
        <GradGarra id={c.id("garra")} cores={["#ffffff", "#c9d6de", "#4a5862"]} />
      </defs>
      <circle cx="60" cy="21" r="11" fill={`url(#${c.id("garra")})`} stroke="#46545e" strokeWidth=".6" />
      <path d={b.contorno} fill={GEMA.gelo[1]} />
      <Facetas facetas={b.facetas} pal={GEMA.gelo} c={c} piscar={3} velPisca="2s" />
      <Mesa d={b.mesa} pal={GEMA.gelo} c={c} />
      <Estrela4 x={64} y={17} r={8} c={c} v="2.4s" />
      <Estrela4 x={40} y={40} r={5} c={c} atraso={1.2} />
      <Varredura c={c} faixa={7} forca={0.7} clip={<path d={d} />} />
    </>
  );
}

function Diamante({ c }: { c: Ctx }) {
  const g = BRILHANTE_DIAMANTE;
  const pal = GEMA.diamante;
  const garras = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [r1(60 + 42 * Math.cos(a)), r1(60 + 42 * Math.sin(a))] as P;
  });
  return (
    <>
      <defs>
        <GradAro id={c.id("aro")} cores={ARO.platina} />
        <GradGarra id={c.id("garra")} cores={["#ffffff", "#c9d6de", "#4a5862"]} />
      </defs>
      {/* Aro de platina + a pedra */}
      <circle cx="60" cy="60" r="43" fill="none" stroke={`url(#${c.id("aro")})`} strokeWidth="5" />
      <path d={g.contorno} fill={pal[1]} />
      <Facetas facetas={g.facetas} pal={pal} c={c} piscar={3} velPisca="2.4s" />
      {/* Fogo: a luz branca se abre em cores nas facetas */}
      {g.facetas.map((f, i) =>
        i % 3 === 1 ? (
          <path
            key={`f${i}`}
            d={f.d}
            fill={FOGO[i % FOGO.length]}
            opacity={c.a && c.det ? undefined : 0.6}
            className={c.a && c.det ? "emb-pisca" : undefined}
            style={{ mixBlendMode: "screen", animationDelay: `${(i * 0.41) % 2.4}s`, ...vel("2.4s") }}
          />
        ) : null,
      )}
      <Mesa d={g.mesa} pal={pal} c={c} />
      <path d={g.contorno} fill="none" stroke="#0b1017" strokeWidth=".9" />
      <Garras pts={garras} id={c.id("garra")} r={3.6} />
      <Estrela4 x={40} y={36} r={10} c={c} v="2.2s" />
      <Estrela4 x={86} y={84} r={6} c={c} atraso={1.1} />
      <Estrela4 x={100} y={22} r={5} c={c} atraso={1.7} />
      <Varredura c={c} faixa={8} forca={0.5} clip={<path d={g.contorno} />} />
    </>
  );
}

function Lendario({ c, nivel, mostrarNumero }: { c: Ctx; nivel: number; mostrarNumero: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id={c.id("raio")} cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
          <stop offset=".25" stopColor="#fff3c4" stopOpacity=".95" />
          <stop offset=".6" stopColor="#f5c451" stopOpacity=".5" />
          <stop offset="1" stopColor="#f5c451" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c.id("sol")} cx="60" cy="60" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff6d0" stopOpacity=".6" />
          <stop offset=".5" stopColor="#ffd766" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c.id("onix")} cx=".4" cy=".3" r=".8">
          <stop offset="0" stopColor="#3a3a44" />
          <stop offset=".4" stopColor="#101014" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <radialGradient id={c.id("pedra")} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#e6ecf2" />
          <stop offset="1" stopColor="#7d8894" />
        </radialGradient>
        <GradMetal id={c.id("ouro")} stops={METAL.lendario} />
        <GradAro id={c.id("aro")} cores={ARO.lendario} />
        <linearGradient id={c.id("numero")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset=".55" stopColor="#ffd766" />
          <stop offset="1" stopColor="#c58a1a" />
        </linearGradient>
      </defs>

      {/* Raios de sol girando devagar + disco de luz que respira */}
      <g className={c.a ? "emb-gira" : undefined} style={vel("40s")}>
        <path d={RAIOS} fill={`url(#${c.id("raio")})`} />
      </g>
      <circle
        cx="60"
        cy="60"
        r="50"
        fill={`url(#${c.id("sol")})`}
        className={c.a ? "emb-aura" : undefined}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />

      {/* Ombros do anel aparecendo em cima e embaixo */}
      <path d="M46 12 Q60 2 74 12 L70 16 Q60 10 50 16 Z" fill={`url(#${c.id("ouro")})`} stroke="#4d2f02" strokeWidth=".7" />
      <path d="M46 108 Q60 118 74 108 L70 104 Q60 110 50 104 Z" fill={`url(#${c.id("ouro")})`} stroke="#4d2f02" strokeWidth=".7" />

      {/* Cabeça do anel: ouro com borda serrilhada */}
      <circle cx="60" cy="60" r="49" fill={`url(#${c.id("aro")})`} stroke="#3a2302" strokeWidth="1" />
      <circle cx="60" cy="60" r="46" fill={`url(#${c.id("ouro")})`} stroke="#4d2f02" strokeWidth=".6" />
      {c.det && (
        <circle cx="60" cy="60" r="47.5" fill="none" stroke="#fffbe6" strokeOpacity=".7" strokeWidth=".8" strokeDasharray="0 2.4" strokeLinecap="round" />
      )}

      {/* Auréola: diamantes, e as nove pedras da jornada na metade de baixo */}
      {AUREOLA.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.6" fill={p.cor ?? `url(#${c.id("pedra")})`} stroke={p.cor ? "#4d2f02" : "#6b5a3a"} strokeWidth=".5" />
          <circle cx={p.x - 1} cy={p.y - 1.1} r="1.1" fill="#fff" opacity={p.cor ? 0.8 : 0.95} />
          {!p.cor && i % 5 === 2 && <circle cx={p.x + 0.6} cy={p.y + 0.5} r="1.3" fill={FOGO[i % FOGO.length]} opacity=".6" />}
          {c.a && c.det && i % 3 === 0 && (
            <circle cx={p.x} cy={p.y} r="2.2" fill="#fff" className="emb-pisca" style={{ animationDelay: `${(i * 0.27) % 2.4}s`, ...vel("2.4s") }} />
          )}
        </g>
      ))}

      {/* Ônix polido: o centro fica limpo, só o número em ouro */}
      <circle cx="60" cy="60" r="34" fill={`url(#${c.id("aro")})`} stroke="#4d2f02" strokeWidth=".8" />
      <circle cx="60" cy="60" r="31" fill={`url(#${c.id("onix")})`} />
      <path d="M36 50 Q44 32 64 30 Q48 36 40 52 Z" fill="#fff" opacity=".18" />

      <Varredura
        c={c}
        faixa={9}
        forca={0.6}
        clip={
          <>
            <circle cx="60" cy="60" r="49" />
            <path d="M46 12 Q60 2 74 12 L70 16 Q60 10 50 16 Z M46 108 Q60 118 74 108 L70 104 Q60 110 50 104 Z" />
          </>
        }
      />

      {mostrarNumero && (
        <text
          x="60"
          y={NUMERO_Y[9]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={numero(c, nivel, 9).fontSize}
          fontWeight="900"
          fill={`url(#${c.id("numero")})`}
          stroke="#000"
          strokeWidth={numero(c, nivel, 9).strokeWidth}
          paintOrder="stroke"
          style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-1px" }}
        >
          {nivel}
        </text>
      )}

      {/* Brasas subindo e brilhos */}
      <Particulas c={c} cor={["#ffe391", "#ffffff", "#ffb347"]} xs={[10, 22, 34, 86, 98, 110]} y={96} r={1.5} v="2.6s" />
      <Estrela4 x={30} y={26} r={9} c={c} v="2.4s" />
      <Estrela4 x={94} y={88} r={6} c={c} atraso={0.9} />
      <Estrela4 x={100} y={24} r={5} c={c} atraso={1.6} />
    </>
  );
}

const PECAS = [Bronze, Prata, Ouro, Esmeralda, Safira, Ametista, Rubi, Platina, Diamante];

export function EmblemaPatente({
  nivel,
  tamanho = 112,
  animar = true,
  mostrarNumero = true,
  mostrarDivisao = false,
  halo = true,
  className = "",
}: {
  nivel: number;
  tamanho?: number;
  animar?: boolean;
  mostrarNumero?: boolean;
  /** Marcas da divisão (IV..I) embaixo do emblema. */
  mostrarDivisao?: boolean;
  /** Brilho de fundo na cor da patente. Desligado nas miniaturas (selo da foto). */
  halo?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const faixa = faixaDoNivel(nivel);
  const m = MATERIAIS[faixa];
  const cor = levelColor(nivel);
  const det = tamanho >= 60;
  const c: Ctx = { id: (s) => `${uid}-${s}`, a: animar, det, mini: tamanho < 48 };
  const marcas = marcasDaDivisao(nivel);
  const Peca = faixa < 9 ? PECAS[faixa] : null;

  return (
    <span
      className={`relative inline-flex shrink-0 flex-col items-center ${className}`}
      role="img"
      aria-label={`Patente ${levelMaterial(nivel)} ${levelSubTier(nivel)}, nível ${nivel}`}
    >
      <span className={`relative block ${animar && faixa >= 7 ? "emb-flutua" : ""}`} style={{ width: tamanho, height: tamanho }}>
        {/* Halo de fundo na cor da patente; no Lendário vira aura viva. */}
        {halo && (
        <span
          aria-hidden
          className={`pointer-events-none absolute rounded-full blur-xl ${animar && faixa === 9 ? "emb-aura" : ""}`}
          style={{
            inset: faixa === 9 ? "-4%" : "8%",
            background:
              faixa === 9
                ? "radial-gradient(circle, #ffd76699, #f5a62333 45%, transparent 70%)"
                : `radial-gradient(circle, ${faixa === 8 ? "#dfe9ff" : cor}${faixa >= 7 ? "5c" : faixa >= 3 ? "40" : "2b"}, transparent 68%)`,
          }}
        />
        )}
        {halo && faixa === 8 && (
          <span
            aria-hidden
            className={`pointer-events-none absolute rounded-full opacity-50 ${animar ? "emb-iris" : ""}`}
            style={{
              inset: "3%",
              background: "conic-gradient(from 0deg, #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff, #7cffcb, #fffc7c, #ff6ad5)",
              WebkitMask: "radial-gradient(circle, transparent 60%, #000 62%, #000 64%, transparent 66%)",
              mask: "radial-gradient(circle, transparent 60%, #000 62%, #000 64%, transparent 66%)",
            }}
          />
        )}

        <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} className="emb relative overflow-visible" aria-hidden>
          {det && <Filtros c={c} />}
          <g filter={det ? `url(#${c.id("sombra")})` : undefined}>
            {Peca ? (
              <g className={animar && faixa === 6 ? "emb-pulsa" : undefined}>
                <Peca c={c} />
                {mostrarNumero && (
                  <text
                    x="60"
                    y={NUMERO_Y[faixa]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={numero(c, nivel, faixa).fontSize}
                    fontWeight="900"
                    fill="#fff"
                    stroke={m.escuro}
                    strokeWidth={numero(c, nivel, faixa).strokeWidth}
                    paintOrder="stroke"
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-1px",
                    }}
                  >
                    {nivel}
                  </text>
                )}
              </g>
            ) : (
              <Lendario c={c} nivel={nivel} mostrarNumero={mostrarNumero} />
            )}
          </g>
        </svg>
      </span>

      {mostrarDivisao && (
        <span className="mt-1 flex items-center gap-1" aria-hidden title={`Divisão ${levelSubTier(nivel)}`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rotate-45 rounded-[1px]"
              style={i < marcas ? { background: cor, boxShadow: `0 0 6px ${cor}` } : { background: "rgba(255,255,255,0.12)" }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
