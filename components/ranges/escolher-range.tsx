"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { CAMPO } from "@/components/banca/util";
import { contarCombos, topPercent } from "@/lib/ranges/notacao";
import type { AcaoReal } from "@/lib/services/range-service";
import { MiniGrade } from "./mini-grade";
import { Chip, Segmentos, TOTAL_COMBOS, numCombos, pct } from "./pecas";
import type { Biblioteca } from "./use-biblioteca";
import { RANGE_NOVO, deReal, dePronto, deSalvo, type RangeAtual } from "./use-construtor";

// Escolher um range: pra abrir no Construtor, pra comparar, ou pra ser o
// range do vilão na equidade.

type Fonte = "prontos" | "meus" | "time" | "real" | "top";

export const TOPS = [100, 50, 35, 25, 15, 10, 5];

export function rangeTop(p: number): RangeAtual {
  return { ...RANGE_NOVO, nome: p === 100 ? "Qualquer mão" : `Top ${p}% das mãos`, pesos: topPercent(p) };
}

export function ItemRange({ r, detalhe, onClick }: { r: RangeAtual; detalhe?: string; onClick: () => void }) {
  const combos = contarCombos(r.pesos, r.pesosCombo);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <MiniGrade pesos={r.pesos} pesosCombo={r.pesosCombo} largura={58} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{r.nome}</span>
        <span className="tnum text-[11.5px] text-muted">
          {numCombos(combos)} combos · {pct(combos / TOTAL_COMBOS)}
          {detalhe ? ` · ${detalhe}` : ""}
        </span>
      </span>
    </button>
  );
}

export function EscolherRange({
  aberto,
  titulo,
  bib,
  comTop = false,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  bib: Biblioteca;
  /** Mostra "Qualquer mão" e "Top X%" (vilão, comparar). */
  comTop?: boolean;
  onEscolher: (r: RangeAtual) => void;
  onFechar: () => void;
}) {
  const [fonte, setFonte] = useState<Fonte>("prontos");
  const [busca, setBusca] = useState("");
  const [stack, setStack] = useState<number | null>(null);
  const [acaoReal, setAcaoReal] = useState<AcaoReal>("abrir");
  const { carregarReal } = bib;

  useEffect(() => {
    if (aberto && fonte === "real") carregarReal(acaoReal);
  }, [aberto, fonte, acaoReal, carregarReal]);

  const stacks = useMemo(() => [...new Set(bib.prontos.map((p) => p.stack))].sort((a, b) => a - b), [bib.prontos]);
  const termo = busca.trim().toLowerCase();
  const bate = (texto: string) => !termo || texto.toLowerCase().includes(termo);

  const opcoes: { v: Fonte; t: string }[] = [
    { v: "prontos", t: "Prontos (GTO)" },
    { v: "meus", t: "Meus" },
    ...(bib.time ? [{ v: "time" as Fonte, t: "Do time" }] : []),
    { v: "real", t: "De verdade" },
    ...(comTop ? [{ v: "top" as Fonte, t: "Top %" }] : []),
  ];

  let conteudo: React.ReactNode;
  if (fonte === "prontos") {
    const lista = bib.prontos.filter((p) => (stack == null || p.stack === stack) && bate(`${p.titulo} ${p.stack}bb`));
    conteudo = (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Chip ativo={stack == null} onClick={() => setStack(null)}>
            Todos os stacks
          </Chip>
          {stacks.map((s) => (
            <Chip key={s} ativo={stack === s} onClick={() => setStack(s)}>
              {s}bb
            </Chip>
          ))}
        </div>
        <Lista vazio="Nenhum range pronto com esse filtro.">
          {lista.map((p) => (
            <ItemRange key={p.id} r={dePronto(p)} onClick={() => onEscolher(dePronto(p))} />
          ))}
        </Lista>
      </>
    );
  } else if (fonte === "meus") {
    const lista = bib.meus.filter((r) => bate(`${r.nome} ${r.posicao ?? ""} ${r.stack ?? ""}`));
    conteudo = (
      <Lista vazio={bib.meus.length ? "Nenhum range seu com esse nome." : "Você ainda não salvou nenhum range."}>
        {lista.map((r) => (
          <ItemRange key={r.id} r={deSalvo(r, bib.meuId)} onClick={() => onEscolher(deSalvo(r, bib.meuId))} />
        ))}
      </Lista>
    );
  } else if (fonte === "time") {
    const lista = bib.doTime.filter((r) => bate(`${r.nome} ${r.donoNome ?? ""}`));
    conteudo = (
      <Lista vazio="Ninguém do time compartilhou um range ainda.">
        {lista.map((r) => (
          <ItemRange key={r.id} r={deSalvo(r, bib.meuId)} detalhe={r.userId === bib.meuId ? "seu" : r.donoNome} onClick={() => onEscolher(deSalvo(r, bib.meuId))} />
        ))}
      </Lista>
    );
  } else if (fonte === "real") {
    const lista = bib.reais[acaoReal];
    conteudo = (
      <>
        <Segmentos
          rotulo="Ação"
          valor={acaoReal}
          onChange={setAcaoReal}
          opcoes={[
            { v: "abrir", t: "Abrir" },
            { v: "pagar", t: "Pagar" },
            { v: "3bet", t: "3-bet" },
          ]}
        />
        {!lista ? (
          <p className="m-0 flex items-center gap-2 py-6 text-[12.5px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Olhando as suas mãos importadas…
          </p>
        ) : (
          <Lista vazio="Ainda não tem mãos importadas suficientes pra montar esse range.">
            {lista
              .filter((r) => bate(r.posicao))
              .map((r) => (
                <ItemRange key={r.posicao} r={deReal(r)} detalhe={`${r.oportunidades} mãos`} onClick={() => onEscolher(deReal(r))} />
              ))}
          </Lista>
        )}
      </>
    );
  } else {
    conteudo = (
      <Lista vazio="">
        {TOPS.map((p) => (
          <ItemRange key={p} r={rangeTop(p)} onClick={() => onEscolher(rangeTop(p))} />
        ))}
      </Lista>
    );
  }

  return (
    <Modal open={aberto} onClose={onFechar} title={titulo} wide>
      <div className="flex flex-col gap-3">
        <div className="painel-scroll -mx-1 overflow-x-auto px-1">
          <Segmentos rotulo="De onde" valor={fonte} onChange={setFonte} opcoes={opcoes} />
        </div>
        {fonte !== "top" && (
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por posição, stack ou nome" className={`${CAMPO} !pl-8`} />
          </label>
        )}
        {bib.carregando ? (
          <p className="m-0 flex items-center gap-2 py-6 text-[12.5px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </p>
        ) : (
          conteudo
        )}
      </div>
    </Modal>
  );
}

function Lista({ children, vazio }: { children: React.ReactNode; vazio: string }) {
  const itens = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (!itens.length) return <p className="m-0 py-6 text-center text-[12.5px] text-muted">{vazio}</p>;
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}
