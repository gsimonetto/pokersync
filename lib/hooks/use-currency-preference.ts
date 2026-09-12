"use client";

import { useEffect, useState } from "react";
import { getUsdBrlRate } from "@/lib/services/fx-service";

export type DisplayCurrency = "usd" | "brl";

const STORAGE_KEY = "pokersync:performance:currency";

const USD_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const BRL_FORMAT = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Todo valor de torneio importado (buy-in, premiacao, EV em $) e' guardado
// em USD -- extractTournamentInfo/tournament-summary-parser so reconhecem
// "$X ... USD" no hand history/resumo de torneio (ver hand-session-service.ts
// e tournament-summary-parser.ts), nunca R$. O Player Evolution mostrava
// esse numero cru com formato de Real (BRL.format direto), o que faz um
// buy-in de US$55 aparecer como "R$55,00" -- pedido explicito: dar ao
// jogador um seletor pra escolher como ver (dolar cru, ou convertido pra
// real na cotacao do dia, mesma fonte que a Gestao de Banca ja usa).
export function useCurrencyPreference() {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("usd");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "usd" || saved === "brl") setCurrencyState(saved);
    } catch {
      // localStorage indisponivel -- fica no default (usd)
    }
  }, []);

  useEffect(() => {
    if (currency !== "brl" || rate !== null) return;
    let cancelled = false;
    getUsdBrlRate().then((r) => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, [currency, rate]);

  function setCurrency(next: DisplayCurrency) {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // segue sem persistir -- so nao lembra a escolha na proxima visita
    }
  }

  // Formata um valor guardado em USD na moeda escolhida. Sem cotacao
  // carregada ainda (ou API fora do ar), cai pra USD mesmo com "BRL"
  // selecionado -- melhor mostrar o valor real em dolar do que travar a
  // tela ou inventar uma conversao errada.
  function formatUsd(amountUsd: number | null): string | null {
    if (amountUsd === null) return null;
    if (currency === "brl" && rate !== null) return BRL_FORMAT.format(amountUsd * rate);
    return USD_FORMAT.format(amountUsd);
  }

  return { currency, setCurrency, rate, formatUsd, loadingRate: currency === "brl" && rate === null };
}
