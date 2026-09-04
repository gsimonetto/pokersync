"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Target, Trophy, MessageSquare, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";
import { fetchTournamentSessions } from "@/lib/services/analysis-service";
import { fetchTournamentPayouts } from "@/lib/services/tournament-payout-service";
import { fetchMyAchievements, type Achievement } from "@/lib/services/achievements-service";
import { Modal } from "@/components/ui/modal";
import { MinhasMetasModalBody } from "@/components/goals/minhas-metas-modal";
import { RecadosCoachModalBody } from "@/components/goals/recados-coach-modal";
import { fetchGoals } from "@/lib/services/bankroll-service";
import { fetchPlayerGoals, fetchPlayerAlerts } from "@/lib/services/team-service";
import { todayISO } from "@/lib/bankroll/format";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Icone por conquista do catalogo (ver migracao achievements) --
// fallback Trophy pra qualquer conquista futura sem icone proprio
// mapeado aqui ainda.
const ACHIEVEMENT_ICON: Record<string, LucideIcon> = {
  founder: Trophy,
};

function fmtPct(v: number | null | undefined, digits = 1): string | null {
  if (v === null || v === undefined) return null;
  return `${Number(v).toFixed(digits)}%`;
}

function calcAge(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const birth = new Date(dataNascimento);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function ModulosPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [team, setTeam] = useState<{ name: string; accent: string } | null>(null);
  const [perf, setPerf] = useState<PlayerPerformance | null>(null);
  const [avgBuyin, setAvgBuyin] = useState<number | null>(null);
  const [totalGanhos, setTotalGanhos] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const [metasModalOpen, setMetasModalOpen] = useState(false);
  const [coachModalOpen, setCoachModalOpen] = useState(false);
  const [metasDot, setMetasDot] = useState(false);
  const [coachDot, setCoachDot] = useState(false);

  // Bolinha discreta nos cards abaixo: so' liga quando tem algo que
  // vale a pena abrir pra ver -- meta pessoal com prazo proximo (<=2
  // dias) pro card de Metas; meta do coach proxima do prazo ou alerta
  // dos ultimos 3 dias pro card de Recados. Busca leve, separada do que
  // a modal carrega quando abre (essa so' checa, nao renderiza nada).
  useEffect(() => {
    let alive = true;
    (async () => {
      const hoje = todayISO();
      const emDoisDias = new Date();
      emDoisDias.setDate(emDoisDias.getDate() + 2);
      const limiteISO = emDoisDias.toISOString().slice(0, 10);

      try {
        const goals = await fetchGoals();
        if (!alive) return;
        setMetasDot(goals.some((g) => g.deadline >= hoje && g.deadline <= limiteISO));
      } catch {
        // sem permissao/erro de rede: card fica sem bolinha, nao quebra a tela
      }

      const { data: userData } = await createClient().auth.getUser();
      const meId = userData.user?.id;
      if (!meId) return;
      try {
        const [metas, alertas] = await Promise.all([fetchPlayerGoals(meId), fetchPlayerAlerts(meId)]);
        if (!alive) return;
        const metaProxima = metas.some((m) => !m.finalizada && m.deadline >= hoje && m.deadline <= limiteISO);
        const alertaRecente = alertas.some((a) => Date.now() - new Date(a.createdAt).getTime() < 3 * 86400000);
        setCoachDot(metaProxima || alertaRecente);
      } catch {
        // sem time/sem permissao: card de Recados nem aparece (ver JSX)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      // createClient() lanca sincrono se as envs do Supabase nao
      // estiverem configuradas -- sem o try/catch essa excecao vira uma
      // unhandled rejection (a IIFE inteira rejeita antes do primeiro
      // await), mesmo padrao defensivo ja usado em components/top-nav.tsx.
      let supabase: ReturnType<typeof createClient>;
      try {
        supabase = createClient();
      } catch {
        return;
      }
      const [profileRes, userRes, progressRes, perfRes, tournSessionsRes, achievementsRes, payoutsRes] = await Promise.allSettled([
        fetchProfile(),
        supabase.auth.getUser(),
        supabase.from("user_progress").select("level").maybeSingle(),
        fetchPlayerPerformance(),
        fetchTournamentSessions(),
        fetchMyAchievements(),
        fetchTournamentPayouts(),
      ]);
      if (!alive) return;

      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (progressRes.status === "fulfilled") setLevel(progressRes.value.data?.level ?? null);
      if (perfRes.status === "fulfilled") setPerf(perfRes.value);
      if (achievementsRes.status === "fulfilled") setAchievements(achievementsRes.value);

      // Buy-in médio / Ganhos totais: SÓ das mãos importadas (hand_sessions
      // + tournament_payouts, mesma fonte do Revisor), nunca de
      // bankroll_sessions (Gestão de Banca) -- excluir uma sessão na Banca
      // não pode mudar esses números. Ganhos totais é soma BRUTA do que
      // cada torneio pagou (sem subtrair buy-in nem saque, diferente do
      // "Lucro total" líquido que já existe na Banca).
      if (tournSessionsRes.status === "fulfilled") {
        const tournSessions = tournSessionsRes.value;
        const buyins = tournSessions.map((s) => s.buyin).filter((b): b is number => b != null);
        setAvgBuyin(buyins.length > 0 ? buyins.reduce((a, b) => a + b, 0) / buyins.length : null);

        if (payoutsRes.status === "fulfilled") {
          const payoutByTournament = new Map(payoutsRes.value.map((p) => [p.tournamentIdPs, p]));
          const ganhos = tournSessions
            .map((s) => (s.tournament_id_ps ? payoutByTournament.get(s.tournament_id_ps)?.heroPayoutAmount : null))
            .filter((v): v is number => v != null);
          setTotalGanhos(ganhos.length > 0 ? ganhos.reduce((a, b) => a + b, 0) : null);
        }
      }

      // Time: precisa do user.id da chamada de auth acima -- RLS de
      // team_members libera todo membro do mesmo time, entao o filtro por
      // user_id evita juntar as N linhas do time inteiro.
      if (userRes.status === "fulfilled") {
        const userId = userRes.value.data.user?.id;
        if (userId) {
          const { data: teamRow } = await supabase
            .from("team_members")
            .select("teams ( name, accent )")
            .eq("user_id", userId)
            .maybeSingle();
          if (!alive) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const teamData = teamRow?.teams as any;
          if (teamData) setTeam({ name: teamData.name, accent: teamData.accent });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const displayName = profile?.apelido || profile?.nome || "Jogador";
  const age = useMemo(() => calcAge(profile?.data_nascimento ?? null), [profile]);

  return (
    <AppShell>
      <main className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6">
        {/* Card de perfil: foto (coluna 1) + dados do jogador (coluna 2)
            + metricas mais relevantes (coluna 3), mesma ordem/estilo de
            linha -- estrutura pedida pelo usuario. Buy-in medio e Ganhos
            totais vem de hand_sessions + tournament_payouts (mesma fonte
            do Revisor de Maos/Player Evolution), NUNCA de bankroll_sessions
            (Gestao de Banca) -- cada modulo trata a mesma mao importada do
            seu proprio jeito (ver handleRemove em app/banca/page.tsx e o
            comentario equivalente em StatisticsTab.tsx), entao excluir uma
            sessao na Banca nao muda esses dois numeros aqui. */}
        <section className="group flex shrink-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface transition-all duration-300 hover:border-white/15 hover:shadow-[0_0_40px_-12px_rgba(255,255,255,0.18)] sm:flex-row">
          <div className="mx-auto flex aspect-square w-full max-w-[220px] shrink-0 items-center justify-center overflow-hidden bg-elevated p-4 sm:mx-0 sm:aspect-auto sm:h-auto sm:w-[220px] sm:max-w-none">
            <Avatar
              id={profile?.avatar_id ?? 1}
              url={profile?.avatar_url}
              shape="square"
              size={190}
              className="shrink-0 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>

          <div className="flex-1 p-5">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight text-ink">{displayName}</h2>
              {profile?.nome && profile.nome !== displayName && (
                <p className="mt-0.5 text-sm text-muted">{profile.nome}</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Idade</span>
                  <span className="text-sm text-ink">{age !== null ? `${age} anos` : "—"}</span>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Time atual</span>
                  <MetricValue href={team ? "/time" : undefined}>{team?.name ?? "Sem time"}</MetricValue>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Ganhos totais</span>
                  <MetricValue href="/performance" mono>
                    {totalGanhos != null ? BRL.format(totalGanhos) : "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Buy-in médio</span>
                  <MetricValue href="/performance" mono>
                    {avgBuyin != null ? BRL.format(avgBuyin) : "—"}
                  </MetricValue>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">VPIP</span>
                  <MetricValue href="/performance" mono>
                    {fmtPct(perf?.vpip_pct) ?? "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">3-Bet</span>
                  <MetricValue href="/performance" mono>
                    {fmtPct(perf?.three_bet_pct) ?? "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">ROI acumulado</span>
                  <Link
                    href="/performance"
                    className={`text-sm font-semibold tabular-nums transition-colors hover:underline ${
                      perf?.roi_pct != null ? (Number(perf.roi_pct) >= 0 ? "text-positive" : "text-negative") : "text-ink"
                    }`}
                  >
                    {perf?.roi_pct != null ? `${Number(perf.roi_pct) >= 0 ? "+" : ""}${fmtPct(perf.roi_pct)}` : "—"}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">ITM aproximado</span>
                  <MetricValue href="/performance" mono>
                    {fmtPct(perf?.itm_pct_aproximado) ?? "—"}
                  </MetricValue>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Nível</span>
                  <MetricValue href="/hub" mono>
                    {level != null ? level : "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Sessões</span>
                  <MetricValue href="/performance" mono>
                    {perf?.num_sessoes ?? "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between border-b border-hairline/50 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Horas jogadas</span>
                  <MetricValue href="/performance" mono>
                    {perf?.horas_jogadas != null ? `${perf.horas_jogadas}h` : "—"}
                  </MetricValue>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Streak atual</span>
                  <MetricValue href="/performance" mono>
                    {perf?.streak_atual != null ? `${perf.streak_atual}d` : "—"}
                  </MetricValue>
                </div>
              </div>
            </div>

            {/* Conquistas PokerSync: pedido explicito pra NAO mostrar
                nenhum selo/placeholder bloqueado enquanto o jogador nao
                tem nenhuma conquista real -- so' o titulo e o espaco
                reservado (min-h), sem numero nem icone inventado. Quando
                achievements vier preenchido (ver achievements-service.ts),
                os selos desbloqueados aparecem aqui, cada um com o icone
                do proprio catalogo (ACHIEVEMENT_ICON, fallback Trophy). */}
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Conquistas PokerSync</p>
              <div className="flex min-h-9 flex-wrap gap-2">
                {achievements.map((a) => {
                  const Icon = ACHIEVEMENT_ICON[a.code] ?? Trophy;
                  return (
                    <div
                      key={a.code}
                      title={a.description}
                      className="grid size-9 place-items-center rounded-lg border border-evolution/40 bg-evolution/10 text-evolution shadow-[0_0_10px_rgba(245,158,11,.3)]"
                    >
                      <Icon size={16} strokeWidth={1.75} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Minhas Metas + Recados do Coach: menu compacto, 2 itens lado a
            lado (nao mais 2 cards grandes de modulo) -- so' icone, label e
            bolinha de notificacao, abrindo modal ao clicar. Frequencias
            pre-flop saiu daqui: ja existe em Player Evolution, duplicar so'
            inflava a tela sem necessidade. Sem time, so' o item de Metas
            aparece (ocupa a linha inteira, sem coluna vazia do lado). */}
        <div className={`grid divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface ${team ? "grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0" : "grid-cols-1"}`}>
          <button
            onClick={() => setMetasModalOpen(true)}
            className="group flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-elevated"
          >
            <div className="relative shrink-0">
              <div className="flex size-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-[#E0954C]">
                <Target size={16} />
              </div>
              {metasDot && (
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-negative" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink">Minhas Metas</p>
              <p className="truncate text-[11px] text-muted">Volume, estudo e prazo de conclusão</p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-muted opacity-0 transition-all duration-200 group-hover:opacity-100" />
          </button>

          {team && (
            <button
              onClick={() => setCoachModalOpen(true)}
              className="group flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-elevated"
            >
              <div className="relative shrink-0">
                <div className="flex size-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-[#7C83E0]">
                  <MessageSquare size={16} />
                </div>
                {coachDot && (
                  <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-negative" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">Recados do Coach</p>
                <p className="truncate text-[11px] text-muted">Metas, funil, checklist e alertas</p>
              </div>
              <ArrowRight size={14} className="shrink-0 text-muted opacity-0 transition-all duration-200 group-hover:opacity-100" />
            </button>
          )}
        </div>
      </main>

      <Modal open={metasModalOpen} onClose={() => setMetasModalOpen(false)} title="Minhas Metas" wide>
        <MinhasMetasModalBody />
      </Modal>

      <Modal open={coachModalOpen} onClose={() => setCoachModalOpen(false)} title="Recados do Coach" wide>
        <RecadosCoachModalBody />
      </Modal>
    </AppShell>
  );
}

// Valor de metrica clicavel: leva direto pro modulo que produz aquele
// numero (ex: VPIP -> Player Evolution, Nivel -> Hub). Sem href, cai pro
// span estatico de sempre (ex: "Sem time").
function MetricValue({ href, mono, children }: { href?: string; mono?: boolean; children: React.ReactNode }) {
  const cls = `text-sm text-ink ${mono ? "tabular-nums" : ""}`;
  if (!href) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={`${cls} transition-colors hover:text-training hover:underline`}>
      {children}
    </Link>
  );
}

