import { describe, expect, it } from "vitest";
import { filtrarPayoutsPorCorte, sessoesBancaDesde, sessoesDesde } from "@/lib/services/analysis-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import type { TournamentPayout } from "@/lib/services/tournament-payout-service";
import type { Session } from "@/lib/bankroll/types";

const torneio = (id: string, jogadoEm: string): HandSession => ({
  id,
  user_id: "u",
  kind: "tournament",
  label: id,
  tournament_id_ps: `T${id}`,
  format_type: "regular",
  bounty_current: null,
  buyin: 10,
  reentries: 0,
  reentries_checked_at: null,
  table_size: 9,
  stakes: null,
  champion: false,
  final_place: null,
  reached_ft: false,
  bankroll_excluded: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-29T00:00:00Z",
  last_played_at: jogadoEm,
});

const premio = (torneioId: string, chegouEm: string): TournamentPayout => ({
  id: torneioId,
  tournamentIdPs: torneioId,
  source: "agent",
  pokerRoom: null,
  totalEntrants: null,
  prizePool: null,
  places: [],
  heroFinishPlace: null,
  heroPayoutAmount: 50,
  fetchedAt: chegouEm,
  updatedAt: chegouEm,
});

const CORTE = "2026-09-15T12:00:00.000Z";
const antes = torneio("a", "2026-09-10T20:00:00Z");
const depois = torneio("d", "2026-09-20T20:00:00Z");

describe("corte do Performance (Apagar / De hoje em diante)", () => {
  it("sem corte, tudo vale", () => {
    expect(sessoesDesde([antes, depois], null)).toHaveLength(2);
  });

  it("torneio vale pela última mão jogada", () => {
    expect(sessoesDesde([antes, depois], CORTE).map((s) => s.id)).toEqual(["d"]);
  });

  it("prêmio de torneio cortado não conta, mesmo sincronizado depois", () => {
    const payouts = [premio("Ta", "2026-09-20T00:00:00Z"), premio("Td", "2026-09-21T00:00:00Z")];
    expect(filtrarPayoutsPorCorte(payouts, [antes, depois], CORTE).map((p) => p.id)).toEqual(["Td"]);
  });

  it("prêmio só de resumo (sem mão) vale pela data em que chegou", () => {
    const payouts = [premio("Tx", "2026-09-10T00:00:00Z"), premio("Ty", "2026-09-20T00:00:00Z")];
    expect(filtrarPayoutsPorCorte(payouts, [antes, depois], CORTE).map((p) => p.id)).toEqual(["Ty"]);
  });

  it("sessão da banca: importada segue o torneio; manual segue a data", () => {
    const s = (p: Partial<Session>): Session => ({ id: "x", date: "2026-09-20", format: "MTT", buyIn: 1, reentries: 0, cashout: 0, ...p });
    const sessoes = [
      s({ id: "imp-antes", importedHandSessionId: "a", date: "2026-09-29" }),
      s({ id: "imp-depois", importedHandSessionId: "d", date: "2026-09-29" }),
      s({ id: "manual-antes", date: "2026-09-01" }),
      s({ id: "manual-depois", date: "2026-09-25" }),
    ];
    expect(sessoesBancaDesde(sessoes, [depois], CORTE).map((x) => x.id)).toEqual(["imp-depois", "manual-depois"]);
  });
});
