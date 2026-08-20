"use client";

import { AppHeader } from "@/components/app-header";
import { Biblioteca } from "@/components/ranges/biblioteca";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function BibliotecaPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader right={<RangesTabs active="biblioteca" />} />

      <Biblioteca />
    </main>
  );
}
