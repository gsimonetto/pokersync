// Classifica a "situacao" preflop de uma mao colada (open, vs open, 3bet,
// vs 3bet, 4bet, vs 4bet) a partir do que o parser ja identificou —
// sequencia de acoes + heroName. Duas etapas:
//
// 1. Estrutural (deterministica, sem I/O): conta raises preflop antes/depois
//    da acao do hero e decide se o hero foi agressor ou caller. Produz um
//    rotulo canonico interno (snake_case, ex: "vs_open", "3bet").
//
// 2. Traducao pro vocabulario dos drills: canonical -> action da coluna
//    drills.action, via tabela situation_dictionary no Supabase (editavel
//    sem deploy). Hoje o vocabulario real dos drills e "vs Open" e "3-Bet"
//    (verificado por execute_sql na migration).
//
// Convivencia com resolveSuggestionStreet (drill-service): mesma filosofia
// de "so devolve match quando temos certeza"; senao, undefined. Filtros
// incompletos = sem drill sugerido, e o botao "Treinar esse spot" fica
// oculto (mesma regra ja aplicada hoje pra sugestoes sem drill).

import type { ParsedHand, ParsedAction } from "./hand-parser";
import { createClient } from "@/lib/supabase/client";

export type SituationCanonical =
  | "open"
  | "vs_open"
  | "3bet"
  | "vs_3bet"
  | "4bet"
  | "vs_4bet";

export interface StructuralSituation {
  canonical: SituationCanonical;
  // Numero de raises preflop QUE ACONTECERAM ANTES do hero tomar sua
  // ultima decisao preflop — util pra explicar/debugar a classificacao.
  raisesBeforeHero: number;
  // Se hero foi o autor do ultimo raise preflop. Combinado com o count
  // acima, define se hero e' o agressor ("3bet") ou o defensor ("vs_3bet").
  heroWasLastRaiser: boolean;
}

export class SituationClassifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SituationClassifyError";
  }
}

// Preflop = primeira street. Se nao existir, nao ha o que classificar
// (mao sem HOLE CARDS parseado — nao deveria acontecer em fluxo normal).
function preflopActions(hand: ParsedHand): ParsedAction[] {
  const preflop = hand.streets.find((s) => s.name === "preflop");
  return preflop?.actions ?? [];
}

// "posts" (SB/BB/ante) NAO sao raises pra efeito de classificacao —
// mesmo o BB sendo tecnicamente uma aposta forcada, ninguem chama uma
// mao onde todo mundo limpa e o BB checka de "vs Open". A conta que
// importa aqui e' a de acoes de agressao voluntaria: "raises" no
// vocabulario do parser (inclui all-in raises via campo isAllIn).
function isRaise(a: ParsedAction): boolean {
  return a.action === "raises";
}

export function classifyStructural(hand: ParsedHand): StructuralSituation | null {
  if (!hand.heroName) return null;
  const actions = preflopActions(hand);
  if (actions.length === 0) return null;

  // Ultima acao NAO-post do hero no preflop: essa e' a decisao que o
  // jogador tomou "diante da situacao X" — e' o que classificamos.
  let lastHeroActionIndex = -1;
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (a.player === hand.heroName && a.action !== "posts") {
      lastHeroActionIndex = i;
      break;
    }
  }
  if (lastHeroActionIndex === -1) return null;

  // Raises que aconteceram ANTES dessa decisao do hero.
  let raisesBefore = 0;
  for (let i = 0; i < lastHeroActionIndex; i++) {
    if (isRaise(actions[i])) raisesBefore++;
  }

  const heroLastAction = actions[lastHeroActionIndex];
  const heroWasLastRaiser = isRaise(heroLastAction);

  // Mapeamento:
  //   raisesBefore=0, hero raise    -> open       (hero abriu)
  //   raisesBefore=1, hero !raise   -> vs_open    (hero call vs open)
  //   raisesBefore=1, hero raise    -> 3bet       (hero fez 3-bet)
  //   raisesBefore=2, hero !raise   -> vs_3bet    (hero enfrentando 3-bet)
  //   raisesBefore=2, hero raise    -> 4bet
  //   raisesBefore>=3, hero !raise  -> vs_4bet
  //
  // Casos ambiguos (ex: raisesBefore=0 e hero call — limp) nao sao
  // classificaveis nesse eixo; devolve null pra deixar o UI esconder o
  // botao de treino em vez de sugerir drill errado.
  let canonical: SituationCanonical | null = null;
  if (raisesBefore === 0 && heroWasLastRaiser) canonical = "open";
  else if (raisesBefore === 1 && !heroWasLastRaiser) canonical = "vs_open";
  else if (raisesBefore === 1 && heroWasLastRaiser) canonical = "3bet";
  else if (raisesBefore === 2 && !heroWasLastRaiser) canonical = "vs_3bet";
  else if (raisesBefore === 2 && heroWasLastRaiser) canonical = "4bet";
  else if (raisesBefore >= 3 && !heroWasLastRaiser) canonical = "vs_4bet";

  if (!canonical) return null;

  return {
    canonical,
    raisesBeforeHero: raisesBefore,
    heroWasLastRaiser,
  };
}

// Traduz o rotulo canonico produzido em classifyStructural pro vocabulario
// que a coluna drills.action realmente usa. Ex: canonical "vs_open" ->
// alias "vs Open" (case-sensitive; drills.action = 'vs Open' exato).
//
// Fonte da verdade: tabela situation_dictionary (Supabase). Nao ha fallback
// hardcoded aqui — se o dicionario nao tiver o canonical, devolve null e
// o botao "Treinar esse spot" fica oculto (comportamento consistente com
// resolveSuggestionStreet no drill-service).
export async function resolveActionForDrillFilter(
  canonical: SituationCanonical
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("situation_dictionary")
    .select("alias")
    .eq("canonical", canonical)
    .limit(1);
  if (error) {
    // Nao interrompe o fluxo — apenas nao sugere drill pra essa mao.
    console.warn("[situation-classifier] falha ao consultar dicionario:", error.message);
    return null;
  }
  return data?.[0]?.alias ?? null;
}

// Conveniencia: tudo em um so — classifica e ja traz o alias pronto pra
// virar filtro drills.action. Se qualquer etapa falhar, devolve null,
// que significa "nao ha spot mapeavel — nao mostre botao de treino".
export interface ResolvedSituation {
  canonical: SituationCanonical;
  action: string; // valor pra filtrar drills.action
  raisesBeforeHero: number;
  heroWasLastRaiser: boolean;
}

export async function classifyAndResolve(hand: ParsedHand): Promise<ResolvedSituation | null> {
  const structural = classifyStructural(hand);
  if (!structural) return null;
  const action = await resolveActionForDrillFilter(structural.canonical);
  if (!action) return null;
  return {
    canonical: structural.canonical,
    action,
    raisesBeforeHero: structural.raisesBeforeHero,
    heroWasLastRaiser: structural.heroWasLastRaiser,
  };
}
