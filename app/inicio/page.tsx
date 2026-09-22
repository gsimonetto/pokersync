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
      <main className="painel w-full px-4 py-6 md:px-6 xl:flex xl:h-full xl:flex-col xl:overflow-hidden xl:py-5">
        <PainelStyles />
        <PainelHeader />

        {/* Seis colunas no computador pra as duas faixas terem divisões
            diferentes sem grades separadas: em cima, Coach e Calendário
            com 3 colunas cada (mesma largura e mesma altura); embaixo,
            três cards de 2 colunas.

            No computador a tela inteira cabe na janela, sem barra de
            rolagem (pedido explícito): as duas faixas dividem a altura
            que sobra depois do cabeçalho, e é cada CARD que rola por
            dentro quando o conteúdo passa do espaço. No celular nada
            disso vale -- lá a página rola normalmente, como se espera. */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-6 xl:grid-rows-[minmax(0,1.08fr)_minmax(0,1fr)]">
          <AiCoachCard className="xl:col-span-3" style={{ animationDelay: "40ms" }} />
          <AgendaCard className="xl:col-span-3" style={{ animationDelay: "100ms" }} />
          <IndicatorsCard className="xl:col-span-2" style={{ animationDelay: "160ms" }} />
          <HabitsCard className="xl:col-span-2" style={{ animationDelay: "220ms" }} />
          <ReviewHandsCard className="xl:col-span-2" style={{ animationDelay: "280ms" }} />
        </div>
      </main>
    </AppShell>
  );
}
