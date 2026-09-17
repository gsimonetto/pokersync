"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DiaryHeader } from "@/components/diario/diary-header";
import { AgendaCard } from "@/components/diario/agenda-card";
import { WeeklyGoalsCard } from "@/components/diario/weekly-goals-card";
import { InsightsCard } from "@/components/diario/insights-card";
import { WhatToDoCard } from "@/components/diario/what-to-do-card";
import { LeaksCard } from "@/components/revisor/leaks-card";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchProgress } from "@/lib/services/xp-service";

// Home Diário — "diário do jogador": lista vertical de cards separados,
// largura total (sem max-w, mesma convenção do resto do AppShell —
// ver components/app-shell.tsx), identidade de app de hábito pessoal
// (Day One/Oura), animação em cascata por card na entrada (fade-in-up
// global já respeita prefers-reduced-motion, ver app/globals.css). A
// antiga Home (app/modulos/page.tsx) continua existindo como hub de
// navegação — acessível pelo link "Ver módulos" no cabeçalho desta
// tela. Sem card de Score de Evolução aqui (pedido explícito: as 5
// colunas de métrica dele não cabem bem numa tela de diário — ele
// continua existindo no módulo de Análise).
export default function DiarioPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profileRes, progressRes] = await Promise.allSettled([fetchProfile(), fetchProgress()]);
      if (!alive) return;
      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (progressRes.status === "fulfilled") setStreakDays(progressRes.value.streak_days);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function irParaTreino(leak: { drill_id?: string }) {
    if (!leak?.drill_id) return;
    router.push(`/treino?suggestionId=${leak.drill_id}`);
  }

  const nome = profile?.apelido?.trim() || profile?.nome?.trim() || "";

  return (
    <AppShell>
      {/* w-full sem max-w/mx-auto (convenção do AppShell) -- uma coluna
          só de cards largos, cada um ocupando a tela toda, igual ao
          wireframe validado (nada de sidebar estreita espremendo
          conteúdo com várias colunas internas). */}
      <main className="w-full px-4 py-6 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <DiaryHeader nome={nome} streakDays={streakDays} />
          <Link
            href="/modulos"
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            <LayoutGrid size={13} />
            Ver módulos
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <AgendaCard style={{ animationDelay: "60ms" }} />
          <WeeklyGoalsCard style={{ animationDelay: "120ms" }} />
          <InsightsCard style={{ animationDelay: "180ms" }} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* LeaksCard já é seu próprio card com título/estilo — some
                sozinho (retorna null) quando não há leak recorrente
                ainda, então não envolvemos com um título duplicado
                aqui. */}
            <div className="fade-in-up" style={{ animationDelay: "240ms" }}>
              <LeaksCard onPractice={irParaTreino} />
            </div>
            <WhatToDoCard style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
