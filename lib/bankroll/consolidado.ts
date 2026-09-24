import { aggregate, currenciesInUse, netWorth } from "./calc";
import type { Session, Transaction } from "./types";

// Banca somando TODAS as moedas numa só (em reais). Existe porque a tela
// inicial só contava lançamentos em BRL: quem depositou em dólar (ex.:
// US$ 305 na PokerStars) via "R$ 0" lá, enquanto a Gestão de Banca
// mostrava o saldo em dólar. Aqui cada moeda tem seu saldo calculado com
// a MESMA conta da Gestão de Banca (base + resultado + depósitos − saques
// − caixinha) e depois é convertida pela cotação.
//
// A banca inicial cadastrada (bankroll_settings) é sempre em reais, então
// só entra no saldo de BRL.

export interface SaldoMoeda {
  moeda: string;
  saldo: number;
  /** Resultado das sessões nessa moeda nos últimos 30 dias. */
  resultado30d: number;
}

const moedaDe = (m?: string) => m || "BRL";

export function saldosPorMoeda(sessoes: Session[], transacoes: Transaction[], base: number): SaldoMoeda[] {
  const moedas = currenciesInUse(sessoes, transacoes);
  if (!moedas.includes("BRL") && base !== 0) moedas.unshift("BRL");
  const corte = new Date();
  corte.setDate(corte.getDate() - 30);
  const iso = corte.toISOString().slice(0, 10);
  return moedas.map((moeda) => {
    const sess = sessoes.filter((s) => moedaDe(s.currency) === moeda);
    const tx = transacoes.filter((t) => moedaDe(t.currency) === moeda);
    const saldo = netWorth(moeda === "BRL" ? base : 0, aggregate(sess).profit, tx).playingBankroll;
    const resultado30d = aggregate(sess.filter((s) => s.date >= iso)).profit;
    return { moeda, saldo, resultado30d };
  });
}

export interface BancaConsolidada {
  /** Total em reais; null quando alguma moeda não tem cotação. */
  total: number | null;
  resultado30d: number | null;
  /** Moedas diferentes de BRL que entraram na conta (pra explicar o número). */
  convertidas: { moeda: string; saldo: number; taxa: number }[];
  /** Moedas que ficaram de fora por falta de cotação. */
  semCotacao: string[];
}

export function consolidarEmReais(saldos: SaldoMoeda[], taxaParaBRL: (moeda: string) => number | null): BancaConsolidada {
  let total = 0;
  let r30 = 0;
  const convertidas: BancaConsolidada["convertidas"] = [];
  const semCotacao: string[] = [];
  for (const s of saldos) {
    const taxa = s.moeda === "BRL" ? 1 : taxaParaBRL(s.moeda);
    if (taxa == null) {
      semCotacao.push(s.moeda);
      continue;
    }
    total += s.saldo * taxa;
    r30 += s.resultado30d * taxa;
    if (s.moeda !== "BRL") convertidas.push({ moeda: s.moeda, saldo: s.saldo, taxa });
  }
  if (semCotacao.length > 0 && convertidas.length === 0 && !saldos.some((s) => s.moeda === "BRL")) {
    return { total: null, resultado30d: null, convertidas, semCotacao };
  }
  return { total, resultado30d: r30, convertidas, semCotacao };
}
