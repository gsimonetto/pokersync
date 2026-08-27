"use client";

import { AppShell } from "@/components/app-shell";
import { TeamLibrary } from "@/components/ranges/team-library";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// Sem AppHeader (barra sticky) -- as abas do modulo entram direto no
// fluxo da pagina, mesma distancia do topo que o Treino.
export default function TeamRangesPage() {
  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        <TeamLibrary tabs={<RangesTabs active="time" />} />
      </main>
    </AppShell>
  );
}
