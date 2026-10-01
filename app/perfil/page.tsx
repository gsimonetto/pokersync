"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { Award, BarChart3, Flame, Medal, Pencil, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { PainelCard } from "@/components/painel/painel-card";
import { AvatarNivel } from "@/components/avatar-nivel";
import { EmblemaEstilos, EmblemaPatente } from "@/components/hub/patentes/emblema";
import { SeloFundador } from "@/components/achievements/selo-fundador";
import { FounderCard } from "@/components/achievements/founder-card";
import { createClient } from "@/lib/supabase/client";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { fetchMeuBanner, fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchProgress, levelColor, levelMaterial, levelSubTier, type Progress } from "@/lib/services/xp-service";
import { fetchRankingTemporada } from "@/lib/services/ranking-service";
import { fetchMyAchievements, type Achievement } from "@/lib/services/achievements-service";
import { fetchTournamentMetrics } from "@/lib/services/analysis-service";
import { fetchTrainingAccuracy } from "@/lib/services/drill-service";
import { listSessionsWithCount, type HandSessionWithCount } from "@/lib/services/hand-session-service";
import { fetchTournamentPayouts, type TournamentPayout } from "@/lib/services/tournament-payout-service";
import type { TournamentMetrics } from "@/types/analysis";

// Meu perfil (pedido explícito: "um botão com ícone de um boneco no topo,
// para o jogador clicar e ver sua própria ficha e troféus, seu perfil
// LinkedIn"). Capa + foto + patente no topo, e embaixo três blocos: os
// números de jogador, os troféus dos torneios e as conquistas do
// PokerSync. Só o próprio jogador vê esta página.
//
// Cada parte carrega sozinha: se uma falhar (ex.: sem torneios ainda), as
// outras aparecem normalmente.

const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const diaMes = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

interface Trofeus {
  titulos: number;
  podios: number;
  mesasFinais: number;
  melhores: { s: HandSessionWithCount; lugar: number; inscritos: number | null; premio: number | null }[];
}

function montarTrofeus(sessoes: HandSessionWithCount[], payouts: TournamentPayout[]): Trofeus {
  const porId = new Map(payouts.filter((p) => p.tournamentIdPs).map((p) => [p.tournamentIdPs as string, p]));
  const torneios = sessoes.filter((s) => s.kind === "tournament");
  const titulos = torneios.filter((s) => s.champion).length;
  const podios = torneios.filter((s) => !s.champion && (s.final_place === 2 || s.final_place === 3)).length;
  const mesasFinais = titulos + podios + torneios.filter((s) => !s.champion && s.final_place == null && s.reached_ft).length;
  // Melhores colocações: pela fração do field que ficou pra trás (1º de
  // 1.000 vale mais que 1º de 6).
  const melhores = torneios
    .map((s) => {
      const p = s.tournament_id_ps ? porId.get(s.tournament_id_ps) : undefined;
      const lugar = s.champion ? 1 : (p?.heroFinishPlace ?? s.final_place ?? null);
      return lugar ? { s, lugar, inscritos: p?.totalEntrants ?? null, premio: p?.heroPayoutAmount ?? null } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.lugar / (a.inscritos ?? a.lugar * 10) - b.lugar / (b.inscritos ?? b.lugar * 10))
    .slice(0, 5);
  return { titulos, podios, mesasFinais, melhores };
}

function Numero({ rotulo, valor, detalhe, cor }: { rotulo: string; valor: string; detalhe?: string; cor?: string }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <span className="text-[11px] text-muted">{rotulo}</span>
      <span className="tnum truncate text-[22px] font-bold leading-none tracking-[-0.02em]" style={{ color: cor }}>
        {valor}
      </span>
      {detalhe && <span className="truncate text-[11px] text-muted/80">{detalhe}</span>}
    </li>
  );
}

function Taca({ icone, cor, valor, rotulo }: { icone: React.ReactNode; cor: string; valor: number; rotulo: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-2 py-4 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: `${cor}1F`, color: cor, boxShadow: valor > 0 ? `0 0 18px ${cor}40` : undefined }}>
        {icone}
      </span>
      <span className="tnum text-[24px] font-bold leading-none text-ink">{valor}</span>
      <span className="text-[11.5px] text-muted">{rotulo}</span>
    </li>
  );
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [posicao, setPosicao] = useState<{ lugar: number; total: number } | null>(null);
  const [conquistas, setConquistas] = useState<Achievement[]>([]);
  const [cartaFundador, setCartaFundador] = useState<Achievement | null>(null);
  const [metricas, setMetricas] = useState<TournamentMetrics | null>(null);
  const [treino, setTreino] = useState<{ hits: number; total: number } | null>(null);
  const [revisao, setRevisao] = useState<{ vistas: number; analisadas: number } | null>(null);
  const [trofeus, setTrofeus] = useState<Trofeus | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!vivo) return;
      if (data.user?.created_at) setDesde(data.user.created_at);
      await Promise.allSettled([
        fetchProfile().then((p) => vivo && setPerfil(p)),
        fetchMeuBanner().then((b) => vivo && setBanner(b ?? null)),
        fetchProgress().then((p) => vivo && setProgress(p)),
        fetchMyAchievements().then((c) => vivo && setConquistas(c)),
        fetchRankingTemporada("global", 200).then((r) => {
          const eu = r.jogadores.find((j) => j.souEu);
          if (vivo && eu?.posicao) setPosicao({ lugar: eu.posicao, total: r.total });
        }),
        fetchTournamentMetrics().then((m) => vivo && setMetricas(m)),
        fetchTrainingAccuracy().then((t) => vivo && setTreino(t)),
        uid
          ? Promise.all([
              supabase.from("hand_reviews").select("id", { count: "exact", head: true }).eq("user_id", uid).not("viewed_in_replayer_at", "is", null),
              supabase.from("hand_reviews").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "concluida"),
            ]).then(([a, b]) => vivo && setRevisao({ vistas: a.count ?? 0, analisadas: b.count ?? 0 }))
          : Promise.resolve(),
        uid
          ? Promise.all([listSessionsWithCount(uid), fetchTournamentPayouts()]).then(([s, p]) => vivo && setTrofeus(montarTrofeus(s, p)))
          : Promise.resolve(),
      ]);
      if (vivo) setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const nivel = progress?.level ?? 1;
  const cor = levelColor(nivel);
  const nome = perfil?.nome || perfil?.apelido || "Jogador";
  const fundador = conquistas.find((c) => c.code === "founder");

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6">
            <PerfEstilos />
            <EmblemaEstilos />

            {/* Cabeçalho estilo LinkedIn: capa, foto sobreposta, nome e patente. */}
            <section className="painel-vidro mb-4 overflow-hidden rounded-3xl border border-white/10">
              <div
                className="relative h-32 sm:h-44"
                style={{ background: banner ? undefined : `radial-gradient(120% 140% at 15% 0%, ${cor}55, transparent 60%), linear-gradient(135deg, #17130a, #0b0b0d 60%)` }}
              >
                {banner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />
                )}
                <Link
                  href="/configuracoes"
                  className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-ink backdrop-blur transition hover:bg-black/70"
                >
                  <Pencil size={13} /> Editar perfil
                </Link>
              </div>
              <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
                <div className="-mt-12 shrink-0 sm:-mt-14">
                  <div className="rounded-[22px] bg-[#0b0b0d] p-1.5">
                    <AvatarNivel avatarId={perfil?.avatar_id ?? 1} avatarUrl={perfil?.avatar_url} tamanho={104} nivel={progress?.level ?? null} xpAtual={progress?.xp_current ?? null} quadrado brilho />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {nome}
                    {fundador && (
                      <button type="button" onClick={() => setCartaFundador(fundador)} title={fundador.label} className="inline-flex">
                        <SeloFundador tamanho={30} animar={false} />
                      </button>
                    )}
                  </h1>
                  <p className="mt-1 text-[13px] text-muted">
                    {perfil?.apelido && (
                      <span>
                        @{perfil.apelido}
                        {perfil.friend_code ? <span className="text-muted/70">#{perfil.friend_code}</span> : null}
                      </span>
                    )}
                    {desde && <span> · no PokerSync desde {mesAno.format(new Date(desde))}</span>}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span className="font-semibold" style={{ color: cor }}>
                      {levelMaterial(nivel)} {levelSubTier(nivel)} · Nível {nivel}
                    </span>
                    {progress && <span className="text-muted">{progress.xp_total.toLocaleString("pt-BR")} XP no total</span>}
                    {progress && progress.streak_days > 0 && (
                      <span className="inline-flex items-center gap-1 text-[#F97316]">
                        <Flame size={13} /> {progress.streak_days} {progress.streak_days === 1 ? "dia" : "dias"} seguidos
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                  <EmblemaPatente nivel={nivel} tamanho={56} animar={false} halo={false} />
                  <div>
                    <p className="text-[11px] text-muted">Ranking da temporada</p>
                    <p className="tnum text-[20px] font-bold leading-tight text-ink">{posicao ? `${posicao.lugar}º` : "—"}</p>
                    <p className="text-[11px] text-muted">{posicao ? `de ${posicao.total} jogadores` : "sem pontos ainda"}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <div className="flex min-w-0 flex-col gap-3.5">
                <PainelCard title="Números de jogador" icon={<BarChart3 size={15} />} ordem={0} rolagem={false}>
                  {carregando && !metricas ? (
                    <div className="painel-esqueleto h-[180px] rounded-2xl" />
                  ) : (
                    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <Numero rotulo="Torneios jogados" valor={String(metricas?.total_games ?? 0)} detalhe={metricas?.active_days ? `em ${metricas.active_days} dias` : undefined} />
                      <Numero rotulo="ITM" valor={pct(metricas?.itm_pct)} detalhe="ficou no dinheiro" />
                      <Numero
                        rotulo="ROI"
                        valor={metricas?.roi_pct == null ? "—" : `${metricas.roi_pct > 0 ? "+" : ""}${pct(metricas.roi_pct)}`}
                        cor={metricas?.roi_pct == null ? undefined : metricas.roi_pct >= 0 ? "#34D399" : "#F87171"}
                        detalhe="lucro ÷ investido"
                      />
                      <Numero
                        rotulo="Lucro em torneios"
                        valor={metricas?.total_profit == null ? "—" : fmtSignedMoneyIn(metricas.total_profit, "USD")}
                        cor={metricas?.total_profit == null ? undefined : metricas.total_profit >= 0 ? "#34D399" : "#F87171"}
                        detalhe={metricas?.total_invested ? `investido ${fmtMoneyIn(metricas.total_invested, "USD")}` : undefined}
                      />
                      <Numero
                        rotulo="Bounties ganhos"
                        valor={String(metricas?.total_bounties_won ?? 0)}
                        detalhe={metricas?.total_bounty_cash_won ? fmtMoneyIn(metricas.total_bounty_cash_won, "USD") : "eliminações em PKO"}
                      />
                      <Numero rotulo="Mãos revisadas" valor={String(revisao?.vistas ?? 0)} detalhe={`${revisao?.analisadas ?? 0} com análise`} />
                      <Numero
                        rotulo="Treinos feitos"
                        valor={String(treino?.total ?? 0)}
                        detalhe={treino && treino.total > 0 ? `${Math.round((treino.hits / treino.total) * 100)}% de acerto` : "no modo Treino"}
                      />
                      <Numero
                        rotulo="Maior sequência"
                        valor={`${progress?.streak_best ?? 0}`}
                        detalhe={(progress?.streak_best ?? 0) === 1 ? "dia seguido" : "dias seguidos"}
                      />
                    </ul>
                  )}
                </PainelCard>

                <PainelCard title="Troféus" icon={<Trophy size={15} />} ordem={1} rolagem={false}>
                  {!trofeus ? (
                    <div className="painel-esqueleto h-[160px] rounded-2xl" />
                  ) : (
                    <>
                      <ul className="grid grid-cols-3 gap-2.5">
                        <Taca icone={<Trophy size={20} />} cor="#E0B24C" valor={trofeus.titulos} rotulo={trofeus.titulos === 1 ? "Título" : "Títulos"} />
                        <Taca icone={<Medal size={20} />} cor="#C0C6CC" valor={trofeus.podios} rotulo="Pódios (2º e 3º)" />
                        <Taca icone={<Award size={20} />} cor="#A855F7" valor={trofeus.mesasFinais} rotulo={trofeus.mesasFinais === 1 ? "Mesa final" : "Mesas finais"} />
                      </ul>
                      <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted/80">Melhores colocações</p>
                      {trofeus.melhores.length === 0 ? (
                        <p className="text-[12.5px] text-muted">Seus torneios aparecem aqui assim que o Radar trouxer o resumo deles.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {trofeus.melhores.map(({ s, lugar, inscritos, premio }) => (
                            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                              <span
                                className="tnum grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-[13px] font-bold"
                                style={
                                  lugar === 1
                                    ? { background: "#E0B24C", color: "#111" }
                                    : lugar <= 3
                                      ? { background: "#C0C6CC", color: "#111" }
                                      : { background: "rgba(255,255,255,0.06)", color: "#fff" }
                                }
                              >
                                {lugar}º
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">{s.label}</span>
                                <span className="block text-[11px] text-muted">
                                  {inscritos ? `de ${inscritos.toLocaleString("pt-BR")} jogadores · ` : ""}
                                  {diaMes.format(new Date(s.updated_at))}
                                </span>
                              </span>
                              {premio != null && premio > 0 && <span className="tnum shrink-0 text-[13px] font-semibold text-[#34D399]">+{fmtMoneyIn(premio, "USD")}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </PainelCard>
              </div>

              <PainelCard title="Conquistas" icon={<Award size={15} />} ordem={2} rolagem={false}>
                {conquistas.length === 0 ? (
                  <p className="text-[12.5px] text-muted">Nenhuma conquista ainda. Elas aparecem aqui quando você desbloquear.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {conquistas.map((c) => (
                      <li key={c.code}>
                        <button
                          type="button"
                          onClick={() => c.code === "founder" && setCartaFundador(c)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition hover:border-white/20"
                        >
                          {c.code === "founder" ? (
                            <SeloFundador tamanho={48} animar={false} />
                          ) : (
                            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#E0B24C]/15 text-[#E0B24C]">
                              <Award size={22} />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-ink">{c.label}</span>
                            <span className="block text-[11.5px] leading-snug text-muted">{c.description}</span>
                            <span className="mt-0.5 block text-[11px] text-muted/80">Desde {diaMes.format(new Date(c.unlockedAt))}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </PainelCard>
            </div>
          </main>
        </MotionConfig>
      </PainelVisual>
      {cartaFundador && (
        <FounderCard open onClose={() => setCartaFundador(null)} description={cartaFundador.description} unlockedAt={cartaFundador.unlockedAt} nome={nome} />
      )}
    </AppShell>
  );
}
