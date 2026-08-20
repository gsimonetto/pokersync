"use client";

import { BookMarked } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Biblioteca } from "@/components/ranges/biblioteca";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

export default function BibliotecaPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <AppHeader backHref="/modulos" icon={BookMarked} iconColor="var(--color-review)" title="Biblioteca"
        right={<RangesTabs active="biblioteca" />} />

      <Biblioteca />
    </main>
  );
}
