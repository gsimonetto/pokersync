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
//   Rubi      rubi lapidado em coração -- o naipe de copas -- pulsando
//   Platina   escudo de platina escovada, alado, com um brilhante no topo
//   Diamante  diamante rosa (o mais raro que existe) visto de lado, alado,
//             com o "fogo" colorido que a lapidação solta
//   Lendário  o brasão supremo: escudo de obsidiana com céu estrelado,
//             coroa cravejada, asas de ouro, raios de sol girando e as
//             nove pedras de todas as patentes anteriores contornando o
//             escudo -- quem chega lá carrega a jornada inteira no peito.
//
// Nível de detalhe por tamanho: abaixo de 60px somem textura, rebites,
// penas finas e partículas (viram ruído); fica a silhueta e o material.
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
  const contorno = poli(Array.from({ length: n * 2 }, (_, k) => p(k / (n * 2), 1)));
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

// Rubi: coração (a curva clássica do coração, escalada pro quadro).
function coracao(t: number): P {
  const a = t * Math.PI * 2;
  return [16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))];
}
const RUBI = brilhante(
  (t, s) => {
    const [x, y] = coracao(t);
    return [60 + s * 2.55 * x, 58 + s * 2.55 * (y - 2.5)];
  },
  16,
  0.48,
  0.74,
);

// Brilhantes redondos pequenos (topo da Platina, coroa do Lendário).
const redondo = (cx: number, cy: number, r: number) =>
  brilhante((t, s) => {
    const a = t * Math.PI * 2 - Math.PI / 2;
    return [cx + s * r * Math.cos(a), cy + s * r * Math.sin(a)];
  }, 8);
const BRILHANTE_PLATINA = redondo(60, 21, 9);

// Diamante visto de lado: coroa (em cima da cintura) + pavilhão até a culaça.
const DIAMANTE = (() => {
  const g: P[] = [22, 34.7, 47.3, 60, 72.7, 85.3, 98].map((x) => [x, 49]);
  const m: P[] = [42, 54, 66, 78].map((x) => [x, 30]);
  const culaca: P = [60, 109];
  const coroa: P[][] = [
    [m[0], g[0], g[1]],
    [m[0], g[1], g[2]],
    [m[0], g[2], m[1]],
    [m[1], g[2], g[3]],
    [m[1], g[3], m[2]],
    [m[2], g[3], g[4]],
    [m[2], g[4], m[3]],
    [m[3], g[4], g[5]],
    [m[3], g[5], g[6]],
  ];
  const tc = [0.92, 0.62, 0.98, 0.42, 0.86, 0.36, 0.72, 0.3, 0.5];
  const facetas: (Faceta & { fogo?: string })[] = coroa.map((pts, i) => ({
    d: poli(pts),
    t: tc[i],
  }));
  const tp = [0.72, 0.28, 0.5, 0.9, 0.2, 0.62, 0.38, 0.8, 0.16, 0.56, 0.3, 0.1, 0.46, 0.7, 0.22, 0.34, 0.12, 0.4];
  const fogo = ["#7cd8ff", "#fff27c", "#9dffb0", "#c9a0ff", "#ffb07c"];
  for (let i = 0; i < 6; i++) {
    const meio: P = [(g[i][0] + g[i + 1][0]) / 2, 49];
    const q: P = [meio[0] + (culaca[0] - meio[0]) * 0.42, 49 + (culaca[1] - 49) * 0.42];
    [
      [g[i], g[i + 1], q],
      [g[i], q, culaca],
      [g[i + 1], culaca, q],
    ].forEach((pts, j) => {
      const k = i * 3 + j;
      facetas.push({
        d: poli(pts as P[]),
        t: tp[k],
        fogo: k % 4 === 1 ? fogo[k % fogo.length] : undefined,
      });
    });
  }
  const contorno = poli([m[0], m[3], g[6], culaca, g[0]]);
  return { facetas, contorno, mesa: `M${m[0][0]} 30 H${m[3][0]}` };
})();

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

// Penas: cada asa é um leque de penas em fileiras (a de cima, mais curta,
// cobre a base das compridas). Desenha a asa esquerda; a direita é espelho.
interface Fileira {
  n: number;
  a0: number;
  a1: number;
  L: number;
  w: number;
}
function asa(px: number, py: number, fileiras: Fileira[]) {
  const penas: { d: string; eixo: string; t: number }[] = [];
  fileiras.forEach((f, fi) => {
    for (let k = 0; k < f.n; k++) {
      const graus = f.a0 + ((f.a1 - f.a0) * k) / Math.max(1, f.n - 1);
      const a = (graus * Math.PI) / 180;
      const L = f.L * (0.62 + 0.38 * Math.sin((Math.PI * (k + 0.5)) / f.n));
      const T = ([x, y]: P): string => `${r1(px + x * Math.cos(a) - y * Math.sin(a))} ${r1(py + x * Math.sin(a) + y * Math.cos(a))}`;
      const w = f.w;
      penas.push({
        d: `M${T([0, 0])} C${T([L * 0.25, -w])} ${T([L * 0.72, -w * 0.95])} ${T([L, 0])} C${T([L * 0.72, w * 0.6])} ${T([L * 0.25, w * 0.75])} ${T([0, 0])} Z`,
        eixo: `M${T([L * 0.08, 0])} L${T([L * 0.86, 0])}`,
        t: fi / Math.max(1, fileiras.length - 1),
      });
    }
  });
  return penas;
}
const ASA_PLATINA = asa(40, 52, [
  { n: 7, a0: 172, a1: 244, L: 42, w: 4.6 },
  { n: 5, a0: 184, a1: 234, L: 27, w: 5 },
]);
const ASA_DIAMANTE = asa(38, 46, [
  { n: 7, a0: 170, a1: 246, L: 42, w: 4.4 },
  { n: 5, a0: 182, a1: 236, L: 26, w: 4.8 },
]);
const ASA_LENDARIO = asa(44, 60, [
  { n: 9, a0: 168, a1: 262, L: 52, w: 4.4 },
  { n: 7, a0: 176, a1: 252, L: 38, w: 4.8 },
  { n: 5, a0: 188, a1: 242, L: 23, w: 5.2 },
]);

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

// Céu estrelado dentro do escudo de obsidiana.
const ESTRELAS_CEU: [number, number, number][] = [
  [44, 50, 0.6],
  [52, 46, 0.4],
  [71, 48, 0.7],
  [78, 56, 0.4],
  [42, 64, 0.5],
  [79, 70, 0.6],
  [48, 80, 0.4],
  [70, 84, 0.5],
  [58, 90, 0.4],
  [64, 50, 0.35],
  [40, 74, 0.35],
  [76, 80, 0.3],
];

// As nove pedras da jornada, contornando o escudo do Lendário
// (Bronze no alto à esquerda, descendo, passando pela ponta e subindo até o Diamante).
const JORNADA: { x: number; y: number; cor: string }[] = [
  { x: 37.5, y: 49, cor: "#c98d52" },
  { x: 37.5, y: 61, cor: "#e9edf1" },
  { x: 39.5, y: 74, cor: "#f2c94c" },
  { x: 45, y: 86, cor: "#12a15a" },
  { x: 60, y: 99, cor: "#2f63e0" },
  { x: 75, y: 86, cor: "#9a4ee0" },
  { x: 80.5, y: 74, cor: "#d42a3c" },
  { x: 82.5, y: 61, cor: "#bfe9f2" },
  { x: 82.5, y: 49, cor: "#f06aa8" },
];

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
  { claro: "#FFFFFF", base: "#f472b6", escuro: "#4A0B2C" }, // Diamante
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
  rosa: [[0, "#ffffff"], [0.3, "#f6e3ec"], [0.5, "#c7a3b5"], [0.56, "#9d7488"], [0.8, "#ecd3df"], [1, "#6e4a5c"]],
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
  diamante: ["#4a0b2c", "#a3285f", "#f06aa8", "#ffc9e0", "#ffffff"],
  gelo: ["#0a3f4d", "#3a98ad", "#a7ecf7", "#eafcff", "#ffffff"],
};

const ESCUDO = {
  bronze: "M24 22 Q60 12 96 22 V58 C96 84 80 99 60 108 C40 99 24 84 24 58 Z",
  prata: "M22 20 Q42 22 60 11 Q78 22 98 20 V58 C98 85 81 100 60 110 C39 100 22 85 22 58 Z",
  ouro: "M27 24 Q35 14 45 20 Q52 10 60 9 Q68 10 75 20 Q85 14 93 24 V58 C93 84 78 99 60 108 C42 99 27 84 27 58 Z",
  platina: "M32 25 Q60 15 88 25 V60 C88 84 75 97 60 106 C45 97 32 84 32 60 Z",
  lendario: "M36 41 Q60 35 84 41 V66 C84 86 73 97 60 105 C47 97 36 86 36 66 Z",
};
const COROA = "M36 42 L33 21 L40.5 29 L46 15 L53 26 L60 6 L67 26 L74 15 L79.5 29 L87 21 L84 42 Z";

const VEL_VARRE = ["7s", "3.4s", "4.6s", "5s", "6s", "5.5s", "4.5s", "3.8s", "3.2s", "3.6s"];
const NUMERO_Y = [62, 62, 62, 62, 62, 66, 56, 67, 63, 71];

export function EmblemaEstilos() {
  return (
    <style>{`
      /* Só os elementos animados giram/escalam em torno do próprio centro;
         uma regra geral mexeria também nos transform="" fixos (asa
         espelhada, louros) e os tiraria do lugar. */
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
      @keyframes embBate { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(5deg); } }
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
      .emb-bate { animation: embBate 3.2s ease-in-out infinite; transform-box: view-box; }
      @media (prefers-reduced-motion: reduce) {
        .emb-varre, .emb-sobe, .emb-pisca, .emb-onda, .emb-gira, .emb-pulsa, .emb-estrela, .emb-iris, .emb-aura, .emb-flutua, .emb-bate { animation: none !important; }
      }
    `}</style>
  );
}

// ---------- Peças reutilizáveis ----------

interface Ctx {
  id: (s: string) => string;
  a: boolean;
  det: boolean;
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

function Asa({ penas, c, metal, animar = false, pivo }: { penas: ReturnType<typeof asa>; c: Ctx; metal: string; animar?: boolean; pivo: P }) {
  const lado = (espelho: boolean) => (
    <g transform={espelho ? "translate(120 0) scale(-1 1)" : undefined}>
      <g className={animar && c.a ? "emb-bate" : undefined} style={animar ? { transformOrigin: `${pivo[0]}px ${pivo[1]}px` } : undefined}>
        {penas.map((p, i) => (
          <g key={i}>
            <path d={p.d} fill={`url(#${c.id("pena")})`} stroke={ARO[metal]?.[2] ?? "#333"} strokeOpacity=".75" strokeWidth=".55" strokeLinejoin="round" />
            {p.t > 0 && <path d={p.d} fill="#fff" opacity={0.08 * p.t} />}
            {c.det && <path d={p.eixo} stroke="#fff" strokeOpacity=".35" strokeWidth=".45" strokeLinecap="round" />}
          </g>
        ))}
      </g>
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id={c.id("pena")} x1="0" y1="0" x2="1" y2="1">
          {METAL[metal].map(([o, cor]) => (
            <stop key={o} offset={o} stopColor={cor} />
          ))}
        </linearGradient>
      </defs>
      {lado(false)}
      {lado(true)}
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
      <LuzInterna d={g.contorno} id={c.id("interna")} cor="#ff5a6e" cy=".5" />
      <path d={g.contorno} fill="none" stroke="#2e0006" strokeOpacity=".8" strokeWidth=".8" />
      <Garras
        id={c.id("garra")}
        pts={[[36, 30], [84, 30], [60, 94]]}
      />
      <Estrela4 x={40} y={38} r={7} c={c} v="1.6s" />
      <Varredura c={c} faixa={6} forca={0.35} clip={<path d={g.contorno} />} />
    </>
  );
}

function Platina({ c }: { c: Ctx }) {
  const d = ESCUDO.platina;
  const b = BRILHANTE_PLATINA;
  return (
    <>
      <Asa penas={ASA_PLATINA} c={c} metal="platina" pivo={[40, 52]} />
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
  const g = DIAMANTE;
  const pal = GEMA.diamante;
  return (
    <>
      <Asa penas={ASA_DIAMANTE} c={c} metal="rosa" pivo={[38, 46]} />
      <path d={g.contorno} fill={pal[1]} stroke="#4a0b2c" strokeWidth="1.2" strokeLinejoin="round" />
      <g stroke="#ffe3ef" strokeOpacity=".4" strokeWidth=".4" strokeLinejoin="round">
        {g.facetas.map((f, i) => (
          <path key={i} d={f.d} fill={rampa(pal, f.t)} />
        ))}
      </g>
      {/* Fogo: a luz se abre em cores dentro da pedra */}
      {g.facetas.map((f, i) =>
        f.fogo ? (
          <path
            key={`f${i}`}
            d={f.d}
            fill={f.fogo}
            opacity={c.a && c.det ? undefined : 0.3}
            className={c.a && c.det ? "emb-pisca" : undefined}
            style={{
              mixBlendMode: "screen",
              animationDelay: `${(i * 0.41) % 2.4}s`,
              ...vel("2.4s"),
            }}
          />
        ) : null,
      )}
      {c.a &&
        c.det &&
        g.facetas.map((f, i) =>
          i % 5 === 2 ? (
            <path key={`p${i}`} d={f.d} fill="#fff" className="emb-pisca" style={{ animationDelay: `${(i * 0.53) % 3}s`, ...vel("2.2s") }} />
          ) : null,
        )}
      <path d={g.mesa} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M22 49 H98" stroke="#fff" strokeOpacity=".55" strokeWidth=".7" />
      <path d={g.contorno} fill="none" stroke="#4a0b2c" strokeOpacity=".9" strokeWidth=".9" strokeLinejoin="round" />
      <Estrela4 x={44} y={30} r={9} c={c} v="2.2s" />
      <Estrela4 x={18} y={22} r={5} c={c} atraso={0.6} />
      <Estrela4 x={102} y={30} r={6} c={c} atraso={1.2} />
      <Estrela4 x={92} y={98} r={5} c={c} atraso={1.8} />
      <Varredura c={c} faixa={8} forca={0.55} clip={<path d={g.contorno} />} />
    </>
  );
}

function Lendario({ c, nivel, mostrarNumero }: { c: Ctx; nivel: number; mostrarNumero: boolean }) {
  const d = ESCUDO.lendario;
  return (
    <>
      <defs>
        <radialGradient id={c.id("raio")} cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
          <stop offset=".25" stopColor="#fff3c4" stopOpacity=".95" />
          <stop offset=".6" stopColor="#f5c451" stopOpacity=".55" />
          <stop offset="1" stopColor="#f5c451" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c.id("sol")} cx="60" cy="62" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff6d0" stopOpacity=".7" />
          <stop offset=".45" stopColor="#ffd766" stopOpacity=".28" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c.id("obsidiana")} cx=".45" cy=".3" r=".85">
          <stop offset="0" stopColor="#3b2d63" />
          <stop offset=".45" stopColor="#170f2e" />
          <stop offset="1" stopColor="#040308" />
        </radialGradient>
        <radialGradient id={c.id("nebulosa")} cx=".62" cy=".62" r=".45">
          <stop offset="0" stopColor="#f5c451" stopOpacity=".28" />
          <stop offset="1" stopColor="#f5c451" stopOpacity="0" />
        </radialGradient>
        <GradMetal id={c.id("ouro")} stops={METAL.lendario} />
        <GradAro id={c.id("aro")} cores={ARO.lendario} />
        <GradGarra id={c.id("perola")} cores={["#ffffff", "#f3ead8", "#9c8a66"]} />
        <linearGradient id={c.id("numero")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset=".55" stopColor="#ffd766" />
          <stop offset="1" stopColor="#c58a1a" />
        </linearGradient>
      </defs>

      {/* Raios de sol girando atrás de tudo + anel pontilhado no sentido contrário */}
      <g className={c.a ? "emb-gira" : undefined} style={vel("40s")}>
        <path d={RAIOS} fill={`url(#${c.id("raio")})`} />
      </g>
      {c.det && (
        <g className={c.a ? "emb-gira" : undefined} style={{ ...vel("60s"), animationDirection: "reverse" }}>
          <circle cx="60" cy="60" r="53" fill="none" stroke="#ffe391" strokeOpacity=".55" strokeWidth=".8" strokeDasharray="0.6 4.2" strokeLinecap="round" />
        </g>
      )}

      {/* Disco de luz: o brasão parece sair de dentro do sol */}
      <circle cx="60" cy="62" r="46" fill={`url(#${c.id("sol")})`} className={c.a ? "emb-aura" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center" }} />

      <Asa penas={ASA_LENDARIO} c={c} metal="lendario" animar pivo={[44, 60]} />

      {/* Escudo: aro de ouro duplo com face de obsidiana e céu estrelado */}
      <path d={d} fill={`url(#${c.id("aro")})`} stroke="#3a2302" strokeWidth="1.2" strokeLinejoin="round" transform={reduz(1.1, 60, 70)} />
      <path d={d} fill={`url(#${c.id("ouro")})`} stroke="#4d2f02" strokeWidth=".8" transform={reduz(1.02, 60, 70)} />
      <path d={d} fill={`url(#${c.id("obsidiana")})`} stroke="#8a5a0a" strokeWidth=".8" transform={reduz(0.9, 60, 70)} />
      <g transform={reduz(0.9, 60, 70)}>
        <path d={d} fill={`url(#${c.id("nebulosa")})`} />
        {c.det &&
          ESTRELAS_CEU.map(([x, y, r], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill="#fff"
              className={c.a && i % 3 === 0 ? "emb-pisca" : undefined}
              style={{ animationDelay: `${i * 0.3}s`, ...vel("2.6s") }}
              opacity={c.a && i % 3 === 0 ? undefined : 0.75}
            />
          ))}
        <Domo d={d} id={c.id("domo")} forca={0.8} />
      </g>
      {/* Filigrana nos cantos */}
      {c.det && (
        <g fill="none" stroke="#ffe391" strokeWidth=".7" strokeLinecap="round" opacity=".85">
          <path d="M42 50 q2 -5 8 -4 q-2 3 -5 2" />
          <path d="M78 50 q-2 -5 -8 -4 q2 3 5 2" />
        </g>
      )}

      {/* As nove pedras da jornada */}
      {JORNADA.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={c.det ? 2.7 : 2.4} fill={p.cor} stroke="#4d2f02" strokeWidth=".7" />
          <circle cx={p.x - 0.8} cy={p.y - 0.9} r=".9" fill="#fff" opacity=".85" />
          {c.a && c.det && <circle cx={p.x - 0.6} cy={p.y - 0.7} r="1.3" fill="#fff" className="emb-pisca" style={{ animationDelay: `${i * 0.33}s`, ...vel("3s") }} />}
        </g>
      ))}

      {/* Coroa cravejada */}
      <path d={COROA} fill={`url(#${c.id("ouro")})`} stroke="#4d2f02" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M35 36 H85 V42 H35 Z" fill={`url(#${c.id("aro")})`} stroke="#4d2f02" strokeWidth=".7" />
      {c.det && <path d="M36 36 H84" stroke="#fffbe6" strokeOpacity=".8" strokeWidth=".6" />}
      {(
        [
          [33, 21],
          [46, 15],
          [74, 15],
          [87, 21],
        ] as P[]
      ).map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.4" fill={`url(#${c.id("perola")})`} stroke="#4d2f02" strokeWidth=".5" />
      ))}
      <ellipse cx="46" cy="39" rx="2.4" ry="1.8" fill={GEMA.safira[2]} stroke="#4d2f02" strokeWidth=".5" />
      <ellipse cx="74" cy="39" rx="2.4" ry="1.8" fill={GEMA.esmeralda[2]} stroke="#4d2f02" strokeWidth=".5" />
      <ellipse cx="60" cy="31" rx="3.4" ry="4.4" fill={GEMA.rubi[2]} stroke="#4d2f02" strokeWidth=".6" />
      <ellipse cx="59" cy="29.5" rx="1" ry="1.4" fill="#fff" opacity=".7" />
      {/* Estrela-brilhante no topo */}
      <path d="M60 0 L62.2 4.8 L67 7 L62.2 9.2 L60 14 L57.8 9.2 L53 7 L57.8 4.8 Z" fill="#fff" stroke="#f5c451" strokeWidth=".5" />

      <Varredura
        c={c}
        faixa={9}
        forca={0.7}
        clip={
          <>
            <path d={COROA} />
            <path d={d} transform={reduz(1.1, 60, 70)} />
          </>
        }
      />

      {/* Brasas e brilhos */}
      <Particulas c={c} cor={["#ffe391", "#ffffff", "#ffb347"]} xs={[14, 24, 34, 46, 56, 66, 76, 88, 98, 106]} y={98} r={1.6} v="2.4s" />
      <Estrela4 x={60} y={7} r={11} c={c} v="2.4s" />
      <Estrela4 x={14} y={26} r={6} c={c} atraso={0.5} />
      <Estrela4 x={106} y={34} r={5} c={c} atraso={1.1} />
      <Estrela4 x={100} y={100} r={6} c={c} atraso={1.7} />
      <Estrela4 x={20} y={96} r={4} c={c} atraso={0.9} />

      {/* O número em ouro */}
      {mostrarNumero && (
        <text
          x="60"
          y={NUMERO_Y[9]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={nivel >= 10 ? 26 : 30}
          fontWeight="900"
          fill={`url(#${c.id("numero")})`}
          stroke="#1a1002"
          strokeWidth="3.6"
          paintOrder="stroke"
          style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-1px" }}
        >
          {nivel}
        </text>
      )}
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
  className = "",
}: {
  nivel: number;
  tamanho?: number;
  animar?: boolean;
  mostrarNumero?: boolean;
  /** Marcas da divisão (IV..I) embaixo do emblema. */
  mostrarDivisao?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const faixa = faixaDoNivel(nivel);
  const m = MATERIAIS[faixa];
  const cor = levelColor(nivel);
  const det = tamanho >= 60;
  const c: Ctx = { id: (s) => `${uid}-${s}`, a: animar, det };
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
        <span
          aria-hidden
          className={`pointer-events-none absolute rounded-full blur-xl ${animar && faixa === 9 ? "emb-aura" : ""}`}
          style={{
            inset: faixa === 9 ? "-4%" : "8%",
            background:
              faixa === 9
                ? "radial-gradient(circle, #ffd76699, #f5a62333 45%, transparent 70%)"
                : `radial-gradient(circle, ${cor}${faixa >= 7 ? "5c" : faixa >= 3 ? "40" : "2b"}, transparent 68%)`,
          }}
        />
        {faixa === 8 && (
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
                    fontSize={nivel >= 10 ? 30 : 34}
                    fontWeight="900"
                    fill="#fff"
                    stroke={m.escuro}
                    strokeWidth="4"
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
