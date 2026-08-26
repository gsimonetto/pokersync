"use client";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { TreeList } from "@/components/ranges/tree-list";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function ArvoresPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell right={<RangesTabs active="arvores" />} />

        <TreeList />
      </main>
    </AppShell>
  );
}
