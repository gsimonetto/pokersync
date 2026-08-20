"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Trophy, Flame, Zap, Target, TrendingUp,
  CheckCircle2, Calendar, Shield, Circle, Notebook, ClipboardList,
  Clock, Spade, BookOpen, HelpCircle, Scale, Medal, Star, Users, Bell,
} from "lucide-react";
import {
  fetchProgress, fetchActiveMissions, fetchMissionCatalog,
  fetchLeaderboardPeriod, fetchMyLeaderboardRank, xpForNextLevel, levelColor, MAX_LEVEL,
  type Progress, type LeaderboardEntry, type LeaderboardPeriod, type MyRank,
} from "@/lib/services/xp-service";
import { fetchMyMembership, type MyMembership } from "@/lib/services/team-service";
import { fetchNotifications, markAsRead, type Notification } from "@/lib/services/notification-service";
import { createClient } from "@/lib/supabase/client";

const ACCENT = "#E0B24C";
const XP_GREEN = "#22c55e";

// Cor de cada missao herda a cor do modulo de origem (missions.category),
// espelhando os accents reais de lib/modules-data.ts.
const CATEGORY_ACCENT: Record<string, string> = {
  drill: "#2FB89A",     // Modo Treino
  bankroll: "#5AA6E0",  // Gestao de Banca
  review: "#A855F7",    // Revisao de Maos
  habit: ACCENT,         // sem modulo proprio, mantem o dourado neutro
};

function accentFor(category?: string | null) {
  return (category && CATEGORY_ACCENT[category]) || ACCENT;
}

// Pra onde o card de missao leva quando clicado -- fecha o ciclo "vi a
// missao no Hub -> fui cumprir ela" em vez de so mostrar progresso sem
// caminho. "habit" nao tem modulo proprio (ver CATEGORY_ACCENT acima),
// entao fica sem link mesmo -- nao inventa destino que nao existe.
const CATEGORY_HREF: Record<string, string> = {
  drill: "/treino",
  bankroll: "/banca",
  review: "/revisor",
};

function hrefFor(category?: string | null) {
  return (category && CATEGORY_HREF[category]) || null;
}

// Icones das missoes (pedido explicito: "nao pode ter icones que nao
// existem, adicionar aos que nao existem") — mapeado 1:1 contra os
// valores REAIS que existem hoje na tabela `missions.icon` (conferido
// via SQL), nao so os que apareciam nas primeiras missoes cadastradas.
// Antes disso, 7 dos 13 icones distintos usados no catalogo caiam no
// fallback generico (Circle) por nao estarem mapeados aqui.
const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  "check-circle": CheckCircle2,
  "trending-up": TrendingUp,
  flame: Flame,
  calendar: Calendar,
  shield: Shield,
  notebook: Notebook,
  "clipboard-list": ClipboardList,
  clock: Clock,
  spade: Spade,
  "book-open": BookOpen,
  "help-circle": HelpCircle,
  scale: Scale,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMission = any;

// Selo de dificuldade nos cards (pedido explicito: "ter niveis de
// dificuldade") — cor sobe em intensidade conforme fica mais dificil.
const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  facil: { label: "Fácil", color: "#22c55e" },
  media: { label: "Média", color: "#f59e0b" },
  dificil: { label: "Difícil", color: "#f97316" },
  expert: { label: "Expert", color: "#e0555a" },
};

type MissionTab = "daily" | "weekly" | "monthly" | "challenge";

export default function HubPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [missions, setMissions] = useState<AnyMission[]>([]);
  const [catalog, setCatalog] = useState<AnyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<MissionTab>("daily");

  // Ranking global -- agora secao fixa da tela (nao mais drawer escondido
  // atras do trofeu: pedido explicito, "hoje e' so uma tela ao lado").
  // O botao de trofeu vira atalho de scroll, igual ao padrao ja usado no
  // painel de leaks da Gestao de Banca (leaksRef).
  const rankingRef = useRef<HTMLElement | null>(null);
  const [rankingPeriod, setRankingPeriod] = useState<LeaderboardPeriod>("week");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  // Time e notificacoes recentes -- o Hub deveria ser o centro que
  // conecta os modulos, nao so uma lista de numeros. Nao bloqueiam o
  // carregamento principal nem quebram a tela se falharem (usuario sem
  // time e' o caso normal, nao um erro).
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    fetchMyMembership().then(setMembership).catch(() => {});
    fetchNotifications(5).then(setRecentNotifs).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLeaderboardLoading(true);
    Promise.all([
      fetchLeaderboardPeriod(rankingPeriod, 50).catch(() => []),
      fetchMyLeaderboardRank(rankingPeriod).catch(() => null),
    ]).then(([lb, mine]) => {
      if (!alive) return;
      setLeaderboard(lb);
      setMyRank(mine);
      setLeaderboardLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [rankingPeriod]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, m, c] = await Promise.all([
          fetchProgress(),
          fetchActiveMissions(),
          fetchMissionCatalog(),
        ]);
        if (!alive) return;
        setProgress(p);
        setMissions(m);
        setCatalog(c);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Falha ao carregar Hub.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <main className="p-10 text-center text-sm text-muted">Carregando Hub...</main>;
  if (err || !progress) return <main className="p-10 text-center text-sm text-negative">{err}</main>;

  const level = progress.level;
  const isMaxLevel = level >= MAX_LEVEL;
  const badgeColor = levelColor(level);
  const xpNeeded = isMaxLevel ? 0 : xpForNextLevel(level);
  const xpCurrent = progress.xp_current;
  const pct = isMaxLevel ? 100 : Math.min(100, (xpCurrent / xpNeeded) * 100);

  const showingCatalog = missions.length === 0;
  const grp = (kind: string) =>
    showingCatalog ? catalog.filter((m) => m.kind === kind) : missions.filter((m) => m.missions?.kind === kind);
  const dailyMissions = grp("daily");
  const weeklyMissions = grp("weekly");
  const monthlyMissions = grp("monthly");
  const challengeMissions = grp("challenge");

  const TABS: { key: MissionTab; label: string; icon: LucideIcon; items: AnyMission[] }[] = [
    { key: "daily", label: "Diárias", icon: Calendar, items: dailyMissions },
    { key: "weekly", label: "Semanais", icon: Flame, items: weeklyMissions },
    { key: "monthly", label: "Mensais", icon: Trophy, items: monthlyMissions },
    { key: "challenge", label: "Desafios", icon: Shield, items: challengeMissions },
  ];
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {/* Animacoes escopadas neste arquivo: nao depende do globals.css do restante do projeto. */}
      <style>{`
        @keyframes hubFlameFlicker {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: .88; }
          25%      { transform: scale(1.1) rotate(-3deg); opacity: 1; }
          50%      { transform: scale(.95) rotate(2deg); opacity: .9; }
          75%      { transform: scale(1.08) rotate(3deg); opacity: 1; }
        }
        @keyframes hubFlameGlow {
          0%, 100% { opacity: .3; transform: scale(1); }
          50%      { opacity: .65; transform: scale(1.45); }
        }
        @keyframes hubEmberRise {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
          100% { transform: translateY(-26px) translateX(var(--ember-x, 4px)) scale(.2); opacity: 0; }
        }
        @keyframes hubXpPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
          50%      { box-shadow: 0 0 12px 0 rgba(34,197,94,.4); }
        }
        @keyframes hubFadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hub-flame-icon { animation: hubFlameFlicker var(--flame-speed, 2.4s) ease-in-out infinite; }
        .hub-flame-glow { animation: hubFlameGlow var(--flame-speed, 2.4s) ease-in-out infinite; }
        .hub-ember { animation: hubEmberRise var(--ember-speed, 1.6s) ease-in infinite; }
        .hub-xp-chip { animation: hubXpPulse 2.6s ease-in-out infinite; }
        .hub-mission-card { transition: border-color .2s ease, box-shadow .2s ease, transform .18s ease; animation: hubFadeInUp .3s ease-out both; }
        .hub-mission-card:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 10px 24px -12px rgba(0,0,0,.6); }
        .hub-tab-btn { transition: all .2s ease; }
        .hub-tab-btn:hover:not(.is-active) { transform: translateY(-1px); }
        @keyframes hubBadgeRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hubBadgeBreathe {
          0%, 100% { box-shadow: 0 0 0 4px ${badgeColor}18, 0 0 14px -2px ${badgeColor}70; }
          50%      { box-shadow: 0 0 0 6px ${badgeColor}26, 0 0 26px 2px ${badgeColor}aa; }
        }
        @keyframes hubBadgeNumberGlow {
          0%, 100% { text-shadow: 0 0 6px ${badgeColor}55; }
          50%      { text-shadow: 0 0 16px ${badgeColor}cc; }
        }
        @keyframes hubXpShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .hub-badge-ring { animation: hubBadgeRotate 6s linear infinite; }
        .hub-badge-box { animation: hubBadgeBreathe 2.4s ease-in-out infinite; }
        .hub-badge-number { animation: hubBadgeNumberGlow 2.4s ease-in-out infinite; }
        .hub-xp-shimmer { animation: hubXpShimmer 2.2s ease-in-out infinite; }
        .hub-level-card { transition: box-shadow .3s ease, border-color .3s ease; }
        .hub-level-card:hover { border-color: rgba(224,178,76,0.4); box-shadow: 0 0 30px -10px rgba(224,178,76,0.25); }
        .hub-ministat { transition: transform .2s ease, background-color .2s ease; }
        .hub-ministat:hover { transform: translateY(-2px); background-color: rgba(255,255,255,.06); }
        .hub-trophy-btn { transition: all .2s ease; }
        .hub-trophy-btn:hover { transform: scale(1.08) rotate(-4deg); box-shadow: 0 0 16px -4px rgba(224,178,76,.5); }
        .hub-lb-row { animation: hubFadeInUp .25s ease-out both; transition: background-color .15s ease; }
        @media (prefers-reduced-motion: reduce) {
          .hub-flame-icon, .hub-flame-glow, .hub-xp-chip, .hub-ember, .hub-mission-card, .hub-level-card, .hub-ministat, .hub-trophy-btn, .hub-badge-ring, .hub-badge-box, .hub-badge-number, .hub-xp-shimmer { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/modulos" className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hub de Evolução</h1>
            <p className="mt-0.5 text-sm text-muted">Ganhe XP, mantenha a ofensiva e suba de nível.</p>
          </div>
        </div>

        {/* Ranking de todos os membros PokerSync -- secao fixa la embaixo,
            isso aqui so' rola ate' ela. */}
        <button
          onClick={() => rankingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          title="Ranking PokerSync"
          className="hub-trophy-btn grid h-10 w-10 place-items-center rounded-xl border"
          style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}15`, color: ACCENT }}
        >
          <Trophy size={18} />
        </button>
      </div>

      <div className="hub-level-card relative mt-6 overflow-hidden rounded-xl border border-hairline bg-surface p-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 100% 0%, ${ACCENT}12 0%, transparent 60%)` }}
        />
        <Trophy
          size={170}
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-7 -right-5 opacity-[0.08]"
          style={{ color: ACCENT }}
        />

        <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-5">
          <div className="relative h-20 w-20">
            {/* Anel giratorio atras do badge — conic-gradient na cor da
                faixa, sempre girando (pedido explicito: "mais animacoes
                no nivel"). */}
            <div
              className="hub-badge-ring pointer-events-none absolute -inset-1.5 rounded-full opacity-70 blur-[2px]"
              style={{ background: `conic-gradient(from 0deg, transparent, ${badgeColor}, transparent 55%)` }}
            />
            <div
              className="hub-badge-box relative grid h-20 w-20 place-items-center rounded-2xl bg-void text-3xl font-extrabold"
              style={{ border: `2px solid ${badgeColor}`, color: badgeColor }}
            >
              <span className="hub-badge-number">{level}</span>
            </div>
          </div>

          <div className="min-w-0">
            {/* Nome de patente em ingles (Micro Stakes I etc) removido
                (pedido explicito) — so o numero do nivel, sem rotulo por
                baixo. Cor do nivel muda a cada 10 (pedido explicito). */}
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              <span>
                Nível {level}
                <span className="text-muted/70">/{MAX_LEVEL}</span>
              </span>
              {isMaxLevel && <span style={{ color: badgeColor }}>· MÁXIMO</span>}
              {progress.prestige_count > 0 && (
                <span
                  className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{ color: "#F5D48C", background: "#F5D48C22" }}
                  title={`Prestígio ${progress.prestige_count}x — já chegou no nível máximo e recomeçou`}
                >
                  <Star size={10} fill="#F5D48C" /> {progress.prestige_count}
                </span>
              )}
            </p>
            <div className="mt-3">
              <div className="relative h-2 overflow-hidden rounded-full border border-hairline bg-white/5">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${badgeColor}, #F5D48C)` }}
                />
                {/* Brilho passando pela barra (loop continuo) — so' visivel
                    dentro da parte preenchida por causa do overflow-hidden
                    do container pai. */}
                <div
                  className="hub-xp-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)" }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>{xpCurrent} XP</span>
                <span>{isMaxLevel ? "Nível máximo atingido" : `${xpNeeded} XP para o próximo`}</span>
              </div>
            </div>
          </div>

          {/* Fogo animado: intensidade escala com a ofensiva. Ganhou
              particulas de brasa subindo (pedido explicito: "fogo de
              streak mais animado"), alem do flicker que ja existia. */}
          <FlameStat days={progress.streak_days} />
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3.5 border-t border-hairline pt-5 sm:grid-cols-3">
          <MiniStat icon={Zap} label="XP total" value={progress.xp_total.toLocaleString("pt-BR")} />
          <MiniStat icon={Target} label="Combo GTO" value={String(progress.combo_gto)} />
          <MiniStat icon={Trophy} label="Recorde streak" value={String(progress.streak_best)} />
        </div>
      </div>

      {/* Hub como centro de verdade, nao so lista de numeros: acesso
          rapido ao time (se tiver um) e as ultimas notificacoes, que
          antes so viviam escondidas no sininho do menu. */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <section className="rounded-xl border border-hairline bg-surface p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              <Bell size={13} /> Notificações recentes
            </h2>
            <Link href="/notificacoes" className="text-[11px] font-semibold text-muted transition-colors hover:text-ink">
              Ver todas
            </Link>
          </div>
          {recentNotifs.length === 0 ? (
            <p className="mt-3 text-xs text-muted">Nenhuma notificação ainda.</p>
          ) : (
            <div className="mt-2.5 flex flex-col gap-1">
              {recentNotifs.map((n) => (
                <Link
                  key={n.id}
                  href={n.action_url || "/notificacoes"}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id).catch(() => {});
                  }}
                  className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors hover:bg-elevated ${
                    !n.read ? "bg-white/[0.03]" : ""
                  }`}
                >
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />}
                  <span className={`min-w-0 flex-1 truncate ${n.read ? "text-muted" : "text-ink"}`}>
                    <span className="font-semibold">{n.title}</span>
                    {n.body ? ` — ${n.body}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <Link
          href="/time"
          className="flex flex-col justify-center rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-review/40 hover:bg-elevated"
        >
          <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <Users size={13} /> Seu time
          </h2>
          {membership ? (
            <>
              <p className="mt-1.5 truncate text-sm font-semibold text-ink">{membership.teamName}</p>
              <p className="text-[11px] text-muted capitalize">{membership.role}</p>
            </>
          ) : (
            <p className="mt-1.5 text-xs text-muted">Você ainda não faz parte de um time.</p>
          )}
        </Link>
      </div>

      {showingCatalog && (
        <p className="mt-5 rounded-lg border border-evolution/25 bg-evolution/10 px-4 py-3 text-xs" style={{ color: ACCENT }}>
          As missões abaixo são um preview do catálogo. Em breve você receberá missões diárias personalizadas ao seu nível.
        </p>
      )}

      {/* Abas Diario/Semanal/Mensal/Desafios (pedido explicito: "separar
          por diario, semanal e mensal") — Mensal ainda nao tem missoes
          cadastradas no catalogo, aparece vazia ate existirem. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`hub-tab-btn flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
                active ? "is-active border-transparent text-void" : "border-hairline bg-elevated text-muted hover:text-ink"
              }`}
              style={active ? { background: ACCENT } : undefined}
            >
              <Icon size={13} />
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-void/20" : "bg-white/[0.06]"}`}>
                {t.items.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {activeTab.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-sm text-muted">
            {tab === "monthly" ? "Missões mensais chegam em breve." : "Nenhuma missão aqui ainda."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeTab.items.map((item, idx) => (
              <MissionCard key={idx} item={item} preview={showingCatalog} />
            ))}
          </div>
        )}
      </div>

      <RankingSection
        forwardedRef={rankingRef}
        entries={leaderboard}
        loading={leaderboardLoading}
        meId={meId}
        period={rankingPeriod}
        onPeriodChange={setRankingPeriod}
        myRank={myRank}
      />
    </main>
  );
}

function FlameStat({ days }: { days: number }) {
  const tier = days >= 7 ? 2 : days >= 3 ? 1 : 0;
  const color = tier === 2 ? "#FBBF24" : tier === 1 ? "#F97316" : "#6B6B6B";
  const speed = tier === 2 ? "1.2s" : tier === 1 ? "1.8s" : "3.2s";
  const emberSpeed = tier === 2 ? "1.1s" : "1.6s";
  // Brasas: pequenos pontos que sobem e desaparecem, atrasados entre si
  // pra nao pulsarem em uníssono — so aparecem com streak ativo (tier>0).
  const embers = tier > 0 ? [0, 1, 2] : [];

  return (
    <div className="min-w-[84px] rounded-xl border border-hairline bg-white/[0.03] px-3.5 py-2.5 text-center">
      <span className="relative mx-auto grid h-[22px] w-[22px] place-items-center" style={{ ["--flame-speed" as string]: speed }}>
        {tier > 0 && (
          <span
            className="hub-flame-glow absolute inset-0 rounded-full blur-md"
            style={{ background: color, opacity: 0.35 }}
          />
        )}
        {embers.map((i) => (
          <span
            key={i}
            className="hub-ember absolute bottom-0 left-1/2 h-1 w-1 rounded-full"
            style={{
              background: color,
              ["--ember-speed" as string]: emberSpeed,
              ["--ember-x" as string]: `${(i - 1) * 5}px`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
        <Flame
          size={22}
          className={tier > 0 ? "hub-flame-icon relative" : "relative"}
          color={color}
          fill={tier === 2 ? color : "none"}
        />
      </span>
      <div className="mt-0.5 text-xl font-extrabold">{days}</div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Dias</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="hub-ministat flex items-center gap-2.5 rounded-lg p-1">
      <div className="grid h-8 w-8 place-items-center rounded-lg border border-hairline bg-white/[0.04]">
        <Icon size={14} className="text-muted" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

// Card vira link de verdade quando a categoria tem modulo proprio (ver
// CATEGORY_HREF) -- senao fica um <div> normal, sem fingir um destino
// que nao existe (caso "habit").
function MissionCardShell({
  href,
  className,
  style,
  children,
}: {
  href: string | null;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

function MissionCard({ item, preview }: { item: AnyMission; preview: boolean }) {
  const m = preview ? item : item.missions;
  // Fallback pra Circle so deveria acontecer com icone realmente
  // desconhecido/futuro — todos os icones cadastrados hoje ja tem
  // entrada valida em ICON_MAP (ver comentario acima do mapa).
  const Icon = ICON_MAP[m?.icon] || Circle;
  const goal = preview ? m.goal_base : item.goal_value;
  const prog = preview ? 0 : item.progress;
  const completed = !preview && item.status === "completed";
  const pct = Math.min(100, (prog / goal) * 100);
  const href = preview ? null : hrefFor(m?.category);

  // Cor da missao = cor do modulo de origem. Concluida sobrepoe com verde,
  // porque "feito" e uma informacao mais importante do que a origem.
  const accent = completed ? XP_GREEN : accentFor(m?.category);
  const iconColor = accent;

  return (
    <MissionCardShell
      href={href}
      className={`hub-mission-card group block rounded-xl border p-4 ${
        completed ? "border-positive/35 bg-positive/[0.06]" : "border-hairline bg-surface"
      } ${preview ? "opacity-85" : ""} ${href ? "cursor-pointer" : ""}`}
      style={{ borderColor: completed ? undefined : `${accent}30` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border transition-colors"
          style={
            completed
              ? { borderColor: "rgba(47,184,154,0.4)", background: "rgba(47,184,154,0.15)" }
              : { borderColor: `${accent}40`, background: `${accent}1A` }
          }
        >
          <Icon size={18} strokeWidth={1.75} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h4 className="flex-1 text-sm font-bold">{m.title}</h4>
            {DIFFICULTY_META[m?.difficulty] && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]"
                style={{ color: DIFFICULTY_META[m.difficulty].color, background: `${DIFFICULTY_META[m.difficulty].color}18` }}
              >
                {DIFFICULTY_META[m.difficulty].label}
              </span>
            )}
            {/* XP sempre em verde: forma propria (chip com brilho) para nao se confundir com o estado "concluida" */}
            <span
              className="hub-xp-chip flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold"
              style={{ color: XP_GREEN, borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}
            >
              +{m.xp_reward} XP
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-muted">{m.description}</p>

          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {prog} / {goal}
            </div>
          </div>
        </div>
      </div>
    </MissionCardShell>
  );
}

const RANKING_PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Geral" },
];

// Ranking global -- secao fixa do Hub (nao mais escondida atras de um
// botao). Ganhou filtro por periodo (antes so xp_total vitalicio, o que
// travava sempre nos mesmos nomes de quem entrou primeiro) e a posicao
// do proprio jogador mesmo quando ele nao esta no top exibido.
function RankingSection({
  forwardedRef,
  entries,
  loading,
  meId,
  period,
  onPeriodChange,
  myRank,
}: {
  forwardedRef: React.RefObject<HTMLElement | null>;
  entries: LeaderboardEntry[] | null;
  loading: boolean;
  meId: string | null;
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  myRank: MyRank | null;
}) {
  const meInList = entries?.some((e) => e.userId === meId) ?? false;

  return (
    <section ref={forwardedRef} className="mt-6 scroll-mt-6 rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT }}>
          <Trophy size={16} /> Ranking PokerSync
        </h2>
        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          {RANKING_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase transition-all ${
                period === p.value ? "bg-ink text-void" : "text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Carregando ranking…</p>
        ) : !entries || entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            {period === "all" ? "Ninguém no ranking ainda." : "Ninguém ganhou XP nesse período ainda."}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entries.map((e) => (
              <RankingRow key={e.userId} entry={e} isMe={e.userId === meId} />
            ))}
            {myRank && !meInList && (
              <>
                <div className="my-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                  <span className="h-px flex-1 bg-hairline" /> você <span className="h-px flex-1 bg-hairline" />
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-review/50 bg-review/[0.08] px-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold text-muted">{myRank.rank}</span>
                  <p className="min-w-0 flex-1 text-sm font-semibold">
                    Sua posição <span className="text-[10px] text-review">(você)</span>
                  </p>
                  <span className="shrink-0 text-sm font-bold" style={{ color: ACCENT }}>
                    {myRank.xp.toLocaleString("pt-BR")} XP
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RankingRow({ entry: e, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const medalColor = e.rank === 1 ? "#F5D48C" : e.rank === 2 ? "#C0C6CC" : e.rank === 3 ? "#CD7F32" : null;
  return (
    <div
      className={`hub-lb-row flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        isMe ? "border-review/50 bg-review/[0.08]" : "border-hairline bg-void/40 hover:bg-elevated"
      }`}
      style={{ animationDelay: `${Math.min(e.rank, 20) * 0.02}s` }}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold text-muted">
        {medalColor ? <Medal size={16} style={{ color: medalColor }} /> : e.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {e.name} {isMe && <span className="text-[10px] text-review">(você)</span>}
        </p>
        <p className="text-[11px] text-muted">
          <span style={{ color: levelColor(e.level) }}>Nível {e.level}</span> · {e.streakDays} dias de streak
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold" style={{ color: ACCENT }}>
        {e.xpTotal.toLocaleString("pt-BR")} XP
      </span>
    </div>
  );
}
