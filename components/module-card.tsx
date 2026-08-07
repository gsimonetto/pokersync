"use client";

import { useState, useCallback } from "react";
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
  // No desktop o hover puro (:hover / group-hover) ja acende o card.
  // No celular nao existe hover, entao o toque ativa manualmente a
  // mesma classe "is-active" que o CSS trata como equivalente ao hover.
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") setActive(true);
  }, []);

  const endTouch = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") {
      window.setTimeout(() => setActive(false), 180);
    }
  }, []);

  const accentStyle: React.CSSProperties & { "--acc": string } = {
    "--acc": accent,
  };

  const content = (
    <article
      style={accentStyle}
      onPointerDown={onPointerDown}
      onPointerUp={endTouch}
      onPointerCancel={endTouch}
      className={
        "group acc-card relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-hairline bg-surface p-4 " +
        (available ? "acc-lift cursor-pointer" : "opacity-50") +
        (active ? " is-active" : "")
      }
    >
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
