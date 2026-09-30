import { describe, expect, it } from "vitest";
import { parseHeroFinishPlaceFromList, parseTournamentSummary } from "@/lib/poker/tournament-summary-parser";
import { MAX_LEVEL, xpForNextLevel } from "@/lib/services/xp-service";

describe("resumo de torneio", () => {
  const resumo = `PokerStars Tournament #3900000001, No Limit Hold'em
Buy-In: $7.50/$1.50 USD
1500 players
Total Prize Pool: $31,255.51 USD
Tournament started 2026/09/20 20:00:00 ET
  1: Campeao (Brasil), $4,500.00 (14.4%)
 37: Hero (Brasil), $150.00 (0.48%)
You finished in 37th place.
You received a total of $150.`;

  it("lê valores em dólar com vírgula de milhar sem multiplicar por 100", () => {
    const r = parseTournamentSummary(resumo);
    expect(r.tournamentIdPs).toBe("3900000001");
    expect(r.totalEntrants).toBe(1500);
    expect(r.prizePool).toBe(31255.51);
    expect(r.heroFinishPlace).toBe(37);
    expect(r.heroPayoutAmount).toBe(150);
  });

  it("acha a colocação do herói na lista quando a frase final não tem o número", () => {
    expect(parseHeroFinishPlaceFromList(resumo, "Hero")).toBe(37);
  });

  it("campo que não aparece fica nulo (nunca inventa número)", () => {
    expect(parseTournamentSummary("texto qualquer").heroPayoutAmount).toBeNull();
  });
});

describe("curva de nível", () => {
  it("do 1 ao 99 soma o mesmo XP que o banco (5 anos no ritmo máximo)", () => {
    let total = 0;
    for (let l = 1; l < MAX_LEVEL; l++) total += xpForNextLevel(l);
    expect(total).toBe(1922503);
  });

  it("cada nível pede mais que o anterior", () => {
    for (let l = 2; l < MAX_LEVEL; l++) expect(xpForNextLevel(l)).toBeGreaterThan(xpForNextLevel(l - 1));
  });
});
