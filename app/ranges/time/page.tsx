"use client";

import { AppHeader } from "@/components/app-header";
import { TeamLibrary } from "@/components/ranges/team-library";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function TeamRangesPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader right={<RangesTabs active="time" />} />

      <TeamLibrary />
    </main>
  );
}
