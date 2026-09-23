"use client";

import { use, useCallback, useEffect, useState } from "react";
import { IdCard } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { Esqueleto } from "@/components/painel/painel-card";
import { PeriodSelector, PrintButton } from "@/components/period-selector";
import { PlayerDetailBody } from "@/components/time/player-detail-body";
import { TeamPrintStyles } from "@/components/time/print-styles";
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
} from "@/lib/services/team-service";

// Ficha individual do jogador. Quem pode abrir: admin do time, o coach
// responsavel, ou o proprio jogador — a checagem esta nas RPCs, esta
// tela so mostra o erro que voltar.
// Espacamento de borda seguindo Banca/Revisor: full-width, px-6 py-10.

const PERIODOS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

export default function JogadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
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
        fetchPlayerDetail(id, dias),
        fetchPlayerActivity(id, dias),
        fetchPlayerSharedHands(id),
        fetchPlayerAlerts(id).catch(() => []),
        fetchPlayerScoreHistory(id, dias).catch(() => []),
        fetchPlayerEvolutionStats(id, dias).catch(() => null),
        fetchPlayerTeamProfile(id),
        fetchPlayerTeamHistory(id),
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
  }, [id, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6 print:p-0">
          <PerfEstilos />
          {/* Nome, foto, coach e score moram na capa da ficha
              (PlayerDetailBody); o cabeçalho fica só com voltar + período. */}
          <AppHeader
            insideShell
            backHref="/time/painel?tab=jogadores"
            iconNode={<IdCard size={20} className="text-[#d4af37]" />}
            title="Ficha do jogador"
            subtitle={loading ? "Carregando…" : p ? undefined : "Jogador não encontrado"}
            right={
              <div className="flex items-center gap-2 print:hidden">
                <PeriodSelector value={dias} onChange={setDias} options={PERIODOS} />
                <PrintButton />
              </div>
            }
          />

          {erro && (
            <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
          )}

          <div className="mx-auto max-w-6xl">
            {loading ? (
              <Esqueleto linhas={4} altura={110} />
            ) : !p ? (
              <p className="text-sm text-muted">Jogador não encontrado.</p>
            ) : (
              <PlayerDetailBody
                id={id}
                p={p}
                perfil={perfil}
                historico={historico}
                atividade={atividade}
                maos={maos}
                alertas={alertas}
                historicoScore={historicoScore}
                evolutionStats={evolutionStats}
                // Metas so' se criam/editam pelo card do jogador no Funil (controle
                // centralizado num unico lugar) -- aqui e' so' leitura, mesmo pra
                // quem e' admin/coach do jogador. Ver components/time/funil/funil-modal-card.tsx.
                podeGerenciarMetas={false}
              />
            )}
          </div>
        </main>
      </PainelVisual>

      <TeamPrintStyles />
    </AppShell>
  );
}
