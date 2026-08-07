// Motor de veredito por frequencia — portado de matchUserActionToGtoNode.js.
// Nao usa EV porque o gto_nodes gravado pelo TexasSolver nao tem EV
// (dump_result nao exporta por-acao); frequencia e a unica base real que
// o banco tem, e e a base de todo o sistema de veredito do projeto.

export type Verdict = "OTIMA" | "ACEITAVEL" | "ERRO_LEVE" | "ERRO_GRAVE" | "UNKNOWN";

const FREQ_OTIMA = 0.4;
const FREQ_ACEITAVEL = 0.15;
const FREQ_ERRO_LEVE = 0.05;
// Bets/raises dentro de ±15% do tamanho do no mais proximo contam como
// "a mesma acao" — mesma tolerancia ja usada no resto do pipeline de GTO.
const SIZING_TOLERANCE = 0.15;

export interface GtoNode {
  actions: string[];
  player: number;
  strategy: Record<string, number[]>;
}

export interface UserAction {
  action: "CHECK" | "BET" | "CALL" | "RAISE" | "FOLD" | string;
  sizing?: number;
}

export interface VerdictResult {
  verdict: Verdict;
  chosenFreq: number;
  topFreq: number;
  topAction: string | null;
  /** Acao crua do solver (ex: "BET 450,000000") que casou com a escolha do jogador, ou null se nenhuma casou. */
  chosenAction: string | null;
}

interface ParsedAction {
  type: string;
  sizing: number;
}

// O solver grava o tamanho em centesimos de bb — por isso a divisao por
// 100, pra ficar na mesma unidade que userAction.sizing (que ja chega em
// bb desde a ActionBar).
function parseActionString(raw: string): ParsedAction {
  const parts = raw.trim().split(/\s+/);
  const type = parts[0].toUpperCase();
  const sizing = parts[1] ? parseFloat(parts[1].replace(",", ".")) / 100 : 0;
  return { type, sizing };
}

function classifyFrequency(freq: number): Verdict {
  if (freq >= FREQ_OTIMA) return "OTIMA";
  if (freq >= FREQ_ACEITAVEL) return "ACEITAVEL";
  if (freq >= FREQ_ERRO_LEVE) return "ERRO_LEVE";
  return "ERRO_GRAVE";
}

export function matchUserActionToGtoNode(
  userAction: UserAction,
  gtoNode: GtoNode | null | undefined,
  heroCards: string
): VerdictResult {
  if (!gtoNode || !Array.isArray(gtoNode.actions) || gtoNode.actions.length === 0) {
    return { verdict: "UNKNOWN", chosenFreq: 0, topFreq: 0, topAction: null, chosenAction: null };
  }
  const comboFreqs = gtoNode.strategy?.[heroCards];
  if (!Array.isArray(comboFreqs) || comboFreqs.length !== gtoNode.actions.length) {
    return { verdict: "UNKNOWN", chosenFreq: 0, topFreq: 0, topAction: null, chosenAction: null };
  }

  const parsedActions = gtoNode.actions.map(parseActionString);
  const candidates = parsedActions
    .map((a, i) => ({ ...a, index: i }))
    .filter((a) => a.type === userAction.action.toUpperCase());

  let chosenIndex = -1;
  if (candidates.length === 1) {
    chosenIndex = candidates[0].index;
  } else if (candidates.length > 1) {
    const withDiff = candidates.map((c) => {
      const diff =
        c.sizing === 0
          ? Math.abs(c.sizing - (userAction.sizing ?? 0))
          : Math.abs(c.sizing - (userAction.sizing ?? 0)) / c.sizing;
      return { ...c, diff };
    });
    withDiff.sort((a, b) => a.diff - b.diff);
    if (withDiff[0].diff <= SIZING_TOLERANCE) {
      chosenIndex = withDiff[0].index;
    }
  }

  const chosenFreq = chosenIndex >= 0 ? comboFreqs[chosenIndex] : 0;
  const chosenAction = chosenIndex >= 0 ? gtoNode.actions[chosenIndex] : null;
  const topIndex = comboFreqs.reduce((best, freq, i) => (freq > comboFreqs[best] ? i : best), 0);
  const topFreq = comboFreqs[topIndex];
  const topAction = gtoNode.actions[topIndex];
  const verdict = classifyFrequency(chosenFreq);

  return { verdict, chosenFreq, topFreq, topAction, chosenAction };
}

/** Cor por veredito — substitui o evColor() que dependia de EV inexistente. */
export function verdictColor(v: Verdict): string {
  if (v === "OTIMA") return "#22C55E";
  if (v === "ACEITAVEL") return "#EAB308";
  if (v === "ERRO_LEVE") return "#EAB308";
  if (v === "ERRO_GRAVE") return "#EF4444";
  return "#8A94A3";
}

/**
 * Formata um valor de sizing removendo casas decimais desnecessarias.
 * Ex: 140.0 -> "140" | 142.5 -> "142.5"
 */
export function formatSizing(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** Converte "BET 450,000000" em label legivel: "Bet 4.5" (ja em bb). */
export function describeAction(raw: string): { type: string; label: string; sizing: number } {
  const { type, sizing } = parseActionString(raw);
  const typeLabel = type.charAt(0) + type.slice(1).toLowerCase();
  const label = sizing > 0 ? `${typeLabel} ${formatSizing(sizing)}` : typeLabel;
  return { type, label, sizing };
}
