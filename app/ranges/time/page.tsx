"use client";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { TeamLibrary } from "@/components/ranges/team-library";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function TeamRangesPage() {
  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell right={<RangesTabs active="time" />} />

        <TeamLibrary />
      </main>
    </AppShell>
  );
}
