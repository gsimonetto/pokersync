"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DiaryHeader } from "@/components/diario/diary-header";
import { AgendaCard } from "@/components/diario/agenda-card";
import { WeeklyGoalsCard } from "@/components/diario/weekly-goals-card";
import { GameChangesCard } from "@/components/diario/game-changes-card";
import { WhatToDoCard } from "@/components/diario/what-to-do-card";
import { LeaksCard } from "@/components/revisor/leaks-card";
import { EvolutionScoreCard } from "@/components/analysis/EvolutionScoreCard";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchProgress } from "@/lib/services/xp-service";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";

// Home Diário — "diário do jogador": lista vertical de cards separados,
// identidade de app de hábito pessoal (Day One/Oura), animação em
// cascata por card na entrada (fade-in-up global já respeita
// prefers-reduced-motion, ver app/globals.css). A antiga Home
// (app/modulos/page.tsx) continua existindo como hub de navegação —
// acessível pelo link "Ver módulos" abaixo, no cabeçalho desta tela.
export default function DiarioPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [perf, setPerf] = useState<PlayerPerformance | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [profileRes, progressRes, perfRes] = await Promise.allSettled([
        fetchProfile(),
        fetchProgress(),
        fetchPlayerPerformance(),
      ]);
      if (!alive) return;
      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (progressRes.status === "fulfilled") setStreakDays(progressRes.value.streak_days);
      if (perfRes.status === "fulfilled") setPerf(perfRes.value);
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
      {/* w-full sem max-w/mx-auto (convenção do AppShell, ver seu
          comentário no topo do arquivo) -- em telas largas o Diário usa
          duas colunas (agenda/evolução à esquerda, o resto à direita) em
          vez de uma coluna estreita centralizada com espaço vazio nas
          laterais. Em telas estreitas as duas colunas empilham. */}
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

        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[380px_1fr]">
          <div className="flex flex-col gap-4">
            <AgendaCard style={{ animationDelay: "60ms" }} />
            <div className="fade-in-up" style={{ animationDelay: "360ms" }}>
              <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.1em] text-muted">Sua evolução</h2>
              <EvolutionScoreCard perf={perf} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <WeeklyGoalsCard style={{ animationDelay: "120ms" }} />
            <GameChangesCard style={{ animationDelay: "180ms" }} />
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
        </div>
      </main>
    </AppShell>
  );
}
