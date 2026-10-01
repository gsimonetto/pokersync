import type { CSSProperties } from "react";
import type { EstiloMesa } from "@/lib/hooks/use-preferencias-mesa";

/* Acabamento da mesa (pedido explícito: "mais realismo e qualidade, a
   madeira precisa ser melhorada"). Só a parte de MATERIAL -- borda,
   filete/LED e textura do feltro. Geometria, assentos e cartas
   continuam em poker-table.tsx.
     Luxo:  borda de nogueira envernizada feita em GOMOS, como nas mesas
            de marcenaria: cada pedaço com o veio correndo ao longo da
            borda (na curva o veio acompanha a volta, em vez de listras
            retas atravessando tudo), emenda escura entre os pedaços,
            reflexo do verniz na crista e filete de latão polido.
     Arena: couro preto granulado, estofado (crista clara, cantos
            escuros), costura dupla e uma fita de LED fina entre o couro
            e o feltro, na cor do feltro.
   As texturas são SVG gerados (ruído do próprio navegador), sem imagem
   pra baixar. */

const svgUrl = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

// Veio de nogueira: ruído esticado na horizontal, "fatiado" em faixas
// (os anéis do tronco) e pintado de marrom; por cima, os poros (riscos
// finos e escuros). O ladrilho emenda sem costura (stitchTiles).
const MADEIRA = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>" +
    "<filter id='w' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='0.0016 0.022' numOctaves='3' seed='4' stitchTiles='stitch' result='n'/>" +
    "<feComponentTransfer in='n' result='b'><feFuncR type='table' tableValues='0 .55 1 .6 .15 .7 1 .45 0 .6 .95 .5 .1 .65 1'/></feComponentTransfer>" +
    "<feColorMatrix in='b' type='matrix' values='.26 0 0 0 .17  .15 0 0 0 .09  .08 0 0 0 .045  0 0 0 0 1' result='cor'/>" +
    "<feTurbulence type='fractalNoise' baseFrequency='0.004 0.9' numOctaves='2' seed='13' stitchTiles='stitch' result='p'/>" +
    "<feColorMatrix in='p' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 1.42' result='poros'/>" +
    "<feComposite in='poros' in2='cor' operator='atop'/>" +
    "</filter><rect width='600' height='600' filter='url(#w)'/></svg>",
);

// Granulado do couro: relevo iluminado de lado (só as partes claras).
const COURO = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
    "<filter id='c' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>" +
    "<feTurbulence type='turbulence' baseFrequency='0.2' numOctaves='3' seed='3' stitchTiles='stitch' result='t'/>" +
    "<feDiffuseLighting in='t' surfaceScale='1.6' lighting-color='#fff' result='l'><feDistantLight azimuth='250' elevation='48'/></feDiffuseLighting>" +
    "<feColorMatrix in='l' type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 -.55'/>" +
    "</filter><rect width='220' height='220' filter='url(#c)'/></svg>",
);

// Fibra do feltro (fina) e manchas leves de tingimento (largas).
const FIBRA = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
    "<filter id='f' x='0' y='0' width='100%' height='100%'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='3' seed='2' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 0'/>" +
    "</filter><rect width='240' height='240' filter='url(#f)'/></svg>",
);
const MANCHAS = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'>" +
    "<filter id='m' x='0' y='0' width='100%' height='100%'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='3' seed='11' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -.45'/>" +
    "</filter><rect width='700' height='700' filter='url(#m)'/></svg>",
);

// Brilho que vai mais forte em cima (de onde vem a luz) e some embaixo.
const LUZ_DE_CIMA = (forte: number, meio: number, fim: number) =>
  `linear-gradient(180deg, rgba(0,0,0,${forte}), rgba(0,0,0,${meio}) 45%, rgba(0,0,0,${fim}))`;

// rgba(...,.35) -> rgba(...,a): a cor do feltro vira a luz do LED.
const comAlfa = (cor: string, a: number) => cor.replace(/[\d.]+\)$/, `${a})`);

/** Raios do cornerRadius ("34% / 54%") em fração da caixa, com o mesmo
 *  corte que o navegador faz quando os dois cantos somam mais de 100%. */
function raiosDaBorda(cornerRadius: string): { rx: number; ry: number } {
  const [a, b = a] = cornerRadius.split("/").map((s) => parseFloat(s) / 100);
  const rx = Number.isFinite(a) ? a : 0.1;
  const ry = Number.isFinite(b) ? b : rx;
  const corte = Math.min(1, 1 / (2 * rx || 1), 1 / (2 * ry || 1));
  return { rx: rx * corte, ry: ry * corte };
}

interface Gomo {
  /** Ângulo (a partir do centro, 0 = topo, sentido horário) onde começa. */
  de: number;
  ate: number;
  /** Direção do veio nesse pedaço (graus de rotação da textura). */
  veio: number;
}

/** Pedaços da borda de madeira: os lados retos e os cantos (curvas
 *  grandes em 2-3 pedaços), cada um com o veio ao longo da borda. */
function gomosDaBorda(aspecto: number, cornerRadius: string): Gomo[] {
  const W = aspecto;
  const H = 1;
  const { rx: fx, ry: fy } = raiosDaBorda(cornerRadius);
  const rx = fx * W;
  const ry = fy * H;
  const angulo = (x: number, y: number) => ((Math.atan2(x - W / 2, -(y - H / 2)) * 180) / Math.PI + 360) % 360;
  const inicios: { a: number; veio: number }[] = [];
  const canto = (cx: number, cy: number, t0: number, t1: number) => {
    const arco = Math.max(rx, ry);
    const n = arco > 0.18 ? 3 : arco > 0.06 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const ta = t0 + ((t1 - t0) * i) / n;
      const tm = t0 + ((t1 - t0) * (i + 0.5)) / n;
      // Tangente da elipse no meio do pedaço = direção do veio.
      const tx = -rx * Math.sin(tm);
      const ty = -ry * Math.cos(tm);
      inicios.push({ a: angulo(cx + rx * Math.cos(ta), cy - ry * Math.sin(ta)), veio: (Math.atan2(ty, tx) * 180) / Math.PI });
    }
  };
  if (W - 2 * rx > 0.01) inicios.push({ a: angulo(rx, 0), veio: 0 });
  canto(W - rx, ry, Math.PI / 2, 0);
  if (H - 2 * ry > 0.01) inicios.push({ a: angulo(W, ry), veio: 90 });
  canto(W - rx, H - ry, 0, -Math.PI / 2);
  if (W - 2 * rx > 0.01) inicios.push({ a: angulo(W - rx, H), veio: 0 });
  canto(rx, H - ry, -Math.PI / 2, -Math.PI);
  if (H - 2 * ry > 0.01) inicios.push({ a: angulo(0, H - ry), veio: 90 });
  canto(rx, ry, Math.PI, Math.PI / 2);
  inicios.sort((p, q) => p.a - q.a);
  return inicios.map((p, i) => ({ de: p.a, ate: i + 1 < inicios.length ? inicios[i + 1].a : inicios[0].a + 360, veio: p.veio }));
}

// Cada tábua com um tom levemente diferente, como madeira de verdade.
const TONS = [0, 0.1, -0.06, 0.05, -0.02, 0.12, -0.05, 0.03, 0, 0.08, -0.04, 0.06];

const cheio: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/** Borda da mesa + o que separa a borda do feltro (latão no Luxo, LED na
 *  Arena). Vai atrás do feltro, que deve ficar com `inset: espessura`. */
export function BordaMesa({
  estilo,
  cornerRadius,
  aspecto,
  espessura,
  brilho,
}: {
  estilo: EstiloMesa;
  cornerRadius: string;
  /** largura / altura da mesa (define onde ficam as emendas da madeira). */
  aspecto: number;
  /** Largura da borda em px. */
  espessura: number;
  /** Cor do brilho do feltro (vira a cor do LED na Arena). */
  brilho: string;
}) {
  const px = espessura;
  const r = cornerRadius;
  const crista = (inset: number, largura: number, cor: string, desfoque: number, mascara: string): CSSProperties => ({
    ...cheio,
    inset,
    borderRadius: r,
    border: `${largura}px solid ${cor}`,
    filter: `blur(${desfoque}px)`,
    WebkitMaskImage: mascara,
    maskImage: mascara,
  });

  if (estilo === "luxo") {
    const gomos = gomosDaBorda(aspecto, r);
    const juntas = gomos.map((g) => `rgba(20,8,2,.85) ${g.de - 0.25}deg ${g.de + 0.25}deg, transparent ${g.de + 0.25}deg`).join(", ");
    return (
      <>
        <div
          style={{
            ...cheio,
            borderRadius: r,
            overflow: "hidden",
            background: "#3a2213",
            boxShadow: "0 0 0 1px #140a04, 0 2px 0 1px rgba(0,0,0,.6), 0 28px 60px rgba(0,0,0,.85)",
          }}
        >
          {gomos.map((g, i) => {
            const mascara = `conic-gradient(from ${g.de}deg at 50% 50%, #000 0 ${g.ate - g.de}deg, transparent 0)`;
            const tom = TONS[i % TONS.length];
            const sobreposicao = tom >= 0 ? `rgba(255,214,160,${tom * 0.6})` : `rgba(0,0,0,${-tom * 1.6})`;
            return (
              <div key={i} style={{ ...cheio, borderRadius: r, overflow: "hidden", WebkitMaskImage: mascara, maskImage: mascara }}>
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: "300%",
                    height: "300%",
                    transform: `translate(-50%,-50%) rotate(${g.veio}deg)`,
                    backgroundImage: `linear-gradient(${sobreposicao}, ${sobreposicao}), ${MADEIRA}`,
                    backgroundSize: "auto, 600px 600px",
                    backgroundPosition: `0 0, ${i * 137}px ${i * 61}px`,
                  }}
                />
              </div>
            );
          })}
          {/* Emendas entre as tábuas. */}
          <div style={{ ...cheio, background: `conic-gradient(from 0deg, transparent 0deg, ${juntas}, transparent 360deg)`, opacity: 0.5 }} />
          {/* Luz de cima e sombra embaixo. */}
          <div
            style={{
              ...cheio,
              background: "radial-gradient(70% 55% at 50% 0%, rgba(255,226,180,.32), transparent 70%), linear-gradient(180deg, transparent 45%, rgba(0,0,0,.38))",
              mixBlendMode: "soft-light",
            }}
          />
          {/* Perfil arredondado: borda de fora escura, quina de cima clara. */}
          <div
            style={{
              ...cheio,
              borderRadius: r,
              boxShadow: `inset 0 0 0 1px rgba(0,0,0,.55), inset 0 0 ${px * 0.3}px rgba(0,0,0,.6), inset 0 1.5px 0 rgba(255,225,180,.3)`,
            }}
          />
          {/* Reflexo do verniz: faixa larga e suave + linha fina na crista. */}
          <div style={crista(px * 0.22, px * 0.3, "rgba(255,232,195,.16)", px * 0.12, LUZ_DE_CIMA(1, 0.35, 0.15))} />
          <div style={crista(px * 0.34, 1, "rgba(255,246,228,.55)", 0.6, "linear-gradient(180deg, #000, rgba(0,0,0,.2) 40%, transparent 75%)")} />
        </div>
        {/* Filete de latão polido (o feltro cobre o miolo). */}
        <div
          style={{
            ...cheio,
            inset: px - Math.min(3.5, px * 0.3),
            borderRadius: r,
            background: "conic-gradient(from 20deg, #f6e2a4, #9b742f, #e9cd84, #7d5d24, #f3dc98, #a37b33, #f6e2a4, #8a672a, #f6e2a4)",
            boxShadow: `0 0 0 1px rgba(30,16,4,.9), 0 0 ${px * 0.45}px ${px * 0.08}px rgba(0,0,0,.7)`,
          }}
        />
      </>
    );
  }

  return (
    <>
      <div
        style={{
          ...cheio,
          borderRadius: r,
          overflow: "hidden",
          background: "radial-gradient(80% 60% at 50% 0%, #2a2c31, #111215 55%, #060607)",
          boxShadow: `0 0 0 1px #000, 0 28px 60px rgba(0,0,0,.85), 0 0 40px -10px ${comAlfa(brilho, 0.5)}`,
        }}
      >
        <div style={{ ...cheio, backgroundImage: COURO, backgroundSize: "220px 220px", opacity: 0.13, mixBlendMode: "screen" }} />
        {/* Estofado: cantos escuros e crista clara no meio. */}
        <div style={{ ...cheio, borderRadius: r, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 ${px * 0.45}px ${px * 0.05}px rgba(0,0,0,.85)` }} />
        <div style={crista(px * 0.32, Math.max(2, px * 0.16), "rgba(255,255,255,.13)", px * 0.14, LUZ_DE_CIMA(1, 0.35, 0.12))} />
        {/* Costura dupla. */}
        <div style={{ ...cheio, inset: px * 0.18, borderRadius: r, border: "1px dashed rgba(170,175,185,.28)" }} />
        <div style={{ ...cheio, inset: px * 0.62, borderRadius: r, border: "1px dashed rgba(170,175,185,.18)" }} />
      </div>
      {/* Fita de LED entre o couro e o feltro (o feltro cobre o miolo). */}
      <div
        style={{
          ...cheio,
          inset: px - Math.min(2.5, px * 0.3),
          borderRadius: r,
          background: comAlfa(brilho, 1),
          boxShadow: [
            "inset 0 0 0 1px rgba(255,255,255,.45)",
            "0 0 0 1px rgba(0,0,0,.9)",
            `0 0 ${px * 0.35}px ${px * 0.08}px ${comAlfa(brilho, 0.85)}`,
            `0 0 ${px * 1.1}px ${px * 0.2}px ${comAlfa(brilho, 0.35)}`,
          ].join(", "),
        }}
      />
    </>
  );
}

/** Sombras do feltro: a borda fazendo sombra no pano (mais forte em cima,
 *  de onde vem a luz) e o pano escurecendo nas pontas. */
export function sombraDoFeltro(espessura: number): string {
  const px = espessura;
  return [
    "0 0 0 1px rgba(0,0,0,.7)",
    `inset 0 ${px * 0.5}px ${px * 0.9}px -${px * 0.25}px rgba(0,0,0,.7)`,
    `inset 0 0 ${px * 1.6}px rgba(0,0,0,.45)`,
    "inset 0 -30px 80px rgba(0,0,0,.5)",
  ].join(", ");
}

/** Textura do pano, por cima da cor do feltro. No Luxo (camurça) as
 *  manchas aparecem mais. */
export function TexturaFeltro({ estilo }: { estilo: EstiloMesa }) {
  const camurca = estilo === "luxo";
  return (
    <>
      <div style={{ ...cheio, backgroundImage: MANCHAS, backgroundSize: "700px 700px", opacity: camurca ? 0.16 : 0.08, mixBlendMode: "soft-light" }} />
      <div style={{ ...cheio, backgroundImage: FIBRA, backgroundSize: "240px 240px", opacity: camurca ? 0.2 : 0.16, mixBlendMode: "overlay" }} />
    </>
  );
}

/** Largura da borda pra uma mesa desse tamanho (px). */
export function espessuraDaBorda(largura: number, altura: number): number {
  if (!largura || !altura) return 16;
  return Math.max(9, Math.min(34, Math.min(largura, altura) * 0.058));
}
