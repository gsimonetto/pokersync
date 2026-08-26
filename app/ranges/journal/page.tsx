"use client";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RangeJournal } from "@/components/ranges/range-journal";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function JournalPage() {
  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell right={<RangesTabs active="journal" />} />

        <RangeJournal />
      </main>
    </AppShell>
  );
}
