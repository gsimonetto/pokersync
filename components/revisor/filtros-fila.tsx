"use client";

import { SlidersHorizontal, X, Zap } from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";
import { HERO_POSITION_LABEL, HERO_POSITION_ORDER, STACK_DEPTH_LABEL, type HeroPosition, type StackDepthBucket } from "@/types/analysis";

// Filtros da tela inicial do Revisor (pedido explícito: "quero os filtros
// avançados que sejam possíveis fazer nesta tela inicial, e não precisar
// ir em outra aba pra isso"). Dois grupos no mesmo painel:
//  - do torneio: formato, faixa de buy-in e resultado;
//  - das mãos: posição, stack e all-in (o que era a aba "Filtros
//    avançados") -- com eles ativos, a tela mostra também as mãos que
//    batem, pra abrir direto na mesa.

export type FaixaBuyin = "ate5" | "5a20" | "20a50" | "50mais";
export type ResultadoTorneio = "lucro" | "prejuizo" | "itm" | "ft";
export type FormatoTorneio = "pko" | "mystery" | "regular" | "spin" | "cash";

export interface FiltrosFila {
  formatos: FormatoTorneio[];
  buyins: FaixaBuyin[];
  resultados: ResultadoTorneio[];
  posicoes: HeroPosition[];
  stacks: StackDepthBucket[];
  soAllIn: boolean;
}

export const FILTROS_VAZIOS: FiltrosFila = { formatos: [], buyins: [], resultados: [], posicoes: [], stacks: [], soAllIn: false };

const FORMATOS: { v: FormatoTorneio; rotulo: string }[] = [
  { v: "pko", rotulo: "PKO" },
  { v: "mystery", rotulo: "Mystery" },
  { v: "regular", rotulo: "Regular" },
  { v: "spin", rotulo: "Spin & Go" },
  { v: "cash", rotulo: "Cash" },
];
const BUYINS: { v: FaixaBuyin; rotulo: string }[] = [
  { v: "ate5", rotulo: "Até $5" },
  { v: "5a20", rotulo: "$5 a $20" },
  { v: "20a50", rotulo: "$20 a $50" },
  { v: "50mais", rotulo: "Acima de $50" },
];
const RESULTADOS: { v: ResultadoTorneio; rotulo: string }[] = [
  { v: "lucro", rotulo: "Com lucro" },
  { v: "prejuizo", rotulo: "Com prejuízo" },
  { v: "itm", rotulo: "Premiado (ITM)" },
  { v: "ft", rotulo: "Mesa final" },
];

export function faixaDoBuyin(buyin: number): FaixaBuyin {
  if (buyin <= 5) return "ate5";
  if (buyin <= 20) return "5a20";
  if (buyin <= 50) return "20a50";
  return "50mais";
}

/** Mesmos cortes de STACK_DEPTH_LABEL, em cima do stack do herói em BB. */
export function faixaDoStack(bb: number): StackDepthBucket {
  if (bb <= 10) return "0-10";
  if (bb <= 20) return "10-20";
  if (bb <= 40) return "20-40";
  if (bb <= 60) return "40-60";
  return "60+";
}

export const temFiltroDeMao = (f: FiltrosFila) => f.posicoes.length > 0 || f.stacks.length > 0 || f.soAllIn;
export const totalDeFiltros = (f: FiltrosFila) =>
  f.formatos.length + f.buyins.length + f.resultados.length + f.posicoes.length + f.stacks.length + (f.soAllIn ? 1 : 0);

function alternar<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">{rotulo}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Botão que abre/fecha o painel, com a quantidade de filtros ativos. */
export function BotaoFiltros({ aberto, ativos, onClick }: { aberto: boolean; ativos: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
        aberto || ativos > 0 ? "border-review/50 bg-review/15 text-ink" : "border-white/10 bg-white/[0.04] text-muted hover:border-white/20 hover:text-ink"
      }`}
    >
      <SlidersHorizontal size={13} /> Filtros
      {ativos > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-review px-1 text-[10px] font-bold text-white">{ativos}</span>}
    </button>
  );
}

export function PainelFiltros({ f, onChange }: { f: FiltrosFila; onChange: (f: FiltrosFila) => void }) {
  const ativos = totalDeFiltros(f);
  return (
    <div className="painel-vidro fade-in-up mb-4 rounded-2xl border border-white/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">Filtrar torneios e mãos</p>
        {ativos > 0 && (
          <button type="button" onClick={() => onChange(FILTROS_VAZIOS)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted transition hover:bg-white/[0.05] hover:text-ink">
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[11.5px] font-semibold text-ink/80">Do torneio</p>
          <Grupo rotulo="Formato">
            {FORMATOS.map((x) => (
              <FilterChip key={x.v} label={x.rotulo} active={f.formatos.includes(x.v)} onClick={() => onChange({ ...f, formatos: alternar(f.formatos, x.v) })} />
            ))}
          </Grupo>
          <Grupo rotulo="Buy-in">
            {BUYINS.map((x) => (
              <FilterChip key={x.v} label={x.rotulo} active={f.buyins.includes(x.v)} onClick={() => onChange({ ...f, buyins: alternar(f.buyins, x.v) })} />
            ))}
          </Grupo>
          <Grupo rotulo="Resultado">
            {RESULTADOS.map((x) => (
              <FilterChip key={x.v} label={x.rotulo} active={f.resultados.includes(x.v)} onClick={() => onChange({ ...f, resultados: alternar(f.resultados, x.v) })} />
            ))}
          </Grupo>
        </div>
        <div className="space-y-3 lg:border-l lg:border-white/[0.06] lg:pl-4">
          <p className="text-[11.5px] font-semibold text-ink/80">
            Das mãos <span className="font-normal text-muted">· mostra as mãos que batem, pra abrir na mesa</span>
          </p>
          <Grupo rotulo="Sua posição">
            {HERO_POSITION_ORDER.map((p) => (
              <FilterChip key={p} label={HERO_POSITION_LABEL[p]} active={f.posicoes.includes(p)} onClick={() => onChange({ ...f, posicoes: alternar(f.posicoes, p) })} />
            ))}
          </Grupo>
          <Grupo rotulo="Seu stack">
            {(Object.keys(STACK_DEPTH_LABEL) as StackDepthBucket[]).map((s) => (
              <FilterChip key={s} label={STACK_DEPTH_LABEL[s]} active={f.stacks.includes(s)} onClick={() => onChange({ ...f, stacks: alternar(f.stacks, s) })} />
            ))}
          </Grupo>
          <Grupo rotulo="Jogada">
            <FilterChip label="Você foi all-in" icon={<Zap size={11} />} active={f.soAllIn} onClick={() => onChange({ ...f, soAllIn: !f.soAllIn })} />
          </Grupo>
        </div>
      </div>
    </div>
  );
}
