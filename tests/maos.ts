// Mãos de exemplo no formato PokerStars (inglês e português) pros testes.

interface OpcoesMao {
  id: number;
  heroiFichas: number;
  corpo: string;
  mesa?: number;
  torneio?: string;
}

export function maoEn({ id, heroiFichas, corpo, mesa = 9, torneio = "3000000001" }: OpcoesMao): string {
  return `PokerStars Hand #${id}: Tournament #${torneio}, $10+$1 USD Hold'em No Limit - Level I (10/20) - 2026/09/20 20:00:0${id % 10} ET
Table '${torneio} 1' ${mesa}-max Seat #1 is the button
Seat 1: Vilao (3000 in chips)
Seat 2: Hero (${heroiFichas} in chips)
Vilao: posts small blind 10
Hero: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
${corpo}`;
}

// Torneio PKO de $16,50 (7,50 + 7,50 + 1,50) com o client em português.
export const MAO_PKO_PT = `PokerStars Mão #250000000001: Torneio #3900000001, $ 7,50+$ 7,50+$ 1,50 USD Hold'em No Limit - Nível I (10/20) - 20/09/2026 20:00:00 BRT
Mesa '3900000001 1' 9-max Lugar #1 é o botão
Lugar 1: Vilao (1500 em fichas, Bounty de $ 7,50)
Lugar 2: Hero (1500 em fichas, Bounty de $ 11,25)
Vilao: paga o small blind 10
Hero: paga o big blind 20
*** CARTAS DA MÃO ***
Hero recebe [Ah Kh]
Vilao: desiste
Hero ganha $ 3,75 por eliminar Fulano e sua própria recompensa aumenta para $ 11,25
*** SUMÁRIO ***`;

export const MAO_PKO_EN = MAO_PKO_PT.replace("Bounty de $ 7,50", "$7.50 bounty")
  .replace("Bounty de $ 11,25", "$11.25 bounty")
  .replace("$ 7,50+$ 7,50+$ 1,50", "$7.50+$7.50+$1.50")
  .replace(/em fichas/g, "in chips");

// Herói vai all-in, é pago e perde tudo.
export const CORPO_QUEBRA = `Vilao: raises 60 to 80
Hero: raises 1420 to 1500 and is all-in
Vilao: calls 1420
*** FLOP *** [2c 3d 9s]
*** TURN *** [2c 3d 9s] [Td]
*** RIVER *** [2c 3d 9s Td] [Jc]
*** SHOW DOWN ***
Vilao: shows [Qs Qd] (a pair of Queens)
Hero: shows [Ah Kh] (high card Ace)
Vilao collected 3000 from pot
*** SUMMARY ***
Total pot 3000 | Rake 0`;

// Herói vai all-in e ganha.
export const CORPO_GANHA = CORPO_QUEBRA.replace("[Jc]", "[Ac]").replace("Vilao collected", "Hero collected");

// Herói tem mais fichas: perde o pote mas recebe de volta o que o vilão não pagou.
export const CORPO_SOBRA = `Vilao: raises 60 to 80
Hero: raises 4980 to 5000 and is all-in
Vilao: calls 2920 and is all-in
Uncalled bet (2000) returned to Hero
*** FLOP *** [2c 3d 9s]
*** TURN *** [2c 3d 9s] [Td]
*** RIVER *** [2c 3d 9s Td] [Jc]
*** SHOW DOWN ***
Vilao collected 6000 from pot
*** SUMMARY ***
Total pot 6000 | Rake 0`;
