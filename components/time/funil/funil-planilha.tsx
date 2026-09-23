"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpRight, Flag } from "lucide-react";
import { AnelScore } from "@/components/time/player-badge";
import { PRIORIDADE_LABEL, type FunnelPhase } from "@/lib/services/team-funnel-service";
import { ESTADO_PASSO_COR, TEMPERATURA_COR, TEMPERATURA_LABEL, quandoRelativo } from "@/lib/time/funil-regras";
import type { ItemFunil } from "@/components/time/funil/tipos";

// Modo planilha: o funil inteiro numa tabela densa, pra comparar 40
// jogadores de uma vez (quem joga maior buy-in, quem está parado há mais
// tempo, quem não tem próximo passo). Clique no título da coluna ordena;
// clique na linha abre o cartão; a fase troca direto na linha.

type Coluna = "nome" | "fase" | "prontidao" | "passo" | "dias" | "prioridade" | "sessoes" | "lucro" | "roi" | "abi" | "acerto" | "checklist";

const BRL_INTEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PESO_PRIORIDADE = { alta: 0, normal: 1, baixa: 2 } as const;
const pctBR = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function acerto(i: ItemFunil): number | null {
  const j = i.jogador;
  return j && j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null;
}

// null sempre vai pro fim, nos dois sentidos -- "sem dado" não é "zero".
function comparar(a: number | string | null, b: number | string | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b) * dir;
  return ((a as number) - (b as number)) * dir;
}

function valor(i: ItemFunil, c: Coluna): number | string | null {
  switch (c) {
    case "nome": return i.nome;
    case "fase": return i.card.phaseSortOrder;
    case "prontidao": return i.prontidao.total === 0 ? null : i.prontidao.cumpridos / i.prontidao.total;
    case "passo": return i.passo === null ? null : i.card.nextStepAt ? new Date(i.card.nextStepAt).getTime() : i.passo === "sem" ? -Infinity : null;
    case "dias": return i.diasNaFase;
    case "prioridade": return PESO_PRIORIDADE[i.card.prioridade];
    case "sessoes": return i.card.sessoesFase;
    case "lucro": return i.card.lucroFase;
    case "roi": return i.card.roiPct;
    case "abi": return i.card.abiTorneio ?? i.jogador?.abiTorneio ?? null;
    case "acerto": return acerto(i);
    case "checklist": return i.checklist && i.checklist.total > 0 ? i.checklist.total - i.checklist.done : null;
  }
}

const COLUNAS: { chave: Coluna; rotulo: string; ajuda?: string; direita?: boolean }[] = [
  { chave: "nome", rotulo: "Jogador" },
  { chave: "fase", rotulo: "Fase" },
  { chave: "prontidao", rotulo: "Requisitos", ajuda: "Requisitos de subida cumpridos" },
  { chave: "passo", rotulo: "Próximo passo" },
  { chave: "dias", rotulo: "Na fase", ajuda: "Dias desde que entrou na fase", direita: true },
  { chave: "prioridade", rotulo: "Prioridade" },
  { chave: "sessoes", rotulo: "Sessões", ajuda: "Sessões registradas na Banca desde que entrou na fase", direita: true },
  { chave: "lucro", rotulo: "Resultado", ajuda: "Resultado desde que entrou na fase", direita: true },
  { chave: "roi", rotulo: "ROI", ajuda: "ROI de carreira", direita: true },
  { chave: "abi", rotulo: "Buy-in", ajuda: "Buy-in médio de torneio (carreira)", direita: true },
  { chave: "acerto", rotulo: "Acerto", ajuda: "Acerto GTO nos treinos (últimos 30 dias)", direita: true },
  { chave: "checklist", rotulo: "Tarefas", ajuda: "Itens de checklist em aberto", direita: true },
];

export function FunilPlanilha({
  fases,
  itens,
  onAbrir,
  onMover,
}: {
  fases: FunnelPhase[];
  itens: ItemFunil[];
  onAbrir: (item: ItemFunil) => void;
  onMover: (item: ItemFunil, fase: FunnelPhase) => void;
}) {
  const [ordem, setOrdem] = useState<{ coluna: Coluna; dir: 1 | -1 }>({ coluna: "fase", dir: 1 });

  const linhas = useMemo(
    () =>
      [...itens].sort(
        (a, b) =>
          comparar(valor(a, ordem.coluna), valor(b, ordem.coluna), ordem.dir) ||
          a.nome.localeCompare(b.nome)
      ),
    [itens, ordem]
  );

  if (itens.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Nenhum jogador neste recorte.</p>;
  }

  return (
    <div className="painel-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[#101010]">
          <tr>
            {COLUNAS.map((c, i) => {
              const ativa = ordem.coluna === c.chave;
              return (
                <th
                  key={c.chave}
                  scope="col"
                  aria-sort={ativa ? (ordem.dir === 1 ? "ascending" : "descending") : "none"}
                  className={`border-b border-hairline px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted ${
                    c.direita ? "text-right" : "text-left"
                  } ${i === 0 ? "sticky left-0 z-10 bg-[#101010]" : ""}`}
                >
                  <button
                    type="button"
                    title={c.ajuda}
                    onClick={() => setOrdem((o) => ({ coluna: c.chave, dir: o.coluna === c.chave ? ((o.dir * -1) as 1 | -1) : 1 }))}
                    className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-ink ${ativa ? "text-ink" : ""}`}
                  >
                    {c.rotulo}
                    {ativa && (ordem.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {linhas.map((i) => {
            const { card } = i;
            const ac = acerto(i);
            const abi = card.abiTorneio ?? i.jogador?.abiTorneio ?? null;
            return (
              <tr
                key={card.cardId}
                onClick={() => onAbrir(i)}
                className="group cursor-pointer transition-colors hover:bg-white/[0.03]"
              >
                <td className="sticky left-0 border-b border-hairline/60 bg-[#0d0d0d] px-3 py-2 group-hover:bg-[#151515]">
                  <span className="flex items-center gap-2.5">
                    <AnelScore score={i.score} avatarId={i.jogador?.avatarId ?? 1} avatarUrl={i.jogador?.avatarUrl ?? null} tamanho={30} mostrarNumero={false} animar={false} />
                    <span className="max-w-[160px] truncate font-semibold text-ink">{i.nome}</span>
                  </span>
                </td>
                <td className="border-b border-hairline/60 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: card.phaseColor }} />
                    <select
                      value={card.phaseId}
                      onChange={(e) => {
                        const f = fases.find((x) => x.id === e.target.value);
                        if (f) onMover(i, f);
                      }}
                      aria-label={`Fase de ${i.nome}`}
                      className="min-w-[156px] cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 pl-1 pr-6 text-[12.5px] text-ink outline-none hover:border-hairline"
                    >
                      {fases.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#141414]">{f.name}</option>
                      ))}
                    </select>
                  </span>
                </td>
                <td className="border-b border-hairline/60 px-3 py-2">
                  {i.prontidao.total === 0 ? (
                    <span className="text-muted/50">—</span>
                  ) : i.prontidao.pronto ? (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-positive">
                      <ArrowUpRight size={12} /> Pronto
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                        <span className="block h-full rounded-full bg-white/50" style={{ width: `${(i.prontidao.cumpridos / i.prontidao.total) * 100}%` }} />
                      </span>
                      <span className="tabular-nums text-muted">{i.prontidao.cumpridos}/{i.prontidao.total}</span>
                    </span>
                  )}
                </td>
                <td className="max-w-[240px] border-b border-hairline/60 px-3 py-2">
                  {i.passo === null ? (
                    <span className="text-muted/50">—</span>
                  ) : i.passo === "sem" ? (
                    <span className="inline-flex items-center gap-1" style={{ color: ESTADO_PASSO_COR.sem }}>
                      <AlertCircle size={12} /> Sem próximo passo
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-ink/85">{card.nextStep}</span>
                      {card.nextStepAt && (
                        <span className="shrink-0 text-[11.5px] font-medium" style={{ color: ESTADO_PASSO_COR[i.passo ?? "agendado"] }}>
                          {i.passo === "atrasado" && "atrasado · "}
                          {quandoRelativo(card.nextStepAt)}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums">
                  <span
                    title={TEMPERATURA_LABEL[i.temperatura]}
                    style={{ color: i.temperatura === "em_dia" ? undefined : TEMPERATURA_COR[i.temperatura] }}
                    className={i.temperatura === "em_dia" ? "text-muted" : "font-semibold"}
                  >
                    {i.diasNaFase}d{i.temperatura !== "em_dia" && ` · ${TEMPERATURA_LABEL[i.temperatura].toLowerCase()}`}
                  </span>
                </td>
                <td className="border-b border-hairline/60 px-3 py-2">
                  {card.prioridade === "alta" ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#f08a8e]">
                      <Flag size={11} /> Alta
                    </span>
                  ) : (
                    <span className="text-muted">{PRIORIDADE_LABEL[card.prioridade]}</span>
                  )}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums text-ink/85">{card.sessoesFase ?? "—"}</td>
                <td
                  className="border-b border-hairline/60 px-3 py-2 text-right font-semibold tabular-nums"
                  style={{ color: card.lucroFase == null || card.lucroFase === 0 ? undefined : card.lucroFase > 0 ? "#22c55e" : "#e0555a" }}
                >
                  {card.lucroFase == null ? <span className="font-normal text-muted/50">—</span> : BRL_INTEIRO.format(card.lucroFase)}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums text-ink/85">
                  {card.roiPct == null ? <span className="text-muted/50">—</span> : pctBR(card.roiPct)}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums text-ink/85">
                  {abi == null ? <span className="text-muted/50">—</span> : BRL_INTEIRO.format(abi)}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums text-ink/85">
                  {ac == null ? <span className="text-muted/50">—</span> : `${ac}%`}
                </td>
                <td className="border-b border-hairline/60 px-3 py-2 text-right tabular-nums">
                  {i.checklist && i.checklist.total > 0 ? (
                    <span className={i.checklist.done >= i.checklist.total ? "text-positive" : "text-ink/85"}>
                      {i.checklist.done}/{i.checklist.total}
                    </span>
                  ) : (
                    <span className="text-muted/50">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
