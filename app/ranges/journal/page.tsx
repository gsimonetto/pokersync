"use client";

import { AppHeader } from "@/components/app-header";
import { RangeJournal } from "@/components/ranges/range-journal";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function JournalPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader right={<RangesTabs active="journal" />} />

      <RangeJournal />
    </main>
  );
}
