"use client";

import { useState } from "react";
import { ChevronDown, Bot, PenLine } from "lucide-react";
import type { TournamentPayout } from "@/lib/services/tournament-payout-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { EmptyState } from "@/components/dashboard/kit";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Mesmos slugs que o agente desktop manda em `pokerRoom` (ver PokerRoom em
// pokersync-agent/crates/scanner/src/room.rs) — só rótulo de exibição.
const ROOM_LABEL: Record<string, string> = {
  pokerstars: "PokerStars",
  ggpoker: "GGPoker",
  partypoker: "PartyPoker",
  "888poker": "888poker",
  acr: "ACR",
};

// Uma linha da grade — normalmente vem de uma hand_sessions (torneio com
// mão importada), mas quando o agente sincroniza SÓ o resumo de torneio
// (sem mão nenhuma anexada ainda) não existe hand_sessions nenhuma pra
// esse tournament_id_ps. Sem esse fallback, esse torneio simplesmente não
// aparecia em lugar nenhum da tela — sincronizava e sumia.
interface TournamentRowData {
  key: string;
  tournamentIdPs: string;
  label: string;
  buyin: number | null;
  payout?: TournamentPayout;
}

// Painel de estrutura de premiação — vive dentro da aba Torneios da
// Análise (não é tela separada). Cada torneio já listado (hand_sessions,
// ou só o resumo de premiação quando não há mão anexada) aparece com o
// status de premiação, só leitura: a premiação vem sempre do agente
// desktop (Radar PokerSync) sincronizando o resumo de torneio — não há
// mais formulário manual aqui (pedido explícito: retirar os dois botões
// de importação manual do Player Evolution).
export function TournamentPayoutsPanel({ sessions, payouts }: { sessions: HandSession[]; payouts: TournamentPayout[] }) {
  const byTournament = new Map(payouts.map((p) => [p.tournamentIdPs, p]));

  const sessionTournamentIds = new Set(sessions.map((s) => s.tournament_id_ps).filter((id): id is string => !!id));
  const orphanPayouts = payouts.filter((p) => !sessionTournamentIds.has(p.tournamentIdPs));

  const rows: TournamentRowData[] = [
    ...sessions.map((s) => ({
      key: s.id,
      tournamentIdPs: s.tournament_id_ps ?? s.id,
      label: s.label,
      buyin: s.buyin,
      payout: s.tournament_id_ps ? byTournament.get(s.tournament_id_ps) : undefined,
    })),
    ...orphanPayouts.map((p) => ({
      key: p.id,
      tournamentIdPs: p.tournamentIdPs,
      label: p.pokerRoom ? `${ROOM_LABEL[p.pokerRoom] ?? p.pokerRoom} · Torneio #${p.tournamentIdPs}` : `Torneio #${p.tournamentIdPs}`,
      buyin: null,
      payout: p,
    })),
  ];

  if (rows.length === 0) {
    return <EmptyState texto="Nenhum torneio importado ainda — a estrutura de premiação aparece aqui assim que houver mãos ou resumo de torneio." />;
  }

  // Grid em vez de lista full-width (linha esticada com nome numa ponta e
  // status na outra, vão vazio enorme no meio em telas largas) — mesmo
  // problema que "Por posição"/"Matchups" já resolveram assim.
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <TournamentRow key={row.key} row={row} />
      ))}
    </div>
  );
}

function TournamentRow({ row }: { row: TournamentRowData }) {
  const payout = row.payout;
  const [open, setOpen] = useState(false);

  const hasPayout = payout != null && (payout.heroPayoutAmount != null || payout.places.length > 0);
  const canExpand = payout != null && payout.places.length > 0;

  return (
    <div
      className={`rounded-lg border border-hairline bg-elevated transition-all duration-200 ${
        open ? "sm:col-span-2 lg:col-span-3" : canExpand ? "hover:-translate-y-0.5 hover:border-ink/25" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => canExpand && setOpen((v) => !v)}
        disabled={!canExpand}
        className="flex w-full items-start justify-between gap-2 p-3 text-left disabled:cursor-default"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {row.buyin != null ? BRL.format(row.buyin) : "buy-in não identificado"}
            {payout?.heroFinishPlace != null && <> · {payout.heroFinishPlace}º lugar</>}
            {payout?.heroPayoutAmount != null && <> · {BRL.format(payout.heroPayoutAmount)}</>}
          </p>
          {hasPayout ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-positive/35 bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
              {payout?.source === "agent" ? <Bot size={10} /> : <PenLine size={10} />}
              Registrada
            </span>
          ) : (
            <span className="mt-1.5 inline-flex items-center rounded-full border border-dashed border-hairline px-2 py-0.5 text-[10px] font-semibold text-muted">
              Sem premiação
            </span>
          )}
        </div>
        {canExpand && <ChevronDown size={14} className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && canExpand && (
        <div className="border-t border-hairline p-3">
          <p className="mb-1.5 text-[11px] text-muted">Estrutura completa de premiação</p>
          <div className="space-y-0.5 font-mono text-xs text-ink">
            {payout!.places
              .slice()
              .sort((a, b) => a.place - b.place)
              .map((p) => (
                <p key={p.place}>
                  {p.place}º — {BRL.format(p.amount)}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
