"use client";

import { GitBranch } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TreeList } from "@/components/ranges/tree-list";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function ArvoresPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader backHref="/modulos" icon={GitBranch} iconColor="var(--color-review)" title="Árvores Estratégicas"
        right={<RangesTabs active="arvores" />} />

      <TreeList />
    </main>
  );
}
