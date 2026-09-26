"use client";

import { useId } from "react";

// ============================================================
// Selo de Membro Fundador -- um lacre de cera de verdade (pedido
// explícito: "realista, único, rico em detalhes").
//
// Por que um lacre: é o que fecha uma carta de fundação. Nenhuma outra
// peça do app usa esse material, então o selo não se confunde com as
// patentes (metal e pedras) -- fundador não é nível, é origem.
//
// Anatomia (de fora pra dentro):
//   * borda irregular: a cera escorre e não fica redonda;
//   * lábio levantado: a cera empurrada pra fora pelo sinete;
//   * fundo afundado: onde o sinete bateu (sombra em cima, luz embaixo);
//   * relevo em folha de ouro: "MEMBRO FUNDADOR" em arco, MMXXVI,
//     coroa de louros e o monograma F -- o ouro pega só nas partes altas.
//
// Na carta ganha as fitas de seda penduradas (`fitas`). Abaixo de 60px
// somem textos em arco, louros e brilhos (viram ruído); fica a cera e o F.
// ============================================================

const r1 = (n: number) => Math.round(n * 10) / 10;

// Borda da cera: círculo com ondulações de frequências diferentes, pra
// parecer escorrido à mão (e sempre o mesmo, sem sorteio a cada render).
const BORDA = (() => {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 51 + 2.4 * Math.sin(5 * t + 0.6) + 1.5 * Math.sin(9 * t + 1.9) + 1.1 * Math.sin(14 * t + 0.3) + (t > 1.1 && t < 1.5 ? 3.2 * Math.sin(((t - 1.1) / 0.4) * Math.PI) : 0);
    pts.push(`${r1(60 + r * Math.cos(t))} ${r1(60 + r * Math.sin(t))}`);
  }
  return `M${pts.join(" L")} Z`;
})();

// Folhas dos louros, ao longo de um arco em volta do F (lado esquerdo;
// o direito é espelho).
const LOUROS = (() => {
  const folhas: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < 7; k++) {
    const a = ((118 + k * 14) * Math.PI) / 180;
    const x = 60 + 21 * Math.cos(a);
    const y = 60 + 21 * Math.sin(a);
    const tang = (a * 180) / Math.PI + 90;
    const lado = k % 2 ? 1 : -1;
    folhas.push({ x: r1(x + Math.cos(a) * 2.2 * lado), y: r1(y + Math.sin(a) * 2.2 * lado), r: r1(tang + 28 * lado) });
  }
  return folhas;
})();

// Fitas de seda (só na carta): duas caudas com corte em V.
const FITA_E = "M52 92 L30 140 L36 136 L40 146 L60 100 Z";
const FITA_D = "M68 92 L90 140 L84 136 L80 146 L60 100 Z";

export function SeloFundador({
  tamanho = 120,
  animar = true,
  fitas = false,
  className = "",
}: {
  tamanho?: number;
  animar?: boolean;
  /** Fitas de seda penduradas embaixo do lacre (versão da carta). */
  fitas?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `${uid}-${s}`;
  const det = tamanho >= 60;
  const alturaBox = fitas ? 150 : 120;

  const louros = (
    <g>
      <path d="M49.5 78 A21 21 0 0 1 40 50" fill="none" stroke={`url(#${id("ouro")})`} strokeWidth="1" strokeLinecap="round" />
      {LOUROS.map((f, i) => (
        <ellipse key={i} cx={f.x} cy={f.y} rx="3.6" ry="1.5" transform={`rotate(${f.r} ${f.x} ${f.y})`} fill={`url(#${id("ouro")})`} />
      ))}
    </g>
  );

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: tamanho, height: (tamanho * alturaBox) / 120 }} role="img" aria-label="Selo de Membro Fundador">
      <svg viewBox={`0 0 120 ${alturaBox}`} width={tamanho} height={(tamanho * alturaBox) / 120} className="overflow-visible" aria-hidden>
        <defs>
          {/* Cera bordô: brilho em cima-esquerda, fundo quase preto */}
          <radialGradient id={id("cera")} cx=".36" cy=".3" r=".8">
            <stop offset="0" stopColor="#c23a4b" />
            <stop offset=".35" stopColor="#8e1426" />
            <stop offset=".75" stopColor="#5a0914" />
            <stop offset="1" stopColor="#2c0309" />
          </radialGradient>
          {/* Fundo afundado: sombra no alto (a borda faz sombra), luz embaixo */}
          <linearGradient id={id("fundo")} x1="0" y1="0" x2=".3" y2="1">
            <stop offset="0" stopColor="#3c040d" />
            <stop offset=".55" stopColor="#6d0d1c" />
            <stop offset="1" stopColor="#8f1a2b" />
          </linearGradient>
          {/* Lábio: luz na parte de cima, sombra embaixo */}
          <linearGradient id={id("labio")} x1="0" y1="0" x2=".35" y2="1">
            <stop offset="0" stopColor="#e0697a" />
            <stop offset=".4" stopColor="#9c1b2e" />
            <stop offset="1" stopColor="#3a050c" />
          </linearGradient>
          <linearGradient id={id("ouro")} x1="0" y1="0" x2=".3" y2="1">
            <stop offset="0" stopColor="#fff4c8" />
            <stop offset=".3" stopColor="#f2c65a" />
            <stop offset=".6" stopColor="#b98220" />
            <stop offset="1" stopColor="#f5d27a" />
          </linearGradient>
          <linearGradient id={id("seda")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3a0710" />
            <stop offset=".35" stopColor="#8a1a2c" />
            <stop offset=".5" stopColor="#c44a5c" />
            <stop offset=".65" stopColor="#8a1a2c" />
            <stop offset="1" stopColor="#3a0710" />
          </linearGradient>
          <linearGradient id={id("brilho")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id("relevo")}>
            <circle cx="60" cy="60" r="37" />
          </clipPath>
          <path id={id("arcoCima")} d="M28 60 A32 32 0 0 1 92 60" />
          <path id={id("arcoBaixo")} d="M26.5 60 A33.5 33.5 0 0 0 93.5 60" />
          {det && (
            <filter id={id("sombra")} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#000" floodOpacity=".8" />
            </filter>
          )}
        </defs>

        {/* Fitas de seda, atrás do lacre */}
        {fitas && (
          <g>
            <path d={FITA_E} fill={`url(#${id("seda")})`} stroke="#2a0409" strokeWidth=".6" strokeLinejoin="round" />
            <path d={FITA_D} fill={`url(#${id("seda")})`} stroke="#2a0409" strokeWidth=".6" strokeLinejoin="round" />
            {det && (
              <g stroke="#ffd7dd" strokeOpacity=".22" strokeWidth=".5" fill="none">
                <path d="M47 104 L34 134" />
                <path d="M73 104 L86 134" />
              </g>
            )}
          </g>
        )}

        <g filter={det ? `url(#${id("sombra")})` : undefined}>
          {/* Cera escorrida */}
          <path d={BORDA} fill={`url(#${id("cera")})`} stroke="#23020a" strokeWidth=".8" strokeLinejoin="round" />
          {/* Lábio levantado pelo sinete */}
          <circle cx="60" cy="60" r="42.5" fill="none" stroke={`url(#${id("labio")})`} strokeWidth="7" />
          <circle cx="60" cy="60" r="46" fill="none" stroke="#2c0309" strokeOpacity=".35" strokeWidth=".8" />
          {/* Fundo onde o sinete bateu */}
          <circle cx="60" cy="60" r="39" fill={`url(#${id("fundo")})`} />
          <circle cx="60" cy="60" r="39" fill="none" stroke="#1c0106" strokeOpacity=".7" strokeWidth="1.2" />

          {/* Relevo em folha de ouro */}
          <g>
            {/* sombra do relevo (embaixo-direita) */}
            <g transform="translate(.7 .8)" opacity=".55">
              <circle cx="60" cy="60" r="28" fill="none" stroke="#1a0105" strokeWidth={det ? 1 : 1.6} />
              <text
                x="60"
                y="61"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontWeight="700"
                fontSize={det ? 34 : 44}
                fill="#1a0105"
              >
                F
              </text>
            </g>
            <circle cx="60" cy="60" r="28" fill="none" stroke={`url(#${id("ouro")})`} strokeWidth={det ? 1 : 1.6} strokeDasharray={det ? "0.1 2.2" : undefined} strokeLinecap="round" />
            {det && (
              <>
                <text fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="6.4" letterSpacing="1.3" fill={`url(#${id("ouro")})`}>
                  <textPath href={`#${id("arcoCima")}`} startOffset="50%" textAnchor="middle">
                    MEMBRO FUNDADOR
                  </textPath>
                </text>
                <text fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="6.4" letterSpacing="1.6" fill={`url(#${id("ouro")})`}>
                  <textPath href={`#${id("arcoBaixo")}`} startOffset="50%" textAnchor="middle">
                    ✦ MMXXVI ✦
                  </textPath>
                </text>
                {louros}
                <g transform="translate(120 0) scale(-1 1)">{louros}</g>
              </>
            )}
            <text
              x="60"
              y="61"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontWeight="700"
              fontSize={det ? 34 : 44}
              fill={`url(#${id("ouro")})`}
              stroke="#6b3f06"
              strokeWidth=".5"
            >
              F
            </text>
            {/* luz no alto do relevo (cima-esquerda) */}
            {det && (
              <text
                x="59.5"
                y="60.4"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontWeight="700"
                fontSize="34"
                fill="none"
                stroke="#fffbe6"
                strokeOpacity=".55"
                strokeWidth=".4"
              >
                F
              </text>
            )}
          </g>

          {/* Brilho molhado da cera */}
          <ellipse cx="40" cy="30" rx="10" ry="4.5" transform="rotate(-35 40 30)" fill="#fff" opacity=".22" />
          {det && <ellipse cx="86" cy="88" rx="5" ry="2" transform="rotate(-35 86 88)" fill="#fff" opacity=".1" />}
          {det && <path d="M24 72 q3 2 6 1" stroke="#ff9aa8" strokeOpacity=".25" strokeWidth=".6" fill="none" strokeLinecap="round" />}

          {/* Luz que passa pelo ouro */}
          {animar && (
            <g clipPath={`url(#${id("relevo")})`} style={{ mixBlendMode: "screen" }}>
              <rect className="emb-varre" x="0" y="-10" width="30" height="140" fill={`url(#${id("brilho")})`} style={{ ["--vel" as string]: "5.5s" }} />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
