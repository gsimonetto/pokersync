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

// Caso real (PKO de $27 no PokerStars, 2026-10): antes postados antes de
// "*** HOLE CARDS ***", herói no BB com 2940 = 20 de ante + all-in "to
// 2920". O ante entrava na aposta do blind e a conta dava 2920 < 2940.
const maoComAnte = (id: number, heroiFichas: number, corpo: string) =>
  parseHand(`PokerStars Hand #${id}: Tournament #4000000001, $12.25+$12.25+$2.50 USD Hold'em No Limit - Level V (80/160) - 2026/10/01 11:36:3${id % 10} ET
Table '4000000001 9' 8-max Seat #3 is the button
Seat 1: Vilao (11036 in chips, $12.25 bounty)
Seat 2: Outro (5000 in chips, $12.25 bounty)
Seat 6: Hero (${heroiFichas} in chips, $12.25 bounty)
Vilao: posts the ante 20
Outro: posts the ante 20
Hero: posts the ante 20
Outro: posts small blind 80
Hero: posts big blind 160
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
${corpo}`);

const ALLIN_DO_BB = `Vilao: raises 160 to 320
Outro: folds
Hero: raises 2600 to 2920 and is all-in
Vilao: raises 8116 to 11036 and is all-in
Uncalled bet (8116) returned to Vilao
*** FLOP *** [Js 9d 5s]
*** TURN *** [Js 9d 5s] [2s]
*** RIVER *** [Js 9d 5s 2s] [8s]
*** SHOW DOWN ***
Vilao collected 6320 from pot
*** SUMMARY ***`;

const FOLD_DO_BB = `Vilao: raises 160 to 320
Outro: folds
Hero: folds
Vilao collected 500 from pot
*** SUMMARY ***`;

describe("rebuy com ante (PokerStars)", () => {
  it("lê o tipo dos posts que vêm antes das cartas", () => {
    const posts = maoComAnte(1, 2940, ALLIN_DO_BB).streets[0].actions.filter((a) => a.action === "posts");
    expect(posts.map((a) => a.postType)).toEqual(["ante", "ante", "ante", "small blind", "big blind"]);
  });

  it("all-in do BB com ante: quebrou", () => expect(heroiQuebrou(maoComAnte(1, 2940, ALLIN_DO_BB))).toBe(true));

  it("mão antiga salva sem tipo de post e sem marca de all-in: a conta de fichas também acerta", () => {
    const mao = maoComAnte(1, 2940, ALLIN_DO_BB);
    const antiga = {
      ...mao,
      streets: mao.streets.map((r) => ({ ...r, actions: r.actions.map(({ postType: _t, isAllIn: _a, ...a }) => a) })),
    };
    expect(heroiQuebrou(antiga)).toBe(true);
  });

  it("quebrar e voltar com 10000 fichas conta 1 rebuy", () => {
    expect(contarRebuys([maoComAnte(1, 2940, ALLIN_DO_BB), maoComAnte(2, 10000, FOLD_DO_BB)])).toBe(1);
  });

  it("só pagar ante e blind e desistir não é quebrar", () => {
    expect(heroiQuebrou(maoComAnte(3, 2940, FOLD_DO_BB))).toBe(false);
  });
});
