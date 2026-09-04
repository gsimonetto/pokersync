"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redo2, Undo2 } from "lucide-react";
import { HAND_STRENGTH_RANKING } from "@/lib/poker/hand-strength-ranking";

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

// Uma mao pode ser dividida entre as 3 acoes (estrategia mista, igual ao
// que o solver ja retorna no Modo Treino). Mao ausente do mapa = fold
// 100% implicito, mesma convencao do V1.
export interface RaiseMixEntry {
  type: RaiseType;
  weight: number;
}

export interface HandDecision {
  fold: number;
  call: number;
  raise: number;
  /** So' importa quando raise>0 — qual "sabor" de raise foi pintado
      (raise simples, 3-bet ou all-in), so' pra cor/rotulo na grade.
      undefined = raise generico (cor verde padrao), pra nao quebrar
      ranges salvos antes dessa distincao existir. */
  raiseType?: RaiseType;
  /** So' presente quando a fatia de raise (acima) foi pintada com o
      pincel de mescla dividida entre dois sabores de raise (ex: metade
      3-bet, metade all-in) — os pesos somam `raise`. Quando ausente, a
      fatia inteira usa a cor de `raiseType`. Puramente cosmetico, igual
      raiseType: o resto do produto so' le fold/call/raise. */
  raiseMix?: RaiseMixEntry[];
}

export type RangeHands = Record<string, HandDecision>;

// O modelo de dados por baixo continua so' fold/call/raise (todo o
// resto do produto — board analyzer, equidade, drill, aderencia — le
// esses 3 campos). Os botoes mostram 5 rotulos preflop comuns; 3-bet e
// All-in sao formas mais precisas de descrever um "raise" pro jogador —
// nao viram uma 4a/5a categoria no dado agregado, mas o raiseType acima
// guarda qual delas foi usada pra pintar, so' pra distinguir na grade
// (cor/tooltip) — sem isso os 3 botoes de raise ficavam visualmente
// identicos e pareciam nao fazer nada.
export type PaintAction = "fold" | "call" | "raise";
export type RaiseType = "raise" | "threebet" | "allin";
type ToolButton = "fold" | "call" | "raise" | "threebet" | "allin";

const TOOL_META: Record<ToolButton, { label: string; action: PaintAction; color: string; raiseType?: RaiseType }> = {
  fold: { label: "Fold", action: "fold", color: "#c4c7c8" },
  call: { label: "Call", action: "call", color: "#3b82f6" },
  raise: { label: "Raise", action: "raise", color: "#22c55e", raiseType: "raise" },
  threebet: { label: "3-bet", action: "raise", color: "#f59e0b", raiseType: "threebet" },
  allin: { label: "All-in", action: "raise", color: "#e0555a", raiseType: "allin" },
};
const TOOL_ORDER: ToolButton[] = ["fold", "call", "raise", "threebet", "allin"];
const RAISE_TYPE_COLOR: Record<RaiseType, string> = { raise: "#22c55e", threebet: "#f59e0b", allin: "#e0555a" };
const RAISE_TYPE_LABEL: Record<RaiseType, string> = { raise: "Raise", threebet: "3-bet", allin: "All-in" };

const EMPTY_DECISION: HandDecision = { fold: 100, call: 0, raise: 0 };

// Decisao completa que a ferramenta ativa produz ao pintar uma celula —
// centraliza a logica que antes so' setava call/raise e deixava fold
// hardcoded em 0 (bug: a ferramenta "Fold" pintava fold:0/call:0/raise:0,
// um estado que nao soma 100% e a grade renderizava como se fosse raise).
function decisionForTool(tool: ToolButton): HandDecision {
  const { action, raiseType } = TOOL_META[tool];
  return {
    fold: action === "fold" ? 100 : 0,
    call: action === "call" ? 100 : 0,
    raise: action === "raise" ? 100 : 0,
    raiseType: action === "raise" ? raiseType : undefined,
  };
}

// Pincel de mescla: combina duas ferramentas numa so' celula, cada uma
// com seu peso (ex: 50% 3-bet + 50% All-in, ou 30% Fold + 70% Call).
// Quando as duas caem em "raise" com sabores diferentes, guarda os dois
// pesos em raiseMix pra colorir a fatia de raise dividida — o resto do
// dado (fold/call/raise agregados) continua igual ao de sempre.
function decisionForMix(toolA: ToolButton, toolB: ToolButton, weightA: number): HandDecision {
  const weightB = 100 - weightA;
  const buckets = { fold: 0, call: 0, raise: 0 };
  const raiseWeights = new Map<RaiseType, number>();
  for (const [tool, weight] of [
    [toolA, weightA],
    [toolB, weightB],
  ] as const) {
    if (weight <= 0) continue;
    const { action, raiseType } = TOOL_META[tool];
    buckets[action] += weight;
    if (action === "raise") {
      const rt = raiseType ?? "raise";
      raiseWeights.set(rt, (raiseWeights.get(rt) ?? 0) + weight);
    }
  }
  const raiseMix = Array.from(raiseWeights.entries()).map(([type, weight]) => ({ type, weight }));
  return {
    fold: buckets.fold,
    call: buckets.call,
    raise: buckets.raise,
    raiseType: raiseMix[0]?.type,
    raiseMix: raiseMix.length > 1 ? raiseMix : undefined,
  };
}

// Compara duas decisoes pra saber se pintar de novo em cima deveria
// apagar (mesmo resultado exato) ou repintar — usada tanto pro pincel
// simples quanto pro de mescla, entao o gesto de "clicar nao muda nada
// -> apaga" funciona igual nos dois modos.
function decisionsEqual(a: HandDecision, b: HandDecision): boolean {
  if (a.fold !== b.fold || a.call !== b.call || a.raise !== b.raise) return false;
  if ((a.raiseType ?? null) !== (b.raiseType ?? null)) return false;
  const key = (m?: RaiseMixEntry[]) =>
    (m ?? [])
      .map((e) => `${e.type}:${e.weight}`)
      .sort()
      .join(",");
  return key(a.raiseMix) === key(b.raiseMix);
}

export function getDecision(hands: RangeHands, label: string): HandDecision {
  return hands[label] ?? EMPTY_DECISION;
}

export function getHandLabel(rowIdx: number, colIdx: number): string {
  const rHigh = RANKS[rowIdx];
  const rLow = RANKS[colIdx];
  if (rowIdx === colIdx) return `${rHigh}${rLow}`;
  if (rowIdx < colIdx) return `${rHigh}${rLow}s`;
  return `${rLow}${rHigh}o`;
}

function comboCount(label: string): number {
  if (label.length === 2) return 6; // par
  return label.endsWith("s") ? 4 : 12; // suited : offsuit
}

// "Clique inteligente": clicar numa mao preenche o grupo inteiro ate
// ela, nao so aquela celula — igual a notacao "X+" que todo jogador ja
// usa (ex: clicar A8o preenche A8o,A9o,ATo,AJo,AQo,AKo = "A8o+").
// Par (diagonal): preenche de AA ate o par clicado.
// Suited (linha fixa, o rank mais alto): preenche do melhor kicker
// daquela linha ate o kicker clicado.
// Offsuit (coluna fixa, o rank mais alto): mesma logica, por coluna.
function smartGroupCells(rowIdx: number, colIdx: number): [number, number][] {
  const cells: [number, number][] = [];
  if (rowIdx === colIdx) {
    for (let i = 0; i <= rowIdx; i++) cells.push([i, i]);
  } else if (rowIdx < colIdx) {
    for (let c = rowIdx + 1; c <= colIdx; c++) cells.push([rowIdx, c]);
  } else {
    for (let r = colIdx + 1; r <= rowIdx; r++) cells.push([r, colIdx]);
  }
  return cells;
}

// Gradiente empilhado de baixo pra cima: fold (cinza) -> call (azul) ->
// raise (verde). Fold com peso 100 fica praticamente invisivel de
// proposito — so o que tem acao chama atencao visual.
export function cellBackground(d: HandDecision): string {
  const foldC = "#c4c7c8", callC = "#3b82f6";
  const foldEnd = d.fold;
  const callEnd = d.fold + d.call;
  const stops = [`${foldC}22 0%`, `${foldC}22 ${foldEnd}%`, `${callC} ${foldEnd}%`, `${callC} ${callEnd}%`];

  // Fatia de raise: normalmente uma cor so' (raiseType). Quando raiseMix
  // tem 2 entradas (pincel de mescla dividiu entre dois sabores de
  // raise), empilha as duas dentro da mesma fatia — os pesos ja' somam
  // d.raise, entao cada um vira exatamente aquele tanto de altura.
  if (d.raise > 0) {
    const mix = d.raiseMix && d.raiseMix.length > 1 ? d.raiseMix : [{ type: d.raiseType ?? "raise", weight: d.raise }];
    let cursor = callEnd;
    for (const seg of mix) {
      const segEnd = cursor + seg.weight;
      const color = RAISE_TYPE_COLOR[seg.type];
      stops.push(`${color} ${cursor}%`, `${color} ${segEnd}%`);
      cursor = segEnd;
    }
  }
  return `linear-gradient(to top, ${stops.join(", ")})`;
}

// Combos totais do baralho (usado como denominador na barra de %) — 6
// pares x 13 + 4 suited x 78 + 12 offsuit x 78 = 1326, mas calculado
// aqui em vez de hardcoded pra nao dessincronizar se algo mudar.
const TOTAL_DECK_COMBOS = (() => {
  let total = 0;
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) if (r <= c) total += r === c ? 6 : 4;
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) if (r > c) total += 12;
  return total;
})();

// Preenche o TOPO X% do range (por combos, nao por quantidade de maos —
// igual o Flopzilla) com a acao escolhida. A mao que cai bem na
// fronteira do corte recebe peso fracionado (ex: 67%) pra bater o
// percentual exato, em vez de arredondar pra mao inteira ou de fora.
// Maos fora do top X% voltam pro fold 100% — o slider define o range
// inteiro, nao soma em cima do que ja existia.
function buildPercentSelection(percent: number, tool: ToolButton): RangeHands {
  const { action, raiseType } = TOOL_META[tool];
  const targetCombos = Math.round((TOTAL_DECK_COMBOS * percent) / 100);
  let used = 0;
  const result: RangeHands = {};
  for (const label of HAND_STRENGTH_RANKING) {
    const cc = comboCount(label);
    let weight = 0;
    if (used < targetCombos) {
      const remaining = targetCombos - used;
      if (remaining >= cc) {
        weight = 100;
        used += cc;
      } else {
        weight = Math.round((remaining / cc) * 100);
        used += remaining;
      }
    }
    result[label] =
      weight > 0
        ? {
            fold: 100 - weight,
            call: action === "call" ? weight : 0,
            raise: action === "raise" ? weight : 0,
            raiseType: action === "raise" ? raiseType : undefined,
          }
        : EMPTY_DECISION;
  }
  return result;
}

export interface RangeGridProps {
  value: RangeHands;
  onChange: (hands: RangeHands) => void;
  readOnly?: boolean;
  labelsWithOverrides?: Set<string>;
  onOpenComboEditor?: (label: string) => void;
  maxWidthPx?: number;
}

export function RangeGrid({
  value,
  onChange,
  readOnly = false,
  labelsWithOverrides,
  onOpenComboEditor,
  maxWidthPx = 580,
}: RangeGridProps) {
  const [tool, setTool] = useState<ToolButton>("raise");
  const [percent, setPercent] = useState(100);
  // Pincel de mescla: pinta uma celula dividida entre duas ferramentas
  // (ex: metade Call metade Raise, ou metade 3-bet metade All-in) numa
  // unica pintada, em vez de ter que abrir o editor de combo pra digitar
  // os numeros na mao.
  const [mixMode, setMixMode] = useState(false);
  const [mixToolA, setMixToolA] = useState<ToolButton>("raise");
  const [mixToolB, setMixToolB] = useState<ToolButton>("call");
  const [mixRatio, setMixRatio] = useState(50);
  const isDragging = useRef(false);
  // Decidido uma vez no inicio da arrastada: se a celula clicada ja
  // tinha exatamente essa ferramenta a 100%, a arrastada inteira vira
  // "apagar" (volta pro fold 100%) em vez de pintar.
  const dragMode = useRef<"paint" | "erase">("paint");

  // Desfazer/refazer: cada gesto completo (uma arrastada inteira, ou um
  // solte do slider de %) vira UM passo — nao um passo por celula — pra
  // Ctrl+Z desfazer a pintura inteira de uma vez, do jeito que se espera
  // de uma ferramenta de desenho.
  const [past, setPast] = useState<RangeHands[]>([]);
  const [future, setFuture] = useState<RangeHands[]>([]);

  function undo() {
    if (readOnly || past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [value, ...f]);
    onChange(previous);
  }
  function redo() {
    if (readOnly || future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, value]);
    onChange(next);
  }

  const currentBrush = useCallback(
    () => (mixMode ? decisionForMix(mixToolA, mixToolB, mixRatio) : decisionForTool(tool)),
    [mixMode, mixToolA, mixToolB, mixRatio, tool]
  );

  const paintCells = useCallback(
    (cells: [number, number][]) => {
      const next = { ...value };
      const painted = dragMode.current === "erase" ? EMPTY_DECISION : currentBrush();
      for (const [r, c] of cells) next[getHandLabel(r, c)] = painted;
      onChange(next);
    },
    [value, onChange, currentBrush]
  );

  // Toque/clique unico pinta so' a mao clicada — toque/clique duplo na
  // MESMA mao (dentro de DOUBLE_TAP_MS) preenche o grupo "X+" inteiro
  // (ex: clicar 55 pinta so' 55; clicar 55 de novo rapido preenche
  // 55,66,77...ate' AA). Antes um unico clique ja preenchia o grupo
  // todo, o que pintava mao demais sem querer.
  const DOUBLE_TAP_MS = 400;
  const lastTap = useRef<{ label: string; time: number } | null>(null);

  const startPaint = (rowIdx: number, colIdx: number) => {
    if (readOnly) return;
    isDragging.current = true;
    const label = getHandLabel(rowIdx, colIdx);
    const now = Date.now();
    const isDoubleTap = lastTap.current?.label === label && now - lastTap.current.time < DOUBLE_TAP_MS;

    if (isDoubleTap) {
      // Reaproveita o "past" ja' empilhado pelo primeiro toque —
      // desfazer volta direto pro estado de antes do gesto inteiro,
      // nao so' do segundo toque.
      lastTap.current = null;
      dragMode.current = "paint";
      paintCells(smartGroupCells(rowIdx, colIdx));
      return;
    }

    lastTap.current = { label, time: now };
    const current = getDecision(value, label);
    dragMode.current = decisionsEqual(current, currentBrush()) ? "erase" : "paint";
    setPast((p) => [...p, value]);
    setFuture([]);
    paintCells([[rowIdx, colIdx]]);
  };
  const continuePaint = (rowIdx: number, colIdx: number) => {
    if (!isDragging.current || readOnly) return;
    paintCells([[rowIdx, colIdx]]);
  };
  const stopPaint = () => {
    isDragging.current = false;
  };

  function applyPercent(p: number) {
    setPercent(p);
    if (readOnly) return;
    setPast((prev) => [...prev, value]);
    setFuture([]);
    onChange(buildPercentSelection(p, tool));
  }

  // Atalhos de teclado: 1-5 troca a ferramenta (mesma ordem dos botoes),
  // Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z ou Ctrl+Y refaz. So ativa numa
  // grade editavel (nunca em grades readOnly, ex: lado a lado no
  // comparador) e ignora quando o foco esta' num campo de texto (nome,
  // tag, descricao) pra nao roubar digitacao normal.
  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mixMode) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TOOL_ORDER.length) setTool(TOOL_ORDER[idx]);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, past, future, value, mixMode]);

  const summary = useMemo(() => {
    const combos = { fold: 0, call: 0, raise: 0 };
    let activeHands = 0;
    for (let row = 0; row < RANKS.length; row++) {
      for (let col = 0; col < RANKS.length; col++) {
        const label = getHandLabel(row, col);
        const d = getDecision(value, label);
        const c = comboCount(label);
        combos.fold += c * (d.fold / 100);
        combos.call += c * (d.call / 100);
        combos.raise += c * (d.raise / 100);
        if (d.call > 0 || d.raise > 0) activeHands += 1;
      }
    }
    return {
      activeHands,
      call: Math.round(combos.call),
      raise: Math.round(combos.raise),
      totalPct: Math.round(((combos.call + combos.raise) / TOTAL_DECK_COMBOS) * 100),
    };
  }, [value]);

  return (
    <div className="w-full select-none">
      <div className="mx-auto" style={{ maxWidth: maxWidthPx }}>
        {!readOnly && (
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* overflow-x-auto + shrink-0 nos botoes em vez de flex-wrap:
                  com flex-wrap, esse pill (rounded-full) quebrava em 2
                  linhas em telas estreitas e o border-radius de "full"
                  virava uma bolha enorme em vez de continuar parecendo
                  pilula -- rola na horizontal e mantem a forma. */}
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto rounded-full border border-hairline bg-elevated p-1">
                {TOOL_ORDER.map((t) => {
                  const active = tool === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTool(t)}
                      title={`${TOOL_META[t].label} (tecla ${TOOL_ORDER.indexOf(t) + 1})`}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all ${
                        active ? "shadow-sm" : "text-muted hover:text-ink"
                      }`}
                      style={active ? { backgroundColor: `${TOOL_META[t].color}26`, color: TOOL_META[t].color } : undefined}
                    >
                      <span
                        className="h-2 w-2 rounded-full transition-transform"
                        style={{ backgroundColor: TOOL_META[t].color, transform: active ? "scale(1.15)" : "scale(1)" }}
                      />
                      {TOOL_META[t].label}
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setMixMode((v) => !v)}
                  title="Pintar celula dividida entre 2 acoes (ex: metade 3-bet, metade All-in)"
                  aria-pressed={mixMode}
                  className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                    mixMode ? "border-evolution bg-evolution/10 text-evolution" : "border-hairline bg-elevated text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex h-3.5 w-3.5 overflow-hidden rounded-full border border-black/10">
                    <span className="h-full w-1/2" style={{ backgroundColor: TOOL_META[mixToolA].color }} />
                    <span className="h-full w-1/2" style={{ backgroundColor: TOOL_META[mixToolB].color }} />
                  </span>
                  Mesclar
                </button>
                <button
                  type="button"
                  onClick={undo}
                  disabled={past.length === 0}
                  title="Desfazer (Ctrl+Z)"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:text-ink disabled:opacity-30"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={future.length === 0}
                  title="Refazer (Ctrl+Shift+Z)"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:text-ink disabled:opacity-30"
                >
                  <Redo2 size={14} />
                </button>
              </div>
            </div>

            {mixMode ? (
              // Pincel de mescla: escolhe as 2 acoes e o quanto cada uma
              // pesa — pinta a celula (ou o grupo "X+") inteira dividida
              // nessa proporcao numa tacada so, sem precisar abrir o
              // editor de combo pra digitar numero por numero.
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-elevated px-3 py-2">
                <select
                  value={mixToolA}
                  onChange={(e) => setMixToolA(e.target.value as ToolButton)}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                  style={{ color: TOOL_META[mixToolA].color }}
                >
                  {TOOL_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TOOL_META[t].label}
                    </option>
                  ))}
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mixRatio}
                  onChange={(e) => setMixRatio(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-current"
                />
                <select
                  value={mixToolB}
                  onChange={(e) => setMixToolB(e.target.value as ToolButton)}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 text-xs font-medium outline-none"
                  style={{ color: TOOL_META[mixToolB].color }}
                >
                  {TOOL_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TOOL_META[t].label}
                    </option>
                  ))}
                </select>
                <span className="w-24 shrink-0 text-right text-[11px] font-medium tabular-nums text-muted">
                  {mixRatio}% / {100 - mixRatio}%
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-hairline bg-elevated px-3 py-1.5">
                <span className="shrink-0 text-[11px] text-muted">Top %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e) => applyPercent(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-current"
                  style={{ color: TOOL_META[tool].color }}
                />
                <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-ink">{percent}%</span>
              </div>
            )}
          </div>
        )}

        <div
          className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px] rounded-xl border border-hairline bg-surface p-1.5"
          onPointerUp={stopPaint}
          onPointerLeave={stopPaint}
        >
          {RANKS.map((_, rowIdx) =>
            RANKS.map((__, colIdx) => {
              const label = getHandLabel(rowIdx, colIdx);
              const d = getDecision(value, label);
              const hasOverride = labelsWithOverrides?.has(label) ?? false;
              const raiseTypeLabel =
                d.raise > 0 && d.raiseMix && d.raiseMix.length > 1
                  ? ` (${d.raiseMix.map((seg) => `${RAISE_TYPE_LABEL[seg.type]} ${seg.weight}%`).join(" + ")})`
                  : d.raise > 0 && d.raiseType && d.raiseType !== "raise"
                    ? ` (${RAISE_TYPE_LABEL[d.raiseType]})`
                    : "";
              const title = `${label} — Fold ${d.fold}% / Call ${d.call}% / Raise ${d.raise}%${raiseTypeLabel}${hasOverride ? " (tem combo customizado)" : ""}`;
              return (
                <div
                  key={label}
                  onPointerDown={() => startPaint(rowIdx, colIdx)}
                  onPointerEnter={() => continuePaint(rowIdx, colIdx)}
                  title={title}
                  className={`relative flex aspect-square items-center justify-center rounded-[3px] text-[11px] font-semibold text-ink transition-transform hover:z-10 hover:scale-[1.12] hover:shadow-md ${
                    readOnly ? "cursor-default" : "cursor-pointer"
                  }`}
                  style={{ background: cellBackground(d) }}
                >
                  {label}
                  {hasOverride && <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-evolution" />}
                  {onOpenComboEditor && !readOnly && (
                    // Hit-box de 2x2px era praticamente impossivel de
                    // acertar (e invisivel, sem nenhuma pista de que
                    // dava pra clicar ali) — agora fica sempre visivel
                    // (bem sutil) e cresce/escurece no hover, com area
                    // de clique maior. Fica so' no canto (nao cobre a
                    // celula toda) pra nao atrapalhar o clique/arrasto
                    // de pintar quando a celula esta' fechada.
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenComboEditor(label);
                      }}
                      className="absolute bottom-0 right-0 flex h-3 w-3 items-end justify-end rounded-tl-[3px] bg-black/0 pb-px pr-px text-[7px] leading-none text-black/25 transition-colors hover:bg-black/60 hover:text-white"
                      title="Editar combos individuais desta mão"
                    >
                      ⋯
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted">
          {summary.activeHands} mãos · {summary.totalPct}% do range · {summary.raise} raise · {summary.call} call
        </p>
      </div>
    </div>
  );
}
