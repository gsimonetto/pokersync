"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Trophy, Flame, Zap, Target, TrendingUp,
  CheckCircle2, Calendar, Shield, Circle,
} from "lucide-react";
import {
  fetchProgress, fetchActiveMissions, fetchMissionCatalog,
  getPatente, xpForNextLevel, type Progress,
} from "@/lib/services/xp-service";

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

const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  "check-circle": CheckCircle2,
  "trending-up": TrendingUp,
  flame: Flame,
  calendar: Calendar,
  shield: Shield,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMission = any;

export default function HubPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [missions, setMissions] = useState<AnyMission[]>([]);
  const [catalog, setCatalog] = useState<AnyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <main className="p-10 text-center text-sm text-muted">Carregando Hub...</main>;
  if (err || !progress) return <main className="p-10 text-center text-sm text-negative">{err}</main>;

  const level = progress.level;
  const patente = getPatente(level);
  const xpNeeded = xpForNextLevel(level);
  const xpCurrent = progress.xp_current;
  const pct = Math.min(100, (xpCurrent / xpNeeded) * 100);

  const showingCatalog = missions.length === 0;
  const grp = (kind: string) =>
    showingCatalog ? catalog.filter((m) => m.kind === kind) : missions.filter((m) => m.missions?.kind === kind);
  const dailyMissions = grp("daily");
  const weeklyMissions = grp("weekly");
  const challengeMissions = grp("challenge");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Animacoes escopadas neste arquivo: nao depende do globals.css do restante do projeto. */}
      <style>{`
        @keyframes hubFlameFlicker {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: .88; }
          25%      { transform: scale(1.08) rotate(-2deg); opacity: 1; }
          50%      { transform: scale(.97) rotate(1.5deg); opacity: .92; }
          75%      { transform: scale(1.05) rotate(2deg); opacity: 1; }
        }
        @keyframes hubFlameGlow {
          0%, 100% { opacity: .25; transform: scale(1); }
          50%      { opacity: .55; transform: scale(1.3); }
        }
        @keyframes hubXpPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
          50%      { box-shadow: 0 0 12px 0 rgba(34,197,94,.4); }
        }
        .hub-flame-icon { animation: hubFlameFlicker var(--flame-speed, 2.4s) ease-in-out infinite; }
        .hub-flame-glow { animation: hubFlameGlow var(--flame-speed, 2.4s) ease-in-out infinite; }
        .hub-xp-chip { animation: hubXpPulse 2.6s ease-in-out infinite; }
        .hub-mission-card { transition: border-color .2s ease, box-shadow .2s ease, transform .15s ease; }
        .hub-mission-card:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) {
          .hub-flame-icon, .hub-flame-glow, .hub-xp-chip { animation: none !important; }
          .hub-mission-card { transition: none !important; }
        }
      `}</style>

      <div className="flex items-center gap-3">
        <Link href="/modulos" className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hub de Evolucao</h1>
          <p className="mt-0.5 text-sm text-muted">Ganhe XP, mantenha a ofensiva e suba de patente.</p>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-xl border border-hairline bg-surface p-6">
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
          <div
            className="grid h-20 w-20 place-items-center rounded-2xl bg-void text-3xl font-extrabold"
            style={{ border: `2px solid ${ACCENT}`, color: ACCENT, boxShadow: "0 0 0 4px rgba(224,178,76,0.08)" }}
          >
            {level}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Nivel {level}</p>
            <h2 className="mt-0.5 text-xl font-bold">{patente}</h2>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full border border-hairline bg-white/5">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, #F5D48C)` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>{xpCurrent} XP</span>
                <span>{xpNeeded} XP para o proximo</span>
              </div>
            </div>
          </div>

          {/* Fogo animado: intensidade escala com a ofensiva (0-2 apagado, 3-6 laranja, 7+ laranja/amarelo mais rapido) */}
          <FlameStat days={progress.streak_days} />
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3.5 border-t border-hairline pt-5 sm:grid-cols-3">
          <MiniStat icon={Zap} label="XP total" value={progress.xp_total.toLocaleString("pt-BR")} />
          <MiniStat icon={Target} label="Combo GTO" value={String(progress.combo_gto)} />
          <MiniStat icon={Trophy} label="Recorde streak" value={String(progress.streak_best)} />
        </div>
      </div>

      {showingCatalog && (
        <p className="mt-5 rounded-lg border border-evolution/25 bg-evolution/10 px-4 py-3 text-xs" style={{ color: ACCENT }}>
          As missoes abaixo sao um preview do catalogo. Em breve voce recebera missoes diarias personalizadas ao seu nivel.
        </p>
      )}

      {dailyMissions.length > 0 && (
        <MissionSection title="Missoes diarias" icon={Calendar} missions={dailyMissions} preview={showingCatalog} />
      )}
      {weeklyMissions.length > 0 && (
        <MissionSection title="Missoes semanais" icon={Flame} missions={weeklyMissions} preview={showingCatalog} />
      )}
      {challengeMissions.length > 0 && (
        <MissionSection title="Desafios" icon={Shield} missions={challengeMissions} preview={showingCatalog} />
      )}
    </main>
  );
}

function FlameStat({ days }: { days: number }) {
  const tier = days >= 7 ? 2 : days >= 3 ? 1 : 0;
  const color = tier === 2 ? "#FBBF24" : tier === 1 ? "#F97316" : "#6B6B6B";
  const speed = tier === 2 ? "1.4s" : tier === 1 ? "2s" : "3.2s";

  return (
    <div className="min-w-[84px] rounded-xl border border-hairline bg-white/[0.03] px-3.5 py-2.5 text-center">
      <span className="relative mx-auto grid h-[22px] w-[22px] place-items-center" style={{ ["--flame-speed" as string]: speed }}>
        {tier > 0 && (
          <span
            className="hub-flame-glow absolute inset-0 rounded-full blur-md"
            style={{ background: color, opacity: 0.35 }}
          />
        )}
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
    <div className="flex items-center gap-2.5">
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

function MissionSection({
  title,
  icon: Icon,
  missions,
  preview,
}: {
  title: string;
  icon: LucideIcon;
  missions: AnyMission[];
  preview: boolean;
}) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon size={16} style={{ color: ACCENT }} />
        <h3 className="text-xs font-extrabold uppercase tracking-[0.12em]">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {missions.map((item, idx) => (
          <MissionCard key={idx} item={item} preview={preview} />
        ))}
      </div>
    </div>
  );
}

function MissionCard({ item, preview }: { item: AnyMission; preview: boolean }) {
  const m = preview ? item : item.missions;
  const Icon = ICON_MAP[m?.icon] || Circle;
  const goal = preview ? m.goal_base : item.goal_value;
  const prog = preview ? 0 : item.progress;
  const completed = !preview && item.status === "completed";
  const pct = Math.min(100, (prog / goal) * 100);

  // Cor da missao = cor do modulo de origem. Concluida sobrepoe com verde,
  // porque "feito" e uma informacao mais importante do que a origem.
  const accent = completed ? XP_GREEN : accentFor(m?.category);
  const iconColor = accent;

  return (
    <div
      className={`hub-mission-card group rounded-xl border p-4 ${
        completed ? "border-positive/35 bg-positive/[0.06]" : "border-hairline bg-surface"
      } ${preview ? "opacity-85" : ""}`}
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
    </div>
  );
}
