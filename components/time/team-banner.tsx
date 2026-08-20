import { Users } from "lucide-react";

// Banner do time — mesma altura/raio do WelcomeHero dos Modulos
// (components/welcome-hero.tsx), so' que aqui a imagem de fundo e'
// customizavel pelo proprio time. Sem banner, cai num degrade na cor
// do time (nunca fica "vazio").
export function TeamBanner({
  name,
  description,
  accent,
  logoUrl,
  bannerUrl,
  right,
}: {
  name: string;
  description?: string | null;
  accent: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 sm:p-8"
      style={
        bannerUrl
          ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      {bannerUrl ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/85 via-void/40 to-void/10" />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px]"
          />
        </>
      )}

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 sm:h-16 sm:w-16"
            style={{ backgroundColor: `${accent}30` }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <Users size={26} style={{ color: accent }} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${bannerUrl ? "text-white drop-shadow" : "text-ink"}`}>
              {name}
            </h1>
            {description && (
              <p className={`mt-1 max-w-xl truncate text-[13px] leading-relaxed ${bannerUrl ? "text-white/85" : "text-muted"}`}>
                {description}
              </p>
            )}
          </div>
        </div>

        {right}
      </div>
    </section>
  );
}
