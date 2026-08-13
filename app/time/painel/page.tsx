"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  Flame,
  TriangleAlert,
  BookOpen,
  Target,
  Wallet,
  Gamepad2,
  Printer,
} from "lucide-react";
import {
  diasSemAtividade,
  fetchMyTeam,
  fetchTeamActivity,
  fetchTeamDashboard,
  fetchTeamLeaks,
  traduzErroTime,
  type MyTeam,
  type TeamActivityDay,
  type TeamDashboardRow,
  type TeamLeak,
} from "@/lib/services/team-service";

// Painel do time — dashboard unico: visao geral, evolucao e financeiro
// (jogos e lucro contam desde que o jogador ACEITOU O CONVITE, sempre,
// independente do filtro de periodo abaixo, que so afeta estudo).
// Admin ve o time inteiro; coach ve so os jogadores atribuidos a ele —
// quem filtra e' a RPC no banco, nao esta tela.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

const PERIODOS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const INATIVO_DIAS = 7;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function PainelTimePage() {
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [pronto, setPronto] = useState(false); // dispara as animacoes de entrada
  const [erro, setErro] = useState<string | null>(null);
  const [time, setTime] = useState<MyTeam | null>(null);
  const [linhas, setLinhas] = useState<TeamDashboardRow[]>([]);
  const [leaks, setLeaks] = useState<TeamLeak[]>([]);
  const [atividade, setAtividade] = useState<TeamActivityDay[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setPronto(false);
    setErro(null);
    try {
      const [t, rows, lk, at] = await Promise.all([
        fetchMyTeam(),
        fetchTeamDashboard(dias),
        fetchTeamLeaks(dias),
        fetchTeamActivity(dias),
      ]);
      setTime(t);
      setLinhas(rows);
      setLeaks(lk);
      setAtividade(at);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => setPronto(true));
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
    const jogos = jogadores.reduce((a, j) => a + j.jogosNoTime, 0);
    const lucro = jogadores.reduce((a, j) => a + j.lucroNoTime, 0);
    const inativos = jogadores.filter((j) => {
      const d = diasSemAtividade(j.lastActivityAt);
      return d === null || d >= INATIVO_DIAS;
    }).length;
    return {
      treinos,
      acertoPct: treinos > 0 ? Math.round((acertos / treinos) * 100) : null,
      revisadas,
      jogos,
      lucro,
      inativos,
      ativos: jogadores.length - inativos,
    };
  }, [jogadores]);

  const maxAtividade = Math.max(1, ...atividade.map((d) => d.treinos + d.revisoes));

  function imprimir() {
    window.print();
  }

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10 text-ink print:max-w-full print:p-0">
        <header className="mb-6 flex flex-wrap items-center gap-3 print:mb-4">
          <Link
            href="/time"
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
          <LayoutDashboard size={20} style={{ color: time?.team.accent ?? "#5AA6E0" }} className="print:hidden" />
          <div className="flex-1">
            <h1 className="m-0 text-xl font-semibold tracking-tight">
              Painel {time ? `— ${time.team.name}` : "do time"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {time?.role === "coach" ? "Seus jogadores acompanhados" : "Visão geral da organização"}
              <span className="hidden print:inline"> · gerado em {new Date().toLocaleDateString("pt-BR")}</span>
            </p>
          </div>

          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1 print:hidden">
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

          <button
            onClick={imprimir}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 print:hidden"
          >
            <Printer size={15} />
            Imprimir / PDF
          </button>
        </header>

        {erro && (
          <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative print:hidden">
            {erro}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted">Carregando painel…</p>
        ) : (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
              <Kpi delay={0} pronto={pronto} icon={Target} label="Treinos no período" value={String(resumo.treinos)} />
              <Kpi
                delay={40}
                pronto={pronto}
                icon={Flame}
                label="Acerto GTO"
                value={resumo.acertoPct === null ? "—" : `${resumo.acertoPct}%`}
                hint={resumo.acertoPct === null ? "sem treinos" : undefined}
              />
              <Kpi delay={80} pronto={pronto} icon={BookOpen} label="Mãos revisadas" value={String(resumo.revisadas)} />
              <Kpi
                delay={120}
                pronto={pronto}
                icon={Gamepad2}
                label="Jogos no time"
                value={String(resumo.jogos)}
                hint="desde que entraram"
              />
              <Kpi
                delay={160}
                pronto={pronto}
                icon={Wallet}
                label="Resultado no time"
                value={BRL.format(resumo.lucro)}
                hint="desde que entraram"
                tom={resumo.lucro > 0 ? "positivo" : resumo.lucro < 0 ? "negativo" : undefined}
              />
              <Kpi
                delay={200}
                pronto={pronto}
                icon={TriangleAlert}
                label="Precisam de atenção"
                value={String(resumo.inativos)}
                hint={`${resumo.ativos} ativos`}
                tom={resumo.inativos > 0 ? "negativo" : undefined}
              />
            </section>

            <section
              className={`rounded-xl border border-hairline bg-surface p-6 transition-all duration-500 ${
                pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              <h2 className="text-base font-semibold">Evolução do time</h2>
              <p className="mt-1 text-sm text-muted">Treinos e revisões concluídas por dia, somando todo o escopo.</p>

              <div className="mt-4 flex h-32 items-end gap-[3px] print:h-24">
                {atividade.map((d, i) => {
                  const total = d.treinos + d.revisoes;
                  const alturaTreino = (d.treinos / maxAtividade) * 100;
                  const alturaRevisao = (d.revisoes / maxAtividade) * 100;
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
                          <div
                            className="w-full rounded-t-sm bg-review transition-all ease-out"
                            style={{
                              height: pronto ? `${alturaRevisao}%` : "0%",
                              transitionDuration: "700ms",
                              transitionDelay: `${Math.min(i * 12, 400)}ms`,
                            }}
                          />
                          <div
                            className="w-full rounded-b-sm bg-training transition-all ease-out"
                            style={{
                              height: pronto ? `${alturaTreino}%` : "0%",
                              transitionDuration: "700ms",
                              transitionDelay: `${Math.min(i * 12, 400)}ms`,
                            }}
                          />
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

            <section
              className={`rounded-xl border border-hairline bg-surface p-6 transition-all duration-500 delay-100 ${
                pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              <h2 className="text-base font-semibold">Jogadores</h2>
              <p className="mt-1 text-sm text-muted">
                Jogos e resultado contam a partir da data em que cada jogador entrou no time.
              </p>

              {jogadores.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {time?.role === "coach"
                    ? "Nenhum jogador atribuído a você ainda. Um administrador faz essa atribuição na tela do time."
                    : "Nenhum jogador no time ainda. Envie um convite para começar."}
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm print:min-w-0 print:text-xs">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        <th className="pb-2 pr-3">Jogador</th>
                        <th className="pb-2 pr-3">Nível</th>
                        <th className="pb-2 pr-3">Treinos</th>
                        <th className="pb-2 pr-3">Acerto GTO</th>
                        <th className="pb-2 pr-3">Revisadas</th>
                        <th className="pb-2 pr-3">Jogos</th>
                        <th className="pb-2 pr-3">Resultado</th>
                        <th className="pb-2">Atividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {jogadores.map((j) => {
                        const d = diasSemAtividade(j.lastActivityAt);
                        const inativo = d === null || d >= INATIVO_DIAS;
                        const pct = j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null;
                        return (
                          <tr key={j.userId} className="text-ink/90">
                            <td className="py-2.5 pr-3 font-medium">
                              <Link href={`/time/jogador/${j.userId}`} className="hover:underline print:no-underline">
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
                            <td className="py-2.5 pr-3 tnum">{j.jogosNoTime}</td>
                            <td
                              className={`py-2.5 pr-3 tnum font-medium ${
                                j.lucroNoTime > 0 ? "text-positive" : j.lucroNoTime < 0 ? "text-negative" : ""
                              }`}
                            >
                              {j.jogosNoTime > 0 ? BRL.format(j.lucroNoTime) : "—"}
                            </td>
                            <td className="py-2.5">
                              <span className={inativo ? "text-negative" : "text-muted"}>
                                {d === null ? "nunca" : d === 0 ? "hoje" : `há ${d}d`}
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

            <section
              className={`rounded-xl border border-hairline bg-surface p-6 transition-all duration-500 delay-150 ${
                pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              } print:break-inside-avoid`}
            >
              <h2 className="text-base font-semibold">Leaks mais frequentes</h2>
              <p className="mt-1 text-sm text-muted">
                Vem das avaliações de rua feitas no Revisor de Mãos, no período selecionado.
              </p>
              {leaks.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Ainda não há erros classificados neste período.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {leaks.map((l, i) => {
                    const maior = leaks[0].total || 1;
                    const largura = Math.max(6, Math.round((l.total / maior) * 100));
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
                            className="h-full rounded-full bg-review transition-all ease-out"
                            style={{
                              width: pronto ? `${largura}%` : "0%",
                              transitionDuration: "600ms",
                              transitionDelay: `${150 + i * 40}ms`,
                            }}
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

      {/* Folha de impressao: esconde chrome interativo, forca fundo
          claro para nao gastar tinta preta em impressao real. */}
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #111 !important;
          }
          .text-ink,
          .text-ink\\/90,
          .font-medium,
          .font-semibold {
            color: #111 !important;
          }
          .text-muted {
            color: #555 !important;
          }
          .bg-surface,
          .bg-elevated {
            background: #fff !important;
            border-color: #ddd !important;
          }
          .border-hairline {
            border-color: #ddd !important;
          }
          @page {
            margin: 14mm;
          }
        }
      `}</style>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tom,
  pronto,
  delay = 0,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tom?: "positivo" | "negativo";
  pronto: boolean;
  delay?: number;
}) {
  const cor = tom === "positivo" ? "text-positive" : tom === "negativo" ? "text-negative" : "text-ink";
  return (
    <div
      className="rounded-xl border border-hairline bg-surface p-4 transition-all ease-out print:break-inside-avoid"
      style={{
        opacity: pronto ? 1 : 0,
        transform: pronto ? "translateY(0)" : "translateY(6px)",
        transitionDuration: "450ms",
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icon size={13} className={tom === "negativo" ? "text-negative" : ""} />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tnum ${cor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
