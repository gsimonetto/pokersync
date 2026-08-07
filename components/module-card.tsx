import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";

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

export function ModuleCard({
  icon: Icon,
  title,
  subtitle,
  accent,
  tag,
  available,
  href,
}: Omit<ModuleDef, "key">) {
  const accentStyle: React.CSSProperties & { "--acc": string } = {
    "--acc": accent,
  };
  const content = (
    <article
      style={accentStyle}
      className={
        "group acc-border relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-hairline bg-surface p-4 transition " +
        (available
          ? "acc-glow cursor-pointer hover:-translate-y-0.5"
          : "opacity-50")
      }
    >
      <div className="flex items-start justify-between">
        <div className="acc-text-group acc-border-group flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-elevated transition-colors">
          <Icon size={20} />
        </div>
        {available ? (
          <StatusBadge tag={tag} available={available} />
        ) : (
          <Lock size={14} className="text-muted" />
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>
      </div>
      {available && (
        <ArrowRight
          size={16}
          className="acc-text-group absolute bottom-4 right-4 -translate-x-1 text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      )}
    </article>
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
