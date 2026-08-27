"use client";

import { AppShell } from "@/components/app-shell";
import { RangeJournal } from "@/components/ranges/range-journal";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// Sem AppHeader (barra sticky) -- as abas do modulo entram direto no
// fluxo da pagina, mesma distancia do topo que o Treino.
export default function JournalPage() {
  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        <RangeJournal tabs={<RangesTabs active="journal" />} />
      </main>
    </AppShell>
  );
}
