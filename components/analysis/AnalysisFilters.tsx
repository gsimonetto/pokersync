"use client";

import { useState } from "react";
import { Upload, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import { ManualImportPanel } from "@/components/analysis/ManualImportPanel";
import {
  STACK_DEPTH_LABEL,
  TOURNAMENT_STAGE_LABEL,
  HERO_POSITION_LABEL,
  HERO_POSITION_ORDER,
  PREFLOP_ACTION_LABEL,
  type AnalysisFilters as Filters,
  type StackDepthBucket,
  type TournamentStage,
  type HeroPosition,
  type PreflopActionType,
} from "@/types/analysis";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

type ModalityValue = "all" | "mtt" | "cash";

// Barra de filtros globais do modulo de Analise. Reformulada (2026-09)
// pra caber na mesma linha do TabNav (ver `trailing` em tab-nav.tsx) em
// vez de empilhar duas linhas com espaco em branco entre elas: "Filtros"
// e' so' um icone (com bolinha de contagem) em vez de botao com rotulo,
// e tanto ele quanto "Importar -> Hand history" abrem em modal central
// (ModalPortal) em vez de um bloco full-width que empurrava o conteudo
// pra baixo ou um dropdown ancorado no botao.
//
// Modalidade (MTT/Cash) sai do grupo generico de chips e vira um
// segmented control proprio, sempre visivel -- e' o filtro que decide
// qual "regua" de referencia (PREFLOP_REFERENCE/POSTFLOP_REFERENCE)
// as outras abas usam (ver computeReferenceProfile), entao merece
// destaque em vez de ficar escondido dentro do dropdown "Filtros".
export function AnalysisFilters({
  filters,
  onChange,
  availableStackDepths,
  availablePositions,
  onImported,
  onSelectTournamentImport,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  availableStackDepths: Set<StackDepthBucket>;
  availablePositions: Set<HeroPosition>;
  onImported: () => void;
  onSelectTournamentImport: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const activeCount = filters.stackDepths.length + filters.stages.length + filters.positions.length + filters.preflopActions.length;

  const modality: ModalityValue = filters.formats.length === 1 ? (filters.formats[0] as ModalityValue) : "all";
  function handleModalityChange(v: ModalityValue) {
    onChange({ ...filters, formats: v === "all" ? [] : [v] });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        value={modality}
        onChange={handleModalityChange}
        options={[
          { value: "all", label: "Todos" },
          { value: "mtt", label: "MTT" },
          { value: "cash", label: "Cash" },
        ]}
      />

      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        title="Mais filtros"
        aria-label="Mais filtros"
        className={`relative grid h-7 w-7 place-items-center rounded-md border transition-colors ${
          moreOpen ? "border-ink bg-ink text-void" : "border-hairline text-muted hover:border-ink/40 hover:text-ink"
        }`}
      >
        <SlidersHorizontal size={13} />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-evolution text-[10px] font-bold text-void">
            {activeCount}
          </span>
        )}
      </button>

      {moreOpen && (
        <MoreFiltersModal onClose={() => setMoreOpen(false)}>
          <div className="space-y-3">
            <FilterGroup label="Profundidade de stack">
              {(Object.keys(STACK_DEPTH_LABEL) as StackDepthBucket[]).map((s) => (
                <FilterChip
                  key={s}
                  label={STACK_DEPTH_LABEL[s]}
                  active={filters.stackDepths.includes(s)}
                  disabled={!availableStackDepths.has(s)}
                  disabledReason="Sem mãos nessa faixa de stack ainda"
                  onClick={() => onChange({ ...filters, stackDepths: toggle(filters.stackDepths, s) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Estágio do torneio">
              {(Object.keys(TOURNAMENT_STAGE_LABEL) as TournamentStage[]).map((s) => (
                <FilterChip
                  key={s}
                  label={TOURNAMENT_STAGE_LABEL[s]}
                  active={filters.stages.includes(s)}
                  disabled
                  disabledReason="Depende do motor de ICM, que ainda não roda no pipeline (ver backlog)"
                  onClick={() => onChange({ ...filters, stages: toggle(filters.stages, s) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Posição do herói">
              {HERO_POSITION_ORDER.map((p) => (
                <FilterChip
                  key={p}
                  label={HERO_POSITION_LABEL[p]}
                  active={filters.positions.includes(p)}
                  disabled={!availablePositions.has(p)}
                  disabledReason="Sem mãos identificadas nessa posição ainda"
                  onClick={() => onChange({ ...filters, positions: toggle(filters.positions, p) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Ação preflop">
              {(Object.keys(PREFLOP_ACTION_LABEL) as PreflopActionType[]).map((a) => (
                <FilterChip
                  key={a}
                  label={PREFLOP_ACTION_LABEL[a]}
                  active={filters.preflopActions.includes(a)}
                  onClick={() => onChange({ ...filters, preflopActions: toggle(filters.preflopActions, a) })}
                />
              ))}
            </FilterGroup>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, stackDepths: [], stages: [], positions: [], preflopActions: [] })}
                className="text-[11.5px] font-semibold text-muted hover:text-ink"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </MoreFiltersModal>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setImportMenuOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
            importMenuOpen ? "border-ink bg-ink text-void" : "border-hairline bg-elevated text-muted hover:border-ink/40 hover:text-ink"
          }`}
        >
          <Upload size={13} />
          Importar
          <ChevronDown size={13} className={`transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {importMenuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-lg border border-hairline bg-elevated shadow-lg">
            <button
              type="button"
              onClick={() => {
                setImportOpen(true);
                setImportMenuOpen(false);
              }}
              className="block w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-ink hover:bg-void/40"
            >
              Hand history
              <span className="mt-0.5 block text-[11px] font-normal text-muted">Cole o texto exportado do site</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMenuOpen(false);
                onSelectTournamentImport();
              }}
              className="block w-full border-t border-hairline px-3.5 py-2.5 text-left text-[13px] font-medium text-ink hover:bg-void/40"
            >
              Torneio
              <span className="mt-0.5 block text-[11px] font-normal text-muted">Premiação / colocação na aba Torneios</span>
            </button>
          </div>
        )}
      </div>

      {importOpen && (
        <ImportHandHistoryModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            onImported();
          }}
        />
      )}
    </div>
  );
}

function MoreFiltersModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEscapeToClose(onClose);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 p-4 pt-10" onClick={onClose}>
        <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold">Mais filtros</h3>
            <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}

function ImportHandHistoryModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  useEscapeToClose(onClose);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 p-4 pt-10" onClick={onClose}>
        <div className="w-full max-w-xl rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold">Importar hand history</h3>
            <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          <ManualImportPanel onImported={onImported} />
        </div>
      </div>
    </ModalPortal>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
