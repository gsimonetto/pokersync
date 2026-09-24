import { invested, net } from "./calc";
import type { Session } from "./types";

// "Isso é variância?" -- simulação no estilo das calculadoras de variância
// (PrimeDope e afins), mas usando os SEUS resultados reais em vez de uma
// distribuição teórica de torneio: cada rodada sorteia, com reposição,
// resultados das suas sessões. Duas respostas:
//
// 1. Faixa provável da banca nas próximas N sessões (leque de 10% a 90%).
// 2. Se a sua queda atual é normal: em quantas simulações do mesmo
//    tamanho da sua amostra aparece uma queda igual ou maior.
//
// "ROI esperado" deixa o jogador testar outro ROI (ex.: o que ele acha
// que é o real, se a amostra é curta): cada resultado sorteado é
// deslocado pra que a média bata com esse ROI.

export const AMOSTRA_MINIMA_VARIANCIA = 20;

// Sorteio com semente: o leque não "treme" a cada renderização.
function gerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantil(ordenado: number[], q: number): number {
  if (ordenado.length === 0) return 0;
  const pos = (ordenado.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ordenado[base] + (ordenado[Math.min(base + 1, ordenado.length - 1)] - ordenado[base]) * resto;
}

export interface FaixaPasso {
  passo: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface Variancia {
  amostra: number;
  roiHistorico: number;
  roiUsado: number;
  leque: FaixaPasso[];
  /** % das simulações com queda igual ou maior que a atual (null sem queda). */
  chanceQueda: number | null;
  /** Maior queda típica (mediana) numa amostra do seu tamanho. */
  quedaTipica: number;
}

export function simularVariancia(
  sessoes: Session[],
  { inicio, roiEsperado = null, horizonte = 100, simulacoes = 1000, quedaAtual = 0 }: {
    inicio: number;
    roiEsperado?: number | null;
    horizonte?: number;
    simulacoes?: number;
    quedaAtual?: number;
  },
): Variancia | null {
  if (sessoes.length < AMOSTRA_MINIMA_VARIANCIA) return null;
  const inv = sessoes.map(invested);
  const totalInv = inv.reduce((a, b) => a + b, 0);
  const brutos = sessoes.map(net);
  const roiHistorico = totalInv > 0 ? (brutos.reduce((a, b) => a + b, 0) / totalInv) * 100 : 0;
  const roiUsado = roiEsperado ?? roiHistorico;
  const delta = (roiUsado - roiHistorico) / 100;
  const resultados = brutos.map((r, i) => r + delta * inv[i]);
  const n = resultados.length;
  const sorteio = gerador(n * 7919 + Math.round(roiUsado * 100));

  // 1. Leque das próximas `horizonte` sessões.
  const porPasso: number[][] = Array.from({ length: horizonte + 1 }, () => []);
  for (let s = 0; s < simulacoes; s++) {
    let banca = inicio;
    porPasso[0].push(banca);
    for (let p = 1; p <= horizonte; p++) {
      banca += resultados[Math.floor(sorteio() * n)];
      porPasso[p].push(banca);
    }
  }
  const leque = porPasso.map((vals, passo) => {
    const o = vals.sort((a, b) => a - b);
    return { passo, p10: quantil(o, 0.1), p25: quantil(o, 0.25), p50: quantil(o, 0.5), p75: quantil(o, 0.75), p90: quantil(o, 0.9) };
  });

  // 2. Maior queda em sequências do tamanho da sua amostra.
  const tamanho = Math.min(n, 400);
  const quedas: number[] = [];
  let comQuedaMaior = 0;
  const rodadas = Math.min(simulacoes, 600);
  for (let s = 0; s < rodadas; s++) {
    let acc = 0;
    let pico = 0;
    let maior = 0;
    for (let p = 0; p < tamanho; p++) {
      acc += resultados[Math.floor(sorteio() * n)];
      pico = Math.max(pico, acc);
      maior = Math.max(maior, pico - acc);
    }
    quedas.push(maior);
    if (quedaAtual > 0 && maior >= quedaAtual) comQuedaMaior += 1;
  }
  quedas.sort((a, b) => a - b);

  return {
    amostra: n,
    roiHistorico,
    roiUsado,
    leque,
    chanceQueda: quedaAtual > 0 ? (comQuedaMaior / rodadas) * 100 : null,
    quedaTipica: quantil(quedas, 0.5),
  };
}
