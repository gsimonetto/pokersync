"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Target,
  BookOpen,
  TriangleAlert,
  MessageSquare,
  Eye,
  ChevronRight,
  Wallet,
  Gamepad2,
  Handshake,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AppHeader } from "@/components/app-header";
import { Chip } from "@/components/chip";
import { PeriodSelector, PrintButton } from "@/components/period-selector";
import { GraficoFinanceiro } from "@/components/time/grafico-financeiro";
import { MetasCard } from "@/components/time/metas-card";
import { Kpi } from "@/components/time/kpi";
import { TeamPrintStyles } from "@/components/time/print-styles";
import { createClient } from "@/lib/supabase/client";
import { BRL, variacao } from "@/lib/format";
import {
  ALERTA_LABEL,
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

  const acertoPct = useMemo(() => {
    if (!p || p.treinos === 0) return null;
    return Math.round((p.acertosGto / p.treinos) * 100);
  }, [p]);

  const semAtividade = p ? diasSemAtividade(p.lastActivityAt) : null;
  const maxDia = Math.max(1, ...atividade.map((d) => d.treinos + d.revisoes));

  return (
    <>
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink print:max-w-full print:p-0">
      <AppHeader
        backHref="/time/painel?tab=jogadores"
        iconNode={p ? <Avatar id={p.avatarId} url={p.avatarUrl} size={38} /> : undefined}
        title={p?.nome ?? "Jogador"}
        subtitle={
          p
            ? [
                p.level != null ? `Nível ${p.level}` : null,
                p.coachNome ? `coach: ${p.coachNome}` : "sem coach atribuído",
                semAtividade === null
                  ? "sem atividade registrada"
                  : semAtividade === 0
                  ? "ativo hoje"
                  : `última atividade há ${semAtividade}d`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando…"
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
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi
              icon={Wallet}
              label="Resultado no time"
              value={p.jogosNoTime > 0 ? BRL.format(p.lucroNoTime) : "—"}
              hint={staking.length > 0 ? "líquido — já descontado o staking" : "desde que entrou"}
              tom={p.lucroNoTime > 0 ? "positivo" : p.lucroNoTime < 0 ? "negativo" : undefined}
              destaque
            />
            <Kpi icon={Gamepad2} label="Jogos" value={String(p.jogosNoTime)} hint="desde que entrou" />
            <Kpi
              icon={Target}
              label="Treinos"
              value={String(p.treinos)}
              hint={`${p.xpPeriodo} XP no período`}
              tendencia={variacao(p.treinos, p.treinosPeriodoAnterior)}
            />
            <Kpi
              icon={Flame}
              label="Acerto GTO"
              value={acertoPct === null ? "—" : `${acertoPct}%`}
              hint={p.errosGraves > 0 ? `${p.errosGraves} erro(s) grave(s)` : undefined}
              tendencia={variacao(
                p.treinos > 0 ? Math.round((100 * (p.acertosGto ?? 0)) / p.treinos) : null,
                p.treinosPeriodoAnterior > 0
                  ? Math.round((100 * (p.acertosGtoPeriodoAnterior ?? 0)) / p.treinosPeriodoAnterior)
                  : null
              )}
              tendenciaSufixo="pp"
            />
            <Kpi
              icon={BookOpen}
              label="Mãos revisadas"
              value={String(p.maosRevisadas)}
              hint={p.maosPendentes > 0 ? `${p.maosPendentes} na fila` : undefined}
            />
            <Kpi
              icon={Flame}
              label="Ofensiva"
              value={p.streakDays ? `${p.streakDays}d` : "—"}
              hint={p.streakBest ? `recorde ${p.streakBest}d` : undefined}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <GraficoFinanceiro dados={financeiro} pronto={!loading} titulo="Resultado no período" />
            <div className="rounded-xl border border-hairline bg-surface p-6">
              <h2 className="text-base font-semibold">Frequência de estudo</h2>
              <p className="mt-1 text-sm text-muted">Treinos e revisões concluídas por dia.</p>

            <div className="mt-4 flex h-28 items-end gap-[3px]">
              {atividade.map((d) => {
                const total = d.treinos + d.revisoes;
                const alturaTreino = (d.treinos / maxDia) * 100;
                const alturaRevisao = (d.revisoes / maxDia) * 100;
                return (
                  <div
                    key={d.dia}
                    className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.treinos} treino(s), ${d.revisoes} revisão(ões)`}
                  >
                    {total === 0 ? (
                      <div className="h-[2px] w-full rounded-sm bg-hairline" />
                    ) : (
                      <>
                        <div className="w-full rounded-t-sm bg-review" style={{ height: `${alturaRevisao}%` }} />
                        <div className="w-full rounded-b-sm bg-training" style={{ height: `${alturaTreino}%` }} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-training" /> Treinos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-review" /> Revisões
              </span>
            </div>
            </div>
          </section>

          {staking.length > 0 && (
            <section className="rounded-xl border border-hairline bg-surface p-6">
              <h2 className="flex items-center gap-1.5 text-base font-semibold">
                <Handshake size={15} className="text-training" />
                Staking recente
              </h2>
              <p className="mt-1 text-sm text-muted">
                Sessões em que o jogador vendeu parte da ação — resultado líquido é o que fica com ele, bruto é o
                tamanho real do swing da sessão.
              </p>
              <ul className="mt-4 divide-y divide-hairline">
                {staking.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]">
                    <span className="text-muted">{new Date(s.dia).toLocaleDateString("pt-BR")}</span>
                    <span className="font-medium">{s.formato}</span>
                    <span className="rounded-full border border-training/40 bg-training/10 px-2 py-0.5 text-[10.5px] font-semibold text-training">
                      {s.ownPct}% dele · markup {s.markup.toFixed(2)}
                    </span>
                    {s.backerName && <span className="text-muted">backer: {s.backerName}</span>}
                    <span className="ml-auto flex items-center gap-3 tnum">
                      <span className={s.resultadoLiquido >= 0 ? "text-positive" : "text-negative"}>
                        líquido {BRL.format(s.resultadoLiquido)}
                      </span>
                      <span className="text-xs text-muted">bruto {BRL.format(s.resultadoBruto)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <MetasCard
            playerId={id}
            podeGerenciar={meuPapel === "admin" || (meuPapel === "coach" && p.coachId === meuId)}
          />

          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="text-base font-semibold">Mãos enviadas para você</h2>
            {maos.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhuma mão compartilhada até agora.</p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {maos.map((m) => (
                  <li key={m.shareId}>
                    <Link
                      href={`/revisor?shared=${m.reviewId}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:text-ink"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.titulo}</p>
                        <p className="text-xs text-muted">
                          {new Date(m.compartilhadaEm).toLocaleDateString("pt-BR")}
                          {m.comentarios > 0 && ` · ${m.comentarios} comentário(s)`}
                        </p>
                      </div>
                      {!m.vistaEm ? (
                        <span className="rounded-full bg-evolution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void">
                          Nova
                        </span>
                      ) : m.comentarios === 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <Eye size={12} /> vista
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-training">
                          <MessageSquare size={12} /> respondida
                        </span>
                      )}
                      <ChevronRight size={15} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {alertas.length > 0 && (
            <section className="rounded-xl border border-hairline bg-surface p-6">
              <h2 className="text-base font-semibold">Alertas recentes</h2>
              <ul className="mt-3 space-y-2">
                {alertas.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <Chip color={a.kind === "lembrete_estudo" ? "#8b8b8b" : "#F59E0B"} size="sm">
                      {ALERTA_LABEL[a.kind]}
                    </Chip>
                    <span className="min-w-0 flex-1 text-ink/85">{a.detail}</span>
                    <span className="text-xs text-muted">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="flex items-center gap-1.5 text-base font-semibold">
              <TriangleAlert size={15} className="text-evolution" />
              Leaks recorrentes
            </h2>
            {leaks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Sem erros classificados no período.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {leaks.map((l) => {
                  const maior = leaks[0].total || 1;
                  return (
                    <li key={l.reasonCode} className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[13px] font-medium">{l.label}</span>
                        <span className="shrink-0 text-xs text-muted tnum">{l.total}×</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-void">
                        <div
                          className="h-full rounded-full bg-review"
                          style={{ width: `${Math.max(6, Math.round((l.total / maior) * 100))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>

    <TeamPrintStyles />
    </>
  );
}
