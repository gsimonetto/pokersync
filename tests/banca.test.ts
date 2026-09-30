import { describe, expect, it } from "vitest";
import { aggregate, currenciesInUse, invested, net, netWorth, platformBalances } from "@/lib/bankroll/calc";
import { consolidarEmReais, saldosPorMoeda } from "@/lib/bankroll/consolidado";
import type { Session, Transaction } from "@/lib/bankroll/types";

let seq = 0;
const sessao = (s: Partial<Session>): Session => ({
  id: `s${++seq}`,
  date: "2026-09-20",
  format: "MTT",
  buyIn: 10,
  reentries: 0,
  cashout: 0,
  ...s,
});
const tx = (t: Partial<Transaction>): Transaction => ({ id: `t${++seq}`, date: "2026-09-20", type: "deposito", amount: 0, ...t });

describe("custo e resultado da sessão", () => {
  it("rebuys multiplicam o buy-in", () => {
    const s = sessao({ buyIn: 11, reentries: 2, cashout: 50 });
    expect(invested(s)).toBe(33);
    expect(net(s)).toBe(17);
  });

  it("staking: jogador com 50% da ação e markup 1,2", () => {
    // Investido do bolso: 100 × 50% = 50. Retorno: 300 × 50% + markup (100 × 50% × 0,2 = 10) = 160.
    const s = sessao({ buyIn: 100, cashout: 300, ownPct: 50, markup: 1.2 });
    expect(invested(s)).toBe(50);
    expect(net(s)).toBeCloseTo(110);
  });

  it("ownPct inválido cai em 100% (jogador não some da própria sessão)", () => {
    expect(invested(sessao({ buyIn: 10, ownPct: 0 }))).toBe(10);
    expect(invested(sessao({ buyIn: 10, ownPct: 150 }))).toBe(10);
  });
});

describe("agregado", () => {
  const lista = [
    sessao({ buyIn: 10, cashout: 0 }),
    sessao({ buyIn: 10, reentries: 1, cashout: 60 }),
    sessao({ format: "Spin", buyIn: 5, cashout: 15 }),
    sessao({ format: "Cash", buyIn: 100, cashout: 80 }),
  ];
  const a = aggregate(lista);

  it("soma investido (com rebuy) e lucro", () => {
    expect(a.totalInvested).toBe(10 + 20 + 5 + 100);
    expect(a.profit).toBe(155 - 135);
  });

  it("ITM só conta torneios (MTT, SNG, Spin)", () => {
    expect(a.tourneyCount).toBe(3);
    expect(a.itmCount).toBe(2);
    expect(a.itm).toBeCloseTo(66.67, 1);
  });

  it("lista vazia não divide por zero", () => {
    expect(aggregate([])).toMatchObject({ n: 0, roi: 0, itm: 0, avgBuyIn: 0 });
  });
});

describe("moedas", () => {
  const sessoes = [sessao({ buyIn: 10, cashout: 30, currency: "USD" }), sessao({ buyIn: 100, cashout: 50 })];
  const transacoes = [tx({ type: "deposito", amount: 200, currency: "USD" }), tx({ type: "saque", amount: 20 })];

  it("lista as moedas em uso (sem moeda = BRL)", () => {
    expect(currenciesInUse(sessoes, transacoes).sort()).toEqual(["BRL", "USD"]);
  });

  it("saldo separado por moeda; banca inicial só entra em BRL", () => {
    const saldos = saldosPorMoeda(sessoes, transacoes, 1000);
    expect(saldos.find((s) => s.moeda === "USD")!.saldo).toBe(20 + 200);
    expect(saldos.find((s) => s.moeda === "BRL")!.saldo).toBe(1000 - 50 - 20);
  });

  it("consolida em reais pela cotação", () => {
    const c = consolidarEmReais(saldosPorMoeda(sessoes, transacoes, 1000), (m) => (m === "USD" ? 5 : null));
    expect(c.total).toBe(930 + 220 * 5);
    expect(c.semCotacao).toEqual([]);
  });

  it("moeda sem cotação fica de fora e é avisada", () => {
    const c = consolidarEmReais(saldosPorMoeda(sessoes, transacoes, 1000), () => null);
    expect(c.total).toBe(930);
    expect(c.semCotacao).toEqual(["USD"]);
  });
});

describe("patrimônio e plataformas", () => {
  const transacoes = [
    tx({ type: "deposito", amount: 500, venue: "GGPoker" }),
    tx({ type: "saque", amount: 100, venue: "GGPoker" }),
    tx({ type: "caixinha", amount: 50 }),
    tx({ type: "rakeback", amount: 30, venue: "GGPoker" }),
    tx({ type: "despesa", amount: 80 }),
  ];

  it("saque e caixinha tiram da banca de jogo mas não são perda", () => {
    const n = netWorth(1000, 200, transacoes);
    expect(n.lucroReal).toBe(200 + 30 - 80);
    expect(n.netWorth).toBe(1000 + 500 + 150);
    expect(n.playingBankroll).toBe(1650 - 100 - 50);
  });

  it("saldo por sala cruza sessões e transações; despesa não sai de sala", () => {
    const sessoes = [sessao({ venue: "GGPoker", buyIn: 10, cashout: 60 }), sessao({ buyIn: 10 })];
    const gg = platformBalances(sessoes, transacoes).find((p) => p.platform === "GGPoker")!;
    expect(gg.balance).toBe(50 + 500 + 30 - 100);
  });
});
