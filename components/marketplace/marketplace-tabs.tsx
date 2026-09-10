"use client";

import Link from "next/link";
import { Briefcase, FileText, Plus } from "lucide-react";
import { MobileTabsMenu } from "@/components/ui/mobile-tabs-menu";

type TabKey = "vagas" | "candidaturas" | "nova";

// Mesmo padrao de aba usado em Construtor de Ranges (RangesTabs) e no
// Painel do Time -- link de verdade (cada aba e' uma rota propria), com
// fallback de menu no mobile. "Nova vaga" so' aparece pra quem administra
// ou coacha um time (mesma regra que ja decidia se o link aparecia no
// feed antes desta tela ganhar abas).
export function MarketplaceTabs({ active, podeGerenciar }: { active: TabKey; podeGerenciar: boolean }) {
  const tabs: { key: TabKey; href: string; label: string; icon: typeof Briefcase }[] = [
    { key: "vagas", href: "/marketplace", label: "Vagas", icon: Briefcase },
    { key: "candidaturas", href: "/marketplace/minhas-candidaturas", label: "Minhas candidaturas", icon: FileText },
    ...(podeGerenciar ? [{ key: "nova" as const, href: "/marketplace/nova", label: "Nova vaga", icon: Plus }] : []),
  ];

  return (
    <>
      <nav className="relative hidden flex-1 flex-wrap justify-start gap-1 overflow-x-auto border-b border-hairline sm:flex">
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

      <div className="sm:hidden">
        <MobileTabsMenu title="Vagas" items={tabs} activeKey={active} />
      </div>
    </>
  );
}
