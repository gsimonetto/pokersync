"use client";

import { AlertCircle, AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, CornerDownRight, Flag, Flame, ListChecks, Snowflake } from "lucide-react";
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
import type { CSSProperties } from "react";

// Cartão do quadro. Ordem de leitura pensada pro coach decidir sem abrir:
//   1) quem é -- crachá compacto (score, resultado, buy-in, acerto)
//   2) pode subir? -- um ponto por requisito da fase, verde quando bate
//   3) o que vem agora -- próximo passo e quando (vermelho se não tem)
//   4) contexto -- etiquetas, checklist, dias na fase
// A faixa na borda esquerda é a temperatura (em dia / esfriando /
// parado), sempre repetida em texto no rodapé -- nunca só cor.
// Dois extremos ganham cara própria (globals.css):
//   - pronto pra subir = pegando fogo: laranja, chamas tremulando na
//     base, brasas subindo e reflexo no botão Subir (.card-em-chamas);
//   - parado = congelado: azul-gelo, geada e reflexo de vidro
//     (.card-congelado).
// Um é o contrário do outro. Pronto e parado ao mesmo tempo pega fogo
// (subir é a ação), com o selo de gelo no rodapé avisando que está parado.

// Cada cartão anima num momento diferente do ciclo (atraso negativo = já
// começa no meio) -- vários no mesmo quadro não piscam juntos.
function atrasoDaAnimacao(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `-${(h % 70) / 10}s`;
}

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
  const emAlta = pr.pronto;
  const parado = temperatura === "parado";
  const congelado = parado && !emAlta;
  // Selo de fogo no rodapé só quando está em dia -- "esfriando"/"parado"
  // continuam avisando no selo, mesmo com o cartão pegando fogo.
  const seloFogo = emAlta && temperatura === "em_dia";
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
      style={emAlta || congelado ? ({ "--atraso-card": atrasoDaAnimacao(card.playerId) } as CSSProperties) : undefined}
      className={`group relative w-full cursor-grab overflow-hidden rounded-xl border bg-white/[0.04] py-2.5 pl-3.5 pr-2.5 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-training/60 active:cursor-grabbing ${
        emAlta
          ? "card-em-chamas border-[#f97316]/40 hover:border-[#fb923c]/75"
          : congelado
            ? "card-congelado border-[#7dd3fc]/30 hover:border-[#7dd3fc]/60"
            : "border-hairline hover:border-white/20"
      }`}
    >
      {/* Só exceção ganha cor: "em dia" fica neutro pra "esfriando" e
          "parado" saltarem aos olhos. */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={
          emAlta
            ? { background: "linear-gradient(0deg, #dc2626, #f97316 45%, #fde047)", boxShadow: "0 0 10px rgba(249, 115, 22, 0.6)" }
            : congelado
              ? { background: "linear-gradient(180deg, #f0f9ff, #7dd3fc 45%, #38bdf8)", boxShadow: "0 0 10px rgba(125, 211, 252, 0.55)" }
              : { background: temperatura === "em_dia" ? "rgba(255,255,255,0.08)" : corTemp }
        }
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
              className={`flex shrink-0 items-center gap-0.5 rounded-md bg-positive/15 px-1.5 py-0.5 text-[10.5px] font-bold text-positive transition-colors hover:bg-positive/25 disabled:cursor-default disabled:hover:bg-positive/15 ${
                faseSeguinte ? "botao-subir" : ""
              }`}
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
        <span className="-my-1 -ml-1 flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1 pl-1">
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
          className={`flex shrink-0 items-center text-[10.5px] tabular-nums ${
            parado
              ? "selo-congelado gap-1 rounded-full px-1.5 py-0.5 font-medium"
              : seloFogo
                ? "selo-fogo gap-1 rounded-full px-1.5 py-0.5 font-medium"
                : "gap-0.5"
          }`}
          style={{ color: seloFogo ? "#fb923c" : temperatura === "em_dia" ? undefined : corTemp }}
          title={
            seloFogo
              ? `Pronto pra subir · ${item.diasNaFase} dias nesta fase`
              : `${TEMPERATURA_LABEL[temperatura]} · ${item.diasNaFase} dias nesta fase`
          }
        >
          {parado ? (
            <Snowflake size={11} className="floco-girando" />
          ) : seloFogo ? (
            <Flame size={11} className="chama-tremula" />
          ) : (
            <Clock3 size={11} className={temperatura === "em_dia" ? "text-muted" : ""} />
          )}
          <span className={temperatura === "em_dia" && !seloFogo ? "text-muted" : ""}>
            {item.diasNaFase}d
            {seloFogo ? " · em alta" : temperatura !== "em_dia" && ` · ${TEMPERATURA_LABEL[temperatura].toLowerCase()}`}
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
              className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:pointer-events-none disabled:opacity-0"
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
              className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight size={13} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
