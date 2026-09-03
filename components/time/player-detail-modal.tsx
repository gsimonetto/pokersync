"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { RankChip } from "@/components/ui/rank-chip";
import { ScoreRing } from "@/components/ui/score-ring";
import { PeriodSelector } from "@/components/period-selector";
import { PlayerDetailBody } from "@/components/time/player-detail-body";
import { ModalPortal } from "@/components/modal-portal";
import {
  calcularScore,
  diasSemAtividade,
  fetchPlayerActivity,
  fetchPlayerAlerts,
  fetchPlayerDetail,
  fetchPlayerFinancialSeries,
  fetchPlayerLeaks,
  fetchPlayerSharedHands,
  fetchPlayerStakingSessions,
  traduzErroTime,
  type FinancialDay,
  type PlayerActivityDay,
  type TeamAlert,
  type PlayerDetail,
  type PlayerSharedHand,
  type PlayerLeak,
  type PlayerStakingSession,
} from "@/lib/services/team-service";

const PERIODOS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

// Ficha cadastral em modal — abre sem sair da lista de Jogadores (o
// coach perdia filtro/scroll/expansao toda vez que clicava num nome e
// voltava). Mesmo conteudo da pagina /time/jogador/[id] (PlayerDetailBody),
// so' que dentro de um dialog; a pagina continua existindo pra quem chega
// por link direto (notificacao, deep-link do Assistente fora deste contexto).
export function PlayerDetailModal({
  playerId,
  meuUserId,
  meuPapel,
  onFechar,
}: {
  playerId: string;
  meuUserId: string | null;
  meuPapel: string | null;
  onFechar: () => void;
}) {
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [p, setP] = useState<PlayerDetail | null>(null);
  const [atividade, setAtividade] = useState<PlayerActivityDay[]>([]);
  const [leaks, setLeaks] = useState<PlayerLeak[]>([]);
  const [maos, setMaos] = useState<PlayerSharedHand[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [financeiro, setFinanceiro] = useState<FinancialDay[]>([]);
  const [staking, setStaking] = useState<PlayerStakingSession[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [d, a, l, m, al, fin, stk] = await Promise.all([
        fetchPlayerDetail(playerId, dias),
        fetchPlayerActivity(playerId, dias),
        fetchPlayerLeaks(playerId, dias),
        fetchPlayerSharedHands(playerId),
        fetchPlayerAlerts(playerId).catch(() => []),
        fetchPlayerFinancialSeries(playerId, dias).catch(() => []),
        fetchPlayerStakingSessions(playerId).catch(() => []),
      ]);
      setP(d);
      setAtividade(a);
      setLeaks(l);
      setMaos(m);
      setAlertas(al);
      setFinanceiro(fin);
      setStaking(stk);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [playerId, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const semAtividade = p ? diasSemAtividade(p.lastActivityAt) : null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
        <div
          className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-hairline bg-surface"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-hairline px-5 py-4">
            {p && <Avatar id={p.avatarId} url={p.avatarUrl} size={40} />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
                {p?.nome ?? (loading ? "Carregando…" : "Jogador")}
                {p?.level != null && <RankChip level={p.level} />}
                {p && <ScoreRing valor={calcularScore(p).valor} risco={calcularScore(p).risco} />}
              </p>
              {p && (
                <p className="truncate text-xs text-muted">
                  {p.coachNome ? `coach: ${p.coachNome}` : "sem coach atribuído"}
                  {" · "}
                  {semAtividade === null ? "sem atividade registrada" : semAtividade === 0 ? "ativo hoje" : `última atividade há ${semAtividade}d`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PeriodSelector value={dias} onChange={setDias} options={PERIODOS} />
              <Link
                href={`/time/jogador/${playerId}`}
                title="Abrir ficha completa em outra página"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink"
              >
                <ExternalLink size={14} />
              </Link>
              <button
                onClick={onFechar}
                aria-label="Fechar"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-5">
            {erro && (
              <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
            )}
            {loading ? (
              <p className="text-sm text-muted">Carregando…</p>
            ) : !p ? (
              <p className="text-sm text-muted">Jogador não encontrado.</p>
            ) : (
              <PlayerDetailBody
                id={playerId}
                p={p}
                atividade={atividade}
                leaks={leaks}
                maos={maos}
                alertas={alertas}
                financeiro={financeiro}
                staking={staking}
                podeGerenciarMetas={meuPapel === "admin" || (meuPapel === "coach" && p.coachId === meuUserId)}
                hrefMaoCompartilhada={(reviewId) => `/revisor?shared=${reviewId}`}
              />
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
