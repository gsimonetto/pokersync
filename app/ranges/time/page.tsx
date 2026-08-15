"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { TeamLibrary } from "@/components/ranges/team-library";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function TeamRangesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Users size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">Time</h1>
        <RangesTabs active="time" />
      </header>

      <TeamLibrary />
    </main>
  );
}
