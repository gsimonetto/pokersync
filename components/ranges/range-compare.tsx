"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RangeGrid, getDecision, type HandDecision, type RangeHands } from "@/components/ranges/range-grid";
import { getRange, listRanges, type RangeDetail, type RangeListItem } from "@/lib/services/range-service";

interface DiffSummary {
  onlyA: number;
  onlyB: number;
  common: number;
  differentWeight: number;
}

function sameDecision(a: HandDecision, b: HandDecision): boolean {
  return a.fold === b.fold && a.call === b.call && a.raise === b.raise;
}

// Compara os mapas mao->decisao dos dois ranges, olhando pras 169 maos
// (nao so pras chaves presentes) pois agora mao ausente tem decisao
// implicita (fold 100) que ainda pode divergir de uma decisao explicita
// no outro range. "Comum" = decisao identica nos 3 numeros; "peso
// diferente" = ambos tem alguma acao (nao sao 100% fold) mas com split
// distinto; "so em A/B" = um tem acao e o outro e' 100% fold.
function diffRanges(a: RangeHands, b: RangeHands): DiffSummary {
  const labels = new Set([...Object.keys(a), ...Object.keys(b)]);
  let onlyA = 0;
  let onlyB = 0;
  let common = 0;
  let differentWeight = 0;

  for (const label of labels) {
    const da = getDecision(a, label);
    const db = getDecision(b, label);
    const aHasAction = da.call > 0 || da.raise > 0;
    const bHasAction = db.call > 0 || db.raise > 0;

    if (aHasAction && !bHasAction) onlyA += 1;
    else if (bHasAction && !aHasAction) onlyB += 1;
    else if (aHasAction && bHasAction) {
      if (sameDecision(da, db)) common += 1;
      else differentWeight += 1;
    }
  }

  return { onlyA, onlyB, common, differentWeight };
}

export function RangeCompare({ initialA, initialB }: { initialA: string | null; initialB: string | null }) {
  const router = useRouter();
  const [options, setOptions] = useState<RangeListItem[]>([]);
  const [idA, setIdA] = useState(initialA ?? "");
  const [idB, setIdB] = useState(initialB ?? "");
  const [rangeA, setRangeA] = useState<RangeDetail | null>(null);
  const [rangeB, setRangeB] = useState<RangeDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listRanges().then(setOptions).catch(() => setError("Erro ao carregar a lista de ranges."));
  }, []);

  useEffect(() => {
    if (!idA) {
      setRangeA(null);
      return;
    }
    getRange(idA).then(setRangeA).catch(() => setError("Erro ao carregar o range A."));
  }, [idA]);

  useEffect(() => {
    if (!idB) {
      setRangeB(null);
      return;
    }
    getRange(idB).then(setRangeB).catch(() => setError("Erro ao carregar o range B."));
  }, [idB]);

  function selectA(value: string) {
    setIdA(value);
    router.replace(`/ranges/compare?a=${value}${idB ? `&b=${idB}` : ""}`);
  }
  function selectB(value: string) {
    setIdB(value);
    router.replace(`/ranges/compare?b=${value}${idA ? `&a=${idA}` : ""}`);
  }

  const diff = rangeA && rangeB ? diffRanges(rangeA.hands, rangeB.hands) : null;

  return (
    <div>
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={idA}
          onChange={(e) => selectA(e.target.value)}
          className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
        >
          <option value="">Selecione o range A…</option>
          {options.map((r) => (
            <option key={r.id} value={r.id} disabled={r.id === idB}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={idB}
          onChange={(e) => selectB(e.target.value)}
          className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
        >
          <option value="">Selecione o range B…</option>
          {options.map((r) => (
            <option key={r.id} value={r.id} disabled={r.id === idA}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {diff && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-hairline bg-surface p-3 text-center">
            <p className="text-lg font-semibold">{diff.common}</p>
            <p className="text-xs text-muted">Iguais</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-3 text-center">
            <p className="text-lg font-semibold">{diff.differentWeight}</p>
            <p className="text-xs text-muted">Peso diferente</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-3 text-center">
            <p className="text-lg font-semibold">{diff.onlyA}</p>
            <p className="text-xs text-muted">Só em A</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface p-3 text-center">
            <p className="text-lg font-semibold">{diff.onlyB}</p>
            <p className="text-xs text-muted">Só em B</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">{rangeA?.name ?? "Range A"}</p>
          {rangeA && <RangeGrid value={rangeA.hands} onChange={() => {}} readOnly />}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{rangeB?.name ?? "Range B"}</p>
          {rangeB && <RangeGrid value={rangeB.hands} onChange={() => {}} readOnly />}
        </div>
      </div>
    </div>
  );
}
