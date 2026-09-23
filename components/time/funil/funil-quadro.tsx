"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ChevronsLeftRight, ChevronsRightLeft } from "lucide-react";
import { FunilCard } from "@/components/time/funil/funil-card";
import { PRIORIDADE_LABEL, type FunnelPhase, type Prioridade } from "@/lib/services/team-funnel-service";
import { faixaBuyin } from "@/lib/time/funil-regras";
import type { Agrupamento, ItemFunil } from "@/components/time/funil/tipos";

// Quadro do funil. Colunas = fases; com agrupamento ligado, cada raia
// (coach, etiqueta do jogador ou prioridade) repete as colunas embaixo
// de um cabeçalho de fases só, fixo no topo -- o mesmo desenho das
// "swimlanes" de Jira/Linear. Soltar um cartão numa raia diferente muda
// só a FASE: raia é leitura, não se arrasta coach por aqui.

interface Raia {
  chave: string;
  titulo: string | null;
  cor?: string | null;
  itens: ItemFunil[];
}

const ORDEM_PRIORIDADE: Prioridade[] = ["alta", "normal", "baixa"];

function montarRaias(itens: ItemFunil[], agrupar: Agrupamento, coaches: { userId: string; nome: string }[]): Raia[] {
  if (agrupar === "nenhum") return [{ chave: "todos", titulo: null, itens }];

  const mapa = new Map<string, Raia>();
  const pegar = (chave: string, titulo: string, cor?: string | null) => {
    let r = mapa.get(chave);
    if (!r) {
      r = { chave, titulo, cor, itens: [] };
      mapa.set(chave, r);
    }
    return r;
  };

  for (const it of itens) {
    if (agrupar === "coach") {
      const id = it.jogador?.coachId ?? null;
      const nome = id ? coaches.find((c) => c.userId === id)?.nome ?? "Coach" : "Sem coach";
      pegar(id ?? "~sem", nome).itens.push(it);
    } else if (agrupar === "etiqueta") {
      const id = it.jogador?.labelId ?? null;
      pegar(id ?? "~sem", it.jogador?.labelName ?? "Sem etiqueta", it.jogador?.labelColor).itens.push(it);
    } else {
      const p = it.card.prioridade;
      pegar(p, `Prioridade ${PRIORIDADE_LABEL[p].toLowerCase()}`).itens.push(it);
    }
  }

  const raias = [...mapa.values()];
  if (agrupar === "prioridade") {
    return raias.sort((a, b) => ORDEM_PRIORIDADE.indexOf(a.chave as Prioridade) - ORDEM_PRIORIDADE.indexOf(b.chave as Prioridade));
  }
  // "Sem coach"/"Sem etiqueta" por último; o resto em ordem alfabética.
  return raias.sort((a, b) => (a.chave === "~sem" ? 1 : b.chave === "~sem" ? -1 : (a.titulo ?? "").localeCompare(b.titulo ?? "")));
}

function lerRecolhidas(chave: string): Set<string> {
  try {
    const bruto = window.localStorage.getItem(chave);
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function FunilQuadro({
  teamId,
  fases,
  itens,
  totalPorFase,
  agrupar,
  coaches,
  onAbrir,
  onMover,
  onPromover,
}: {
  teamId: string;
  fases: FunnelPhase[];
  /** Já filtrados. */
  itens: ItemFunil[];
  /** Ocupação real (sem filtro) -- capacidade é do funil inteiro, não do recorte. */
  totalPorFase: Map<string, number>;
  agrupar: Agrupamento;
  coaches: { userId: string; nome: string }[];
  onAbrir: (item: ItemFunil) => void;
  onMover: (item: ItemFunil, fase: FunnelPhase) => void;
  onPromover: (item: ItemFunil) => void;
}) {
  // Colunas recolhidas: conveniência de quem olha (fica no navegador).
  const chaveRecolhidas = `funil-colunas-recolhidas:${teamId}`;
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [alvoDrop, setAlvoDrop] = useState<string | null>(null);

  useEffect(() => {
    setRecolhidas(lerRecolhidas(chaveRecolhidas));
  }, [chaveRecolhidas]);

  function alternarRecolhida(faseId: string) {
    setRecolhidas((cur) => {
      const next = new Set(cur);
      if (next.has(faseId)) next.delete(faseId);
      else next.add(faseId);
      try {
        window.localStorage.setItem(chaveRecolhidas, JSON.stringify([...next]));
      } catch {
        /* navegador sem armazenamento: só não lembra na próxima visita */
      }
      return next;
    });
  }

  const raias = useMemo(() => montarRaias(itens, agrupar, coaches), [itens, agrupar, coaches]);
  const umaRaia = raias.length === 1 && raias[0].titulo === null;
  const porId = useMemo(() => new Map(itens.map((i) => [i.card.playerId, i])), [itens]);

  const largura = (faseId: string) => (recolhidas.has(faseId) ? "w-11" : "w-[284px]");

  function soltar(e: React.DragEvent, fase: FunnelPhase) {
    e.preventDefault();
    setAlvoDrop(null);
    const playerId = e.dataTransfer.getData("text/player-id");
    const origem = e.dataTransfer.getData("text/fase-origem");
    const item = porId.get(playerId);
    if (item && origem !== fase.id) onMover(item, fase);
  }

  return (
    <div className={`painel-scroll flex-1 overflow-auto pb-2 [@media(min-width:768px)_and_(min-height:600px)]:min-h-[420px] ${umaRaia ? "flex flex-col" : ""}`}>
      <div className={`inline-flex min-w-full flex-col ${umaRaia ? "min-h-0 flex-1" : ""}`}>
        {/* Cabeçalho das fases -- fixo no topo quando há raias. */}
        <div className={`sticky top-0 z-10 flex gap-3 pb-2 ${umaRaia ? "" : "bg-[#0d0d0d]/95 backdrop-blur-sm"}`}>
          {fases.map((fase) => {
            const ocupacao = totalPorFase.get(fase.id) ?? 0;
            const naTela = itens.filter((i) => i.card.phaseId === fase.id);
            const prontos = naTela.filter((i) => i.prontidao.pronto).length;
            const recolhida = recolhidas.has(fase.id);
            const lotada = fase.wipLimit != null && ocupacao > fase.wipLimit;
            const faixa = faixaBuyin(fase);

            if (recolhida) {
              return (
                <button
                  key={fase.id}
                  type="button"
                  onClick={() => alternarRecolhida(fase.id)}
                  title={`Expandir ${fase.name}`}
                  aria-label={`Expandir ${fase.name}`}
                  // self-start: cabeçalho recolhido baixinho, sem esticar os
                  // cabeçalhos vizinhos (o nome vertical fica no corpo).
                  className={`${largura(fase.id)} flex shrink-0 flex-col items-center gap-1.5 self-start rounded-xl border border-hairline bg-elevated/60 py-2.5 text-muted transition-colors hover:text-ink`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fase.color }} />
                  <span className="text-[11px] font-bold tabular-nums">{ocupacao}</span>
                </button>
              );
            }

            return (
              <div
                key={fase.id}
                className={`${largura(fase.id)} shrink-0 rounded-xl border border-hairline bg-elevated/60 px-3 py-2.5`}
                title={fase.descricao ?? undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fase.color }} />
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{fase.name}</h3>
                  <span className={`text-[12px] font-semibold tabular-nums ${lotada ? "text-negative" : "text-muted"}`}>
                    {ocupacao}
                    {fase.wipLimit != null && <span className="font-normal text-muted/70">/{fase.wipLimit}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarRecolhida(fase.id)}
                    title="Recolher coluna"
                    aria-label={`Recolher ${fase.name}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted/60 transition-colors hover:bg-surface hover:text-ink"
                  >
                    <ChevronsRightLeft size={12} />
                  </button>
                </div>

                {/* Capacidade: trilho da mesma cor, cheio = lotado. */}
                {fase.wipLimit != null && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (ocupacao / fase.wipLimit) * 100)}%`,
                        background: lotada ? "#e0555a" : "rgba(255,255,255,0.45)",
                      }}
                    />
                  </div>
                )}

                {(faixa || prontos > 0 || lotada) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px]">
                    {faixa && <span className="tabular-nums text-muted">{faixa}</span>}
                    {prontos > 0 && (
                      <span className="flex items-center gap-0.5 font-semibold text-positive">
                        <ArrowUpRight size={11} />
                        {prontos} pronto{prontos === 1 ? "" : "s"} p/ subir
                      </span>
                    )}
                    {lotada && (
                      <span className="flex items-center gap-0.5 font-semibold text-negative">
                        <AlertTriangle size={11} /> acima da capacidade
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {raias.map((raia) => (
          <section key={raia.chave} className={umaRaia ? "flex min-h-0 flex-1 flex-col" : "mt-3 first:mt-1"}>
            {raia.titulo !== null && (
              <div className="sticky left-0 mb-2 flex w-fit items-center gap-2 px-1">
                {raia.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: raia.cor }} />}
                <h4 className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{raia.titulo}</h4>
                <span className="text-[11px] tabular-nums text-muted/60">{raia.itens.length}</span>
              </div>
            )}
            <div className={`flex gap-3 ${umaRaia ? "min-h-0 flex-1" : ""}`}>
              {fases.map((fase, idx) => {
                const lista = raia.itens
                  .filter((i) => i.card.phaseId === fase.id)
                  // Prontos primeiro (ação), depois quem está há mais tempo parado.
                  .sort((a, b) => Number(b.prontidao.pronto) - Number(a.prontidao.pronto) || b.diasNaFase - a.diasNaFase);
                const alvo = `${raia.chave}:${fase.id}`;
                const recebendo = alvoDrop === alvo;
                const recolhida = recolhidas.has(fase.id);
                return (
                  <div
                    key={fase.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (alvoDrop !== alvo) setAlvoDrop(alvo);
                    }}
                    onDragLeave={() => setAlvoDrop((cur) => (cur === alvo ? null : cur))}
                    onDrop={(e) => soltar(e, fase)}
                    className={`${largura(fase.id)} flex shrink-0 flex-col rounded-xl border p-1.5 transition-colors ${
                      recebendo ? "border-ink/40 bg-ink/5 ring-2 ring-ink/15" : "border-hairline/60 bg-elevated/25"
                    } ${umaRaia ? "min-h-0" : "min-h-[72px]"}`}
                  >
                    {recolhida ? (
                      <button
                        type="button"
                        onClick={() => alternarRecolhida(fase.id)}
                        title={`Expandir ${fase.name}`}
                        className="flex flex-col items-center gap-2 py-1 text-muted transition-colors hover:text-ink"
                      >
                        <ChevronsLeftRight size={13} />
                        <span className="text-[12px] font-semibold [writing-mode:vertical-rl]">{fase.name}</span>
                      </button>
                    ) : (
                      <div className={`space-y-2 ${umaRaia ? "painel-scroll min-h-0 flex-1 overflow-y-auto pr-0.5" : ""}`}>
                        {lista.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-hairline p-3 text-center text-xs text-muted/70">
                            {recebendo ? "Solte aqui" : "Vazio"}
                          </p>
                        ) : (
                          lista.map((item) => (
                            <FunilCard
                              key={item.card.cardId}
                              item={item}
                              faseAnterior={fases[idx - 1]}
                              faseSeguinte={fases[idx + 1]}
                              onAbrir={() => onAbrir(item)}
                              onMover={(f) => onMover(item, f)}
                              onPromover={() => onPromover(item)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
