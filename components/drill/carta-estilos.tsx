"use client";

import { useId, type ReactNode } from "react";

// ============================================================
// Estilos de carta de baralho (Treino e Revisor) -- exploração de 4
// layouts realistas (pedido explícito: "focado em visibilidade e
// facilidade pro jogador de poker, além de rico e bonito").
//
// Regras que valem pros 4 (vindas de uso real em mesa):
//   * sem figura em K/Q/J: ilustração em vetor não fica ultra-realista e
//     competiria com o índice -- o realismo vem do MATERIAL (papel,
//     tinta, relevo, brilho), e a leitura fica no índice;
//   * baralho de 4 cores (espadas preto, copas vermelho, ouros azul, paus
//     verde) ou 2 cores, conforme a preferência;
//   * naipes desenhados em vetor (não glifo de fonte): mesmo tamanho e
//     forma em qualquer navegador;
//   * canto de baixo NUNCA gira o número (6 e 9 girados são idênticos);
//   * cartas pequenas (< 44px) escondem o canto de baixo e crescem o
//     índice -- é o que o olho procura.
// Quadro de desenho: 100 x 143 (proporção de carta de pôquer, 2,5 x 3,5").
// ============================================================

export type EstiloCarta = "classico" | "jumbo" | "solido" | "noir" | "faixa" | "diagonal" | "vintage" | "cristal";
export type NaipeKey = "s" | "h" | "d" | "c";

// Formas dos naipes num quadro 100 x 100.
export const NAIPE_PATH: Record<NaipeKey, string> = {
  s: "M50 3 C62 22 94 38 94 62 C94 78 80 86 67 83 C60 81 56 77 54 73 C55 84 59 91 67 97 H33 C41 91 45 84 46 73 C44 77 40 81 33 83 C20 86 6 78 6 62 C6 38 38 22 50 3 Z",
  h: "M50 94 C38 82 5 60 5 33 C5 17 17 6 31 6 C40 6 47 11 50 19 C53 11 60 6 69 6 C83 6 95 17 95 33 C95 60 62 82 50 94 Z",
  d: "M50 2 C59 20 73 37 91 50 C73 63 59 80 50 98 C41 80 27 63 9 50 C27 37 41 20 50 2 Z",
  // Paus: três folhas (círculos) + miolo + haste, todos no mesmo sentido pra preencher sem buraco.
  c: "M29 29 a21 21 0 1 1 42 0 a21 21 0 1 1 -42 0 Z M5 60 a21 21 0 1 1 42 0 a21 21 0 1 1 -42 0 Z M53 60 a21 21 0 1 1 42 0 a21 21 0 1 1 -42 0 Z M40 38 L60 38 L64 62 L36 62 Z M46 62 C46 80 42 89 32 97 H68 C58 89 54 80 54 62 Z",
};

const TINTA_4: Record<NaipeKey, string> = { s: "#15181d", h: "#c8102e", d: "#1553b8", c: "#11803e" };
const TINTA_NOIR: Record<NaipeKey, string> = { s: "#eef1f6", h: "#ff4d62", d: "#4aa3ff", c: "#35d07f" };
const FUNDO_SOLIDO: Record<NaipeKey, [string, string]> = {
  s: ["#3a3f47", "#121418"],
  h: ["#e0323f", "#8e0f1a"],
  d: ["#2f6fd1", "#123a7a"],
  c: ["#27a15e", "#0d5130"],
};

const FONTE = "'Space Grotesk', 'Arial Narrow', Arial, sans-serif";
const SERIFA = "Georgia, 'Times New Roman', serif";
// Tintas "de época" (Vintage): mesmas 4 cores, um pouco envelhecidas.
const TINTA_VINTAGE: Record<NaipeKey, string> = { s: "#1d1a16", h: "#a3162b", d: "#1c4f9c", c: "#1d6b3a" };

function Naipe({ n, x, y, tam, fill, extra }: { n: NaipeKey; x: number; y: number; tam: number; fill: string; extra?: ReactNode }) {
  return (
    <g transform={`translate(${x - tam / 2} ${y - tam / 2}) scale(${tam / 100})`}>
      <path d={NAIPE_PATH[n]} fill={fill} />
      {extra}
    </g>
  );
}

export function CartaEstilo({
  card,
  estilo,
  largura,
  baralho = "4cores",
}: {
  card: string;
  estilo: EstiloCarta;
  largura: number;
  baralho?: "4cores" | "2cores";
}) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `${uid}-${s}`;
  const rankRaw = card.slice(0, -1);
  const rank = rankRaw === "T" ? "10" : rankRaw;
  const n = card.slice(-1).toLowerCase() as NaipeKey;
  const n2 = baralho === "2cores" ? ({ s: "s", h: "h", d: "h", c: "s" } as const)[n] : n; // cor do 2 cores
  const altura = Math.round((largura * 143) / 100);
  const pequena = largura < 44;
  const dois = rank.length === 2;

  const tinta = estilo === "noir" ? TINTA_NOIR[n2] : estilo === "solido" ? "#ffffff" : estilo === "vintage" ? TINTA_VINTAGE[n2] : TINTA_4[n2];
  const corNaipe = TINTA_4[n2];

  // Índice (valor) -- cresce na carta pequena, que só mostra o canto de cima.
  const indice = (tamRank: number, tamNaipe: number, x: number, yRank: number, alinhar: "start" | "end", naipeAntes: boolean, cor: string, filtro?: string, fonte = FONTE) => {
    const xNaipe = alinhar === "start" ? x + (dois ? tamRank * 0.55 : tamRank * 0.3) : x - (dois ? tamRank * 0.55 : tamRank * 0.3);
    const yNaipe = naipeAntes ? yRank - tamRank * 0.92 - tamNaipe * 0.5 : yRank + tamNaipe * 0.72;
    return (
      <g filter={filtro}>
        <text
          x={x}
          y={yRank}
          textAnchor={alinhar}
          fontFamily={fonte}
          fontWeight="700"
          fontSize={dois ? tamRank * 0.86 : tamRank}
          letterSpacing={dois ? -tamRank * 0.08 : 0}
          fill={cor}
        >
          {rank}
        </text>
        <Naipe n={n} x={xNaipe} y={yNaipe} tam={tamNaipe} fill={cor} />
      </g>
    );
  };

  let corpo: ReactNode;

  if (estilo === "classico" || estilo === "jumbo") {
    // Cartolina branca com trama de linho e brilho de verniz.
    const papel = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("papel")})`} stroke="#bdb7ab" strokeWidth=".9" />
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linho")})`} opacity=".55" />
      </>
    );
    if (estilo === "classico") {
      corpo = (
        <>
          {papel}
          {!pequena && <rect x="5" y="5" width="90" height="133" rx="5" fill="none" stroke={tinta} strokeOpacity=".14" strokeWidth=".8" />}
          {pequena ? (
            <>
              {indice(52, 30, 9, 50, "start", false, tinta)}
              <Naipe n={n} x={64} y={104} tam={50} fill={tinta} />
            </>
          ) : (
            <>
              {indice(34, 19, 9, 34, "start", false, tinta)}
              <Naipe n={n} x={50} y={71} tam={44} fill={tinta} extra={<path d={NAIPE_PATH[n]} fill={`url(#${id("tinta")})`} />} />
              {indice(30, 16, 91, 134, "end", true, tinta)}
            </>
          )}
        </>
      );
    } else {
      // Jumbo: índice gigante (padrão de cartas de torneio) -- o valor
      // ocupa metade da carta, o naipe a outra.
      corpo = (
        <>
          {papel}
          <text
            x={dois ? 50 : 50}
            y={66}
            textAnchor="middle"
            fontFamily={FONTE}
            fontWeight="800"
            fontSize={dois ? 58 : 70}
            letterSpacing={dois ? -5 : 0}
            fill={tinta}
          >
            {rank}
          </text>
          <Naipe n={n} x={50} y={104} tam={pequena ? 58 : 54} fill={tinta} extra={<path d={NAIPE_PATH[n]} fill={`url(#${id("tinta")})`} />} />
          {!pequena && <rect x="5" y="5" width="90" height="133" rx="5" fill="none" stroke={tinta} strokeOpacity=".12" strokeWidth=".8" />}
        </>
      );
    }
  } else if (estilo === "solido") {
    // Cor do naipe no fundo (evolução do atual), com volume, moldura e grão.
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("solido")})`} stroke="#000" strokeOpacity=".55" strokeWidth="1" />
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linho")})`} opacity=".35" />
        {!pequena && <rect x="5" y="5" width="90" height="133" rx="5" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth=".9" />}
        {pequena ? (
          <>
            {indice(52, 30, 9, 50, "start", false, "#fff", `url(#${id("relevo")})`)}
            <Naipe n={n} x={64} y={104} tam={50} fill="#fff" />
          </>
        ) : (
          <>
            {indice(34, 19, 9, 34, "start", false, "#fff", `url(#${id("relevo")})`)}
            <g filter={`url(#${id("relevo")})`}>
              <Naipe n={n} x={50} y={71} tam={44} fill="#fff" />
            </g>
            {indice(30, 16, 91, 134, "end", true, "#fff", `url(#${id("relevo")})`)}
          </>
        )}
      </>
    );
  } else if (estilo === "faixa") {
    // Faixa lateral na cor do naipe: a cor é lida pelo canto do olho,
    // antes do valor. Valor gigante na área branca.
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("papel")})`} stroke="#bdb7ab" strokeWidth=".9" />
        <g clipPath={`url(#${id("forma")})`}>
          <rect x="0" y="0" width="26" height="143" fill={`url(#${id("faixaCor")})`} />
          <rect x="26" y="0" width="1.2" height="143" fill="#000" opacity=".18" />
        </g>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linho")})`} opacity=".55" />
        <Naipe n={n} x={13} y={pequena ? 22 : 18} tam={pequena ? 18 : 15} fill="#fff" />
        {!pequena && <Naipe n={n} x={13} y={125} tam={15} fill="#fff" />}
        <text x="63" y={pequena ? 70 : 64} textAnchor="middle" fontFamily={FONTE} fontWeight="800" fontSize={dois ? 50 : 62} letterSpacing={dois ? -4 : 0} fill={tinta}>
          {rank}
        </text>
        <Naipe n={n} x={63} y={pequena ? 110 : 104} tam={pequena ? 44 : 40} fill={tinta} extra={<path d={NAIPE_PATH[n]} fill={`url(#${id("tinta")})`} />} />
      </>
    );
  } else if (estilo === "diagonal") {
    // Corte diagonal: valor em cima (tinta do naipe), naipe branco em
    // cima do bloco de cor embaixo.
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("papel")})`} stroke="#bdb7ab" strokeWidth=".9" />
        <g clipPath={`url(#${id("forma")})`}>
          <path d="M0 96 L100 58 L100 143 L0 143 Z" fill={`url(#${id("faixaCor")})`} />
          <path d="M0 96 L100 58" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" />
        </g>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linho")})`} opacity=".5" />
        <text x="10" y={pequena ? 58 : 52} fontFamily={FONTE} fontWeight="800" fontSize={dois ? 44 : 54} letterSpacing={dois ? -3.5 : 0} fill={tinta}>
          {rank}
        </text>
        <g filter={`url(#${id("relevo")})`}>
          <Naipe n={n} x={66} y={108} tam={pequena ? 50 : 46} fill="#fff" />
        </g>
      </>
    );
  } else if (estilo === "vintage") {
    // Baralho antigo: papel envelhecido, moldura ornamentada, índice com
    // serifa e naipe central gravado (hachura de gravura em metal).
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("antigo")})`} stroke="#a8967a" strokeWidth=".9" />
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linho")})`} opacity=".45" />
        {!pequena && (
          <g fill="none" stroke={tinta} strokeOpacity=".45">
            <rect x="4.5" y="4.5" width="91" height="134" rx="4" strokeWidth=".9" />
            <rect x="7" y="7" width="86" height="129" rx="3" strokeWidth=".4" />
            {[
              [7, 7, 1, 1],
              [93, 7, -1, 1],
              [7, 136, 1, -1],
              [93, 136, -1, -1],
            ].map(([x, y, sx, sy], i) => (
              <path key={i} d={`M${x} ${y + sy * 9} q${sx * 1} ${-sy * 8} ${sx * 9} ${-sy * 9} M${x + sx * 3} ${y + sy * 3} l${sx * 2} ${sy * 2}`} strokeWidth=".6" />
            ))}
          </g>
        )}
        {pequena ? (
          <>
            {indice(50, 28, 9, 50, "start", false, tinta, undefined, SERIFA)}
            <Naipe n={n} x={64} y={104} tam={50} fill={tinta} />
          </>
        ) : (
          <>
            {indice(37, 19, 10, 38, "start", false, tinta, undefined, SERIFA)}
            <Naipe
              n={n}
              x={50}
              y={71}
              tam={46}
              fill={tinta}
              extra={
                <>
                  <path d={NAIPE_PATH[n]} fill={`url(#${id("hachura")})`} />
                  <path d={NAIPE_PATH[n]} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="2" />
                </>
              }
            />
            {indice(32, 16, 90, 133, "end", true, tinta, undefined, SERIFA)}
          </>
        )}
      </>
    );
  } else if (estilo === "cristal") {
    // Acrílico translúcido na cor do naipe: deixa o feltro aparecer de
    // leve, com borda de luz e reflexo forte no alto.
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("vidro")})`} />
        <rect x="1.2" y="1.2" width="97.6" height="140.6" rx="7.4" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" />
        <rect x="4" y="4" width="92" height="135" rx="5" fill="none" stroke={corNaipe} strokeOpacity=".9" strokeWidth=".8" />
        {pequena ? (
          <>
            {indice(52, 30, 9, 50, "start", false, "#fff", `url(#${id("brilhoTinta")})`)}
            <g filter={`url(#${id("brilhoTinta")})`}>
              <Naipe n={n} x={64} y={104} tam={50} fill="#fff" />
            </g>
          </>
        ) : (
          <>
            {indice(34, 19, 9, 34, "start", false, "#fff", `url(#${id("brilhoTinta")})`)}
            <g filter={`url(#${id("brilhoTinta")})`}>
              <Naipe n={n} x={50} y={71} tam={44} fill="#fff" />
            </g>
            {indice(30, 16, 91, 134, "end", true, "#fff", `url(#${id("brilhoTinta")})`)}
          </>
        )}
        <path d="M.5 40 Q.5 .5 40 .5 H70 Q30 20 .5 70 Z" fill="#fff" opacity=".16" />
      </>
    );
  } else {
    // Noir: cartolina preta fosca, tinta metalizada na cor do naipe.
    corpo = (
      <>
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("noir")})`} stroke={tinta} strokeOpacity=".45" strokeWidth="1.1" />
        <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("linhoClaro")})`} opacity=".5" />
        {!pequena && <rect x="5" y="5" width="90" height="133" rx="5" fill="none" stroke={tinta} strokeOpacity=".22" strokeWidth=".7" />}
        {pequena ? (
          <>
            {indice(52, 30, 9, 50, "start", false, `url(#${id("foil")})`, `url(#${id("brilhoTinta")})`)}
            <g filter={`url(#${id("brilhoTinta")})`}>
              <Naipe n={n} x={64} y={104} tam={50} fill={`url(#${id("foil")})`} />
            </g>
          </>
        ) : (
          <>
            {indice(34, 19, 9, 34, "start", false, `url(#${id("foil")})`, `url(#${id("brilhoTinta")})`)}
            <g filter={`url(#${id("brilhoTinta")})`}>
              <Naipe n={n} x={50} y={71} tam={44} fill={`url(#${id("foil")})`} />
            </g>
            {indice(30, 16, 91, 134, "end", true, `url(#${id("foil")})`, `url(#${id("brilhoTinta")})`)}
          </>
        )}
      </>
    );
  }

  const [s1, s2] = FUNDO_SOLIDO[n2];
  return (
    <svg
      viewBox="0 0 100 143"
      width={largura}
      height={altura}
      role="img"
      aria-label={`${rank} de ${{ s: "espadas", h: "copas", d: "ouros", c: "paus" }[n]}`}
      style={{
        display: "block",
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))",
        ...(estilo === "cristal" ? { borderRadius: largura * 0.08, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } : {}),
      }}
    >
      <defs>
        <linearGradient id={id("papel")} x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#f7f5ef" />
          <stop offset="1" stopColor="#ebe7dd" />
        </linearGradient>
        <pattern id={id("linho")} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <path d="M0 0 L2.4 2.4 M2.4 0 L0 2.4" stroke="#8a826f" strokeOpacity=".22" strokeWidth=".25" />
        </pattern>
        <pattern id={id("linhoClaro")} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <path d="M0 0 L2.4 2.4 M2.4 0 L0 2.4" stroke="#fff" strokeOpacity=".05" strokeWidth=".25" />
        </pattern>
        {/* Tinta com leve volume (não chapada) */}
        <linearGradient id={id("tinta")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <radialGradient id={id("solido")} cx=".3" cy=".2" r="1.1">
          <stop offset="0" stopColor={s1} />
          <stop offset="1" stopColor={s2} />
        </radialGradient>
        <radialGradient id={id("noir")} cx=".3" cy=".15" r="1.1">
          <stop offset="0" stopColor="#2a2d33" />
          <stop offset=".6" stopColor="#15171b" />
          <stop offset="1" stopColor="#0b0c0e" />
        </radialGradient>
        <linearGradient id={id("foil")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".35" stopColor={tinta} />
          <stop offset=".7" stopColor={tinta} />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".85" />
        </linearGradient>
        <clipPath id={id("forma")}>
          <rect x=".5" y=".5" width="99" height="142" rx="8" />
        </clipPath>
        <linearGradient id={id("faixaCor")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={FUNDO_SOLIDO[n2][0]} />
          <stop offset="1" stopColor={FUNDO_SOLIDO[n2][1]} />
        </linearGradient>
        <radialGradient id={id("antigo")} cx=".4" cy=".35" r=".9">
          <stop offset="0" stopColor="#fbf3df" />
          <stop offset=".7" stopColor="#efe1bf" />
          <stop offset="1" stopColor="#dcc79c" />
        </radialGradient>
        <pattern id={id("hachura")} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 3 H6" stroke="#fff" strokeOpacity=".32" strokeWidth="1.6" />
        </pattern>
        <linearGradient id={id("vidro")} x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" stopColor={FUNDO_SOLIDO[n2][0]} stopOpacity=".78" />
          <stop offset="1" stopColor={FUNDO_SOLIDO[n2][1]} stopOpacity=".62" />
        </linearGradient>
        <filter id={id("relevo")} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy=".8" stdDeviation=".5" floodColor="#000" floodOpacity=".45" />
        </filter>
        <filter id={id("brilhoTinta")} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor={tinta} floodOpacity=".45" />
        </filter>
        <linearGradient id={id("verniz")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".35" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {corpo}
      {/* Verniz: reflexo suave no alto */}
      <rect x=".5" y=".5" width="99" height="142" rx="8" fill={`url(#${id("verniz")})`} pointerEvents="none" />
    </svg>
  );
}
