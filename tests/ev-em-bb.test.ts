import { describe, expect, it } from "vitest";
import { bbPor100, emBb, fmtBbEv, valorDoBb } from "@/lib/poker/ev-em-bb";

// Valores reais gravados pelo motor (tabela drills).
const sb15 = { matchup: "sb_vs_bb", sbOpen: { ev_fold: 88.044 }, bbJam: { ev_fold: 85.226 } };
const btn15 = { matchup: "btn_vs_bb", sbOpen: { ev_fold: 90.848 }, bbJam: { ev_fold: 84.971 } };
const sb100 = { matchup: "sb_vs_bb", sbOpen: { ev_fold: 258.073 }, bbJam: { ev_fold: 257.262 } };

describe("valor de 1 bb no spot", () => {
  it("SB: a diferença entre os folds é meio bb", () => {
    expect(valorDoBb(sb15)).toBeCloseTo(5.636, 2);
  });
  it("BTN: não pagou blind, a diferença é 1 bb", () => {
    expect(valorDoBb(btn15)).toBeCloseTo(5.877, 2);
  });
  it("stack maior: cada bb vale menos na premiação", () => {
    expect(valorDoBb(sb100)!).toBeLessThan(valorDoBb(sb15)!);
  });
  it("dado quebrado não vira número", () => {
    expect(valorDoBb({ ...sb15, bbJam: { ev_fold: 90 } })).toBeNull();
    expect(valorDoBb({ ...sb15, sbOpen: { ev_fold: Number.NaN } })).toBeNull();
  });
});

describe("conversão e bb/100", () => {
  it("jam de 72o com 15 bb custa ~0,46 bb", () => {
    // 72o: fold 88,044 x all-in 85,43 -> diferença 2,61 na escala do motor.
    expect(emBb(2.61, valorDoBb(sb15))).toBeCloseTo(0.463, 2);
  });
  it("sem valor do bb, sem conversão", () => {
    expect(emBb(2.61, null)).toBeNull();
  });
  it("bb/100 = perda média x 100", () => {
    expect(bbPor100(3, 60)).toBe(5);
    expect(bbPor100(0, 0)).toBeNull();
  });
  it("formato brasileiro com casas conforme o tamanho", () => {
    expect(fmtBbEv(0.4631)).toBe("0,46 bb");
    expect(fmtBbEv(-2.345)).toBe("2,3 bb");
    expect(fmtBbEv(12.4)).toBe("12 bb");
    expect(fmtBbEv(0)).toBe("0 bb");
  });
});

describe("motor v2 (com ante)", () => {
  it("usa o valor de 1 bb gravado pelo motor", () => {
    expect(valorDoBb({ ...sb15, icmPorBb: 6.295 })).toBe(6.295);
  });
  it("valor inválido vira null", () => {
    expect(valorDoBb({ ...sb15, icmPorBb: 0 })).toBeNull();
  });
});
