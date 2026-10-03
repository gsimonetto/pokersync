// ACR / Winning Poker Network (RADAR-009): o que só existe no NOME do
// arquivo, não no conteúdo. Validado contra arquivos reais de 03/10/2026:
//
//   mãos:   "HH20261003_SCHEDULEDID-G36074377T20_TN-PKO - 20000 GTD_GAMETYPE-Holdem_LIMIT-no_CUR-REAL_OND-F_BUYIN-0.txt"
//   resumo: "TS20261003_T36074377_E1312590432_NL_Hold_em_50.00__5.00.ots"
//
// A mão da ACR não traz buy-in nem nome do torneio, e o resumo (JSON) também
// não traz buy-in. O "BUYIN-0" do arquivo de mãos veio 0 num torneio de
// $50+$5 -- não serve; o buy-in confiável é o do fim do nome do resumo.

/** Nome do torneio no arquivo de mãos ("TN-PKO - 20000 GTD_GAMETYPE-..."). */
export function nomeTorneioDoArquivoAcr(nomeArquivo: string | null | undefined): string | null {
  const m = nomeArquivo?.match(/_TN-(.+?)_GAMETYPE-/i);
  const nome = m?.[1].trim();
  return nome ? nome : null;
}

/** Torneio com bounty pelo nome (PKO, Bounty, Knockout, "KO"). */
export function nomeEhDeBounty(nome: string | null): boolean {
  return !!nome && /\b(?:pko|bounty|knockout|ko)\b/i.test(nome);
}

/** Buy-in total pelo fim do nome do resumo ("_50.00__5.00.ots" = 55). */
export function buyinDoArquivoResumoAcr(nomeArquivo: string | null | undefined): number | null {
  const m = nomeArquivo?.match(/_((?:\d+(?:\.\d+)?__)*\d+(?:\.\d+)?)\.ots$/i);
  if (!m) return null;
  const partes = m[1].split("__").map(Number);
  if (partes.some((n) => !Number.isFinite(n))) return null;
  return Math.round(partes.reduce((s, n) => s + n, 0) * 100) / 100;
}
