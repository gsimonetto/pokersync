"use client";

import { useCallback, useEffect, useState } from "react";
import { getUsdBrlRate } from "@/lib/services/fx-service";

// Cotações pra converter a banca em reais -- um lugar só, usado pela tela
// inicial e pela Gestão de Banca (antes cada uma tinha sua regra e os
// números não batiam).
//
// - Dólar: cotação do dia (AwesomeAPI, cache de 12h em fx-service.ts).
// - Outras moedas (ex.: euro): a taxa que o jogador digitar na aba
//   Dinheiro da Gestão de Banca. Mesma chave de antes no navegador, então
//   quem já tinha digitado continua com a taxa salva.
// - Se o jogador digitou uma taxa pro dólar, ela vence a do dia (é uma
//   escolha consciente dele, ex.: a cotação que o câmbio da sala usa).

const CHAVE = "pokersync:banca:fxRates";

function lerManuais(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function useTaxasCambio() {
  const [manuais, setManuais] = useState<Record<string, string>>({});
  const [usdDoDia, setUsdDoDia] = useState<number | null>(null);

  useEffect(() => {
    setManuais(lerManuais());
    let vivo = true;
    getUsdBrlRate().then((r) => {
      if (vivo) setUsdDoDia(r);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const definirTaxa = useCallback((moeda: string, taxa: string) => {
    setManuais((prev) => {
      const next = { ...prev, [moeda]: taxa };
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(next));
      } catch {
        // sem localStorage (modo privado): vale só enquanto a tela estiver aberta
      }
      return next;
    });
  }, []);

  const taxaParaBRL = useCallback(
    (moeda: string): number | null => {
      if (moeda === "BRL") return 1;
      const manual = Number(manuais[moeda]);
      if (manual > 0) return manual;
      if (moeda === "USD") return usdDoDia;
      return null;
    },
    [manuais, usdDoDia],
  );

  return { manuais, definirTaxa, taxaParaBRL, usdDoDia };
}
