"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Flame, TriangleAlert, BookOpen, Target } from "lucide-react";
import {
  diasSemAtividade,
  fetchMyTeam,
  fetchTeamDashboard,
  fetchTeamLeaks,
  traduzErroTime,
  type MyTeam,
  type TeamDashboardRow,
  type TeamLeak,
} from "@/lib/services/team-service";

// Painel do time. Admin ve o time inteiro; coach ve so os jogadores
// atribuidos a ele — quem filtra e' a RPC no banco, nao esta tela.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

const PERIODOS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const INATIVO_DIAS = 7;

export default function PainelTimePage() {
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [time, setTime] = useState<MyTeam | null>(null);
  const [linhas, setLinhas] = useState<TeamDashboardRow[]>([]);
  const [leaks, setLeaks] = useState<TeamLeak[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [t, rows, lk] = await Promise.all([fetchMyTeam(), fetchTeamDashboard(dias), fetchTeamLeaks(dias)]);
      setTime(t);
      setLinhas(rows);
      setLeaks(lk);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const jogadores = useMemo(() => linhas.filter((l) => l.role === "player"), [linhas]);

  const resumo = useMemo(() => {
    const treinos = jogadores.reduce((a, j) => a + j.treinos, 0);
    const acertos = jogadores.reduce((a, j) => a + j.acertosGto, 0);
    const revisadas = jogadores.reduce((a, j) => a + j.maosRevisadas, 0);
    const inativos = jogadores.filter((j) => {
      const d = diasSemAtividade(j.lastActivityAt);
      return d === null || d >= INATIVO_DIAS;
    }).length;
    return {
      treinos,
      acertoPct: treinos > 0 ? Math.round((acertos / treinos) * 100) : null,
      revisadas,
      inativos,
      ativos: jogadores.length - inativos,
    };
  }, [jogadores]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/time"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <LayoutDashboard size={20} style={{ color: time?.team.accent ?? "#5AA6E0" }} />
        <div className="flex-1">
          <h1 className="m-0 text-xl font-semibold tracking-tight">Painel do time</h1>
          <p className="mt-0.5 text-sm text-muted">
            {time?.role === "coach" ? "Seus jogadores acompanhados" : "Visão geral da organização"}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDias(p.days)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                dias === p.days ? "bg-ink text-void" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando painel…</p>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Target} label="Treinos no período" value={String(resumo.treinos)} />
            <Kpi
              icon={Flame}
              label="Acerto GTO"
              value={resumo.acertoPct === null ? "—" : `${resumo.acertoPct}%`}
              hint={resumo.acertoPct === null ? "sem treinos" : undefined}
            />
            <Kpi icon={BookOpen} label="Mãos revisadas" value={String(resumo.revisadas)} />
            <Kpi
              icon={TriangleAlert}
              label="Precisam de atenção"
              value={String(resumo.inativos)}
              hint={`${resumo.ativos} ativos`}
              alerta={resumo.inativos > 0}
            />
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="text-base font-semibold">Jogadores</h2>
            {jogadores.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                {time?.role === "coach"
                  ? "Nenhum jogador atribuído a você ainda. Um administrador faz essa atribuição na tela do time."
                  : "Nenhum jogador no time ainda. Envie um convite para começar."}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      <th className="pb-2 pr-3">Jogador</th>
                      <th className="pb-2 pr-3">Nível</th>
                      <th className="pb-2 pr-3">Treinos</th>
                      <th className="pb-2 pr-3">Acerto GTO</th>
                      <th className="pb-2 pr-3">Revisadas</th>
                      <th className="pb-2 pr-3">Enviadas</th>
                      <th className="pb-2">Atividade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {jogadores.map((j) => {
                      const dias = diasSemAtividade(j.lastActivityAt);
                      const inativo = dias === null || dias >= INATIVO_DIAS;
                      const pct = j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null;
                      return (
                        <tr key={j.userId} className="text-ink/90 transition-colors hover:bg-elevated/60">
                          <td className="py-2.5 pr-3 font-medium">
                            <Link href={`/time/jogador/${j.userId}`} className="hover:underline">
                              {j.nome}
                            </Link>
                            {j.streakDays ? (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-evolution">
                                <Flame size={11} />
                                {j.streakDays}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-3 tnum">{j.level ?? "—"}</td>
                          <td className="py-2.5 pr-3 tnum">{j.treinos}</td>
                          <td className="py-2.5 pr-3 tnum">{pct === null ? "—" : `${pct}%`}</td>
                          <td className="py-2.5 pr-3 tnum">{j.maosRevisadas}</td>
                          <td className="py-2.5 pr-3 tnum">{j.maosCompartilhadas}</td>
                          <td className="py-2.5">
                            <span className={inativo ? "text-negative" : "text-muted"}>
                              {dias === null ? "nunca" : dias === 0 ? "hoje" : `há ${dias}d`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="text-base font-semibold">Leaks mais frequentes</h2>
            <p className="mt-1 text-sm text-muted">
              Vem das avaliações de rua feitas no Revisor de Mãos, no período selecionado.
            </p>
            {leaks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Ainda não há erros classificados neste período.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {leaks.map((l) => {
                  const maior = leaks[0].total || 1;
                  return (
                    <li key={l.reasonCode} className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[13px] font-medium">{l.label}</span>
                        <span className="shrink-0 text-xs text-muted tnum">
                          {l.total}× · {l.jogadores} jogador(es)
                        </span>
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
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  alerta,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
  hint?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icon size={13} className={alerta ? "text-negative" : ""} />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tnum ${alerta ? "text-negative" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
