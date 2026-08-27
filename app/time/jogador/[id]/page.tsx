"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RankChip } from "@/components/ui/rank-chip";
import { PeriodSelector, PrintButton } from "@/components/period-selector";
import { PlayerDetailBody } from "@/components/time/player-detail-body";
import { TeamPrintStyles } from "@/components/time/print-styles";
import { createClient } from "@/lib/supabase/client";
import {
  diasSemAtividade,
  fetchPlayerActivity,
  fetchPlayerAlerts,
  fetchPlayerDetail,
  fetchPlayerFinancialSeries,
  fetchPlayerLeaks,
  fetchPlayerSharedHands,
  fetchPlayerStakingSessions,
  fetchMyMembership,
  traduzErroTime,
  type FinancialDay,
  type PlayerActivityDay,
  type TeamAlert,
  type PlayerDetail,
  type PlayerSharedHand,
  type PlayerLeak,
  type PlayerStakingSession,
} from "@/lib/services/team-service";

// Ficha individual do jogador. Quem pode abrir: admin do time, o coach
// responsavel, ou o proprio jogador — a checagem esta nas RPCs, esta
// tela so mostra o erro que voltar.
// Espacamento de borda seguindo Banca/Revisor: max-w-[1280px] px-6 py-10.

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
  const [leaks, setLeaks] = useState<PlayerLeak[]>([]);
  const [maos, setMaos] = useState<PlayerSharedHand[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [financeiro, setFinanceiro] = useState<FinancialDay[]>([]);
  const [staking, setStaking] = useState<PlayerStakingSession[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meuPapel, setMeuPapel] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [d, a, l, m, al, fin, stk, mem, auth] = await Promise.all([
        fetchPlayerDetail(id, dias),
        fetchPlayerActivity(id, dias),
        fetchPlayerLeaks(id, dias),
        fetchPlayerSharedHands(id),
        fetchPlayerAlerts(id).catch(() => []),
        fetchPlayerFinancialSeries(id, dias).catch(() => []),
        fetchPlayerStakingSessions(id).catch(() => []),
        fetchMyMembership().catch(() => null),
        createClient().auth.getUser(),
      ]);
      setP(d);
      setAtividade(a);
      setLeaks(l);
      setMaos(m);
      setAlertas(al);
      setFinanceiro(fin);
      setStaking(stk);
      setMeuPapel(mem?.role ?? null);
      setMeuId(auth.data.user?.id ?? null);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [id, dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const semAtividade = p ? diasSemAtividade(p.lastActivityAt) : null;

  return (
    <AppShell>
    <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink print:max-w-full print:p-0">
      <AppHeader
        insideShell
        backHref="/time/painel?tab=jogadores"
        iconNode={p ? <Avatar id={p.avatarId} url={p.avatarUrl} size={38} /> : undefined}
        title={p?.nome ?? "Jogador"}
        subtitle={
          p ? (
            <>
              {p.level != null && <RankChip level={p.level} />}
              <span>
                {[
                  p.coachNome ? `coach: ${p.coachNome}` : "sem coach atribuído",
                  semAtividade === null
                    ? "sem atividade registrada"
                    : semAtividade === 0
                    ? "ativo hoje"
                    : `última atividade há ${semAtividade}d`,
                ].join(" · ")}
              </span>
            </>
          ) : loading ? (
            "Carregando…"
          ) : (
            "Jogador não encontrado"
          )
        }
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

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : !p ? (
        <p className="text-sm text-muted">Jogador não encontrado.</p>
      ) : (
        <PlayerDetailBody
          id={id}
          p={p}
          atividade={atividade}
          leaks={leaks}
          maos={maos}
          alertas={alertas}
          financeiro={financeiro}
          staking={staking}
          podeGerenciarMetas={meuPapel === "admin" || (meuPapel === "coach" && p.coachId === meuId)}
        />
      )}
    </main>

    <TeamPrintStyles />
    </AppShell>
  );
}
