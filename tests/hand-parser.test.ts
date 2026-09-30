import { describe, expect, it } from "vitest";
import { parseHand, parseSession, valorMonetario } from "@/lib/poker/hand-parser";
import { extractTournamentInfo } from "@/lib/services/hand-session-service";
import { CORPO_QUEBRA, MAO_PKO_EN, MAO_PKO_PT, maoEn } from "./maos";

describe("valorMonetario", () => {
  it.each([
    ["7,50", 7.5],
    ["7.50", 7.5],
    ["16,50", 16.5],
    ["3,5", 3.5],
    ["50", 50],
    ["1,500", 1500],
    ["1.500", 1500],
    ["1,234.50", 1234.5],
    ["1.234,50", 1234.5],
  ])("%s vira %d", (bruto, esperado) => {
    expect(valorMonetario(bruto)).toBe(esperado);
  });
});

describe("bounty (PKO de $16,50)", () => {
  it.each([
    ["português", MAO_PKO_PT],
    ["inglês", MAO_PKO_EN],
  ])("lê buy-in, bounty de cada assento e bounty ganho em %s", (_idioma, texto) => {
    const mao = parseHand(texto);
    const info = extractTournamentInfo(mao);
    expect(info.buyin).toBe(16.5);
    expect(info.heroBountyFromHand).toBe(11.25);
    expect(info.looksLikeBounty).toBe(true);
    expect(mao.seats.map((s) => s.bountyValue)).toEqual([7.5, 11.25]);
    expect(mao.heroBountiesWon).toBe(1);
    expect(mao.heroBountyCashWon).toBe(3.75);
  });
});

describe("formato do jogo", () => {
  const corpo = "Hero: folds\n*** SUMMARY ***";
  it("mesa de 3 é Spin & Go", () => {
    expect(parseHand(maoEn({ id: 1, heroiFichas: 500, corpo, mesa: 3 })).format).toBe("Spin");
  });
  it("mesa de 2 é SNG", () => {
    expect(parseHand(maoEn({ id: 2, heroiFichas: 500, corpo, mesa: 2 })).format).toBe("SNG");
  });
  it("mesa cheia continua MTT", () => {
    expect(parseHand(maoEn({ id: 3, heroiFichas: 500, corpo, mesa: 9 })).format).toBe("MTT");
  });
});

describe("mão completa", () => {
  const mao = parseHand(maoEn({ id: 101, heroiFichas: 1500, corpo: CORPO_QUEBRA }));

  it("identifica herói, cartas, board e vencedor", () => {
    expect(mao.site).toBe("pokerstars");
    expect(mao.handId).toBe("101");
    expect(mao.heroName).toBe("Hero");
    expect(mao.heroCards).toEqual(["Ah", "Kh"]);
    expect(mao.board).toEqual(["2c", "3d", "9s", "Td", "Jc"]);
    expect(mao.winner).toBe("Vilao");
    expect(mao.winnings).toEqual([{ player: "Vilao", amount: 3000 }]);
    expect(mao.pot).toBe(3000);
  });

  it("guarda os raises com o total da aposta", () => {
    const preflop = mao.streets.find((s) => s.name === "preflop")!;
    const allin = preflop.actions.find((a) => a.player === "Hero" && a.action === "raises")!;
    expect(allin.raiseTo).toBe(1500);
    expect(allin.isAllIn).toBe(true);
  });

  it("separa várias mãos coladas juntas", () => {
    const texto = [101, 102, 103].map((id) => maoEn({ id, heroiFichas: 1500, corpo: CORPO_QUEBRA })).join("\n\n\n");
    expect(parseSession(texto).map((m) => m.handId)).toEqual(["101", "102", "103"]);
  });
});
