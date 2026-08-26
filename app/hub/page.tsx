"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Trophy, Flame, Zap, Target, TrendingUp,
  CheckCircle2, Calendar, Shield, Circle, Notebook, ClipboardList,
  Clock, Spade, BookOpen, HelpCircle, Scale, Medal, Star, Gift, Crown, Sparkles,
} from "lucide-react";
import {
  fetchProgress, fetchActiveMissions, fetchMissionCatalog,
  fetchLeaderboardPeriod, fetchMyLeaderboardRank, fetchActiveSeason, xpForNextLevel, levelColor, MAX_LEVEL,
  type Progress, type LeaderboardEntry, type LeaderboardPeriod, type MyRank, type Season,
} from "@/lib/services/xp-service";
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

  // Hub agora tem 2 vistas de verdade (pedido explicito: ranking "em
  // outra aba dentro do hub que mostrasse so isso"), nao missoes+ranking
  // empilhados na mesma tela infinita.
  const [view, setView] = useState<"missoes" | "ranking">("missoes");

  const rankingPeriod: LeaderboardPeriod = "season";
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank] = useState<MyRank | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  useEffect(() => {
    fetchActiveSeason().then(setSeason).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "ranking") return;
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
  }, [rankingPeriod, view]);

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
    // createClient() lanca sincrono se as envs do Supabase nao estiverem
    // configuradas -- sem o try/catch isso escapa do useEffect como
    // excecao nao tratada (mesmo padrao ja corrigido em app/modulos e
    // components/top-nav.tsx).
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    } catch {
      // sem sessao configurada: mantem meId nulo
    }
    return () => {
      alive = false;
    };
  }, []);

  if (loading)
    return (
      <AppShell>
        <main className="p-10 text-center text-sm text-muted">Carregando Hub...</main>
      </AppShell>
    );
  if (err || !progress)
    return (
      <AppShell>
        <main className="p-10 text-center text-sm text-negative">{err}</main>
      </AppShell>
    );

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
    <AppShell>
    <main className="w-full mx-auto max-w-[1280px] px-6 py-10">
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
        @keyframes rkRiseIn {
          from { opacity: 0; transform: translateY(18px) scale(.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rkCrownGlow {
          0%, 100% { opacity: .3; transform: scale(1); }
          50%      { opacity: .6; transform: scale(1.35); }
        }
        @keyframes rkSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes rkGiftBob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-2px) rotate(-4deg); }
        }
        @keyframes rkCountdownPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: .55; }
        }
        .rk-riser { animation: rkRiseIn .45s cubic-bezier(.22,1,.36,1) both; }
        .rk-pillar { transition: filter .2s ease; }
        .rk-riser:hover .rk-pillar { filter: brightness(1.15); }
        .rk-crown-glow { animation: rkCrownGlow 2.2s ease-in-out infinite; }
        .rk-loading-spin { animation: rkSpin 1.1s linear infinite; }
        .rk-gift-icon { animation: rkGiftBob 2.6s ease-in-out infinite; }
        .rk-countdown { animation: rkCountdownPulse 2.4s ease-in-out infinite; }
        .rk-banner { animation: hubFadeInUp .3s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .hub-flame-icon, .hub-flame-glow, .hub-xp-chip, .hub-ember, .hub-mission-card, .hub-level-card, .hub-ministat, .hub-trophy-btn, .hub-badge-ring, .hub-badge-box, .hub-badge-number, .hub-xp-shimmer, .rk-riser, .rk-crown-glow, .rk-loading-spin, .rk-gift-icon, .rk-countdown, .rk-banner { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Sem AppHeader (barra sticky) -- o alternador Missões/Ranking
          entra dentro do container principal de cada vista (mesmo padrao
          do Treino: controles vivem dentro do card, nao numa faixa fixa
          por cima). Conteudo comeca flush no topo, igual aos demais
          modulos. */}
      {view === "missoes" && (
      <>
      <div className="hub-level-card relative overflow-hidden rounded-xl border border-hairline bg-surface p-6">
        <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
          <ViewToggle view={view} setView={setView} />
        </div>
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

      {/* Nota discreta, nao alerta ambar de largura total: a informacao
          e' util (explica por que as missoes parecem genericas), mas o
          tratamento de aviso dava a ela peso de problema e anunciava
          produto inacabado logo no topo do modulo. Sem a promessa de
          roadmap ("em breve...") de proposito -- promessa dentro do
          produto envelhece mal e nao ajuda a decidir nada agora. */}
      {showingCatalog && (
        <p className="mt-4 text-xs text-muted">
          Missões do catálogo geral — ainda não personalizadas pro seu nível.
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
      </>
      )}

      {view === "ranking" && (
        <RankingSection
          entries={leaderboard}
          loading={leaderboardLoading}
          meId={meId}
          myRank={myRank}
          season={season}
          view={view}
          setView={setView}
        />
      )}
    </main>
    </AppShell>
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

// Alternador Missões/Ranking -- vive dentro do container de cada vista
// (mesmo padrão de segmented-control usado no Painel do Time e no
// Construtor de Ranges), no lugar de uma barra sticky separada.
function ViewToggle({
  view,
  setView,
}: {
  view: "missoes" | "ranking";
  setView: (v: "missoes" | "ranking") => void;
}) {
  return (
    <SegmentedControl
      value={view}
      onChange={setView}
      options={[
        { value: "missoes", label: <><Target size={13} /> Missões</> },
        { value: "ranking", label: <><Trophy size={13} /> Ranking</> },
      ]}
    />
  );
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Ranking global -- vista propria do Hub, so' por Temporada (pedido
// explicito: "so quero o filtro de temporada"). Sem tabs Semana/Mes/Geral
// -- a vista inteira gira em torno do ciclo trimestral com premio
// (leaderboard_seasons). Sem temporada configurada, mostra estado vazio
// proprio em vez de cair silenciosamente no ranking vitalicio.
function RankingSection({
  entries,
  loading,
  meId,
  myRank,
  season,
  view,
  setView,
}: {
  entries: LeaderboardEntry[] | null;
  loading: boolean;
  meId: string | null;
  myRank: MyRank | null;
  season: Season | null;
  view: "missoes" | "ranking";
  setView: (v: "missoes" | "ranking") => void;
}) {
  const meInList = entries?.some((e) => e.userId === meId) ?? false;
  const podium = entries?.slice(0, 3) ?? [];
  const rest = entries?.slice(3) ?? [];
  const leaderXp = entries?.[0]?.xpTotal || 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ViewToggle view={view} setView={setView} />
        <p className="text-xs text-muted">Ranking de todos os membros PokerSync.</p>
      </div>

      <div
        className="rk-banner relative mb-4 overflow-hidden rounded-xl border p-4"
        style={{ borderColor: `${ACCENT}40`, background: `linear-gradient(120deg, ${ACCENT}14, transparent 65%)` }}
      >
        <Sparkles size={110} strokeWidth={1} className="pointer-events-none absolute -right-4 -top-6 opacity-[0.08]" style={{ color: ACCENT }} />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="rk-gift-icon grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${ACCENT}22`, color: ACCENT }}>
            <Gift size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
              <Trophy size={11} /> Temporada
            </p>
            <p className="mt-0.5 text-sm font-bold text-ink">
              {season ? season.rewardTitle || "Temporada em andamento" : "Nenhuma temporada ativa"}
            </p>
            {season?.rewardDescription && <p className="mt-0.5 text-xs text-muted">{season.rewardDescription}</p>}
          </div>
          {season && (
            <div className="text-right text-xs text-muted">
              <p>{fmtDate(season.startsAt)} — {fmtDate(season.endsAt)}</p>
              <p className="rk-countdown font-semibold" style={{ color: ACCENT }}>
                {season.daysRemaining === 0 ? "Termina hoje" : `${season.daysRemaining} dias restantes`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT }}>
          <Trophy size={16} /> Ranking da temporada
        </h2>

        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted">
              <Trophy size={22} className="rk-loading-spin" style={{ color: ACCENT }} />
              Carregando ranking…
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted">
              <Trophy size={28} strokeWidth={1.3} className="opacity-30" />
              {!season ? "Nenhuma temporada ativa no momento." : "Ninguém ganhou XP nessa temporada ainda."}
            </div>
          ) : (
            <>
              {podium.length === 3 && <Podium entries={podium} meId={meId} />}
              <div className="flex flex-col gap-1.5">
                {(podium.length === 3 ? rest : entries).map((e, idx) => (
                  <RankingRow key={e.userId} entry={e} isMe={e.userId === meId} idx={idx} leaderXp={leaderXp} />
                ))}
                {myRank && !meInList && (
                  <>
                    <div className="my-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-muted">
                      <span className="h-px flex-1 bg-hairline" /> você <span className="h-px flex-1 bg-hairline" />
                    </div>
                    <div className="hub-lb-row flex items-center gap-3 rounded-lg border border-review/50 bg-review/[0.08] px-3 py-2.5">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const PODIUM_META = [
  { rank: 2, order: "order-1", height: "h-20", medal: "#C0C6CC", delay: "0s" },
  { rank: 1, order: "order-2", height: "h-28", medal: "#F5D48C", delay: ".08s" },
  { rank: 3, order: "order-3", height: "h-14", medal: "#CD7F32", delay: ".16s" },
] as const;

// Pódio dos top 3 -- 1o lugar no centro e mais alto, estilo classico.
// Colunas sobem com stagger (rk-riser) e o 1o lugar ganha uma coroa com
// brilho pulsante -- reforca hierarquia visual sem precisar de texto extra.
function Podium({ entries, meId }: { entries: LeaderboardEntry[]; meId: string | null }) {
  const byRank = (r: number) => entries.find((e) => e.rank === r);
  return (
    <div className="mb-5 flex items-end justify-center gap-3">
      {PODIUM_META.map((meta) => {
        const e = byRank(meta.rank);
        if (!e) return null;
        const isMe = e.userId === meId;
        return (
          <div
            key={meta.rank}
            className={`rk-riser flex w-28 flex-col items-center ${meta.order}`}
            style={{ animationDelay: meta.delay }}
          >
            <span className="relative grid place-items-center">
              {meta.rank === 1 && (
                <span className="rk-crown-glow absolute inset-0 rounded-full blur-md" style={{ background: meta.medal, opacity: 0.4 }} />
              )}
              <Crown
                size={meta.rank === 1 ? 22 : 14}
                className="relative"
                style={{ color: meta.medal, opacity: meta.rank === 1 ? 1 : 0.7 }}
                fill={meta.rank === 1 ? meta.medal : "none"}
              />
            </span>
            <p className="mt-1 w-full truncate text-center text-xs font-bold text-ink">
              {e.name} {isMe && <span className="text-[9px] text-review">(você)</span>}
            </p>
            <p className="text-[10px]" style={{ color: levelColor(e.level) }}>
              Nível {e.level}
            </p>
            <p className="mt-0.5 text-[11px] font-bold" style={{ color: ACCENT }}>
              {e.xpTotal.toLocaleString("pt-BR")} XP
            </p>
            <div
              className={`rk-pillar mt-2 flex w-full items-start justify-center rounded-t-lg pt-1.5 ${meta.height}`}
              style={{ background: `${meta.medal}1A`, border: `1px solid ${meta.medal}55` }}
            >
              <span className="text-lg font-extrabold" style={{ color: meta.medal }}>
                {meta.rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingRow({
  entry: e,
  isMe,
  idx,
  leaderXp,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  idx: number;
  leaderXp: number;
}) {
  const medalColor = e.rank === 1 ? "#F5D48C" : e.rank === 2 ? "#C0C6CC" : e.rank === 3 ? "#CD7F32" : null;
  const share = Math.max(4, Math.min(100, (e.xpTotal / leaderXp) * 100));
  return (
    <div
      className={`hub-lb-row group relative overflow-hidden rounded-lg border px-3 py-2.5 ${
        isMe ? "border-review/50 bg-review/[0.08]" : "border-hairline bg-void/40 hover:bg-elevated"
      }`}
      style={{ animationDelay: `${Math.min(idx, 20) * 0.02}s` }}
    >
      {/* Barra de XP relativa ao lider -- da' densidade visual sem novo numero. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 transition-all duration-700"
        style={{ width: `${share}%`, background: `linear-gradient(90deg, ${ACCENT}14, transparent)` }}
      />
      <div className="relative flex items-center gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold text-muted">
          {medalColor ? <Medal size={16} style={{ color: medalColor }} /> : e.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {e.name} {isMe && <span className="text-[10px] text-review">(você)</span>}
          </p>
          <p className="text-[11px] text-muted">
            <span style={{ color: levelColor(e.level) }}>Nível {e.level}</span>
            {e.streakDays > 0 && (
              <span className="inline-flex items-center gap-0.5">
                {" "}· <Flame size={10} className="text-orange-400" /> {e.streakDays}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold" style={{ color: ACCENT }}>
          {e.xpTotal.toLocaleString("pt-BR")} XP
        </span>
      </div>
    </div>
  );
}
