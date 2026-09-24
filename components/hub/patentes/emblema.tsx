"use client";

import { useId } from "react";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";

// ============================================================
// Emblema de patente -- cada faixa de 10 níveis tem a cara do próprio
// nome (pedido explícito: "cada ranking condizendo com seu nome").
//
// A forma evolui com a patente, pra hierarquia ser lida antes da cor:
//   Bronze, Prata, Ouro         -> escudo (metal)
//   Esmeralda, Safira,
//   Ametista, Rubi              -> gema lapidada (cada uma no seu corte)
//   Platina, Diamante           -> losango / diamante com asas
//   Lendário                    -> coroa com asas
//
// E a animação vem do material:
//   Bronze    reflexo quente, lento          Prata    brilho frio e rápido
//   Ouro      brilho + poeira dourada        Esmeralda faces que cintilam
//   Safira    luz ondulando por dentro       Ametista lascas de cristal girando
//   Rubi      pulsa como coração + brasas    Platina  halo furta-cor
//   Diamante  arco-íris + estrelinhas        Lendário aura viva, raios e faíscas
//
// Tudo em SVG + CSS (sem imagem), escala de 24px a 240px. Quem pediu
// menos movimento no sistema vê o emblema parado.
// ============================================================

export type Faixa = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export function faixaDoNivel(nivel: number): Faixa {
  return Math.min(9, Math.max(0, Math.ceil(nivel / 10) - 1)) as Faixa;
}

/** IV (acabou de entrar) = 1 marca ... I (prestes a subir) = 4 marcas. */
export function marcasDaDivisao(nivel: number): number {
  return { IV: 1, III: 2, II: 3, I: 4 }[levelSubTier(nivel)] ?? 1;
}

interface Material {
  claro: string;
  base: string;
  escuro: string;
}

const MATERIAIS: Material[] = [
  { claro: "#F1C694", base: "#B08D57", escuro: "#5E3F1E" }, // Bronze
  { claro: "#FFFFFF", base: "#C0C6CC", escuro: "#5F6870" }, // Prata
  { claro: "#FFF1B8", base: "#E0B24C", escuro: "#7C560E" }, // Ouro
  { claro: "#A7F3C4", base: "#22c55e", escuro: "#0A5A2C" }, // Esmeralda
  { claro: "#BFDBFE", base: "#3b82f6", escuro: "#142C7A" }, // Safira
  { claro: "#E9D5FF", base: "#A855F7", escuro: "#4C1D95" }, // Ametista
  { claro: "#FECDD3", base: "#e0555a", escuro: "#7A1219" }, // Rubi
  { claro: "#ECFEFF", base: "#22d3ee", escuro: "#0B5F70" }, // Platina
  { claro: "#FFFFFF", base: "#f472b6", escuro: "#831843" }, // Diamante
  { claro: "#FFF8DC", base: "#F5D48C", escuro: "#9A6A12" }, // Lendário
];

// Formas num quadro de 120x120 (centro 60,60), deixando margem pras asas.
const ESCUDO = "M60 14 L96 26 V58 C96 82 80 98 60 107 C40 98 24 82 24 58 V26 Z";
const FORMAS: Record<Faixa, { corpo: string; facetas?: string[]; numeroY: number }> = {
  0: { corpo: ESCUDO, numeroY: 66 },
  1: { corpo: ESCUDO, numeroY: 66 },
  2: { corpo: ESCUDO, numeroY: 66 },
  // Esmeralda: corte "esmeralda" (retângulo de cantos chanfrados, em degraus)
  3: {
    corpo: "M42 16 H78 L100 38 V82 L78 104 H42 L20 82 V38 Z",
    facetas: [
      "M42 16 H78 L70 30 H50 Z",
      "M100 38 V82 L86 74 V46 Z",
      "M42 104 H78 L70 90 H50 Z",
      "M20 38 V82 L34 74 V46 Z",
    ],
    numeroY: 68,
  },
  // Safira: lapidação redonda (brilhante visto de cima)
  4: {
    corpo: "M60 16 L91 29 L104 60 L91 91 L60 104 L29 91 L16 60 L29 29 Z",
    facetas: ["M60 16 L75 44 L60 38 L45 44 Z", "M104 60 L76 75 L82 60 L76 45 Z", "M60 104 L45 76 L60 82 L75 76 Z", "M16 60 L44 45 L38 60 L44 75 Z"],
    numeroY: 68,
  },
  // Ametista: cristal alongado (prisma hexagonal)
  5: {
    corpo: "M60 8 L90 30 V90 L60 112 L30 90 V30 Z",
    facetas: ["M60 8 L90 30 L60 44 Z", "M60 8 L30 30 L60 44 Z", "M60 112 L90 90 L60 78 Z", "M60 112 L30 90 L60 78 Z"],
    numeroY: 68,
  },
  // Rubi: hexágono largo com facetas em triângulo
  6: {
    corpo: "M60 14 L100 37 V83 L60 106 L20 83 V37 Z",
    facetas: ["M60 14 L100 37 L60 50 Z", "M20 37 L60 14 L60 50 Z", "M60 106 L100 83 L60 72 Z", "M20 83 L60 106 L60 72 Z"],
    numeroY: 68,
  },
  // Platina: losango
  7: { corpo: "M60 10 L98 60 L60 110 L22 60 Z", facetas: ["M60 10 L98 60 L60 50 Z", "M60 10 L22 60 L60 50 Z"], numeroY: 70 },
  // Diamante: diamante lapidado visto de lado (mesa + pavilhão)
  8: {
    corpo: "M38 26 H82 L102 48 L60 108 L18 48 Z",
    facetas: ["M38 26 L48 48 H18 Z", "M82 26 L72 48 H102 Z", "M48 48 L60 26 L72 48 Z", "M48 48 L60 108 L72 48 Z"],
    numeroY: 62,
  },
  // Lendário: coroa
  9: { corpo: "M20 42 L40 64 L60 22 L80 64 L100 42 L92 100 H28 Z", facetas: ["M28 86 H92 L92 100 H28 Z"], numeroY: 80 },
};

const ASA = "M28 58 L4 42 L12 54 L0 56 L12 62 L4 72 L18 70 L14 80 L30 70 Z";

export function EmblemaEstilos() {
  return (
    <style>{`
      /* Só os elementos animados giram/escalam em torno do próprio centro;
         uma regra geral mexeria também nos transform="" fixos (asa
         espelhada, borda interna, lascas) e os tiraria do lugar. */
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
      .emb-roda { animation: embGira 18s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .emb-varre, .emb-sobe, .emb-pisca, .emb-onda, .emb-gira, .emb-pulsa, .emb-estrela, .emb-iris, .emb-aura, .emb-flutua, .emb-roda { animation: none !important; }
      }
    `}</style>
  );
}

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
  const forma = FORMAS[faixa];
  const cor = levelColor(nivel);
  const alado = faixa >= 7;
  const gema = faixa >= 3 && faixa <= 6;
  const a = animar;
  const id = (s: string) => `${uid}-${s}`;
  const marcas = marcasDaDivisao(nivel);

  return (
    <span
      className={`relative inline-flex shrink-0 flex-col items-center ${className}`}
      role="img"
      aria-label={`Patente ${levelMaterial(nivel)} ${levelSubTier(nivel)}, nível ${nivel}`}
    >
      <span className={`relative block ${a && faixa >= 7 ? "emb-flutua" : ""}`} style={{ width: tamanho, height: tamanho }}>
        {/* Halo de fundo: brilho na cor da patente; nas altas vira aura
            (Lendário) ou anel furta-cor (Platina/Diamante). */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-[6%] rounded-full blur-xl ${a && faixa === 9 ? "emb-aura" : ""}`}
          style={{ background: `radial-gradient(circle, ${cor}${faixa >= 7 ? "70" : faixa >= 3 ? "4d" : "33"}, transparent 68%)` }}
        />
        {(faixa === 7 || faixa === 8) && (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-[4%] rounded-full opacity-60 ${a ? "emb-iris" : ""}`}
            style={{
              background: "conic-gradient(from 0deg, #ff6ad5, #c774e8, #ad8cff, #8795e8, #94d0ff, #7cffcb, #fffc7c, #ff6ad5)",
              WebkitMask: "radial-gradient(circle, transparent 58%, #000 60%, #000 64%, transparent 66%)",
              mask: "radial-gradient(circle, transparent 58%, #000 60%, #000 64%, transparent 66%)",
            }}
          />
        )}
        {faixa === 9 && (
          <span
            aria-hidden
            className={`pointer-events-none absolute -inset-[8%] rounded-full opacity-50 ${a ? "emb-roda" : ""}`}
            style={{
              background: `repeating-conic-gradient(from 0deg, ${m.base}00 0deg 10deg, ${m.base}88 12deg, ${m.base}00 14deg 30deg)`,
              WebkitMask: "radial-gradient(circle, transparent 38%, #000 46%, transparent 70%)",
              mask: "radial-gradient(circle, transparent 38%, #000 46%, transparent 70%)",
            }}
          />
        )}

        <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} className="emb relative overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={m.claro} />
              <stop offset=".45" stopColor={m.base} />
              <stop offset="1" stopColor={m.escuro} />
            </linearGradient>
            <radialGradient id={id("gema")} cx=".38" cy=".3" r=".85">
              <stop offset="0" stopColor={m.claro} />
              <stop offset=".35" stopColor={m.base} />
              <stop offset="1" stopColor={m.escuro} />
            </radialGradient>
            <linearGradient id={id("brilho")} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity={faixa === 0 ? ".35" : ".7"} />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id("arco")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6ad5" />
              <stop offset=".25" stopColor="#ffd36a" />
              <stop offset=".5" stopColor="#7cffcb" />
              <stop offset=".75" stopColor="#94d0ff" />
              <stop offset="1" stopColor="#c774e8" />
            </linearGradient>
            <clipPath id={id("forma")}>
              <path d={forma.corpo} />
            </clipPath>
          </defs>

          {/* Lascas de cristal orbitando (Ametista) */}
          {faixa === 5 && (
            <g className={a ? "emb-gira" : ""} style={{ ["--vel" as string]: "14s" }}>
              {[0, 120, 240].map((g) => (
                <path key={g} d="M60 2 L64 9 L60 15 L56 9 Z" fill={m.claro} opacity=".85" transform={`rotate(${g} 60 60)`} />
              ))}
            </g>
          )}

          {/* Asas (Platina, Diamante, Lendário) */}
          {alado && (
            <g fill={`url(#${id("metal")})`} stroke={m.escuro} strokeWidth=".8" opacity=".95">
              <path d={ASA} />
              <path d={ASA} transform="translate(120 0) scale(-1 1)" />
            </g>
          )}

          <g className={a && faixa === 6 ? "emb-pulsa" : ""}>
            {/* Corpo */}
            <path
              d={forma.corpo}
              fill={`url(#${id(gema || faixa === 8 ? "gema" : "metal")})`}
              stroke={m.escuro}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Borda interna: metal ganha "moldura"; Ouro, uma borda dupla trabalhada */}
            {faixa <= 2 && (
              <path d={forma.corpo} fill="none" stroke={m.claro} strokeOpacity=".55" strokeWidth={faixa === 2 ? 2.4 : 1.4} transform="translate(60 60) scale(.84) translate(-60 -60)" />
            )}
            {faixa === 2 && <path d={forma.corpo} fill="none" stroke={m.escuro} strokeOpacity=".6" strokeWidth="1" transform="translate(60 60) scale(.74) translate(-60 -60)" />}

            {/* Facetas: claras e fixas; nas gemas elas cintilam uma a uma */}
            {forma.facetas?.map((f, i) => (
              <g key={i}>
                <path d={f} fill="#fff" opacity={faixa === 9 ? 0.12 : 0.14} />
                {a && (gema || faixa === 8) && (
                  <path d={f} fill="#fff" className="emb-pisca" style={{ animationDelay: `${i * 0.55}s`, ["--vel" as string]: faixa === 3 ? "2.6s" : "3.2s" }} />
                )}
              </g>
            ))}

            {/* Dentro da forma: onda (Safira), arco-íris (Diamante) e o brilho que varre */}
            <g clipPath={`url(#${id("forma")})`}>
              {faixa === 4 && a && (
                <path className="emb-onda" d="M-20 74 Q0 64 20 74 T60 74 T100 74 T140 74 T180 74 V130 H-20 Z" fill={m.claro} opacity=".22" />
              )}
              {faixa === 8 && <rect x="0" y="0" width="120" height="120" fill={`url(#${id("arco")})`} opacity=".22" />}
              {a && (
                <rect
                  className="emb-varre"
                  x="0"
                  y="-10"
                  width="34"
                  height="140"
                  fill={`url(#${id("brilho")})`}
                  style={{ ["--vel" as string]: ["7s", "3.6s", "4.6s", "5s", "6s", "5.5s", "4.5s", "3.8s", "3.2s", "3s"][faixa] }}
                />
              )}
            </g>

            {/* Estrela no topo da coroa (Lendário) */}
            {faixa === 9 && <path d="M60 4 L63 13 L72 13 L65 18 L68 27 L60 22 L52 27 L55 18 L48 13 L57 13 Z" fill="#fff" opacity=".95" />}

            {mostrarNumero && (
              <text
                x="60"
                y={forma.numeroY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={nivel >= 10 ? 30 : 34}
                fontWeight="900"
                fill="#fff"
                stroke={m.escuro}
                strokeWidth="4"
                paintOrder="stroke"
                style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-1px" }}
              >
                {nivel}
              </text>
            )}
          </g>

          {/* Partículas: poeira (Ouro), brasas (Rubi), faíscas (Lendário) */}
          {a &&
            (faixa === 2 || faixa === 6 || faixa === 9) &&
            [18, 34, 50, 66, 82, 98].map((x, i) => (
              <circle
                key={x}
                className="emb-sobe"
                cx={x + (i % 2 ? 3 : -3)}
                cy={faixa === 9 ? 96 : 100}
                r={faixa === 9 ? 1.8 : 1.4}
                fill={faixa === 6 ? "#ffb199" : m.claro}
                style={{ animationDelay: `${(i * 0.43) % 2.6}s`, ["--vel" as string]: faixa === 9 ? "2.2s" : "3s" }}
              />
            ))}

          {/* Estrelinhas (Diamante e Lendário) */}
          {a &&
            (faixa === 8 || faixa === 9) &&
            [
              [18, 22],
              [102, 30],
              [96, 96],
              [24, 92],
            ].map(([x, y], i) => (
              <path
                key={i}
                className="emb-estrela"
                d={`M${x} ${y - 6} L${x + 1.5} ${y - 1.5} L${x + 6} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 6} L${x - 1.5} ${y + 1.5} L${x - 6} ${y} L${x - 1.5} ${y - 1.5} Z`}
                fill="#fff"
                style={{ animationDelay: `${i * 0.6}s` }}
              />
            ))}
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
