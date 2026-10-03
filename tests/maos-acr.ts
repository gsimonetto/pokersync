// Mãos REAIS da ACR (torneio PKO, 03/10/2026), com os nomes trocados
// (Hero = quem jogou, Vilao1..N = adversários). Formato sem ":" depois do
// nome e sem "collected" quando ninguém paga pra ver.

// Raise do small blind, todo mundo folda, ganha sem mostrar.
export const ACR_SEM_SHOWDOWN = `Game Hand #2838198875 - Tournament #36074377 - Holdem (No Limit) - Level 10 (1800.00/3600.00) - 2026/10/03 17:48:09 UTC
Table '20' 8-max Seat #7 is the button
Seat 1: Vilao8 (599896.00)
Seat 2: Vilao10 (98650.00)
Seat 3: Vilao6 (296284.00)
Seat 4: Vilao12 (408979.00)
Seat 5: Vilao11 (106098.00)
Seat 6: Hero (100000.00)
Seat 7: Vilao1 (291054.00)
Seat 8: Vilao2 (357250.00)
Vilao8 posts ante 450.00
Vilao10 posts ante 450.00
Vilao6 posts ante 450.00
Vilao12 posts ante 450.00
Vilao11 posts ante 450.00
Hero posts ante 450.00
Vilao1 posts ante 450.00
Vilao2 posts ante 450.00
Vilao2 posts the small blind 1800.00
Vilao8 posts the big blind 3600.00
*** HOLE CARDS ***
Main pot 3600.00
Dealt to Hero [2h 2s]
Vilao10 folds
Vilao6 folds
Vilao12 folds
Vilao11 folds
Hero folds
Vilao1 folds
Vilao2 raises 9900.00 to 11700.00
Vilao8 folds
Uncalled bet (8100.00) returned to Vilao2
Vilao2 does not show
*** SUMMARY ***
Total pot 10800.00
Seat 1: Vilao8 (big blind) folded on the Pre-Flop
Seat 2: Vilao10 folded on the Pre-Flop and did not bet
Seat 3: Vilao6 folded on the Pre-Flop and did not bet
Seat 4: Vilao12 folded on the Pre-Flop and did not bet
Seat 5: Vilao11 folded on the Pre-Flop and did not bet
Seat 6: Hero folded on the Pre-Flop and did not bet
Seat 7: Vilao1 (button) folded on the Pre-Flop
Seat 8: Vilao2 did not show and won 10800.00`;

// Botão "morto": o assento 3 (botão) ficou vazio porque o jogador caiu na
// mão anterior.
export const ACR_BOTAO_MORTO = `Game Hand #2838208664 - Tournament #36074377 - Holdem (No Limit) - Level 11 (2000.00/4000.00) - 2026/10/03 18:06:30 UTC
Table '20' 8-max Seat #3 is the button
Seat 1: Vilao8 (588346.00)
Seat 2: Vilao10 (116825.00)
Seat 4: Vilao12 (426279.00)
Seat 5: Vilao4 (275750.00)
Seat 6: Hero (97440.00)
Seat 7: Vilao1 (317699.00)
Seat 8: Vilao2 (336875.00)
Vilao8 posts ante 500.00
Vilao10 posts ante 500.00
Vilao12 posts ante 500.00
Vilao4 posts ante 500.00
Hero posts ante 500.00
Vilao1 posts ante 500.00
Vilao2 posts ante 500.00
Vilao12 posts the small blind 2000.00
Vilao4 posts the big blind 4000.00
*** HOLE CARDS ***
Main pot 3500.00
Dealt to Hero [9h Ad]
Hero folds
Vilao1 raises 8000.00 to 8000.00
Vilao2 folds
Vilao8 folds
Vilao10 folds
Vilao12 calls 6000.00
Vilao4 calls 4000.00
*** FLOP *** [4s 6d 3s]
Main pot 27500.00
Vilao12 bets 15125.00
Vilao4 folds
Vilao1 calls 15125.00
*** TURN *** [4s 6d 3s] [8d]
Main pot 57750.00
Vilao12 checks
Vilao1 checks
*** RIVER *** [4s 6d 3s 8d] [6c]
Main pot 57750.00
Vilao12 bets 31763.00
Vilao1 folds
Uncalled bet (31763.00) returned to Vilao12
Vilao12 does not show
*** SUMMARY ***
Total pot 57750.00
Board [4s 6d 3s 8d 6c]
Seat 1: Vilao8 folded on the Pre-Flop and did not bet
Seat 2: Vilao10 folded on the Pre-Flop and did not bet
Seat 4: Vilao12 did not show and won 57750.00
Seat 5: Vilao4 (big blind) folded on the Flop
Seat 6: Hero folded on the Pre-Flop and did not bet
Seat 7: Vilao1 folded on the River
Seat 8: Vilao2 folded on the Pre-Flop and did not bet`;

// All-in com call, showdown e pote dividido.
export const ACR_POTE_DIVIDIDO = `Game Hand #2838223030 - Tournament #36074377 - Holdem (No Limit) - Level 12 (2500.00/5000.00) - 2026/10/03 18:24:35 UTC
Table '20' 8-max Seat #5 is the button
Seat 1: Vilao7 (185170.00)
Seat 2: Vilao5 (297699.00)
Seat 3: Vilao9 (941687.00)
Seat 4: Vilao12 (605997.00)
Seat 5: Vilao4 (192500.00)
Seat 6: Hero (27065.00)
Seat 7: Vilao1 (234061.00)
Seat 8: Vilao3 (98125.00)
Vilao7 posts ante 625.00
Vilao5 posts ante 625.00
Vilao9 posts ante 625.00
Vilao12 posts ante 625.00
Vilao4 posts ante 625.00
Hero posts ante 625.00
Vilao1 posts ante 625.00
Vilao3 posts ante 625.00
Hero posts the small blind 2500.00
Vilao1 posts the big blind 5000.00
*** HOLE CARDS ***
Main pot 5000.00
Dealt to Hero [5s 9s]
Vilao3 raises 97500.00 to 97500.00 and is all-in
Vilao7 folds
Vilao5 folds
Vilao9 folds
Vilao12 calls 97500.00
Vilao4 folds
Hero folds
Vilao1 folds
*** FLOP *** [2h 7s 9c]
Main pot 207500.00
*** TURN *** [2h 7s 9c] [Jh]
Main pot 207500.00
*** RIVER *** [2h 7s 9c Jh] [Jd]
Main pot 207500.00
*** SHOW DOWN ***
Main pot 207500.00
Vilao12 shows [As Kd] (a pair of Jacks [Jh Jd As Kd 9c])
Vilao3 shows [Ad Ks] (a pair of Jacks [Jh Jd Ad Ks 9c])
Vilao3 collected 103750.00 from main pot
Vilao12 collected 103750.00 from main pot
*** SUMMARY ***
Total pot 207500.00
Board [2h 7s 9c Jh Jd]
Seat 1: Vilao7 folded on the Pre-Flop and did not bet
Seat 2: Vilao5 folded on the Pre-Flop and did not bet
Seat 3: Vilao9 folded on the Pre-Flop and did not bet
Seat 4: Vilao12 showed [As Kd] and won 103750.00 with a pair of Jacks [Jh Jd As Kd 9c]
Seat 5: Vilao4 (button) folded on the Pre-Flop
Seat 6: Hero (small blind) folded on the Pre-Flop
Seat 7: Vilao1 (big blind) folded on the Pre-Flop
Seat 8: Vilao3 showed [Ad Ks] and won 103750.00 with a pair of Jacks [Jh Jd Ad Ks 9c]`;
