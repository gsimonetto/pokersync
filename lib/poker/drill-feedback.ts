import type { Verdict } from "./gto-verdict";
import { describeAction } from "./gto-verdict";

// Banco de frases por veredito — portado de feedbackMessages.js, sem
// alteracoes de conteudo. Uma frase e escolhida aleatoriamente a cada
// analise pra nao repetir sempre a mesma.
const FEEDBACK_MESSAGES: Record<Verdict, { badges: string[]; texts: string[] }> = {
  OTIMA: {
    badges: ["Boa escolha", "Mandou bem", "Isso aí"],
    texts: [
      "Você jogou exatamente como devia aqui.",
      "Essa é a linha certa, mandou bem.",
      "Jogada sólida, dentro do que a estratégia pede.",
    ],
  },
  ACEITAVEL: {
    badges: ["Jogada válida", "Dá pro gasto", "Também rola"],
    texts: [
      "Não é a linha mais forte, mas ainda faz parte do jogo certo.",
      "Essa jogada também é usada, só não é a favorita da estratégia.",
      "Válida, mas dá pra apertar um pouco mais aqui.",
    ],
  },
  ERRO_LEVE: {
    badges: ["Quase lá", "Por pouco", "Quase isso"],
    texts: [
      "Essa jogada quase não aparece na estratégia ideal. O forte aqui é {ACAO} ({FREQ}%).",
      "Foi por pouco — a mão pede mais {ACAO} do que isso.",
      "Chegou perto, mas o padrão certo aqui é {ACAO}.",
    ],
  },
  ERRO_GRAVE: {
    badges: ["Fora da jogada certa", "Não rolou", "Escapou dessa"],
    texts: [
      "Nessa mão, o jogo certo é {ACAO}. {ACAO_ESCOLHIDA} quase nunca é a jogada aqui.",
      "Essa fugiu do padrão — a estratégia manda {ACAO} praticamente sempre.",
      "Aqui era pra apostar, não pra {ACAO_ESCOLHIDA}. Guarda essa mão.",
    ],
  },
  UNKNOWN: {
    badges: ["Sem dados"],
    texts: ["Não conseguimos comparar essa jogada com a estratégia agora."],
  },
};

export interface FeedbackContext {
  topAction?: string | null;
  topFreq?: number;
  chosenAction?: string;
}

export function getFeedbackMessage(verdict: Verdict, ctx: FeedbackContext = {}) {
  const { topAction, topFreq, chosenAction } = ctx;
  const set = FEEDBACK_MESSAGES[verdict] || FEEDBACK_MESSAGES.UNKNOWN;
  const badge = set.badges[Math.floor(Math.random() * set.badges.length)];
  let text = set.texts[Math.floor(Math.random() * set.texts.length)];

  if (topAction) {
    const acaoLegivel = describeAction(topAction).label;
    text = text
      .replace(/{ACAO}/g, acaoLegivel)
      .replace(/{FREQ}/g, topFreq ? String(Math.round(topFreq * 100)) : "")
      .replace(/{ACAO_ESCOLHIDA}/g, chosenAction ?? "essa jogada");
  }

  return { badge, text };
}
