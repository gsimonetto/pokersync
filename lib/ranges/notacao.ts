// Range = grupo de mãos com peso (igual ao Flopzilla): cada mão da grade
// tem um peso de 0 a 100 (100 = sempre no range, 50 = metade das vezes) e,
// se quiser, um combo específico tem peso próprio ("AsKs": 100 com "AKs" a
// 0 = só o A♠K♠). Mão ausente = fora do range.
//
// Texto: o formato de sempre dos programas de poker ("22+, A2s+, KTo+,
// 76s"), com peso opcional como "A5s:50" ou em bloco "[50]A5s, A4s[/50]".

import { HAND_STRENGTH_RANKING } from "../poker/hand-strength-ranking";
import { VALORES, TODAS_AS_MAOS, combosDaMao, combosPorMao, maoDoCombo } from "./cartas";

export type Pesos = Record<string, number>;

/** Peso efetivo de cada combo: mão -> peso, com o combo sobrepondo quando existe. */
export function combosDoRange(pesos: Pesos, pesosCombo: Pesos = {}, mortas: Set<string> = new Set()): Map<string, number> {
  const out = new Map<string, number>();
  const maos = new Set([...Object.keys(pesos), ...Object.keys(pesosCombo).map(maoDoCombo)]);
  for (const mao of maos) {
    for (const combo of combosDaMao(mao)) {
      if (mortas.has(combo.slice(0, 2)) || mortas.has(combo.slice(2, 4))) continue;
      const p = pesosCombo[combo] ?? pesos[mao] ?? 0;
      if (p > 0) out.set(combo, p / 100);
    }
  }
  return out;
}

/** Combos contados com peso (AKs a 50% = 2 combos). */
export function contarCombos(pesos: Pesos, pesosCombo: Pesos = {}): number {
  let soma = 0;
  for (const p of combosDoRange(pesos, pesosCombo).values()) soma += p;
  return soma;
}

/** Peso médio da mão (0-100) considerando os combos com peso próprio. */
export function pesoDaMao(pesos: Pesos, pesosCombo: Pesos, mao: string): number {
  const combos = combosDaMao(mao);
  const temCombo = combos.some((c) => c in pesosCombo);
  if (!temCombo) return pesos[mao] ?? 0;
  let soma = 0;
  for (const c of combos) soma += pesosCombo[c] ?? pesos[mao] ?? 0;
  return soma / combos.length;
}

/** "Top X%" das mãos mais fortes (por equidade contra mão aleatória). */
export function topPercent(pct: number): Pesos {
  const alvo = (Math.max(0, Math.min(100, pct)) / 100) * 1326;
  const out: Pesos = {};
  let acumulado = 0;
  for (const mao of HAND_STRENGTH_RANKING) {
    if (acumulado >= alvo - 0.5) break;
    out[mao] = 100;
    acumulado += combosPorMao(mao);
  }
  return out;
}

const v = (c: string) => VALORES.indexOf(c);

/** Lê o texto de um range. Devolve também o que não entendeu. */
export function lerTextoRange(texto: string): { pesos: Pesos; pesosCombo: Pesos; erros: string[] } {
  const pesos: Pesos = {};
  const pesosCombo: Pesos = {};
  const erros: string[] = [];
  // [50]A5s, A4s[/50] -> A5s:50, A4s:50
  const expandido = texto.replace(/\[(\d{1,3}(?:[.,]\d+)?)\]([^[]*)\[\/\1\]/g, (_m, peso: string, dentro: string) =>
    dentro
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((t) => `${t}:${peso}`)
      .join(","),
  );
  for (const bruto of expandido.split(/[,\s]+/)) {
    const t0 = bruto.trim();
    if (!t0) continue;
    const [corpo, pesoTxt] = t0.split(":");
    const peso = pesoTxt == null ? 100 : Math.max(0, Math.min(100, Number(pesoTxt.replace(",", "."))));
    if (Number.isNaN(peso)) {
      erros.push(t0);
      continue;
    }
    const t = corpo.replace(/10/g, "T");
    // combo específico: AsKs
    const combo = t.match(/^([2-9TJQKA])([shdc])([2-9TJQKA])([shdc])$/i);
    if (combo) {
      const a = `${combo[1].toUpperCase()}${combo[2].toLowerCase()}`;
      const b = `${combo[3].toUpperCase()}${combo[4].toLowerCase()}`;
      const [alta, baixa] = v(a[0]) > v(b[0]) || (a[0] === b[0] && "shdc".indexOf(a[1]) < "shdc".indexOf(b[1])) ? [a, b] : [b, a];
      if (alta === baixa) erros.push(t0);
      else pesosCombo[alta + baixa] = peso;
      continue;
    }
    const tu = t.toUpperCase();
    // pares: 22, 22+, 22-88 (ou 88-22)
    let m = tu.match(/^([2-9TJQKA])\1(\+)?(?:-([2-9TJQKA])\3)?$/);
    if (m) {
      const a = v(m[1]);
      const b = m[2] ? 12 : m[3] ? v(m[3]) : a;
      for (let k = Math.min(a, b); k <= Math.max(a, b); k++) pesos[VALORES[k] + VALORES[k]] = peso;
      continue;
    }
    // não-pares: AKs, AKo, AK (os dois), A2s+, A2s-A9s
    m = tu.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?(\+)?(?:-([2-9TJQKA])([2-9TJQKA])([SO])?)?$/);
    if (m) {
      let alta = v(m[1]);
      let baixa = v(m[2]);
      if (alta === baixa) {
        erros.push(t0);
        continue;
      }
      if (baixa > alta) [alta, baixa] = [baixa, alta];
      const tipos = m[3] ? [m[3].toLowerCase()] : ["s", "o"];
      let fim = baixa;
      if (m[4]) fim = alta - 1;
      else if (m[6]) {
        if (v(m[5]) !== alta) {
          erros.push(t0);
          continue;
        }
        fim = v(m[6]);
      }
      for (let k = Math.min(baixa, fim); k <= Math.max(baixa, fim); k++) for (const tipo of tipos) pesos[VALORES[alta] + VALORES[k] + tipo] = peso;
      continue;
    }
    erros.push(t0);
  }
  return { pesos, pesosCombo, erros };
}

// Junta uma lista de valores de kicker (índices) em sequências.
function sequencias(valores: number[]): number[][] {
  const ord = [...valores].sort((a, b) => b - a);
  const res: number[][] = [];
  for (const x of ord) {
    const ult = res[res.length - 1];
    if (ult && ult[ult.length - 1] === x + 1) ult.push(x);
    else res.push([x]);
  }
  return res;
}

function textoDoGrupo(maos: string[]): string[] {
  const partes: string[] = [];
  const conjunto = new Set(maos);
  // pares
  const pares = [...VALORES].map((_, i) => i).filter((i) => conjunto.has(VALORES[i] + VALORES[i]));
  for (const s of sequencias(pares)) {
    const alto = s[0];
    const baixo = s[s.length - 1];
    if (alto === 12 && s.length > 1) partes.push(`${VALORES[baixo]}${VALORES[baixo]}+`);
    else if (s.length > 1) partes.push(`${VALORES[alto]}${VALORES[alto]}-${VALORES[baixo]}${VALORES[baixo]}`);
    else partes.push(`${VALORES[alto]}${VALORES[alto]}`);
  }
  // suited e offsuit, por carta alta
  for (const tipo of ["s", "o"]) {
    for (let alta = 12; alta >= 1; alta--) {
      const kickers: number[] = [];
      for (let k = 0; k < alta; k++) if (conjunto.has(VALORES[alta] + VALORES[k] + tipo)) kickers.push(k);
      for (const s of sequencias(kickers)) {
        const maior = s[0];
        const menor = s[s.length - 1];
        const A = VALORES[alta];
        if (maior === alta - 1 && s.length > 1) partes.push(`${A}${VALORES[menor]}${tipo}+`);
        else if (s.length > 1) partes.push(`${A}${VALORES[maior]}${tipo}-${A}${VALORES[menor]}${tipo}`);
        else partes.push(`${A}${VALORES[maior]}${tipo}`);
      }
    }
  }
  return partes;
}

/** Escreve o range em texto ("22+, A2s+, KTo+, [50]A5o-A2o[/50]"). */
export function escreverTextoRange(pesos: Pesos, pesosCombo: Pesos = {}): string {
  const porPeso = new Map<number, string[]>();
  for (const mao of TODAS_AS_MAOS) {
    const p = Math.round(pesos[mao] ?? 0);
    if (p <= 0) continue;
    porPeso.set(p, [...(porPeso.get(p) ?? []), mao]);
  }
  const partes: string[] = [];
  for (const [p, maos] of [...porPeso].sort((a, b) => b[0] - a[0])) {
    const texto = textoDoGrupo(maos).join(", ");
    partes.push(p === 100 ? texto : `[${p}]${texto}[/${p}]`);
  }
  for (const [combo, p] of Object.entries(pesosCombo)) {
    const r = Math.round(p);
    partes.push(r === 100 ? combo : `${combo}:${r}`);
  }
  return partes.join(", ");
}
