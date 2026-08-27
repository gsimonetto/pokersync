"use client";

import Link from "next/link";
import { Layers, GitBranch, Calculator, BookOpen, Users, NotebookPen } from "lucide-react";

type TabKey = "ranges" | "arvores" | "biblioteca" | "journal" | "time" | "equidade";

// Mesmo padrao de aba do Painel do Time (icone + rotulo, sublinhado na
// ativa) -- link de verdade em vez de onClick, porque cada aba aqui e'
// uma rota propria (nao troca so' um estado de tela).
export function RangesTabs({ active }: { active: TabKey }) {
  const tabs: { key: TabKey; href: string; label: string; icon: typeof Layers }[] = [
    { key: "ranges", href: "/ranges", label: "Ranges", icon: Layers },
    { key: "arvores", href: "/ranges/arvores", label: "Árvores", icon: GitBranch },
    { key: "equidade", href: "/ranges/equidade", label: "Equidade", icon: Calculator },
    { key: "biblioteca", href: "/ranges/biblioteca", label: "Biblioteca", icon: BookOpen },
    { key: "time", href: "/ranges/time", label: "Time", icon: Users },
    { key: "journal", href: "/ranges/journal", label: "Journal", icon: NotebookPen },
  ];

  return (
    <nav className="relative flex flex-1 flex-wrap gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              isActive ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon size={15} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
