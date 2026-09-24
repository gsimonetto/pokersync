"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, History, X } from "lucide-react";
import type { RangeOption } from "@/lib/bankroll/calc";
import { aggregate, filterSessionsByRange, net } from "@/lib/bankroll/calc";
import type { Session } from "@/lib/bankroll/types";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { fetchReviewCountsBySessionIds } from "@/lib/services/hand-review-service";
import { Linha, PainelCard } from "@/components/painel/painel-card";
import type { Banca } from "./use-banca";
import { Segmentos } from "./aba-visao-geral";
import { LinhaSessao } from "./pecas";
import { CAMPO, COR_NEGATIVO, COR_POSITIVO, FAIXAS_BUYIN, PERIODOS, dataBR, mesExtenso, num1 } from "./util";

// Aba "Sessões": a lista inteira, agrupada por mês (com o resultado do
// mês no cabeçalho do grupo), filtros sempre à vista e, ao lado, o
// resumo do que está filtrado -- responde "como fui em MTT no último
// mês?" sem planilha.

type Origem = "all" | "yes" | "no";

export function AbaSessoes({ b, onEditar, onExcluir }: { b: Banca; onEditar: (s: Session) => void; onExcluir: (s: Session) => void }) {
  const [formato, setFormato] = useState("all");
  const [periodo, setPeriodo] = useState<RangeOption>("all");
  const [faixa, setFaixa] = useState("all");
  const [origem, setOrigem] = useState<Origem>("all");

  const formatos = useMemo(() => Array.from(new Set(b.sessoesFiltradas.map((s) => s.format))).filter(Boolean).sort(), [b.sessoesFiltradas]);
  const filtrando = formato !== "all" || periodo !== "all" || faixa !== "all" || origem !== "all";

  const lista = useMemo(() => {
    let l = b.sessoesFiltradas;
    if (formato !== "all") l = l.filter((s) => s.format === formato);
    if (periodo !== "all") l = filterSessionsByRange(l, periodo);
    if (faixa !== "all") {
      const f = FAIXAS_BUYIN.find((x) => x.value === faixa);
      if (f) l = l.filter((s) => f.test(Number(s.buyIn) || 0));
    }
    if (origem !== "all") l = l.filter((s) => (origem === "yes" ? Boolean(s.importedHandSessionId) : !s.importedHandSessionId));
    return [...l].sort((x, y) => `${y.date}${y.time ?? ""}`.localeCompare(`${x.date}${x.time ?? ""}`));
  }, [b.sessoesFiltradas, formato, periodo, faixa, origem]);

  const grupos = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of lista) {
      const k = (s.date || "").slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()].map(([mes, itens]) => ({ mes, itens, resultado: itens.reduce((t, s) => t + net(s), 0) }));
  }, [lista]);

  // Quantas mãos foram revisadas em cada sessão visível (selo "revisadas").
  const [revisadas, setRevisadas] = useState<Record<string, number>>({});
  const ids = lista.map((s) => s.id).filter((id) => !id.startsWith("tmp-")).join(",");
  useEffect(() => {
    if (!ids) return;
    fetchReviewCountsBySessionIds(ids.split(",")).then(setRevisadas).catch(() => {});
  }, [ids]);

  const resumo = aggregate(lista);
  const melhor = lista.reduce<Session | null>((m, s) => (!m || net(s) > net(m) ? s : m), null);
  const pior = lista.reduce<Session | null>((m, s) => (!m || net(s) < net(m) ? s : m), null);
  const fmt = (v: number) => fmtMoneyIn(v, b.moeda);

  function limpar() {
    setFormato("all");
    setPeriodo("all");
    setFaixa("all");
    setOrigem("all");
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 tela-cheia:h-full xl:grid-cols-3">
      <PainelCard
        title={`Suas sessões (${lista.length})`}
        icon={<History size={15} />}
        ordem={0}
        rolagem={false}
        className="xl:col-span-2 tela-cheia:min-h-0"
        action={
          filtrando && (
            <button type="button" onClick={limpar} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted transition hover:bg-white/[0.05] hover:text-ink">
              <X size={13} /> Limpar filtros
            </button>
          )
        }
      >
        {/* Filtros sempre à vista: um toque, sem abrir menu. */}
        <div className="flex flex-wrap items-center gap-2">
          <Segmentos
            valor={formato}
            opcoes={[{ value: "all", label: "Todos" }, ...formatos.map((f) => ({ value: f, label: f }))]}
            onChange={setFormato}
          />
          <Segmentos valor={periodo} opcoes={[...PERIODOS].reverse()} onChange={setPeriodo} />
          <select value={faixa} onChange={(e) => setFaixa(e.target.value)} aria-label="Faixa de buy-in" className={`${CAMPO} !w-auto !py-1.5 text-[12px]`}>
            {FAIXAS_BUYIN.map((f) => (
              <option key={f.value} value={f.value}>
                {f.value === "all" ? f.label : `Buy-in ${f.label}`}
              </option>
            ))}
          </select>
          <Segmentos
            valor={origem}
            opcoes={[
              { value: "all", label: "Todas" },
              { value: "yes", label: "Importadas" },
              { value: "no", label: "Manuais" },
            ]}
            onChange={setOrigem}
          />
        </div>

        <div className="painel-scroll mt-3 max-h-[70vh] min-h-[320px] flex-1 overflow-y-auto pr-1 tela-cheia:max-h-none tela-cheia:min-h-0">
          {lista.length === 0 ? (
            <p className="text-sm text-muted">{filtrando ? "Nenhuma sessão com esses filtros." : "Nenhuma sessão registrada ainda."}</p>
          ) : (
            grupos.map((g) => (
              <section key={g.mes} className="mb-3">
                <div className="sticky top-0 z-10 -mx-1 mb-1.5 flex items-baseline justify-between bg-[#111]/85 px-1 py-1 backdrop-blur">
                  <h3 className="text-[12px] font-semibold text-ink/90">
                    {mesExtenso(g.mes)} <span className="font-normal text-muted">· {g.itens.length} {g.itens.length === 1 ? "sessão" : "sessões"}</span>
                  </h3>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: g.resultado >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    {fmtSignedMoneyIn(g.resultado, b.moeda)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {g.itens.map((s) => (
                    <li key={s.id}>
                      <LinhaSessao s={s} moeda={b.moeda} revisadas={revisadas[s.id]} onEditar={onEditar} onExcluir={onExcluir} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </PainelCard>

      <PainelCard title={filtrando ? "Resumo do filtro" : "Resumo geral"} icon={<BarChart3 size={15} />} ordem={1} className="tela-cheia:min-h-0">
        {lista.length === 0 ? (
          <p className="text-sm text-muted">Sem sessões pra resumir.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Linha className="text-center">
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted/80">Resultado</p>
              <p className="tnum mt-1 text-[30px] font-bold leading-none" style={{ color: resumo.profit >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {fmtSignedMoneyIn(resumo.profit, b.moeda)}
              </p>
              <p className="mt-1.5 text-[11.5px] text-muted">
                ROI {resumo.roi > 0 ? "+" : ""}
                {num1(resumo.roi)}% · {resumo.n} {resumo.n === 1 ? "sessão" : "sessões"}
              </p>
            </Linha>
            <div className="grid grid-cols-2 gap-2">
              <Dado rotulo="Investido" valor={fmt(resumo.totalInvested)} />
              <Dado rotulo="Média por sessão" valor={fmtSignedMoneyIn(resumo.profit / Math.max(1, resumo.n), b.moeda)} />
              {resumo.tourneyCount > 0 && <Dado rotulo="ITM" valor={`${num1(resumo.itm)}%`} />}
              <Dado rotulo="Buy-in médio" valor={fmt(resumo.avgBuyIn)} />
            </div>
            {melhor && pior && lista.length > 1 && (
              <div className="grid grid-cols-1 gap-2">
                <Destaque titulo="Melhor sessão" s={melhor} moeda={b.moeda} />
                <Destaque titulo="Pior sessão" s={pior} moeda={b.moeda} />
              </div>
            )}
          </div>
        )}
      </PainelCard>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Linha className="!p-2.5">
      <p className="text-[11px] text-muted/80">{rotulo}</p>
      <p className="tnum mt-0.5 truncate text-[15px] font-semibold text-ink">{valor}</p>
    </Linha>
  );
}

function Destaque({ titulo, s, moeda }: { titulo: string; s: Session; moeda: string }) {
  const r = net(s);
  return (
    <Linha className="flex items-center justify-between gap-2 !p-2.5">
      <div className="min-w-0">
        <p className="text-[11px] text-muted/80">{titulo}</p>
        <p className="truncate text-[12.5px] text-ink/90">
          {s.format} · {dataBR(s.date)}
          {s.venue ? ` · ${s.venue}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: r >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
        {fmtSignedMoneyIn(r, moeda)}
      </span>
    </Linha>
  );
}
