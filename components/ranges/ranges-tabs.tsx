"use client";

import Link from "next/link";

type TabKey = "ranges" | "arvores" | "biblioteca" | "journal" | "time" | "equidade";

export function RangesTabs({ active }: { active: TabKey }) {
  const tabs: { key: TabKey; href: string; label: string }[] = [
    { key: "ranges", href: "/ranges", label: "Ranges" },
    { key: "arvores", href: "/ranges/arvores", label: "Árvores" },
    { key: "equidade", href: "/ranges/equidade", label: "Equidade" },
    { key: "biblioteca", href: "/ranges/biblioteca", label: "Biblioteca" },
    { key: "time", href: "/ranges/time", label: "Time" },
    { key: "journal", href: "/ranges/journal", label: "Journal" },
  ];

  return (
    <div className="ml-auto flex flex-wrap gap-1 rounded-lg border border-hairline bg-elevated p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-md px-3 py-1 text-xs font-medium ${active === t.key ? "bg-ink text-void" : "text-muted"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
