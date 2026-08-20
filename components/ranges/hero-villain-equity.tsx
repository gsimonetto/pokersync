"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Dices, LayoutGrid } from "lucide-react";
import { RangeGrid, type RangeHands } from "@/components/ranges/range-grid";
import { CardPickerModal } from "@/components/ranges/card-picker-modal";
import { Card } from "@/components/drill/card";
import { parseBoardInput, cardToString } from "@/lib/poker/range-board-analyzer";
import { runEquityMonteCarlo, type EquityResult } from "@/lib/poker/equity-engine";

const POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

export function HeroVillainEquity({
  heroHands,
  heroComboOverrides,
}: {
  heroHands: RangeHands;
  heroComboOverrides: RangeHands;
}) {
  const [open, setOpen] = useState(false);
  const [villainHands, setVillainHands] = useState<RangeHands>({});
  const [heroPosition, setHeroPosition] = useState("BTN");
  const [villainPosition, setVillainPosition] = useState("BB");
  const [boardInput, setBoardInput] = useState("");
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ results: EquityResult[]; trialsCompleted: number } | null>(null);

  const boardParsed = parseBoardInput(boardInput);

  function handleRun() {
    if (boardParsed.error) {
      setError(boardParsed.error);
      return;
    }
    setError("");
    setResult(null);
    setRunning(true);
    setTimeout(() => {
      const outcome = runEquityMonteCarlo(
        [
          { label: `Hero (${heroPosition})`, source: { kind: "range", hands: heroHands, comboOverrides: heroComboOverrides } },
          { label: `Vilão (${villainPosition})`, source: { kind: "range", hands: villainHands } },
        ],
        boardParsed.cards,
        3000
      );
      if ("error" in outcome) setError(outcome.error);
      else setResult(outcome);
      setRunning(false);
    }, 30);
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-xs font-medium">Equidade contra range do vilão</span>
        {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-muted">Posição do hero</label>
              <select
                value={heroPosition}
                onChange={(e) => setHeroPosition(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">Posição do vilão</label>
              <select
                value={villainPosition}
                onChange={(e) => setVillainPosition(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mb-1 text-[11px] text-muted">
            O range do hero é o que você está montando na grade principal. Monte o range do vilão aqui:
          </p>
          <RangeGrid value={villainHands} onChange={setVillainHands} maxWidthPx={320} />

          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-muted">Board (opcional)</label>
            <button
              onClick={() => setShowBoardPicker(true)}
              className="mx-auto flex min-h-[36px] w-fit items-center justify-center gap-1 rounded-lg border border-hairline bg-elevated px-3 py-1"
            >
              {boardParsed.cards.length === 0 ? (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <LayoutGrid size={13} />
                  Selecionar (ou preflop)
                </span>
              ) : (
                boardParsed.cards.map((c) => <Card key={cardToString(c)} card={cardToString(c)} size="mini" />)
              )}
            </button>
          </div>

          {showBoardPicker && (
            <CardPickerModal
              title="Escolher board"
              maxCards={5}
              minCards={0}
              initialCards={boardInput.match(/.{1,2}/g) ?? []}
              onConfirm={(cards) => {
                setBoardInput(cards.join(""));
                setShowBoardPicker(false);
              }}
              onClose={() => setShowBoardPicker(false)}
            />
          )}

          {error && <p className="mt-2 text-center text-xs text-negative">{error}</p>}

          <button
            onClick={handleRun}
            disabled={running}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-void disabled:opacity-50"
          >
            <Dices size={14} />
            {running ? "Calculando…" : "Calcular equidade"}
          </button>

          {result && (
            <div className="mt-3 space-y-1.5">
              {result.results.map((r) => (
                <div key={r.label} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                  <span className="text-xs">{r.label}</span>
                  <span className="text-sm font-semibold">{r.equityPct}%</span>
                </div>
              ))}
              <p className="text-[10px] text-muted">
                {result.trialsCompleted.toLocaleString("pt-BR")} simulações — estimativa por amostragem.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
