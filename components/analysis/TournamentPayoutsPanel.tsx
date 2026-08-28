"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Loader2, Bot, PenLine } from "lucide-react";
import { upsertTournamentPayout, type TournamentPayout, type PayoutPlace } from "@/lib/services/tournament-payout-service";
import type { HandSession } from "@/lib/services/hand-session-service";
import { EmptyState } from "@/components/analysis/shared";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Parseia "1 500\n2 300\n3 200" (ou "1º $500" etc — só extrai os 2 números
// de cada linha, na ordem) pra PayoutPlace[]. Formato livre de propósito:
// pedir que o jogador cole exatamente como está na tabela de premiação do
// site é mais rápido do que forçar um layout rígido de campos.
function parsePlacesText(text: string): PayoutPlace[] {
  const places: PayoutPlace[] = [];
  for (const line of text.split("\n")) {
    const nums = line.match(/[\d.,]+/g);
    if (!nums || nums.length < 2) continue;
    const place = Number(nums[0].replace(",", "."));
    const amount = Number(nums[1].replace(",", "."));
    if (Number.isFinite(place) && Number.isFinite(amount)) places.push({ place, amount });
  }
  return places.sort((a, b) => a.place - b.place);
}

function placesToText(places: PayoutPlace[]): string {
  return places.map((p) => `${p.place} ${p.amount}`).join("\n");
}

// Painel de estrutura de premiação — vive dentro da aba Torneios da
// Análise (não é tela separada). Cada torneio já listado (hand_sessions)
// aparece com o status de premiação; falta = formulário inline pra
// registrar manualmente. `source: "agent"` fica pronto pro dia em que o
// agente desktop buscar isso sozinho — a mesma linha aceita as duas
// origens, só troca quem escreveu por último.
export function TournamentPayoutsPanel({
  sessions,
  payouts,
  onChanged,
  focusPending,
  onFocusConsumed,
}: {
  sessions: HandSession[];
  payouts: TournamentPayout[];
  onChanged: () => void;
  focusPending?: boolean;
  onFocusConsumed?: () => void;
}) {
  const byTournament = new Map(payouts.map((p) => [p.tournamentIdPs, p]));

  function hasPayoutFor(s: HandSession): boolean {
    const p = s.tournament_id_ps ? byTournament.get(s.tournament_id_ps) : undefined;
    return p != null && (p.heroPayoutAmount != null || p.places.length > 0);
  }

  // Veio do botão "Importar → Torneio": abre e rola direto pro primeiro
  // torneio sem premiação, em vez de deixar o jogador procurar na lista.
  // Consome a flag uma vez (no mount) pra não repetir em toda troca de aba.
  const pendingSession = focusPending ? sessions.find((s) => !hasPayoutFor(s)) : undefined;
  useEffect(() => {
    if (focusPending) onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPending]);

  if (sessions.length === 0) {
    return <EmptyState texto="Nenhum torneio importado ainda — a estrutura de premiação aparece aqui assim que houver mãos de torneio." />;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <TournamentRow
          key={s.id}
          session={s}
          payout={s.tournament_id_ps ? byTournament.get(s.tournament_id_ps) : undefined}
          onChanged={onChanged}
          highlight={pendingSession?.id === s.id}
        />
      ))}
    </div>
  );
}

function TournamentRow({
  session,
  payout,
  onChanged,
  highlight,
}: {
  session: HandSession;
  payout?: TournamentPayout;
  onChanged: () => void;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(!!highlight);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight]);
  const [heroFinishPlace, setHeroFinishPlace] = useState(payout?.heroFinishPlace != null ? String(payout.heroFinishPlace) : "");
  const [heroPayoutAmount, setHeroPayoutAmount] = useState(payout?.heroPayoutAmount != null ? String(payout.heroPayoutAmount) : "");
  const [totalEntrants, setTotalEntrants] = useState(payout?.totalEntrants != null ? String(payout.totalEntrants) : "");
  const [placesText, setPlacesText] = useState(payout ? placesToText(payout.places) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!session.tournament_id_ps || saving) return;
    setSaving(true);
    setError("");
    try {
      await upsertTournamentPayout({
        tournamentIdPs: session.tournament_id_ps,
        source: "manual",
        heroFinishPlace: heroFinishPlace.trim() ? Number(heroFinishPlace) : null,
        heroPayoutAmount: heroPayoutAmount.trim() ? Number(heroPayoutAmount) : null,
        totalEntrants: totalEntrants.trim() ? Number(totalEntrants) : null,
        places: parsePlacesText(placesText),
      });
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar premiação.");
    } finally {
      setSaving(false);
    }
  }

  const hasPayout = payout != null && (payout.heroPayoutAmount != null || payout.places.length > 0);

  return (
    <div
      ref={rowRef}
      className={`rounded-lg border bg-elevated transition-colors ${highlight ? "border-evolution/60 ring-1 ring-evolution/40" : "border-hairline"}`}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{session.label}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {session.buyin != null ? BRL.format(session.buyin) : "buy-in não identificado"}
            {payout?.heroFinishPlace != null && <> · {payout.heroFinishPlace}º lugar</>}
            {payout?.heroPayoutAmount != null && <> · {BRL.format(payout.heroPayoutAmount)}</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasPayout ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-positive/35 bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
              {payout?.source === "agent" ? <Bot size={10} /> : <PenLine size={10} />}
              Premiação registrada
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-hairline px-2 py-0.5 text-[10px] font-semibold text-muted">
              Sem premiação
            </span>
          )}
          <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-hairline p-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted">Sua colocação</label>
              <input
                type="number"
                value={heroFinishPlace}
                onChange={(e) => setHeroFinishPlace(e.target.value)}
                placeholder="Ex.: 4"
                className="w-full rounded-lg border border-hairline bg-void px-2.5 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">Quanto você ganhou</label>
              <input
                type="number"
                step="0.01"
                value={heroPayoutAmount}
                onChange={(e) => setHeroPayoutAmount(e.target.value)}
                placeholder="Ex.: 42.50"
                className="w-full rounded-lg border border-hairline bg-void px-2.5 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">Total de inscritos (opcional)</label>
              <input
                type="number"
                value={totalEntrants}
                onChange={(e) => setTotalEntrants(e.target.value)}
                placeholder="Ex.: 842"
                className="w-full rounded-lg border border-hairline bg-void px-2.5 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </div>
          </div>

          <div className="mt-2.5">
            <label className="mb-1 block text-[11px] text-muted">
              Estrutura completa de premiação (opcional — necessária pro cálculo de cEV/ICM)
            </label>
            <textarea
              value={placesText}
              onChange={(e) => setPlacesText(e.target.value)}
              placeholder={"Cole uma colocação por linha, lugar e valor:\n1 500\n2 300\n3 200"}
              rows={4}
              className="w-full resize-y rounded-lg border border-hairline bg-void p-2.5 font-mono text-xs text-ink outline-none focus:border-ink/40"
            />
          </div>

          {error && <p className="mt-2 text-xs text-negative">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar premiação
          </button>
        </div>
      )}
    </div>
  );
}
