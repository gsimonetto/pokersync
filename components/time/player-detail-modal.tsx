"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, IdCard, MessageCircle, MoreVertical, X } from "lucide-react";
import { Esqueleto } from "@/components/painel/painel-card";
import { PeriodSelector } from "@/components/period-selector";
import { PlayerDetailBody } from "@/components/time/player-detail-body";
import { PlayerBadge, crachaDaFicha } from "@/components/time/player-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ModalPortal } from "@/components/modal-portal";
import { AcoesJogadorModal } from "@/components/time/acoes-jogador-modal";
import {
  fetchPlayerActivity,
  fetchPlayerAlerts,
  fetchPlayerDetail,
  fetchPlayerEvolutionStats,
  fetchPlayerScoreHistory,
  fetchPlayerSharedHands,
  fetchPlayerTeamHistory,
  fetchPlayerTeamProfile,
  traduzErroTime,
  type PlayerActivityDay,
  type PlayerEvolutionStats,
  type PlayerScoreHistoryPoint,
  type TeamAlert,
  type PlayerDetail,
  type PlayerSharedHand,
  type PlayerTeamHistoryItem,
  type PlayerTeamProfile,
  type TeamDashboardRow,
  type TeamLabel,
} from "@/lib/services/team-service";

const PAPEL: Record<string, string> = { admin: "Administrador", coach: "Coach", player: "Jogador" };

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
  onFechar,
  jogador,
  labels,
  coaches,
  isAdmin,
  podeConversar,
  onAbrirConversa,
  onChange,
  onErro: onErroPai,
}: {
  playerId: string;
  onFechar: () => void;
  // Props opcionais abaixo: só quando a ficha é aberta a partir da aba
  // Jogadores (lista de admin/coach), pra abrir "Conversar" e o menu de
  // ações (etiqueta, coach, remover) direto daqui — essas ações saíram
  // do card da lista e moraram todas pra dentro da ficha completa.
  jogador?: TeamDashboardRow;
  labels?: TeamLabel[];
  coaches?: { userId: string; nome: string }[];
  isAdmin?: boolean;
  podeConversar?: boolean;
  onAbrirConversa?: () => void;
  onChange?: () => void;
  onErro?: (s: string) => void;
}) {
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  // A mesma ficha, em dois tamanhos: completa ou como crachá (o mesmo
  // crachá da lista do time, do funil e das vagas).
  const [modo, setModo] = useState<"ficha" | "cracha">("ficha");
  const [p, setP] = useState<PlayerDetail | null>(null);
  const [atividade, setAtividade] = useState<PlayerActivityDay[]>([]);
  const [maos, setMaos] = useState<PlayerSharedHand[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [historicoScore, setHistoricoScore] = useState<PlayerScoreHistoryPoint[]>([]);
  const [evolutionStats, setEvolutionStats] = useState<PlayerEvolutionStats | null>(null);
  const [perfil, setPerfil] = useState<PlayerTeamProfile | null>(null);
  const [historico, setHistorico] = useState<PlayerTeamHistoryItem[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [d, a, m, al, hist, evo, pf, hTimes] = await Promise.all([
        fetchPlayerDetail(playerId, dias),
        fetchPlayerActivity(playerId, dias),
        fetchPlayerSharedHands(playerId),
        fetchPlayerAlerts(playerId).catch(() => []),
        fetchPlayerScoreHistory(playerId, dias).catch(() => []),
        fetchPlayerEvolutionStats(playerId, dias).catch(() => null),
        fetchPlayerTeamProfile(playerId),
        fetchPlayerTeamHistory(playerId),
      ]);
      setP(d);
      setAtividade(a);
      setMaos(m);
      setAlertas(al);
      setHistoricoScore(hist);
      setEvolutionStats(evo);
      setPerfil(pf);
      setHistorico(hTimes);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [playerId, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
        <div
          className="perf flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nome, foto e score moram na capa da ficha (PlayerDetailBody);
              aqui fica só a barra de ações. */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center">
              <SegmentedControl
                value={modo}
                onChange={setModo}
                options={[
                  { value: "ficha", label: "Ficha" },
                  { value: "cracha", label: <><IdCard size={13} className={modo === "cracha" ? "" : "text-[#d4af37]"} /> Crachá</> },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <PeriodSelector value={dias} onChange={setDias} options={PERIODOS} />
              {podeConversar && onAbrirConversa && (
                <button
                  onClick={onAbrirConversa}
                  title="Conversar"
                  aria-label="Conversar"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-ink"
                >
                  <MessageCircle size={14} />
                </button>
              )}
              {jogador && labels && coaches && onChange && onErroPai && (
                <button
                  onClick={() => setAcoesAbertas(true)}
                  title="Ações do jogador"
                  aria-label="Ações do jogador"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-ink"
                >
                  <MoreVertical size={14} />
                </button>
              )}
              <Link
                href={`/time/jogador/${playerId}`}
                title="Abrir ficha completa em outra página"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-ink"
              >
                <ExternalLink size={14} />
              </Link>
              <button
                onClick={onFechar}
                aria-label="Fechar"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="painel-scroll overflow-y-auto p-3 sm:p-5">
            {erro && (
              <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
            )}
            {loading ? (
              <Esqueleto linhas={4} altura={96} />
            ) : !p ? (
              <p className="text-sm text-muted">Jogador não encontrado.</p>
            ) : modo === "cracha" ? (
              <div className="flex flex-col items-center gap-4 py-4 sm:py-8">
                <PlayerBadge
                  dados={crachaDaFicha(p, jogador)}
                  variante="cracha"
                  subtitulo={
                    <>
                      {PAPEL[p.role]}
                      {p.coachNome && <span className="text-muted/70"> · coach {p.coachNome}</span>}
                    </>
                  }
                  rodape={`PokerSync · no time desde ${new Date(p.joinedAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`}
                />
                <p className="max-w-xs text-center text-[11.5px] text-muted/70">
                  É o mesmo crachá que aparece na lista do time, no funil e nas vagas. Passe o mouse num número para ver de onde ele vem.
                </p>
              </div>
            ) : (
              <PlayerDetailBody
                id={playerId}
                p={p}
                atividade={atividade}
                maos={maos}
                alertas={alertas}
                historicoScore={historicoScore}
                evolutionStats={evolutionStats}
                perfil={perfil}
                historico={historico}
                emModal
                // Metas so' se criam/editam pelo card do jogador no Funil --
                // aqui (ficha aberta pela aba Jogadores) e' so' leitura. Ver
                // components/time/funil/funil-modal-card.tsx.
                podeGerenciarMetas={false}
                hrefMaoCompartilhada={(reviewId) => `/revisor?shared=${reviewId}`}
              />
            )}
          </div>
        </div>
      </div>

      {acoesAbertas && jogador && labels && coaches && onChange && onErroPai && (
        <AcoesJogadorModal
          jogador={jogador}
          labels={labels}
          coaches={coaches}
          isAdmin={Boolean(isAdmin)}
          onFechar={() => setAcoesAbertas(false)}
          onAbrirConversa={() => {
            setAcoesAbertas(false);
            onAbrirConversa?.();
          }}
          onChange={() => {
            onChange();
            carregar();
          }}
          onRemoved={onFechar}
          onErro={onErroPai}
        />
      )}
    </ModalPortal>
  );
}
