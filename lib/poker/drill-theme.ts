// Tema visual do Modo Treino — cores de posicao, naipes e badges de acao.
// Sao conceitos de dominio (poker), nao do design system geral do produto,
// entao vivem em constantes proprias em vez de tokens Tailwind. Portado
// de drillTheme.js, sem a camada de merge com um theme.js do Vite que
// nao existe no Next (era so um fallback defensivo, sem uso aqui).

export const T = {
  bg: "#0B0D10",
  panel: "#12161C",
  panelAlt: "#161B22",
  line: "#232A33",
  text: "#E9EEF5",
  dim: "#8A94A3",
  accent: "#A855F7",
  ok: "#22C55E",
  warn: "#EAB308",
  bad: "#EF4444",
};

export const F = "'Space Grotesk', system-ui, sans-serif";
export const font = { fontFamily: F };

// Cor por posicao — gradiente de temperatura seguindo a ordem de acao:
// early frio, late quente. Vira codigo visual reconhecivel sem leitura.
export const POS: Record<string, { base: string; glow: string }> = {
  UTG: { base: "#3B82F6", glow: "#60A5FA" },
  "UTG+1": { base: "#06B6D4", glow: "#22D3EE" },
  MP: { base: "#10B981", glow: "#34D399" },
  HJ: { base: "#EAB308", glow: "#FACC15" },
  CO: { base: "#F97316", glow: "#FB923C" },
  BTN: { base: "#A855F7", glow: "#C084FC" },
  SB: { base: "#EC4899", glow: "#F472B6" },
  BB: { base: "#EF4444", glow: "#F87171" },
};

// Four-color deck saturado para ganhar contraste sobre o feltro.
export const SUITS: Record<string, { g: string; c: string }> = {
  h: { g: "♥", c: "#FF3B57" },
  d: { g: "♦", c: "#2E9BFF" },
  c: { g: "♣", c: "#22C55E" },
  s: { g: "♠", c: "#111820" },
};

// Numeros tabulares: colunas de frequencia e stack alinham verticalmente.
export const num: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "'tnum'",
};

export const fmtFreq = (v: number) => `${Math.round(v * 100)}%`;

// Estilos de badge por tipo de acao.
export const ACT: Record<string, { label: string; fg: string; bd: string; bg: string }> = {
  fold: { label: "Fold", fg: T.dim, bd: "rgba(150,160,175,.35)", bg: "rgba(120,130,145,.16)" },
  check: { label: "Check", fg: "#7DD3FC", bd: "rgba(56,189,248,.45)", bg: "rgba(56,189,248,.14)" },
  call: { label: "Call", fg: "#4ADE80", bd: "rgba(34,197,94,.50)", bg: "rgba(34,197,94,.16)" },
  bet: { label: "Bet", fg: "#FDBA74", bd: "rgba(249,115,22,.55)", bg: "rgba(249,115,22,.18)" },
  raise: { label: "Raise", fg: "#FCA5A5", bd: "rgba(239,68,68,.55)", bg: "rgba(239,68,68,.18)" },
  allin: { label: "All-in", fg: "#FDE047", bd: "rgba(250,204,21,.6)", bg: "rgba(250,204,21,.20)" },
};
