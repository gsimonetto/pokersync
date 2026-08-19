// Plataformas conhecidas pra sessao/transacao de banca -- pedido
// explicito: "nao precise digitar na mao". Lista curada pro publico do
// produto (grinders BR, majoritariamente online), com "Outro" como
// valvula de escape pra quem joga em algo fora da lista (nunca trava o
// usuario). "Live / Presencial" cobre quem joga em casa de poker fisica.
export const PLATFORMS = [
  "PokerStars",
  "GGPoker",
  "WPT Global",
  "PartyPoker",
  "888poker",
  "ACR (Winning Poker Network)",
  "CoinPoker",
  "Suprema Poker",
  "PPPoker (clube)",
  "Chico Poker",
  "Natural8",
  "BetOnline",
  "Live / Presencial",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const OUTRO_PLATFORM = "Outro";
