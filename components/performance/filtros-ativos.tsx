"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  HERO_POSITION_LABEL,
  PREFLOP_ACTION_LABEL,
  STACK_DEPTH_LABEL,
  TOURNAMENT_STAGE_LABEL,
  type AnalysisFilters as Filters,
} from "@/types/analysis";

// Filtros ATIVOS à vista, como chips com "x" pra tirar na hora -- antes
// ficavam escondidos atrás do botãozinho de filtro e o jogador olhava
// números filtrados sem saber. O botão de abrir o modal continua ao lado
// (AnalysisFilters), pra adicionar filtro novo.
type Ativo = { chave: string; rotulo: string; tirar: (f: Filters) => Filters };

function ativos(f: Filters): Ativo[] {
  const lista: Ativo[] = [];
  for (const fmt of f.formats) {
    lista.push({
      chave: `fmt:${fmt}`,
      rotulo: fmt === "mtt" ? "MTT" : fmt === "cash" ? "Cash" : String(fmt).toUpperCase(),
      tirar: (x) => ({ ...x, formats: x.formats.filter((v) => v !== fmt) }),
    });
  }
  for (const s of f.stackDepths) {
    lista.push({ chave: `stack:${s}`, rotulo: STACK_DEPTH_LABEL[s], tirar: (x) => ({ ...x, stackDepths: x.stackDepths.filter((v) => v !== s) }) });
  }
  for (const s of f.stages) {
    lista.push({ chave: `fase:${s}`, rotulo: TOURNAMENT_STAGE_LABEL[s], tirar: (x) => ({ ...x, stages: x.stages.filter((v) => v !== s) }) });
  }
  for (const p of f.positions) {
    lista.push({ chave: `pos:${p}`, rotulo: HERO_POSITION_LABEL[p], tirar: (x) => ({ ...x, positions: x.positions.filter((v) => v !== p) }) });
  }
  for (const a of f.preflopActions) {
    lista.push({
      chave: `acao:${a}`,
      rotulo: PREFLOP_ACTION_LABEL[a],
      tirar: (x) => ({ ...x, preflopActions: x.preflopActions.filter((v) => v !== a) }),
    });
  }
  return lista;
}

export function FiltrosAtivos({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const lista = ativos(filters);
  if (lista.length === 0) return <span className="text-[12px] text-muted/70">Todas as mãos</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AnimatePresence initial={false}>
        {lista.map((a) => (
          <motion.span
            key={a.chave}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-1 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 py-0.5 pl-2.5 pr-1 text-[11.5px] font-semibold text-[#f1d78a]"
            style={{ boxShadow: "0 0 10px #d4af3740" }}
          >
            {a.rotulo}
            <button
              type="button"
              onClick={() => onChange(a.tirar(filters))}
              aria-label={`Tirar filtro ${a.rotulo}`}
              className="grid h-4 w-4 place-items-center rounded-full text-[#f1d78a]/70 transition-colors hover:bg-white/10 hover:text-ink"
            >
              <X size={11} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {lista.length > 1 && (
        <button
          type="button"
          onClick={() => onChange({ ...filters, formats: [], stackDepths: [], stages: [], positions: [], preflopActions: [] })}
          className="ml-1 text-[11.5px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
