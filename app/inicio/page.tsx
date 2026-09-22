"use client";

import { AppShell } from "@/components/app-shell";
import { PainelStyles } from "@/components/painel/painel-styles";
import { PainelHeader } from "@/components/painel/painel-header";
import { AiCoachCard } from "@/components/painel/ai-coach-card";
import { AgendaCard } from "@/components/painel/agenda-card";
import { IndicatorsCard } from "@/components/painel/indicators-card";
import { HabitsCard } from "@/components/painel/habits-card";
import { ReviewHandsCard } from "@/components/painel/review-hands-card";

// Painel — tela de início do jogador. Substitui o "diário" anterior
// (lista vertical de cards de reflexão/agenda/metas/insights): a mesma
// informação agora chega por um Coach único, que junta o que cada
// módulo tem a dizer e mostra uma orientação por vez.
//
// Segue a regra de padrão visual do AppShell (ver components/app-shell.tsx):
// `<main className="w-full px-4 py-6 md:px-6">`, full-bleed, e o primeiro
// elemento dentro do main sem `mt-*`. A navegação (lateral, notificações,
// perfil, conversas) continua sendo a do AppShell -- o Painel não tem
// menu próprio.
//
// O CSS da tela vive escopado em `.painel`
// (components/painel/painel-styles.tsx): fundo preto com grade de pontos
// e brilho de canto, e cada card com o facho de luz que segue o mouse --
// os mesmos elementos da tela de login (app/login/login-form.tsx).
export default function InicioPage() {
  return (
    <AppShell>
      <main className="painel w-full px-4 py-6 md:px-6">
        <PainelStyles />
        <PainelHeader />

        {/* Duas faixas: em cima o que exige leitura (Coach e Calendário,
            lado a lado e da mesma altura -- a grade já estica os dois
            pela linha); embaixo os três cards de consulta rápida, em
            tamanho normal. */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AiCoachCard className="md:col-span-1 xl:col-span-2" style={{ animationDelay: "40ms" }} />
          <AgendaCard style={{ animationDelay: "100ms" }} />
          <IndicatorsCard style={{ animationDelay: "160ms" }} />
          <HabitsCard style={{ animationDelay: "220ms" }} />
          <ReviewHandsCard style={{ animationDelay: "280ms" }} />
        </div>
      </main>
    </AppShell>
  );
}
