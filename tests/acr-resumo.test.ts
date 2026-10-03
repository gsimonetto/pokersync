import { describe, expect, it } from "vitest";
import { parseResumoAcr, colocacaoNoResumoAcr, parseTournamentSummary } from "@/lib/poker/tournament-summary-parser";
import { buyinDoArquivoResumoAcr, nomeEhDeBounty, nomeTorneioDoArquivoAcr } from "@/lib/poker/acr-arquivos";
import { parseHand } from "@/lib/poker/hand-parser";
import { extractTournamentInfo } from "@/lib/services/hand-session-service";
import { ACR_SEM_SHOWDOWN } from "./maos-acr";

// Resumo REAL da ACR (03/10/2026) reduzido a poucas linhas e com os nomes
// trocados. Mesmo formato: JSON numa linha só, nome repetido a cada
// reentrada e posições do topo ainda sem prêmio (torneio rolando).
const RESUMO = JSON.stringify({
  spec_version: "1.0.0",
  network_name: "WinningPokerNetwork",
  tournament_number: "T#36074377",
  start_date_utc: "2026-10-03T17:47:59Z",
  end_date_utc: "2026-10-03T18:26:16Z",
  currency: "USD",
  prize_pool: 20000,
  player_count: 308,
  tournament_finishes_and_winnings: [
    { player_name: "Vivo1", finish_position: 1, prize: 0, ticket_value: 0 },
    { player_name: "Reentra", finish_position: 63, prize: 0, ticket_value: 0 },
    { player_name: "Hero", finish_position: 103, prize: 0, ticket_value: 0 },
    { player_name: "Reentra", finish_position: 202, prize: 0, ticket_value: 0 },
    { player_name: "Hero", finish_position: 230, prize: 0, ticket_value: 0 },
  ],
  site_name: "AmericasCardroom",
  internal_version: "2.44.0",
});

const ARQUIVO_RESUMO = "TS20261003_T36074377_E1312590432_NL_Hold_em_50.00__5.00.ots";
const ARQUIVO_MAOS =
  "HH20261003_SCHEDULEDID-G36074377T20_TN-PKO - 20000 GTD_GAMETYPE-Holdem_LIMIT-no_CUR-REAL_OND-F_BUYIN-0.txt";

describe("resumo de torneio da ACR", () => {
  it("lê torneio, entradas, garantido e início", () => {
    const r = parseResumoAcr(RESUMO)!;
    expect(r).toMatchObject({ tournamentIdPs: "36074377", totalEntrants: 308, prizePool: 20000, inicio: "2026-10-03T17:47:59.000Z" });
  });

  it("acha a colocação do herói pela entrada mais recente", () => {
    expect(colocacaoNoResumoAcr(parseResumoAcr(RESUMO)!, "Hero")).toEqual({ posicao: 103, premio: 0 });
    expect(colocacaoNoResumoAcr(parseResumoAcr(RESUMO)!, "Ninguem")).toBeNull();
  });

  it("não confunde com outros formatos", () => {
    expect(parseResumoAcr("PokerStars Tournament #1, No Limit Hold'em")).toBeNull();
    expect(parseResumoAcr(JSON.stringify({ network_name: "Outra", tournament_number: "T#1" }))).toBeNull();
    expect(parseResumoAcr("{ quebrado")).toBeNull();
    // O leitor de texto (PokerStars) não lê nada do JSON -- é por isso
    // que o resumo da ACR tem leitor próprio.
    expect(parseTournamentSummary(RESUMO).tournamentIdPs).toBeNull();
  });
});

describe("nome dos arquivos da ACR", () => {
  it("tira o buy-in do nome do resumo", () => {
    expect(buyinDoArquivoResumoAcr(ARQUIVO_RESUMO)).toBe(55);
    expect(buyinDoArquivoResumoAcr("TS20261003_T1_E2_NL_Hold_em_10.00__10.00__2.00.ots")).toBe(22);
    expect(buyinDoArquivoResumoAcr(ARQUIVO_MAOS)).toBeNull();
    expect(buyinDoArquivoResumoAcr(null)).toBeNull();
  });

  it("tira o nome do torneio do arquivo de mãos", () => {
    expect(nomeTorneioDoArquivoAcr(ARQUIVO_MAOS)).toBe("PKO - 20000 GTD");
    expect(nomeTorneioDoArquivoAcr(ARQUIVO_RESUMO)).toBeNull();
    expect(nomeEhDeBounty("PKO - 20000 GTD")).toBe(true);
    expect(nomeEhDeBounty("Mini Venom")).toBe(false);
  });

  it("o torneio criado pelas mãos já sai com nome e como PKO", () => {
    const mao = parseHand(ACR_SEM_SHOWDOWN);
    expect(extractTournamentInfo(mao, ARQUIVO_MAOS)).toMatchObject({
      tournamentIdPs: "36074377",
      platform: "ACR",
      tournamentName: "ACR / PKO - 20000 GTD",
      looksLikeBounty: true,
      buyin: null,
    });
    expect(extractTournamentInfo(mao).tournamentName).toBe("Torneio #36074377");
  });
});
