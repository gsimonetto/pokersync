import { cellBackground, getDecision, getHandLabel, RANKS, type RangeHands } from "@/components/ranges/range-grid";

// Miniatura somente-leitura da grade 13x13 — usada onde precisa
// reconhecer um range de relance (cards da biblioteca, preview de
// import) sem abrir o range inteiro pra ver o que tem pintado nele.
export function RangeGridPreview({ hands, className }: { hands: RangeHands; className?: string }) {
  return (
    <div className={`grid grid-cols-[repeat(13,minmax(0,1fr))] gap-px overflow-hidden rounded-md border border-hairline ${className ?? ""}`}>
      {RANKS.map((_, rowIdx) =>
        RANKS.map((__, colIdx) => {
          const label = getHandLabel(rowIdx, colIdx);
          const d = getDecision(hands, label);
          return <div key={label} className="aspect-square" style={{ background: cellBackground(d) }} />;
        })
      )}
    </div>
  );
}
