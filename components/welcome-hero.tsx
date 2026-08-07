function Chip({ size, className }: { size: number; className?: string }) {
  return (
    <span
      className={`absolute rounded-full border border-dashed border-white/15 ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="absolute inset-2 rounded-full border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent" />
    </span>
  );
}

const PLAN_STYLE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "#B8B8B8" },
  pro: { label: "Pro", color: "#EF4444" },
  master: { label: "Master", color: "#F97316" },
};

export function WelcomeHero({
  name,
  plan,
  team,
}: {
  name: string;
  plan: "free" | "pro" | "master";
  team: { name: string; accent: string } | null;
}) {
  const planStyle = PLAN_STYLE[plan] ?? PLAN_STYLE.free;

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-ink/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px]"
      />

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 sm:block" aria-hidden="true">
        <Chip size={190} className="right-6 top-1/2 -translate-y-1/2 opacity-70" />
        <Chip size={130} className="right-40 top-6 opacity-60" />
        <Chip size={96} className="-bottom-6 right-24 opacity-50" />
        <Chip size={64} className="right-2 top-8 opacity-40" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
            Bem-vindo de volta
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h1 id="welcome-heading" className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {name}
          </h1>

          {/* Plano: chip com o mesmo tratamento visual do XP no Hub (borda + fundo suave na cor). */}
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: planStyle.color, borderColor: `${planStyle.color}40`, background: `${planStyle.color}14` }}
          >
            {planStyle.label}
          </span>
        </div>

        {/* Time: so aparece se o jogador participa de algum. Cor propria do time. */}
        {team && (
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: team.accent }}>
            {team.name}
          </p>
        )}
      </div>
    </section>
  );
}
