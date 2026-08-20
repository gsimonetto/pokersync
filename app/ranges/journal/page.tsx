"use client";

import { NotebookPen } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RangeJournal } from "@/components/ranges/range-journal";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function JournalPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10 text-ink">
      <AppHeader backHref="/modulos" icon={NotebookPen} iconColor="var(--color-review)" title="Range Journal"
        right={<RangesTabs active="journal" />} />

      <RangeJournal />
    </main>
  );
}
