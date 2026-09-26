"use client";

import { useId } from "react";

/* Ficha Clássica Americana (escolha explícita entre as 8 fichas
   desenhadas): argila na cor do valor, 8 listras na borda alternando duas
   cores e um selo claro no centro, como as fichas de torneio. A cor segue
   a convenção de cassino, então dá pra ler o tamanho da aposta pela pilha:
   azul ½ · branca 1 · vermelha 5 · verde 25 · preta 100. */

export interface Denominacao {
  /** Valor em BB (no modo "fichas" o valor é multiplicado, ver quebrarEmFichas). */
  v: number;
  cor: string;
  listra: string;
  terceira: string;
  /** Cor do anel e do número no selo do centro. */
  selo: string;
}

// Da maior pra menor -- ordem usada pra quebrar um valor em fichas.
export const DENOMINACOES: Denominacao[] = [
  { v: 100, cor: "#1b1d22", listra: "#f2c65a", terceira: "#c8102e", selo: "#1b1d22" },
  { v: 25, cor: "#138a4a", listra: "#ffffff", terceira: "#f2c65a", selo: "#138a4a" },
  { v: 5, cor: "#c8102e", listra: "#ffffff", terceira: "#1553b8", selo: "#c8102e" },
  { v: 1, cor: "#f3f1ea", listra: "#1553b8", terceira: "#c8102e", selo: "#1553b8" },
  { v: 0.5, cor: "#1d6fd8", listra: "#ffffff", terceira: "#f2c65a", selo: "#1d6fd8" },
];

// Valores em fichas de torneio (Revisor com "valores em fichas"): mesma
// escala de cores, com o valor de cada ficha 100x maior (50 · 100 · 500 ·
// 2.500 · 10.000) -- a mesa não sabe o tamanho do blind, e essa é a
// escala mais comum nas estruturas de torneio.
const ESCALA_FICHAS = 100;

/** Quebra um valor nas fichas que o formam, da maior pra menor, até `max` fichas. */
export function quebrarEmFichas(valor: number, max: number, emFichas = false): Denominacao[] {
  const escala = emFichas ? ESCALA_FICHAS : 1;
  const fichas: Denominacao[] = [];
  let resto = valor;
  for (const d of DENOMINACOES) {
    while (resto >= d.v * escala - 1e-9 && fichas.length < max) {
      fichas.push(d);
      resto -= d.v * escala;
    }
  }
  // Menos que a menor ficha (ex.: 0,2 BB de ante) -- ainda assim uma ficha.
  if (fichas.length === 0 && valor > 0) fichas.push(DENOMINACOES[DENOMINACOES.length - 1]);
  return fichas;
}

// O número só aparece quando a ficha é grande o bastante pra ele ser lido;
// nas fichas pequenas da mesa o selo claro com o anel colorido já basta.
const TAMANHO_MIN_NUMERO = 22;

export function FichaAmericana({ d, tamanho }: { d: Denominacao; tamanho: number }) {
  const brilho = `ficha-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id={brilho} cx=".38" cy=".3" r=".85">
          <stop offset="0" stopColor="#fff" stopOpacity=".3" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".3" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={d.cor} stroke="rgba(0,0,0,.5)" strokeWidth="3" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M43 3.5 H57 L55 17 H45 Z" fill={i % 2 ? d.terceira : d.listra} transform={`rotate(${i * 45} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="30" fill="#f7f5ef" stroke={d.selo} strokeWidth="5" />
      {tamanho >= TAMANHO_MIN_NUMERO ? (
        <text x="50" y="52" textAnchor="middle" dominantBaseline="middle" fontFamily="inherit" fontWeight="800" fontSize={d.v >= 100 ? 22 : 25} fill={d.selo}>
          {d.v >= 1 ? d.v : "½"}
        </text>
      ) : (
        <circle cx="50" cy="50" r="19" fill="none" stroke={d.selo} strokeOpacity=".35" strokeWidth="3" />
      )}
      <circle cx="50" cy="50" r="47" fill={`url(#${brilho})`} />
    </svg>
  );
}

// Quanto cada ficha sobe na pilha, em fração do tamanho da ficha.
export const DEGRAU_PILHA = 0.2;

/** Pilha de fichas vista de cima e levemente de lado: a maior embaixo. */
export function PilhaFichas({ fichas, tamanho }: { fichas: Denominacao[]; tamanho: number }) {
  const degrau = Math.max(2, Math.round(tamanho * DEGRAU_PILHA));
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho + degrau * Math.max(0, fichas.length - 1), flexShrink: 0 }}>
      {fichas.map((d, i) => (
        <div key={i} style={{ position: "absolute", left: 0, bottom: i * degrau, filter: "drop-shadow(0 1px 1px rgba(0,0,0,.55))" }}>
          <FichaAmericana d={d} tamanho={tamanho} />
        </div>
      ))}
    </div>
  );
}
