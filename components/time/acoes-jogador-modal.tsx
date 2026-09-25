"use client";

import { useState } from "react";
import { Tag, UserCog, UserMinus, X } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import {
  assignCoach,
  removeMember,
  setMemberLabel,
  traduzErroTime,
  type TeamDashboardRow,
  type TeamLabel,
} from "@/lib/services/team-service";

// Modal de ações por jogador. Etiqueta, coach e remoção são
// exclusivas de admin; conversar é liberado também pro coach (o
// backend send_team_message já aceita qualquer par do mesmo time).
// Extraído de tab-jogadores.tsx pra ser reaberto também de dentro da
// ficha completa (PlayerDetailModal) — a lista de Jogadores agora só
// mostra foto+nome+dinheiro, e essas ações moraram todas pra dentro
// da ficha.
export function AcoesJogadorModal({
  jogador,
  labels,
  coaches,
  isAdmin,
  onFechar,
  onChange,
  onRemoved,
  onErro,
}: {
  jogador: TeamDashboardRow;
  labels: TeamLabel[];
  coaches: { userId: string; nome: string }[];
  isAdmin: boolean;
  onFechar: () => void;
  onChange: () => void;
  /** Chamado (além de onChange) quando o jogador é de fato removido do time. */
  onRemoved?: () => void;
  onErro: (s: string) => void;
}) {
  const [labelId, setLabelId] = useState(jogador.labelId ?? "");
  const [coachId, setCoachId] = useState(jogador.coachId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  async function salvarEtiquetaCoach() {
    setSalvando(true);
    try {
      if (labelId !== (jogador.labelId ?? "")) await setMemberLabel(jogador.userId, labelId || null);
      if (coachId !== (jogador.coachId ?? "")) await assignCoach(jogador.userId, coachId || null);
      onChange();
      onFechar();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarRemocao() {
    setRemovendo(true);
    try {
      await removeMember(jogador.userId);
      onChange();
      onRemoved?.();
      onFechar();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AvatarNivel userId={jogador.userId} avatarId={jogador.avatarId} avatarUrl={jogador.avatarUrl} tamanho={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{jogador.nome}</p>
            <p className="text-xs text-muted">Ações do jogador</p>
          </div>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {isAdmin && (
            <>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <Tag size={12} /> Etiqueta
                </label>
                <select
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="">Sem etiqueta</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {coaches.length > 0 && (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    <UserCog size={12} /> Coach
                  </label>
                  <select
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
                  >
                    <option value="">Sem coach</option>
                    {coaches.map((c) => (
                      <option key={c.userId} value={c.userId}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={salvarEtiquetaCoach}
                disabled={salvando}
                className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.01] disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>
            </>
          )}

          {isAdmin && (
            <div className="border-t border-hairline pt-4">
              {!confirmarRemover ? (
                <button
                  onClick={() => setConfirmarRemover(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-negative/40 px-4 py-2 text-sm font-medium text-negative transition-colors hover:bg-negative/10"
                >
                  <UserMinus size={14} />
                  Remover do time
                </button>
              ) : (
                <div className="rounded-lg border border-negative/40 bg-negative/10 p-3">
                  <p className="text-[13px] text-negative">Remover {jogador.nome} do time? Essa ação não pode ser desfeita.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setConfirmarRemover(false)}
                      className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] text-ink hover:border-ink/40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarRemocao}
                      disabled={removendo}
                      className="flex-1 rounded-lg bg-negative px-3 py-1.5 text-[13px] font-semibold text-void transition-transform hover:scale-[1.01] disabled:opacity-50"
                    >
                      {removendo ? "Removendo…" : "Confirmar remoção"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
