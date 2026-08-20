import Link from "next/link";
import { ArrowLeft, ImagePlus, Users } from "lucide-react";

// Proporcao fixa (4:1) pra quem for montar a arte saber exatamente o
// tamanho — sem isso a imagem escala pra cobrir a caixa e corta de
// jeito imprevisivel dependendo da tela.
export const BANNER_DIMENSOES = "1600 × 400px";
export const BANNER_PROPORCAO_CLASS = "aspect-[4/1]";

// Banner do time, customizavel pelo proprio time. Sem banner: cai num
// degrade na cor do time; se quem esta' vendo pode editar, o degrade
// vira um placeholder explicito ("Adicionar banner") em vez de deixar
// a caixa parecendo so' decorativa.
export function TeamBanner({
  name,
  description,
  accent,
  logoUrl,
  bannerUrl,
  editable,
  uploading,
  onUploadClick,
  backHref,
  right,
}: {
  name: string;
  description?: string | null;
  accent: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  /** Quem esta' vendo pode trocar o banner (admin/coach). */
  editable?: boolean;
  uploading?: boolean;
  onUploadClick?: () => void;
  /** Banner faz as vezes do header nas telas de entrada — voltar fica sobreposto nele. */
  backHref?: string;
  right?: React.ReactNode;
}) {
  const semBannerEditavel = editable && !bannerUrl;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border bg-surface ${
        semBannerEditavel ? "border-dashed border-hairline" : "border-hairline"
      } ${BANNER_PROPORCAO_CLASS}`}
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
            className="glow-breathe pointer-events-none absolute -right-16 -top-24 size-80 rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px]"
          />
        </>
      )}

      <div className="relative flex h-full flex-col justify-end p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 sm:h-16 sm:w-16"
              style={{ backgroundColor: `${accent}30` }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <Users size={22} style={{ color: accent }} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className={`truncate text-xl font-bold tracking-tight sm:text-3xl ${bannerUrl ? "text-white drop-shadow" : "text-ink"}`}>
                {name}
              </h1>
              {description && (
                <p className={`mt-1 hidden max-w-xl truncate text-[13px] leading-relaxed sm:block ${bannerUrl ? "text-white/85" : "text-muted"}`}>
                  {description}
                </p>
              )}
            </div>
          </div>

          {right}
        </div>
      </div>

      {semBannerEditavel && (
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          <ImagePlus size={22} />
          <span className="text-[13px] font-semibold">{uploading ? "Enviando…" : "Adicionar banner do time"}</span>
          <span className="text-[11px] text-muted/80">Recomendado: {BANNER_DIMENSOES} (proporção 4:1)</span>
        </button>
      )}

      {editable && bannerUrl && (
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/25 bg-void/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-void/80 disabled:opacity-60 print:hidden"
        >
          <ImagePlus size={13} />
          {uploading ? "Enviando…" : "Trocar banner"}
        </button>
      )}

      {backHref && (
        <Link
          href={backHref}
          aria-label="Voltar"
          className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-white/25 bg-void/60 text-white backdrop-blur-sm transition-colors hover:bg-void/80 print:hidden"
        >
          <ArrowLeft size={18} />
        </Link>
      )}
    </section>
  );
}
