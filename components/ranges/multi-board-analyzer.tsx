"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Dices } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import {
  analyzeRangeAcrossRandomBoards,
  chooseAdaptiveSampleSize,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  CONNECTIVITY_TEXTURE_LABEL,
  DEFAULT_TEXTURE_FILTER,
  HIGH_CARD_TEXTURE_LABEL,
  PAIRED_TEXTURE_LABEL,
  SUIT_TEXTURE_LABEL,
  type BoardTextureFilter,
  type Category,
  type MultiBoardAnalysis,
} from "@/lib/poker/range-board-analyzer";

const STRONG: Category[] = ["STRAIGHT_FLUSH", "QUADS", "FULL_HOUSE", "FLUSH", "STRAIGHT", "TRIPS", "TWO_PAIR", "OVERPAIR", "TOP_PAIR"];
const MEDIUM: Category[] = ["SECOND_PAIR", "THIRD_PAIR_OR_WORSE", "POCKET_PAIR_BELOW_BOARD", "FLUSH_DRAW", "STRAIGHT_DRAW"];

function categoryColor(cat: Category): string {
  if (STRONG.includes(cat)) return "#22c55e";
  if (MEDIUM.includes(cat)) return "#eab308";
  return "#c4c7c8";
}

const SELECT_CLASS = "rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none";

export function MultiBoardAnalyzer({
  hands,
  comboOverrides = {},
  startOpen = false,
}: {
  hands: RangeHands;
  comboOverrides?: RangeHands;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MultiBoardAnalysis | null>(null);
  const [filter, setFilter] = useState<BoardTextureFilter>(DEFAULT_TEXTURE_FILTER);

  // Sem escolha manual de tamanho de amostra — calcula sozinho o maior
  // numero de boards que da pra rodar sem travar, baseado em quantos
  // combos o range tem ativos agora. O filtro de textura pode reduzir
  // quantos boards de fato sao encontrados (boardsSampled < pedido).
  function handleRun() {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const sampleSize = chooseAdaptiveSampleSize(hands, comboOverrides);
      setResult(analyzeRangeAcrossRandomBoards(hands, sampleSize, comboOverrides, filter));
      setRunning(false);
    }, 30);
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-medium">Média contra vários boards</span>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-3">
          <p className="mb-2 text-[11px] text-muted">Filtrar por textura do flop (estilo Flopzilla) — deixe &quot;Qualquer&quot; pra amostrar todo tipo de board.</p>

          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <select
              value={filter.suits}
              onChange={(e) => setFilter((f) => ({ ...f, suits: e.target.value as BoardTextureFilter["suits"] }))}
              className={SELECT_CLASS}
            >
              {Object.entries(SUIT_TEXTURE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={filter.paired}
              onChange={(e) => setFilter((f) => ({ ...f, paired: e.target.value as BoardTextureFilter["paired"] }))}
              className={SELECT_CLASS}
            >
              {Object.entries(PAIRED_TEXTURE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={filter.connectivity}
              onChange={(e) => setFilter((f) => ({ ...f, connectivity: e.target.value as BoardTextureFilter["connectivity"] }))}
              className={SELECT_CLASS}
            >
              {Object.entries(CONNECTIVITY_TEXTURE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              value={filter.highCard}
              onChange={(e) => setFilter((f) => ({ ...f, highCard: e.target.value as BoardTextureFilter["highCard"] }))}
              className={SELECT_CLASS}
            >
              {Object.entries(HIGH_CARD_TEXTURE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRun}
            disabled={running}
            className="mb-3 flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-void disabled:opacity-50"
          >
            <Dices size={13} />
            {running ? "Calculando…" : "Rodar análise"}
          </button>

          {result && result.boardsSampled === 0 && (
            <p className="text-xs text-negative">Nenhum board encontrado com essa combinação de filtros — talvez ela seja impossível (ex: monotone + pareado não existe).</p>
          )}

          {result && result.boardsSampled > 0 && (
            <div>
              <p className="mb-2 text-[11px] text-muted">
                {result.totalCombos.toLocaleString("pt-BR")} combos em {result.boardsSampled} boards
                {result.boardsSampled < result.boardsRequested && ` (só ${result.boardsSampled} de ${result.boardsRequested} pedidos foram encontrados com esse filtro)`}
                {" "}— amostra ajustada automaticamente pro tamanho do range.
              </p>
              <div className="space-y-1">
                {CATEGORY_ORDER.filter((cat) => result.byCategory[cat] > 0).map((cat) => {
                  const count = result.byCategory[cat];
                  const pct = Math.round((count / result.totalCombos) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="w-36 shrink-0 truncate text-xs text-muted">{CATEGORY_LABEL[cat]}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: categoryColor(cat) }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
