"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Target,
  BookOpen,
  TriangleAlert,
  MessageSquare,
  Eye,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  ALERTA_LABEL,
  diasSemAtividade,
  fetchPlayerActivity,
  fetchPlayerAlerts,
  fetchPlayerDetail,
  fetchPlayerLeaks,
  fetchPlayerSharedHands,
  traduzErroTime,
  type PlayerActivityDay,
  type TeamAlert,
  type PlayerDetail,
  type PlayerSharedHand,
  type TeamLeak,
} from "@/lib/services/team-service";

// Ficha individual do jogador. Quem pode abrir: admin do time, o coach
// responsavel, ou o proprio jogador — a checagem esta nas RPCs, esta
// tela so mostra o erro que voltar.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

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
  const [leaks, setLeaks] = useState<TeamLeak[]>([]);
  const [maos, setMaos] = useState<PlayerSharedHand[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [d, a, l, m, al] = await Promise.all([
        fetchPlayerDetail(id, dias),
        fetchPlayerActivity(id, dias),
        fetchPlayerLeaks(id, dias),
        fetchPlayerSharedHands(id),
        fetchPlayerAlerts(id).catch(() => []),
      ]);
      setP(d);
      setAtividade(a);
      setLeaks(l);
      setMaos(m);
      setAlertas(al);
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
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/time/painel"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>

        {p && <Avatar id={p.avatarId} url={p.avatarUrl} size={38} />}

        <div className="flex-1">
          <h1 className="m-0 text-xl font-semibold tracking-tight">{p?.nome ?? "Jogador"}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {p
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
              : "Carregando…"}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          {PERIODOS.map((op) => (
            <button
              key={op.days}
              onClick={() => setDias(op.days)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                dias === op.days ? "bg-ink text-void" : "text-muted hover:text-ink"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </header>

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : !p ? (
        <p className="text-sm text-muted">Jogador não encontrado.</p>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Target} label="Treinos" value={String(p.treinos)} hint={`${p.xpPeriodo} XP no período`} />
            <Kpi
              icon={Flame}
              label="Acerto GTO"
              value={acertoPct === null ? "—" : `${acertoPct}%`}
              hint={p.errosGraves > 0 ? `${p.errosGraves} erro(s) grave(s)` : undefined}
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

          <section className="rounded-xl border border-hairline bg-surface p-6">
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
          </section>

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
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        a.kind === "lembrete_estudo"
                          ? "border-hairline text-muted"
                          : "border-evolution/50 text-evolution"
                      }`}
                    >
                      {ALERTA_LABEL[a.kind]}
                    </span>
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
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tnum">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
