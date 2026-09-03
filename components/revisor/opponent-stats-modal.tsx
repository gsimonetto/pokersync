"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  isSmallSample,
  classifyOpponentStyle,
  OPPONENT_STYLE_LABEL,
  type OpponentStats,
  type OpponentStyle,
} from "@/lib/services/opponent-stats-service";

// Mesma classificacao/cor do chip na mesa (ver poker-table.tsx) --
// consistencia entre onde o jogador primeiro ve o dado (chip) e onde
// ve o detalhe (aqui). Tailwind nao tem token de amarelo no design
// system geral (so' positive/negative), entao "passivo" usa amber-400
// direto, mesmo tom ja usado no aviso de amostra pequena logo abaixo.
const STYLE_BADGE_CLASS: Record<OpponentStyle, string> = {
  aggressive: "bg-negative/15 text-negative border-negative/30",
  passive: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  balanced: "bg-positive/15 text-positive border-positive/30",
};

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline/50 py-1.5 last:border-0" title={hint}>
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-[12.5px] font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

// Estatisticas completas de UM oponente -- abre ao clicar no nome dele
// na mesa (icone de info sutil ao lado do nome sinaliza o clique). So'
// as 3 mais usadas (VPIP/PFR/3-Bet) ficam visiveis direto no assento,
// pra nao apertar a mesa -- pedido explicito.
export function OpponentStatsModal({ stats, onClose }: { stats: OpponentStats | null; onClose: () => void }) {
  useEffect(() => {
    if (!stats) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stats, onClose]);

  if (!stats) return null;
  const small = isSmallSample(stats);
  const style = classifyOpponentStyle(stats);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 px-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xs rounded-xl border border-hairline bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-bold text-ink" title={stats.opponentName}>
            {stats.opponentName}
          </h2>
          <button onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STYLE_BADGE_CLASS[style]}`}>
            {OPPONENT_STYLE_LABEL[style]}
          </span>
          <p className="text-[11px] text-muted">
            {stats.handsCount} mão{stats.handsCount === 1 ? "" : "s"} jogada{stats.handsCount === 1 ? "" : "s"} contra você
          </p>
        </div>
        {small && <p className="mt-1.5 text-[11px] text-amber-400">Amostra pequena — leia com cautela.</p>}

        <div className="mt-3 flex flex-col">
          <StatRow label="VPIP" value={fmtPct(stats.vpipPct)} hint="Voluntarily Put money In Pot no preflop" />
          <StatRow label="PFR" value={fmtPct(stats.pfrPct)} hint="Preflop raise" />
          <StatRow label="3-Bet" value={fmtPct(stats.threeBetPct)} />
          <StatRow label="Fold to 3-Bet" value={fmtPct(stats.foldTo3BetPct)} hint="Só conta mãos em que ele levou um 3-bet" />
          <StatRow label="C-Bet no flop" value={fmtPct(stats.cbetFlopPct)} hint="Só conta mãos em que ele foi o agressor pré-flop" />
          <StatRow label="Fold to C-Bet (flop)" value={fmtPct(stats.foldToCbetFlopPct)} />
          <StatRow label="Aggression Factor" value={stats.aggressionFactor == null ? "—" : stats.aggressionFactor.toFixed(2)} hint="(bet+raise)/call pós-flop" />
          <StatRow label="Foi a showdown" value={fmtPct(stats.wentToShowdownPct)} />
          <StatRow label="Ganhou no showdown" value={fmtPct(stats.wonShowdownPct)} />
        </div>
      </div>
    </div>
  );
}
