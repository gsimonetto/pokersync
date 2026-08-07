import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { ModuleCardShell } from "./module-card-shell";

export type ModuleStatus = "ATIVO" | "NOVO" | "EM BREVE";

export interface ModuleDef {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string;
  tag?: ModuleStatus;
  available: boolean;
  href?: string;
}

function StatusBadge({ tag, available }: { tag?: ModuleStatus; available: boolean }) {
  const label = tag ?? (available ? "ATIVO" : "EM BREVE");
  const isActive = label === "ATIVO";
  const isNew = label === "NOVO";
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        (isActive
          ? "bg-ink text-void"
          : isNew
          ? "border border-evolution text-evolution"
          : "border border-hairline text-muted")
      }
    >
      {label}
    </span>
  );
}

// Server Component: resolve o icone aqui (JSX ja renderizado), so o
// que precisa de interacao de toque vive no ModuleCardShell (client).
export function ModuleCard({
  icon: Icon,
  title,
  subtitle,
  accent,
  tag,
  available,
  href,
}: Omit<ModuleDef, "key">) {
  const content = (
    <ModuleCardShell accent={accent} available={available}>
      {/* Blob de brilho ambiente atras do icone, igual a referencia do v0. */}
      <div
        aria-hidden="true"
        className="acc-glow pointer-events-none absolute -left-10 -top-10 size-32 rounded-full blur-2xl"
      />

      <div className="relative flex items-start justify-between">
        <div className="acc-border flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-elevated">
          <Icon size={20} className="acc-fg" />
        </div>
        {available ? (
          <StatusBadge tag={tag} available={available} />
        ) : (
          <Lock size={14} className="text-muted" />
        )}
      </div>
      <div className="relative mt-4">
        <h3 className="acc-fg text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
      </div>
      {available && (
        <ArrowRight
          size={16}
          className="acc-fg absolute bottom-4 right-4 -translate-x-1 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-[.is-active]:translate-x-0 group-[.is-active]:opacity-100"
        />
      )}
    </ModuleCardShell>
  );

  if (available && href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
