import { describe, expect, it } from "vitest";
import { parseHand } from "@/lib/poker/hand-parser";
import { contarRebuys, heroiQuebrou } from "@/lib/poker/rebuy-detector";
import { CORPO_GANHA, CORPO_QUEBRA, CORPO_SOBRA, maoEn } from "./maos";

const quebra = (id: number) => parseHand(maoEn({ id, heroiFichas: 1500, corpo: CORPO_QUEBRA }));
const ganha = (id: number) => parseHand(maoEn({ id, heroiFichas: 1500, corpo: CORPO_GANHA }));
const sobra = (id: number) => parseHand(maoEn({ id, heroiFichas: 5000, corpo: CORPO_SOBRA }));

describe("herói quebrou?", () => {
  it("all-in pago e perdido: quebrou", () => expect(heroiQuebrou(quebra(1))).toBe(true));
  it("all-in e ganhou: não quebrou", () => expect(heroiQuebrou(ganha(2))).toBe(false));
  it("perdeu mas recebeu a sobra não paga: não quebrou", () => expect(heroiQuebrou(sobra(3))).toBe(false));
  it("sem herói identificado: não quebrou", () => expect(heroiQuebrou({ ...quebra(4), heroName: null })).toBe(false));
});

describe("contagem de rebuys", () => {
  it("quebrar e voltar ao mesmo torneio conta 1", () => {
    expect(contarRebuys([quebra(1), ganha(2)])).toBe(1);
  });

  it("a última quebra é a eliminação, não rebuy", () => {
    expect(contarRebuys([quebra(1), ganha(2), quebra(3)])).toBe(1);
    expect(contarRebuys([quebra(1)])).toBe(0);
  });

  it("ordem das mãos não importa (usa o número da mão)", () => {
    expect(contarRebuys([quebra(3), ganha(2), quebra(1), sobra(4)])).toBe(2);
  });

  it("torneio sem quebra não tem rebuy", () => {
    expect(contarRebuys([ganha(1), sobra(2), ganha(3)])).toBe(0);
  });

  it("número de mão grande (maior que 2^53) ordena certo", () => {
    const a = { ...quebra(1), handId: "9007199254740993" };
    const b = { ...ganha(2), handId: "9007199254740995" };
    expect(contarRebuys([b, a])).toBe(1);
  });
});
