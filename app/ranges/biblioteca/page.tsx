"use client";

import { AppShell } from "@/components/app-shell";
import { Biblioteca } from "@/components/ranges/biblioteca";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// Sem AppHeader (barra sticky) -- as abas do modulo entram direto no
// fluxo da pagina, mesma distancia do topo que o Treino.
export default function BibliotecaPage() {
  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <div className="mb-4 flex justify-end">
          <RangesTabs active="biblioteca" />
        </div>

        <Biblioteca />
      </main>
    </AppShell>
  );
}
