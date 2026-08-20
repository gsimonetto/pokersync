"use client";

import { AppHeader } from "@/components/app-header";
import { TreeList } from "@/components/ranges/tree-list";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function ArvoresPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader right={<RangesTabs active="arvores" />} />

      <TreeList />
    </main>
  );
}
