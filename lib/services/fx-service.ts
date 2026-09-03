// Cotação USD→BRL — extraído de app/banca/page.tsx (que já usava isso só
// pra converter torneios do agente automaticamente) pra virar utilitário
// compartilhado, reaproveitado também na importação manual de hand
// history (Análise/Revisor), que precisa da mesma conversão pra lançar a
// sessão de banca automaticamente. Mesma chave de cache/TTL de antes —
// não muda nada pra quem já usava via app/banca/page.tsx.
//
// API pública gratuita, sem chave (AwesomeAPI, mantida pelo mesmo pessoal
// por trás do dólar hoje em vários apps brasileiros). Cacheada 12h no
// navegador: não precisa bater na API a cada carregamento de página, e
// uma falha pontual da API não trava a importação por muito tempo.
const USD_BRL_CACHE_KEY = "pokersync:banca:usdBrlRate";
const USD_BRL_TTL_MS = 12 * 60 * 60 * 1000;

export async function getUsdBrlRate(): Promise<number | null> {
  try {
    const raw = window.localStorage.getItem(USD_BRL_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { rate: number; fetchedAt: number };
      if (cached.rate > 0 && Date.now() - cached.fetchedAt < USD_BRL_TTL_MS) return cached.rate;
    }
  } catch {
    // cache indisponível/corrompido -- segue pra buscar fresco
  }
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    if (!res.ok) return null;
    const data = await res.json();
    const rate = Number(data?.USDBRL?.bid);
    if (!(rate > 0)) return null;
    try {
      window.localStorage.setItem(USD_BRL_CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() }));
    } catch {
      // falha ao cachear não impede de usar a cotação que acabou de vir
    }
    return rate;
  } catch {
    return null;
  }
}
