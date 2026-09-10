"use client";

import { AppShell } from "@/components/app-shell";
import { RadarPanel } from "@/components/analysis/RadarPanel";

// Pagina do addon Radar PokerSync -- so' e' alcancada por quem tem o addon
// (ver ADDON_ROUTES em lib/plans/plans-data.ts + gating em
// lib/supabase/middleware.ts); quem nao tem cai na modal de upsell antes
// de chegar aqui. Continua existindo como rota standalone (fora do menu
// lateral, ver app-shell.tsx) porque o gating de addon precisa de uma URL
// propria pra redirecionar/travar -- o conteudo em si mora em RadarPanel,
// reaproveitado tambem dentro da aba "Radar" de Player Evolution.
export default function RadarPage() {
  return (
    <AppShell>
      <main className="w-full px-4 py-6 md:px-6 md:py-10">
        <RadarPanel />
      </main>
    </AppShell>
  );
}
