import { Flame, Sparkles } from "lucide-react";

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

export function WelcomeHero({
  name,
  streakDays,
  patente,
}: {
  name: string;
  streakDays: number;
  patente: string;
}) {
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

        <h1 id="welcome-heading" className="mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {name}
        </h1>

        <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted">
          {streakDays > 0
            ? "Você está em uma sequência sólida. Continue treinando ranges para manter a evolução constante."
            : "Comece hoje uma sessão de estudo para abrir sua sequência de evolução."}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-ink">
            <Flame className="size-3.5" />
            Sequência de {streakDays} {streakDays === 1 ? "dia" : "dias"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted">
            <Sparkles className="size-3.5 text-ink" />
            Patente {patente}
          </span>
        </div>
      </div>
    </section>
  );
}
