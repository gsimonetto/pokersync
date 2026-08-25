"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CircleHelp, Settings, LogOut, ArrowRight, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { NotificationsMenu } from "@/components/notifications-menu";
import { HelpMenu } from "@/components/help-menu";
import { ProfileMenu } from "@/components/profile-menu";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import {
  fetchPlayerPerformance,
  fetchPreflopSituations,
  type PlayerPerformance,
  type PreflopSituation,
} from "@/lib/services/performance-service";
import { modules } from "@/lib/modules-data";

// Mesmas faixas de referencia de app/performance/page.tsx (funcao
// Frequencia) -- contexto visual, nunca veredito de certo/errado.
const REF = {
  vpip: { min: 18, max: 28, escala: 60 },
  pfr: { min: 14, max: 22, escala: 60 },
  threeBet: { min: 5, max: 10, escala: 20 },
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

type OpenMenu = "notifications" | "help" | "profile" | null;

export default function ModulosPage() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [team, setTeam] = useState<{ name: string; accent: string } | null>(null);
  const [perf, setPerf] = useState<PlayerPerformance | null>(null);
  const [preflop, setPreflop] = useState<PreflopSituation[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

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
      const [profileRes, userRes, progressRes, unreadRes, perfRes, preflopRes] = await Promise.allSettled([
        fetchProfile(),
        supabase.auth.getUser(),
        supabase.from("user_progress").select("level").maybeSingle(),
        fetchUnreadCount(),
        fetchPlayerPerformance(),
        fetchPreflopSituations(),
      ]);
      if (!alive) return;

      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (progressRes.status === "fulfilled") setLevel(progressRes.value.data?.level ?? null);
      if (unreadRes.status === "fulfilled") setUnread(unreadRes.value);
      if (perfRes.status === "fulfilled") setPerf(perfRes.value);
      if (preflopRes.status === "fulfilled") setPreflop(preflopRes.value);

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

  const foldTo3bet = preflop.find((p) => p.label === "Fold para 3-Bet");
  const blindDefense = preflop.find((p) => p.label === "Defesa de Blinds");

  function toggle(menu: OpenMenu) {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  async function handleLogout() {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // segue o logout mesmo se a chamada falhar
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-void">
      {/* ============ SIDEBAR ============ */}
      <aside className="hidden md:flex h-full w-[264px] shrink-0 flex-col border-r border-hairline bg-surface">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-hairline px-5">
          <Link href="/modulos" aria-label="Ir para Módulos">
            <Logo className="h-7 w-auto" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-hidden px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Módulos</p>
          {modules.map((m) => {
            const Icon = m.icon;
            const active = pathname === m.href;
            return (
              <Link
                key={m.key}
                href={m.href ?? "#"}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-white/[0.06] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                <span
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-opacity"
                  style={{ background: m.accent, opacity: active ? 1 : 0 }}
                />
                <Icon size={18} strokeWidth={1.75} style={{ color: active ? m.accent : undefined }} />
                {m.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-hairline px-3 py-3">
          <button
            onClick={() => toggle("profile")}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <Settings size={18} strokeWidth={1.75} />
            Configurações
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-negative/[0.08] hover:text-negative"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-6">
          <div>
            <h1 className="text-sm font-semibold leading-tight text-ink">Módulos</h1>
            <p className="text-xs text-muted">Bem-vindo de volta, {displayName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                onClick={() => toggle("notifications")}
                className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
                aria-label="Notificações"
              >
                <Bell className="size-[18px]" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-evolution px-1 text-[9px] font-bold leading-[15px] text-void">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {openMenu === "notifications" && (
                <NotificationsMenu
                  onClose={() => {
                    setOpenMenu(null);
                    fetchUnreadCount()
                      .then(setUnread)
                      .catch(() => {});
                  }}
                />
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => toggle("help")}
                className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
                aria-label="Ajuda"
              >
                <CircleHelp className="size-[18px]" />
              </button>
              {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}
            </div>
            <div className="relative">
              <button
                onClick={() => toggle("profile")}
                className="ml-1.5 flex items-center gap-2 rounded-full border border-hairline bg-elevated py-1 pl-1 pr-3 transition-colors hover:border-white/20"
              >
                <Avatar id={profile?.avatar_id ?? 1} url={profile?.avatar_url} size={28} />
                {level != null && <span className="text-xs font-semibold text-ink">Nv. {level}</span>}
              </button>
              {openMenu === "profile" && profile && (
                <ProfileMenu profile={profile} onProfileChange={setProfile} onClose={() => setOpenMenu(null)} />
              )}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          {/* Card de perfil: foto (coluna 1) + dados do jogador (coluna 2)
              + metricas mais relevantes (coluna 3), mesma ordem/estilo de
              linha -- estrutura pedida pelo usuario. Ganhos totais/Ranking
              ainda nao tem fonte de dado real (chegam com o agente
              desktop importando HH/torneios), entao aparecem como "—" com
              nota, igual ao padrao ja usado em ITM aproximado na tela de
              Performance -- nunca numero inventado. */}
          <section className="flex shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface">
            <div className="flex w-[220px] shrink-0 items-center justify-center bg-elevated">
              <Avatar id={profile?.avatar_id ?? 1} url={profile?.avatar_url} size={120} />
            </div>

            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold tracking-tight text-ink">{displayName}</h2>
                  {profile?.nome && profile.nome !== displayName && (
                    <p className="mt-0.5 text-sm text-muted">{profile.nome}</p>
                  )}
                </div>
                {team && (
                  <span
                    className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={{ borderColor: `${team.accent}66`, background: `${team.accent}1A`, color: team.accent }}
                  >
                    {team.name}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-8 border-t border-hairline pt-4">
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Idade</span>
                    <span className="text-sm text-ink">{age !== null ? `${age} anos` : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Time atual</span>
                    <span className="text-sm text-ink">{team?.name ?? "Sem time"}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Ganhos totais</span>
                    <span className="text-sm text-muted">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Ranking</span>
                    <span className="text-sm text-muted">—</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">VPIP</span>
                    <span className="text-sm tabular-nums text-ink">{fmtPct(perf?.vpip_pct) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">3-Bet</span>
                    <span className="text-sm tabular-nums text-ink">{fmtPct(perf?.three_bet_pct) ?? "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-hairline/50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">ROI acumulado</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        perf?.roi_pct != null ? (Number(perf.roi_pct) >= 0 ? "text-positive" : "text-negative") : "text-ink"
                      }`}
                    >
                      {perf?.roi_pct != null ? `${Number(perf.roi_pct) >= 0 ? "+" : ""}${fmtPct(perf.roi_pct)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">ITM aproximado</span>
                    <span className="text-sm tabular-nums text-ink">{fmtPct(perf?.itm_pct_aproximado) ?? "—"}</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 border-t border-hairline pt-3 text-[11px] text-muted/70">
                Ganhos totais, ranking e conquistas chegam com a importação de HH e histórico de torneios pelo agente
                desktop.
              </p>
            </div>
          </section>

          {/* Frequências pré-flop: mesmo componente-régua de
              app/performance/page.tsx (funcao Frequencia). Fold p/ 3-Bet
              e Defesa de Blinds vem de fetchPreflopSituations, mesma fonte
              real usada na aba "Situações pré-flop" da Performance. */}
          <section className="flex shrink-0 flex-col rounded-xl border border-hairline bg-surface p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                <Target size={14} className="text-training" />
                Frequências pré-flop
              </div>
              <Link href="/performance" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                Ver Player Evolution <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <FreqCard label="VPIP" valor={perf?.vpip_pct ?? null} referencia={REF.vpip} />
              <FreqCard label="PFR" valor={perf?.pfr_pct ?? null} referencia={REF.pfr} />
              <FreqCard label="3-Bet" valor={perf?.three_bet_pct ?? null} referencia={REF.threeBet} />
              <FreqSimples label="Fold p/ 3-Bet" pct={foldTo3bet?.pct ?? null} sample={foldTo3bet?.sample ?? null} />
              <FreqSimples label="Defesa de Blinds" pct={blindDefense?.pct ?? null} sample={blindDefense?.sample ?? null} />
            </div>

            <p className="mt-2.5 shrink-0 text-[11px] text-muted/70">
              Calculado sobre <strong className="text-ink/85">{perf?.maos_com_dados_frequencia ?? 0}</strong> mãos com
              hand history estruturada.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

// Card com regua (faixa de referencia + marcador) -- copia visual exata
// da funcao Frequencia em app/performance/page.tsx, so que compacta pro
// espaco desta tela.
function FreqCard({
  label,
  valor,
  referencia,
}: {
  label: string;
  valor: number | null;
  referencia: { min: number; max: number; escala: number };
}) {
  const v = valor === null || valor === undefined ? null : Number(valor);
  const pos = v === null ? 0 : Math.min(Math.max((v / referencia.escala) * 100, 0), 100);
  const refLeft = (referencia.min / referencia.escala) * 100;
  const refWidth = ((referencia.max - referencia.min) / referencia.escala) * 100;

  return (
    <div className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted/80">{label}</p>
      <p className={`mt-0.5 text-lg font-bold leading-none tabular-nums ${v === null ? "text-muted/30" : "text-ink"}`}>
        {v === null ? "—" : `${v.toFixed(1)}%`}
      </p>
      <div className="relative mt-2.5 h-[3px] w-full rounded-full bg-void/60">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 rounded-full bg-ink/15"
          style={{ left: `${refLeft}%`, width: `${refWidth}%` }}
        />
        {v !== null && (
          <span
            className="absolute top-1/2 h-[11px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-training shadow-[0_0_6px_rgba(59,130,246,.6)]"
            style={{ left: `${pos}%` }}
          />
        )}
      </div>
      <p className="mt-1.5 text-[9.5px] leading-tight text-muted/65">
        ref. {referencia.min}–{referencia.max}%
      </p>
    </div>
  );
}

// Card sem regua (nao ha faixa de referencia definida pro produto pra
// essas duas) -- mesmo valor/contagem que ja aparece em "Situacoes
// pre-flop" na Performance, so' que compacto.
function FreqSimples({ label, pct, sample }: { label: string; pct: number | null; sample: number | null }) {
  return (
    <div className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted/80">{label}</p>
      <p className={`mt-0.5 text-lg font-bold leading-none tabular-nums ${pct === null ? "text-muted/30" : "text-ink"}`}>
        {pct === null ? "—" : `${pct}%`}
      </p>
      <p className="mt-[26px] text-[9.5px] leading-tight text-muted/65">
        {sample !== null ? `sobre ${sample} mãos` : "sem amostra"}
      </p>
    </div>
  );
}
