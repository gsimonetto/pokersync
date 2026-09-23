"use client";

import { AlertCircle, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, CornerDownRight, Flag, ListChecks } from "lucide-react";
import { Chip } from "@/components/chip";
import { PlayerBadge, crachaDoTime, type CrachaDados } from "@/components/time/player-badge";
import type { FunnelPhase } from "@/lib/services/team-funnel-service";
import {
  ESTADO_PASSO_COR,
  TEMPERATURA_COR,
  TEMPERATURA_LABEL,
  foraDaFaixa,
  quandoRelativo,
} from "@/lib/time/funil-regras";
import type { ItemFunil } from "@/components/time/funil/tipos";

// Cartão do quadro. Ordem de leitura pensada pro coach decidir sem abrir:
//   1) quem é -- crachá compacto (score, resultado, buy-in, acerto)
//   2) pode subir? -- um ponto por requisito da fase, verde quando bate
//   3) o que vem agora -- próximo passo e quando (vermelho se não tem)
//   4) contexto -- etiquetas, checklist, dias na fase
// A faixa na borda esquerda é a temperatura (em dia / esfriando /
// parado), sempre repetida em texto no rodapé -- nunca só cor.

export function crachaDoItem(item: ItemFunil): CrachaDados {
  if (item.jogador) {
    const base = crachaDoTime(item.jogador);
    // No funil, ROI e buy-in do cartão (RPC do funil) valem mais que os
    // do painel: chegam juntos com o resto do cartão.
    return {
      ...base,
      resultado: { ...base.resultado, roiPct: item.card.roiPct ?? base.resultado.roiPct },
      volume: { ...base.volume, abi: item.card.abiTorneio ?? base.volume.abi },
    };
  }
  return {
    nome: item.nome,
    avatarId: 1,
    avatarUrl: null,
    score: null,
    resultado: { rotulo: "No time", valor: null, roiPct: item.card.roiPct, ajuda: "ROI de carreira" },
    volume: { abi: item.card.abiTorneio, sessoes: null, ajuda: "Buy-in médio de torneio (carreira)" },
    estudo: { acertoPct: null, treinos: null, ajuda: "" },
  };
}

export function FunilCard({
  item,
  faseAnterior,
  faseSeguinte,
  onAbrir,
  onMover,
  onPromover,
}: {
  item: ItemFunil;
  faseAnterior?: FunnelPhase;
  faseSeguinte?: FunnelPhase;
  onAbrir: () => void;
  onMover: (fase: FunnelPhase) => void;
  onPromover: () => void;
}) {
  const { card, prontidao: pr, requisitos, temperatura, passo, labels, checklist } = item;
  const corTemp = TEMPERATURA_COR[temperatura];
  const faixa = foraDaFaixa(card.abiTorneio ?? item.jogador?.abiTorneio ?? null, item.fase);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/player-id", card.playerId);
        e.dataTransfer.setData("text/fase-origem", card.phaseId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      aria-label={`${item.nome}: abrir cartão`}
      className={`group relative w-full cursor-grab overflow-hidden rounded-xl border bg-surface py-2.5 pl-3.5 pr-2.5 text-left outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-training/60 active:cursor-grabbing ${
        pr.pronto ? "border-positive/35" : "border-hairline"
      }`}
    >
      {/* Só exceção ganha cor: "em dia" fica neutro pra "esfriando" e
          "parado" saltarem aos olhos. */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: temperatura === "em_dia" ? "rgba(255,255,255,0.08)" : corTemp }}
        aria-hidden
      />

      <PlayerBadge
        dados={crachaDoItem(item)}
        variante="compacto"
        lateral={
          card.prioridade === "alta" ? (
            <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] font-semibold text-[#f08a8e]" title="Prioridade alta">
              <Flag size={11} /> Alta
            </span>
          ) : null
        }
      />

      {/* 2) Prontidão */}
      {pr.total > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex flex-1 gap-[3px]" aria-hidden>
            {requisitos.map((r) => (
              <span
                key={r.chave}
                className={`h-1.5 flex-1 rounded-full ${r.ok ? "bg-positive" : "bg-white/[0.09]"}`}
                title={`${r.rotulo}: ${r.atual} de ${r.alvo}`}
              />
            ))}
          </span>
          {pr.pronto ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPromover();
              }}
              disabled={!faseSeguinte}
              title={faseSeguinte ? `Subir para ${faseSeguinte.name}` : "Já está na última fase"}
              className="flex shrink-0 items-center gap-0.5 rounded-md bg-positive/15 px-1.5 py-0.5 text-[10.5px] font-bold text-positive transition-colors hover:bg-positive/25 disabled:cursor-default disabled:hover:bg-positive/15"
            >
              {faseSeguinte ? "Subir" : "Pronto"}
              {faseSeguinte && <ArrowUpRight size={11} />}
            </button>
          ) : (
            <span className="shrink-0 text-[10.5px] tabular-nums text-muted" title="Requisitos de subida cumpridos">
              {pr.cumpridos}/{pr.total}
            </span>
          )}
        </div>
      )}

      {/* 3) Próximo passo */}
      {passo !== null && (
      <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11.5px]" style={{ color: ESTADO_PASSO_COR[passo] }}>
        {passo === "sem" ? (
          <>
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">Sem próximo passo</span>
          </>
        ) : (
          <>
            <CornerDownRight size={12} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-ink/85">{card.nextStep}</span>
            {card.nextStepAt && (
              <span className="shrink-0 font-medium">
                {passo === "atrasado" && "atrasado · "}
                {quandoRelativo(card.nextStepAt)}
              </span>
            )}
          </>
        )}
      </p>
      )}

      {faixa === "acima" && (
        <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#f59e0b]" title="Buy-in médio acima da faixa definida para esta fase">
          <AlertTriangle size={11} /> Jogando acima da faixa da fase
        </p>
      )}

      {/* 4) Contexto */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.05] pt-2">
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {labels.slice(0, 2).map((l) => (
            <Chip key={l.id} color={l.color} size="sm" className="max-w-[88px] truncate">
              {l.name}
            </Chip>
          ))}
          {labels.length > 2 && <span className="text-[10px] text-muted">+{labels.length - 2}</span>}
          {checklist && checklist.total > 0 && (
            <span
              className={`flex shrink-0 items-center gap-0.5 text-[10.5px] tabular-nums ${checklist.done >= checklist.total ? "text-positive" : "text-muted"}`}
              title="Checklist"
            >
              <ListChecks size={11} />
              {checklist.done}/{checklist.total}
            </span>
          )}
        </span>
        <span
          className="flex shrink-0 items-center gap-0.5 text-[10.5px] tabular-nums"
          style={{ color: temperatura === "em_dia" ? undefined : corTemp }}
          title={`${TEMPERATURA_LABEL[temperatura]} · ${item.diasNaFase} dias nesta fase`}
        >
          <Clock3 size={11} className={temperatura === "em_dia" ? "text-muted" : ""} />
          <span className={temperatura === "em_dia" ? "text-muted" : ""}>
            {item.diasNaFase}d{temperatura !== "em_dia" && ` · ${TEMPERATURA_LABEL[temperatura].toLowerCase()}`}
          </span>
        </span>

        {/* Mover por toque: arrastar é só mouse (HTML5 drag não funciona
            em tela de toque). */}
        {(faseAnterior || faseSeguinte) && (
          <span className="-mr-1 flex shrink-0 items-center">
            <button
              type="button"
              disabled={!faseAnterior}
              onClick={(e) => {
                e.stopPropagation();
                if (faseAnterior) onMover(faseAnterior);
              }}
              aria-label={faseAnterior ? `Mover para ${faseAnterior.name}` : undefined}
              className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              disabled={!faseSeguinte}
              onClick={(e) => {
                e.stopPropagation();
                if (faseSeguinte) onMover(faseSeguinte);
              }}
              aria-label={faseSeguinte ? `Mover para ${faseSeguinte.name}` : undefined}
              className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight size={13} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
