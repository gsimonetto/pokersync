"use client";

import { DashboardStyles } from "@/components/design-dashboard/dashboard-styles";
import { DashboardSidebar, MobileModuleBar } from "@/components/design-dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/design-dashboard/dashboard-header";
import { AiCoachCard } from "@/components/design-dashboard/ai-coach-card";
import { IndicatorsCard } from "@/components/design-dashboard/indicators-card";
import { AgendaCard } from "@/components/design-dashboard/agenda-card";
import { HabitsCard } from "@/components/design-dashboard/habits-card";
import { QuickNotesCard } from "@/components/design-dashboard/quick-notes-card";
import { WeeklyStatsCard } from "@/components/design-dashboard/weekly-stats-card";

// PROTÓTIPO VISUAL — Dashboard "Dark Glassmorphism" (roxo neon).
//
// Tela de maquete, fora do fluxo do app: não está no menu do AppShell e
// não substitui a Home (/inicio). Serve pra validar a direção visual com
// dados REAIS (coach, indicadores, banca, metas, agenda, anotações e
// estatísticas da semana), nunca com números inventados.
//
// Sem rodapé de ícones (removido a pedido do usuário): no computador a
// barra lateral basta; no celular a navegação é a fita de módulos no
// topo. Todo o CSS vive escopado em `.psd-root`
// (components/design-dashboard/dashboard-styles.tsx) pra não vazar pras
// telas de produção.
export default function DashboardPrototipoPage() {
  return (
    <div className="psd-root">
      <DashboardStyles />
      <DashboardSidebar />

      <main className="px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:pl-[100px] lg:pr-6">
        <MobileModuleBar />
        <DashboardHeader />

        {/* Grade: 1 coluna no celular, 2 no tablet, 3 no computador.
            O Coach ocupa duas colunas (é o card que se lê primeiro) e o
            contador da semana fecha a tela em largura total. */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AiCoachCard className="md:col-span-2" style={{ animationDelay: "40ms" }} />
          <IndicatorsCard style={{ animationDelay: "100ms" }} />
          <AgendaCard style={{ animationDelay: "160ms" }} />
          <HabitsCard style={{ animationDelay: "220ms" }} />
          <QuickNotesCard style={{ animationDelay: "280ms" }} />
          <WeeklyStatsCard className="md:col-span-2 xl:col-span-3" style={{ animationDelay: "340ms" }} />
        </div>
      </main>
    </div>
  );
}
