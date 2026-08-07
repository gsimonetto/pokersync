"use client";
import { useCallback, useMemo, useState } from "react";

// Portado de useFilters.js. So as dimensoes que existem de verdade nos
// dados hoje — solution/format/stack nao entram porque todo spot no
// banco e MTT/ChipEV/40bb, nao ha o que filtrar.
export type DrillFilterKey = "position" | "action" | "street";
export type DrillFilterState = Record<DrillFilterKey, string | null>;

const DEFAULTS: DrillFilterState = { position: null, action: null, street: null };

export function useDrillFilters() {
  const [filters, setFilters] = useState<DrillFilterState>({ ...DEFAULTS });

  const set = useCallback((key: DrillFilterKey, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? DEFAULTS[key] : value }));
  }, []);

  const reset = useCallback(() => setFilters({ ...DEFAULTS }), []);

  const activeCount = useMemo(() => {
    let count = 0;
    (Object.keys(DEFAULTS) as DrillFilterKey[]).forEach((k) => {
      if (filters[k] !== DEFAULTS[k]) count++;
    });
    return count;
  }, [filters]);

  // Os 3 eixos precisam estar preenchidos pra um fetch ser disparado.
  // E o sinal que drill-service.ts e a pagina usam pra saber se ha
  // criterio valido — sem isso, nenhuma mao deve ser buscada.
  const isComplete = useMemo(
    () => !!filters.position && !!filters.action && !!filters.street,
    [filters]
  );

  return { filters, set, reset, activeCount, isComplete };
}
