"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TabNav } from "@/components/ui/tab-nav";
import { RankChip } from "@/components/ui/rank-chip";
import {
  Trophy, Flame, Zap, Target, TrendingUp,
  CheckCircle2, Calendar, Shield, Circle, Notebook, ClipboardList,
  Clock, Spade, BookOpen, HelpCircle, Scale, Medal, Star, Gift, Crown, Sparkles, Layers, X,
} from "lucide-react";
import {
  fetchProgress, fetchActiveMissions, fetchMissionCatalog,
  fetchLeaderboardPeriod, fetchMyLeaderboardRank, fetchActiveSeason, settleExpiredSeasons, xpForNextLevel, levelColor, levelMaterial, levelSubTier, MAX_LEVEL,
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

const DIFFICULTY_ORDER = ["facil", "media", "dificil", "expert"];

// Dificuldade desconhecida vai pro fim, nao pro topo -- nao faz sentido
// uma missao sem selo furar a fila das faceis.
function difficultyRank(m?: AnyMission) {
  const idx = DIFFICULTY_ORDER.indexOf(m?.difficulty);
  return idx === -1 ? DIFFICULTY_ORDER.length : idx;
}

type MissionTab = "daily" | "weekly" | "monthly" | "challenge";

export default function HubPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [missions, setMissions] = useState<AnyMission[]>([]);
  const [catalog, setCatalog] = useState<AnyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<MissionTab>("daily");
  const [tiersOpen, setTiersOpen] = useState(false);

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
    // Liquida qualquer temporada ja encerrada (idempotente, sem cron) antes
    // de buscar o ranking -- e' o que faz o campeao ganhar o icone assim
    // que alguem abre esta tela apos o fim da temporada.
    settleExpiredSeasons().catch(() => {});
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
  const badgeMaterial = levelMaterial(level);
  const badgeSubTier = levelSubTier(level);
  const xpNeeded = isMaxLevel ? 0 : xpForNextLevel(level);
  const xpCurrent = progress.xp_current;
  const pct = isMaxLevel ? 100 : Math.min(100, (xpCurrent / xpNeeded) * 100);

  const showingCatalog = missions.length === 0;
  // Mais facil primeiro dentro de cada aba (pedido explicito) -- deixa a
  // vitoria rapida no topo e a mais dificil por ultimo, em vez de ordem
  // arbitraria do banco.
  const grp = (kind: string) =>
    (showingCatalog ? catalog.filter((m) => m.kind === kind) : missions.filter((m) => m.missions?.kind === kind))
      .slice()
      .sort((a, b) => difficultyRank(showingCatalog ? a : a.missions) - difficultyRank(showingCatalog ? b : b.missions));
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
          0%, 100% { box-shadow: 0 0 0 5px ${badgeColor}22, 0 0 22px 0px ${badgeColor}90, 0 0 46px 4px ${badgeColor}40; }
          50%      { box-shadow: 0 0 0 8px ${badgeColor}34, 0 0 38px 4px ${badgeColor}c0, 0 0 64px 10px ${badgeColor}60; }
        }
        @keyframes hubBadgeNumberGlow {
          0%, 100% { text-shadow: 0 0 8px ${badgeColor}66, 0 0 2px ${badgeColor}; }
          50%      { text-shadow: 0 0 22px ${badgeColor}ee, 0 0 4px ${badgeColor}; }
        }
        @keyframes hubBadgeHaloPulse {
          0%, 100% { opacity: .55; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.12); }
        }
        @keyframes hubBadgeOrbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hubBadgeSheenSweep {
          0%   { transform: translateX(-140%) skewX(-18deg); }
          55%  { transform: translateX(220%) skewX(-18deg); }
          100% { transform: translateX(220%) skewX(-18deg); }
        }
        @keyframes hubXpShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .hub-badge-ring { animation: hubBadgeRotate 6s linear infinite; }
        .hub-badge-ring-thin { animation: hubBadgeRotate 10s linear infinite reverse; }
        .hub-badge-box { animation: hubBadgeBreathe 2.4s ease-in-out infinite; }
        .hub-badge-number { animation: hubBadgeNumberGlow 2.4s ease-in-out infinite; }
        .hub-badge-halo { animation: hubBadgeHaloPulse 2.4s ease-in-out infinite; }
        .hub-badge-orbit { animation: hubBadgeOrbitSpin 5s linear infinite; }
        .hub-badge-sheen { animation: hubBadgeSheenSweep 3.2s ease-in-out infinite; }
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
        .rk-riser { animation: rkRiseIn .45s cubic-bezier(.22,1,.36,1) both; transition: transform .25s ease; perspective: 600px; }
        .rk-riser:hover { transform: translateY(-4px); }
        .rk-pillar { transition: filter .2s ease, box-shadow .25s ease; }
        .rk-riser:hover .rk-pillar { filter: brightness(1.15); }
        .rk-crown-glow { animation: rkCrownGlow 2.2s ease-in-out infinite; }
        .rk-loading-spin { animation: rkSpin 1.1s linear infinite; }
        .rk-gift-icon { animation: rkGiftBob 2.6s ease-in-out infinite; }
        .rk-countdown { animation: rkCountdownPulse 2.4s ease-in-out infinite; }
        .rk-banner { animation: hubFadeInUp .3s ease-out both; }

        /* Pódio do 1o lugar: trofeu grande balancando + glow pulsante +
           tilt 3D leve no hover (pedido explicito: "algo mais bonito...
           glow, hover... 3d"). */
        @keyframes rkTrophySway {
          0%, 100% { transform: rotate(-4deg) scale(1); }
          50%      { transform: rotate(4deg) scale(1.04); }
        }
        @keyframes rkTrophyGlow {
          0%, 100% { filter: drop-shadow(0 0 10px var(--trophy-glow, #F5D48C)) drop-shadow(0 0 2px var(--trophy-glow, #F5D48C)); }
          50%      { filter: drop-shadow(0 0 22px var(--trophy-glow, #F5D48C)) drop-shadow(0 0 6px var(--trophy-glow, #F5D48C)); }
        }
        @keyframes rkHaloSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .rk-trophy-1 { animation: rkTrophySway 3s ease-in-out infinite, rkTrophyGlow 2.4s ease-in-out infinite; transform-style: preserve-3d; }
        .rk-riser-1:hover .rk-trophy-1 { animation-duration: 1.1s, 1.2s; }
        .rk-riser-1:hover { transform: translateY(-8px) scale(1.05); }
        .rk-halo-1 { animation: rkHaloSpin 7s linear infinite; }

        /* Fogos de artificio atras do podio -- particulas subindo e
           estourando em pontos fixos (sem Math.random pra nao gerar
           mismatch de SSR/CSR), em loop continuo e discreto. */
        @keyframes rkFireworkRise {
          0%   { transform: translateY(0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; }
          55%  { transform: translateY(var(--rise, -70px)) scale(1); opacity: 1; }
          56%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes rkFireworkBurst {
          0%, 55%   { transform: translateY(var(--rise, -70px)) scale(0); opacity: 0; }
          62%       { transform: translateY(var(--rise, -70px)) scale(1); opacity: 1; }
          85%       { transform: translateY(calc(var(--rise, -70px) - 14px)) scale(1.3); opacity: .0; }
          100%      { opacity: 0; }
        }
        .rk-firework { position: absolute; bottom: 0; width: 3px; height: 3px; border-radius: 999px; animation: rkFireworkRise var(--dur, 2.6s) ease-out infinite; animation-delay: var(--delay, 0s); }
        .rk-firework::after {
          content: ""; position: absolute; inset: -7px; border-radius: 999px;
          background: radial-gradient(circle, currentColor 0%, transparent 70%);
          animation: rkFireworkBurst var(--dur, 2.6s) ease-out infinite; animation-delay: var(--delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-flame-icon, .hub-flame-glow, .hub-xp-chip, .hub-ember, .hub-mission-card, .hub-level-card, .hub-ministat, .hub-trophy-btn, .hub-badge-ring, .hub-badge-ring-thin, .hub-badge-box, .hub-badge-number, .hub-badge-halo, .hub-badge-orbit, .hub-badge-sheen, .hub-xp-shimmer, .rk-riser, .rk-crown-glow, .rk-loading-spin, .rk-gift-icon, .rk-countdown, .rk-banner, .rk-trophy-1, .rk-halo-1, .rk-firework, .rk-firework::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Sem AppHeader (barra sticky) -- o alternador Missões/Ranking
          entra dentro do container principal de cada vista (mesmo padrao
          do Treino: controles vivem dentro do card, nao numa faixa fixa
          por cima). Conteudo comeca flush no topo, igual aos demais
          modulos. */}
      {/* Container externo unico, igual aos demais modulos: o alternador
          Missões/Ranking mora no topo da caixa, centralizado, e o
          conteudo de QUALQUER uma das duas vistas fica dentro dela --
          antes o alternador vivia dentro do card de nivel (so' na vista
          de Missoes) e a vista de Ranking tinha seu proprio container
          separado. */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
        <TabNav
          className="mb-4"
          value={view}
          onChange={setView}
          options={[
            { value: "missoes", label: "Missões", icon: Target },
            { value: "ranking", label: "Ranking", icon: Trophy },
          ]}
        />

      {view === "missoes" && (
      <>
      <div className="hub-level-card relative overflow-hidden rounded-xl border border-hairline bg-surface p-6">
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
          <LevelBadge level={level} />

          <div className="min-w-0">
            {/* Rotulo de patente (Bronze/Prata/Ouro...) volta como chip
                colorido -- pedido explicito: "detalhes que remetam o
                nivel igual as patentes de jogos". Numeral romano imita a
                subdivisao dentro do tier (Ouro III etc). Cor do nivel
                muda a cada 10 (pedido explicito, ja existia). Botao ao
                lado abre a galeria com todas as patentes animadas
                (pedido explicito: "icone de niveis... mostre ao jogador,
                com as animacoes de cada uma"). */}
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              <span
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ color: badgeColor, background: `${badgeColor}22`, border: `1px solid ${badgeColor}55` }}
              >
                {badgeMaterial} {badgeSubTier}
              </span>
              <span>
                Nível {level}
                <span className="text-muted/70">/{MAX_LEVEL}</span>
              </span>
              <button
                type="button"
                onClick={() => setTiersOpen(true)}
                className="hub-trophy-btn grid h-5 w-5 place-items-center rounded-full border border-hairline text-muted hover:border-white/30 hover:text-ink"
                aria-label="Ver todas as patentes"
                title="Ver todas as patentes"
              >
                <Layers size={11} />
              </button>
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
          cadastradas no catalogo, aparece vazia ate existirem.
          Centralizado + preto/branco (ativa = bg-ink text-void, mesmo
          padrao do FilterChip usado no resto do produto) em vez do
          preenchimento na cor de acento do time -- contador continua em
          amarelo (bg-evolution), igual o badge de pendencias do sistema. */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`hub-tab-btn flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
                active ? "is-active border-transparent bg-ink text-void" : "border-hairline bg-elevated text-muted hover:text-ink"
              }`}
            >
              <Icon size={13} />
              {t.label}
              {t.items.length > 0 && (
                <span className="rounded-full bg-evolution px-1.5 py-0.5 text-[10px] font-bold text-void">{t.items.length}</span>
              )}
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
        <RankingSection entries={leaderboard} loading={leaderboardLoading} meId={meId} myRank={myRank} season={season} />
      )}
      </div>
    </main>
    {tiersOpen && <LevelTiersModal currentLevel={level} onClose={() => setTiersOpen(false)} />}
    </AppShell>
  );
}

// Badge de nivel reutilizavel -- extraido do hero pra tambem alimentar a
// galeria de patentes (LevelTiersModal). `size` em px controla o
// tamanho, todo o resto (halo, aneis, particulas, sheen) escala junto
// pra caber em telas menores (grid da galeria) sem perder o efeito.
function LevelBadge({ level, size = 80 }: { level: number; size?: number }) {
  const badgeColor = levelColor(level);
  const badgeBandIdx = Math.min(9, Math.max(0, Math.ceil(level / 10) - 1));
  const badgeEpic = badgeBandIdx >= 7;
  const s = size / 80;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Halo ambiente atras de tudo -- camada extra de glow, maior e
          mais dispersa que o brilho do proprio badge (pedido explicito:
          "mais brilho, mais glow"). Escala com o tier. */}
      <div
        className="hub-badge-halo pointer-events-none absolute rounded-full blur-2xl"
        style={{ inset: -20 * s, background: `radial-gradient(circle, ${badgeColor}${badgeEpic ? "66" : "40"} 0%, transparent 70%)` }}
      />
      {/* Particulas orbitando -- so' nas faixas de prestigio alto
          (Platina+), pra patente alta parecer mais "epica" sem poluir
          os niveis iniciais. */}
      {badgeEpic && (
        <div className="hub-badge-orbit pointer-events-none absolute inset-0">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: 4 * s,
                height: 4 * s,
                background: badgeColor,
                boxShadow: `0 0 ${6 * s}px 1px ${badgeColor}`,
                transform: `rotate(${i * 120}deg) translateX(${46 * s}px)`,
              }}
            />
          ))}
        </div>
      )}
      {/* Anel giratorio atras do badge — conic-gradient na cor da
          faixa, sempre girando (pedido explicito: "mais animacoes no
          nivel"), agora mais espesso e com halo proprio. */}
      <div
        className="hub-badge-ring pointer-events-none absolute rounded-full opacity-90 blur-[1.5px]"
        style={{ inset: -8 * s, background: `conic-gradient(from 0deg, transparent, ${badgeColor}, ${badgeColor}, transparent 55%)` }}
      />
      <div className="hub-badge-ring-thin pointer-events-none absolute rounded-full border" style={{ inset: -2 * s, borderColor: `${badgeColor}55` }} />
      <div
        className="hub-badge-box relative grid place-items-center overflow-hidden rounded-2xl bg-void font-extrabold"
        style={{ width: size, height: size, border: `2px solid ${badgeColor}`, color: badgeColor, fontSize: 28 * s }}
      >
        {/* Sheen -- faixa de luz varrendo o badge (efeito "carta
            premium"), reforca o brilho sem precisar de mais cor. */}
        <span
          className="hub-badge-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2"
          style={{ background: "linear-gradient(115deg, transparent, rgba(255,255,255,.5), transparent)" }}
        />
        <span className="hub-badge-number relative">{level}</span>
      </div>
    </div>
  );
}

// Galeria com as 10 patentes -- pedido explicito: "icone de niveis e
// mostre ao jogador, com as animacoes de cada uma". Um nivel
// representativo por faixa (o mais alto dela, pra mostrar o numeral
// romano "I" que fecha o tier); a faixa do jogador ganha destaque.
const TIER_PREVIEW_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

function LevelTiersModal({ currentLevel, onClose }: { currentLevel: number; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const currentBand = Math.min(9, Math.max(0, Math.ceil(currentLevel / 10) - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/70 px-4 pb-8 pt-16 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Layers size={16} style={{ color: ACCENT }} /> Patentes
          </h2>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">A cor do seu nível sobe de patente a cada 10 níveis, até o 99.</p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TIER_PREVIEW_LEVELS.map((lvl, idx) => {
            const color = levelColor(lvl);
            const isCurrent = idx === currentBand;
            return (
              <div
                key={lvl}
                className="flex flex-col items-center gap-2 rounded-lg border p-3"
                style={isCurrent ? { borderColor: `${color}70`, background: `${color}0F` } : { borderColor: "transparent" }}
              >
                <LevelBadge level={lvl} size={60} />
                <span className="text-center text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                  {levelMaterial(lvl)}
                </span>
                <span className="text-[10px] text-muted">
                  {/* Ultima faixa (Lendario) tem so' 9 niveis (91-99), nao 10
                      como as demais -- MAX_LEVEL fecha em 99, nao 100. */}
                  Nível {idx === 9 ? 91 : lvl - 9}–{lvl}
                </span>
                {isCurrent && (
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color, background: `${color}22` }}>
                    você está aqui
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
  className,
}: {
  view: "missoes" | "ranking";
  setView: (v: "missoes" | "ranking") => void;
  className?: string;
}) {
  return (
    <TabNav
      className={className}
      value={view}
      onChange={setView}
      options={[
        { value: "missoes", label: "Missões", icon: Target },
        { value: "ranking", label: "Ranking", icon: Trophy },
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
}: {
  entries: LeaderboardEntry[] | null;
  loading: boolean;
  meId: string | null;
  myRank: MyRank | null;
  season: Season | null;
}) {
  const meInList = entries?.some((e) => e.userId === meId) ?? false;
  const podium = entries?.slice(0, 3) ?? [];
  const rest = entries?.slice(3) ?? [];
  const leaderXp = entries?.[0]?.xpTotal || 1;

  return (
    // Sem container proprio -- a vista de Ranking mora dentro do mesmo
    // container externo que a de Missoes, montado uma vez no componente pai.
    <>
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
              <Trophy size={11} /> {season ? `Temporada #${season.seasonNumber}` : "Temporada"}
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
    </>
  );
}

// Posicoes/cores/atrasos fixos (nao Math.random -- evita mismatch entre
// o HTML renderizado no servidor e a primeira renderizacao no cliente).
const FIREWORKS = [
  { left: "10%", color: "#F5D48C", rise: -78, dur: 2.8, delay: 0 },
  { left: "22%", color: "#5AA6E0", rise: -60, dur: 2.3, delay: 0.6 },
  { left: "35%", color: "#E0555A", rise: -85, dur: 3.1, delay: 1.3 },
  { left: "50%", color: "#F5D48C", rise: -70, dur: 2.5, delay: 0.2 },
  { left: "65%", color: "#8B7FD6", rise: -65, dur: 2.9, delay: 1.7 },
  { left: "78%", color: "#2FB89A", rise: -80, dur: 2.4, delay: 0.9 },
  { left: "90%", color: "#F5D48C", rise: -55, dur: 3.2, delay: 1.1 },
] as const;

// Fogos de artificio discretos atras do podio -- pedido explicito ("algo
// mais chamativo... fogos de artificio atras"). aria-hidden porque e'
// so decoracao, sem informacao nova.
function Fireworks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {FIREWORKS.map((f, i) => (
        <span
          key={i}
          className="rk-firework"
          style={{
            left: f.left,
            color: f.color,
            background: f.color,
            ["--rise" as string]: `${f.rise}px`,
            ["--dur" as string]: `${f.dur}s`,
            ["--delay" as string]: `${f.delay}s`,
          }}
        />
      ))}
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
// Selo de campeao -- pedido explicito: "quem ganhar vai ganhar o icone
// daquela temporada". So aparece pra quem ja venceu ao menos uma vez;
// tooltip lista todas (jogador pode ter mais de um titulo).
function ChampionBadge({ seasons }: { seasons: number[] }) {
  if (seasons.length === 0) return null;
  return (
    <span
      title={`Campeão da Temporada ${seasons.map((n) => `#${n}`).join(", ")}`}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 py-px"
      style={{ color: "#F5D48C" }}
    >
      <Trophy size={11} fill="#F5D48C" />
      {seasons.length > 1 && <span className="text-[9px] font-bold">x{seasons.length}</span>}
    </span>
  );
}

function Podium({ entries, meId }: { entries: LeaderboardEntry[]; meId: string | null }) {
  const byRank = (r: number) => entries.find((e) => e.rank === r);
  return (
    <div className="relative mb-5 overflow-hidden rounded-xl">
      <Fireworks />
      <div className="relative flex items-end justify-center gap-3 pt-3">
        {PODIUM_META.map((meta) => {
          const e = byRank(meta.rank);
          if (!e) return null;
          const isMe = e.userId === meId;
          const champion = meta.rank === 1;
          return (
            <div
              key={meta.rank}
              className={`rk-riser flex w-28 flex-col items-center ${meta.order} ${champion ? "rk-riser-1" : ""}`}
              style={{ animationDelay: meta.delay }}
            >
              <span className="relative grid place-items-center" style={{ height: champion ? 44 : 26 }}>
                {champion ? (
                  <>
                    {/* Halo girando + brilho pulsante atras do trofeu --
                        pedido explicito: "trofeu... glow... 3d". */}
                    <span className="rk-halo-1 absolute inset-[-10px] rounded-full" style={{ background: `conic-gradient(from 0deg, ${meta.medal}00, ${meta.medal}66, ${meta.medal}00 60%)` }} />
                    <span className="rk-crown-glow absolute inset-0 rounded-full blur-lg" style={{ background: meta.medal, opacity: 0.5 }} />
                    <Trophy
                      size={34}
                      className="rk-trophy-1 relative"
                      style={{ color: meta.medal, ["--trophy-glow" as string]: meta.medal }}
                      fill={meta.medal}
                      strokeWidth={1.5}
                    />
                  </>
                ) : (
                  <Crown size={14} className="relative" style={{ color: meta.medal, opacity: 0.7 }} />
                )}
              </span>
              <p className={`mt-1 flex w-full items-center justify-center gap-1 truncate text-center font-bold text-ink ${champion ? "text-sm" : "text-xs"}`}>
                <span className="truncate">{e.name}</span>
                <ChampionBadge seasons={e.championSeasons} />
                {isMe && <span className="text-[9px] text-review">(você)</span>}
              </p>
              <RankChip level={e.level} className="mt-0.5" />
              <p className={`mt-0.5 font-bold ${champion ? "text-[13px]" : "text-[11px]"}`} style={{ color: ACCENT }}>
                {e.xpTotal.toLocaleString("pt-BR")} XP
              </p>
              <div
                className={`rk-pillar mt-2 flex w-full items-start justify-center rounded-t-lg pt-1.5 ${meta.height}`}
                style={{
                  background: `${meta.medal}1A`,
                  border: `1px solid ${meta.medal}55`,
                  boxShadow: champion ? `0 0 24px -6px ${meta.medal}90` : undefined,
                }}
              >
                <span className="text-lg font-extrabold" style={{ color: meta.medal }}>
                  {meta.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
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
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <RankChip level={e.level} />
            {e.name}
            <ChampionBadge seasons={e.championSeasons} />
            {isMe && <span className="text-[10px] text-review">(você)</span>}
          </p>
          <p className="text-[11px] text-muted">
            {e.streakDays > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Flame size={10} className="text-orange-400" /> {e.streakDays} dias de streak
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
