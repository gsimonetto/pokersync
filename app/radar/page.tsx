"use client";

import { RadarPanel } from "@/components/analysis/RadarPanel";
import { TelaVidro } from "@/components/ui/tela-vidro";
import { RADAR_COPY } from "@/lib/plans/module-copy";

// Página do addon Radar PokerSync -- só é alcançada por quem tem o addon
// (ADDON_ROUTES em lib/plans/plans-data.ts + lib/supabase/middleware.ts).
// Continua como rota própria porque o bloqueio do addon precisa de uma URL
// pra redirecionar; o conteúdo é o mesmo RadarPanel da aba "Radar" da
// Performance.
export default function RadarPage() {
  return (
    <TelaVidro titulo={RADAR_COPY.title} subtitulo={RADAR_COPY.blurb}>
      <RadarPanel cabecalho={false} />
    </TelaVidro>
  );
}
