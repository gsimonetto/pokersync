"use client";

import { AppShell } from "@/components/app-shell";
import { TreeList } from "@/components/ranges/tree-list";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// Sem AppHeader (barra sticky) -- as abas do modulo entram direto no
// fluxo da pagina, mesma distancia do topo que o Treino.
export default function ArvoresPage() {
  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        <TreeList tabs={<RangesTabs active="arvores" />} />
      </main>
    </AppShell>
  );
}
