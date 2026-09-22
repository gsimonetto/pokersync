"use client";

import { DashboardStyles } from "@/components/design-dashboard/dashboard-styles";
import { DashboardSidebar } from "@/components/design-dashboard/dashboard-sidebar";
import { DashboardDock } from "@/components/design-dashboard/dashboard-dock";
import { DashboardHeader } from "@/components/design-dashboard/dashboard-header";
import { QuickActionsBar } from "@/components/design-dashboard/quick-actions-bar";
import { FocusTimerCard } from "@/components/design-dashboard/focus-timer-card";
import { HabitsCard } from "@/components/design-dashboard/habits-card";
import { ReviewHandsCard } from "@/components/design-dashboard/review-hands-card";
import { AgendaCard } from "@/components/design-dashboard/agenda-card";
import { QuickNotesCard } from "@/components/design-dashboard/quick-notes-card";

// PROTÓTIPO VISUAL — Dashboard "Dark Glassmorphism" (roxo neon).
//
// Tela de maquete, fora do fluxo do app: não está no menu do AppShell e
// não substitui a Home (/inicio). Serve pra validar a direção visual com
// dados REAIS (banca, metas, fila do Revisor, agenda do time, anotações),
// não com números inventados.
//
// Por que não usa <AppShell>: a referência pede sidebar flutuante só de
// ícones + dock no rodapé, layout diferente da casca de produção. Todo o
// CSS vive escopado em `.psd-root` (components/design-dashboard/
// dashboard-styles.tsx) pra não vazar pras telas reais.
export default function DashboardPrototipoPage() {
  return (
    <div className="psd-root">
      <DashboardStyles />
      <DashboardSidebar />

      {/* Espaço à esquerda só onde a sidebar existe (lg+); embaixo, folga
          pro dock flutuante não cobrir o último card. */}
      <main className="px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:pl-[100px] lg:pr-6">
        <DashboardHeader />

        {/* Ações rápidas: fileira rolável logo abaixo do cabeçalho no
            celular, barra flutuante no rodapé do computador (onde o
            dock de navegação deixou de existir). */}
        <QuickActionsBar />

        {/* Grade dos widgets: 1 coluna no celular, 2 no tablet, 3 no
            desktop. A ordem foi escolhida pra não sobrar buraco em
            nenhuma das três larguras -- a lista de mãos ocupa duas
            colunas e fecha a última linha. */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AgendaCard style={{ animationDelay: "40ms" }} />
          <HabitsCard style={{ animationDelay: "100ms" }} />
          <FocusTimerCard style={{ animationDelay: "160ms" }} />
          <QuickNotesCard style={{ animationDelay: "220ms" }} />
          <ReviewHandsCard className="md:col-span-2" style={{ animationDelay: "280ms" }} />
        </div>

      </main>

      {/* Navegação de rodapé só no celular: no computador ela duplicaria
          a barra lateral (pedido do usuário), e lá o rodapé passou a ser
          das ações rápidas. */}
      <DashboardDock />
    </div>
  );
}
