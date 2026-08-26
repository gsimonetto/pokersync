"use client";

import { useEffect, useState } from "react";
import { X, Users, Layers, Download, Library } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import { MotorLibraryPanel } from "@/components/ranges/motor-library-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import { getRange, listTeamSharedRanges, type TeamSharedRange } from "@/lib/services/range-service";

// Biblioteca de ranges pronta pra carregar dentro do construtor: os
// dois lugares onde ranges "de fora" (nao criados do zero pelo proprio
// jogador) ja existiam no produto — o que o time/coach publicou, e os
// specs pre-flop resolvidos pelo motor da PokerSync — reunidos aqui num
// so lugar, com clicar-e-carregar direto na grade em vez de precisar
// copiar pra biblioteca pessoal antes.
export function RangeLibraryModal({ onLoad, onClose }: { onLoad: (hands: RangeHands) => void; onClose: () => void }) {
  const confirm = useConfirm();
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [teamRanges, setTeamRanges] = useState<TeamSharedRange[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEscapeToClose(onClose);

  useEffect(() => {
    fetchMyTeam()
      .then(async (team) => {
        setMyTeam(team);
        if (team) setTeamRanges(await listTeamSharedRanges(team.team.id));
      })
      .catch(() => setError("Erro ao carregar a biblioteca do time."))
      .finally(() => setLoadingTeam(false));
  }, []);

  async function handleLoadTeamRange(id: string) {
    const ok = await confirm({
      title: "Carregar range da biblioteca",
      message: "Isso substitui o range atual na grade por este.",
      confirmLabel: "Carregar",
    });
    if (!ok) return;
    setLoadingId(id);
    try {
      const r = await getRange(id);
      onLoad(r.hands);
      onClose();
    } catch {
      setError("Erro ao carregar esse range.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Library size={18} />
            Biblioteca de ranges
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Ranges prontos publicados pro seu time (ou pelo coach) e specs pré-flop resolvidos pelo motor da PokerSync
          — clique num deles pra carregar tudo direto no construtor.
        </p>

        {error && <p className="mb-3 text-xs text-negative">{error}</p>}

        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
            <Users size={13} />
            Publicados pelo time / coach
          </div>

          {loadingTeam && <p className="text-xs text-muted">Carregando…</p>}

          {!loadingTeam && !myTeam && (
            <p className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-xs text-muted">
              Você ainda não faz parte de um time — ranges publicados pelo seu coach aparecem aqui.
            </p>
          )}

          {!loadingTeam && myTeam && teamRanges.length === 0 && (
            <p className="rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-xs text-muted">
              Ninguém publicou nenhum range pro time ainda.
            </p>
          )}

          {!loadingTeam && teamRanges.length > 0 && (
            <div className="space-y-1.5">
              {teamRanges.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleLoadTeamRange(r.id)}
                  disabled={loadingId === r.id}
                  className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-left text-sm hover:border-ink/40 disabled:opacity-50"
                >
                  <Layers size={14} className="shrink-0 text-muted" />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {r.isMine ? "por você" : `por ${r.ownerName}`} · {r.hand_count} mãos
                  </span>
                  <Download size={13} className="shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
            <Library size={13} />
            Ranges PokerSync
          </div>
          <MotorLibraryPanel
            onLoad={(hands) => {
              onLoad(hands);
              onClose();
            }}
          />
        </section>
      </div>
    </div>
  );
}
