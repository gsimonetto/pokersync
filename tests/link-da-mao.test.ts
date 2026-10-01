import { describe, expect, it } from "vitest";
import { parseHand } from "@/lib/poker/hand-parser";
import { linkConstrutorDaMao, spotDaMao } from "@/lib/ranges/link-da-mao";
import { traduzirPronto } from "@/lib/ranges/prontos";

// Mesa de 4 com o herói no BB (blinds 100/200, 50bb), como a mão que abria
// o range errado: o SB aumentou normal e o BB pagou.
function mao(preflop: string): ReturnType<typeof parseHand> {
  return parseHand(`PokerStars Hand #260000000001: Tournament #3990000001, $25+$2 USD Hold'em No Limit - Level V (100/200) - 2026/10/01 20:00:00 ET
Table '3990000001 1' 9-max Seat #2 is the button
Seat 1: Primeiro (10000 in chips)
Seat 2: Botao (10000 in chips)
Seat 3: Vilao (10000 in chips)
Seat 4: Hero (10000 in chips)
Vilao: posts small blind 100
Hero: posts big blind 200
*** HOLE CARDS ***
Dealt to Hero [2h Kh]
${preflop}
*** SUMMARY ***
Total pot 1200 | Rake 0`);
}

describe("situação da mão pro Construtor", () => {
  it("SB aumenta normal e o BB paga: pagar contra aumento, nunca all-in", () => {
    const m = mao("Primeiro: folds\nBotao: folds\nVilao: raises 400 to 600\nHero: calls 400");
    expect(spotDaMao(m)).toEqual({ acao: "pagar", contra: "aumento", vs: "SB" });
    expect(linkConstrutorDaMao(m)).toContain("contra=aumento");
  });

  it("SB vai de all-in e o BB paga: pagar contra all-in", () => {
    const m = mao("Primeiro: folds\nBotao: folds\nVilao: raises 9800 to 10000 and is all-in\nHero: calls 9800");
    expect(spotDaMao(m)).toEqual({ acao: "pagar", contra: "allin", vs: "SB" });
  });

  it("BB volta all-in por cima de um aumento: all-in contra aumento", () => {
    const m = mao("Primeiro: folds\nBotao: folds\nVilao: raises 400 to 600\nHero: raises 9800 to 10000 and is all-in");
    expect(spotDaMao(m)).toEqual({ acao: "allin", contra: "aumento", vs: "SB" });
  });

  it("aumento e alguém pagando antes do herói: pote com vários (sem range pronto)", () => {
    const m = mao("Primeiro: raises 400 to 600\nBotao: calls 600\nVilao: folds\nHero: calls 400");
    expect(spotDaMao(m)).toEqual({ acao: "pagar", contra: "varios", vs: null });
  });

  it("foge de um aumento normal: o range de pagar contra aumento", () => {
    const m = mao("Primeiro: folds\nBotao: raises 400 to 600\nVilao: folds\nHero: folds");
    expect(spotDaMao(m)).toEqual({ acao: "pagar", contra: "aumento", vs: "BTN" });
  });
});

describe("ranges prontos sabem contra o quê", () => {
  const linha = (spot: string, label: string) => traduzirPronto({ spot_id: spot, stack_bb: 50, action_label: label, range_string: "AA" });
  it("pagar all-in é contra all-in", () => {
    const p = linha("solver_pushfold_sb_vs_bb_50bb", "BB_CALL_VS_SHOVE");
    expect([p.acao, p.contra, p.vsPosicao]).toEqual(["pagar", "allin", "SB"]);
  });
  it("3-bet all-in é contra aumento normal", () => {
    const p = linha("solver_sb_vs_bb_50bb", "BB_3BET_SHOVE");
    expect([p.acao, p.contra]).toEqual(["allin", "aumento"]);
  });
  it("all-in direto do SB é sem ninguém no pote", () => {
    const p = linha("solver_pushfold_sb_vs_bb_50bb", "SB_SHOVE");
    expect([p.titulo, p.acao, p.contra]).toEqual(["SB vai de all-in", "allin", "nada"]);
  });
});
