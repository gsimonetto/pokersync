"use client";

import { useState } from "react";
import { Upload, ChevronDown, SlidersHorizontal } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";
import { ManualImportPanel } from "@/components/analysis/ManualImportPanel";
import {
  GAME_FORMAT_LABEL,
  STACK_DEPTH_LABEL,
  TOURNAMENT_STAGE_LABEL,
  HERO_POSITION_LABEL,
  HERO_POSITION_ORDER,
  PREFLOP_ACTION_LABEL,
  type AnalysisFilters as Filters,
  type GameFormat,
  type StackDepthBucket,
  type TournamentStage,
  type HeroPosition,
  type PreflopActionType,
} from "@/types/analysis";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Barra sticky de filtros globais do módulo de Análise — mesma unidade
// visual de FilterChip/SegmentedControl usada no resto do produto,
// combinável (multi-seleção em cada grupo, filtros se somam por AND).
// `available*` vem de quem tem dado real nos rows carregados: uma opção
// sem nenhuma linha correspondente aparece desabilitada com o motivo, em
// vez de some ou fingir que existe (mesmo espírito da tela de Performance
// -- "não inventar número").
export function AnalysisFilters({
  filters,
  onChange,
  availableFormats,
  availableStackDepths,
  availablePositions,
  onImported,
  onSelectTournamentImport,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  availableFormats: Set<GameFormat>;
  availableStackDepths: Set<StackDepthBucket>;
  availablePositions: Set<HeroPosition>;
  onImported: () => void;
  onSelectTournamentImport: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const activeCount =
    filters.formats.length + filters.stackDepths.length + filters.stages.length + filters.positions.length + filters.preflopActions.length;

  return (
    <div>
      {/* Um único grupo à direita — "Filtros" e "Importar" vivem juntos
          porque são as duas ações que decidem "quais dados eu vejo / de
          onde eles vêm"; nada mais compete pelo lado esquerdo da barra. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
            moreOpen ? "border-ink bg-ink text-void" : "border-hairline bg-transparent text-muted hover:border-ink/40 hover:text-ink"
          }`}
        >
          <SlidersHorizontal size={13} />
          Filtros
          {activeCount > 0 && (
            <span className="grid h-4 w-4 place-items-center rounded-full bg-evolution text-[10px] font-bold text-void">{activeCount}</span>
          )}
          <ChevronDown size={13} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setImportMenuOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
              importMenuOpen || importOpen
                ? "border-ink bg-ink text-void"
                : "border-hairline bg-elevated text-muted hover:border-ink/40 hover:text-ink"
            }`}
          >
            <Upload size={13} />
            Importar
            <ChevronDown size={13} className={`transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {importMenuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1.5 w-52 overflow-hidden rounded-lg border border-hairline bg-elevated shadow-lg">
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
                  setImportOpen(false);
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
      </div>

      {importOpen && (
        <div className="mt-3">
          <ManualImportPanel
            onImported={() => {
              setImportOpen(false);
              onImported();
            }}
          />
        </div>
      )}

      {moreOpen && (
        <div className="mt-3 space-y-3 border-t border-hairline pt-3">
          <FilterGroup label="Modalidade">
            {(Object.keys(GAME_FORMAT_LABEL) as GameFormat[]).map((f) => (
              <FilterChip
                key={f}
                label={GAME_FORMAT_LABEL[f]}
                active={filters.formats.includes(f)}
                disabled={!availableFormats.has(f)}
                disabledReason="Sem mãos importadas nessa modalidade ainda"
                onClick={() => onChange({ ...filters, formats: toggle(filters.formats, f) })}
              />
            ))}
          </FilterGroup>

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
              onClick={() =>
                onChange({ ...filters, formats: [], stackDepths: [], stages: [], positions: [], preflopActions: [] })
              }
              className="text-[11.5px] font-semibold text-muted hover:text-ink"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
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
