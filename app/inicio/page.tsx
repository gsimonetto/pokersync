"use client";

import { useEffect, useState } from "react";
import { Bell, Clock3, LayoutGrid, WalletCards } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function formatDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function InicioPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchProfile().then(setProfile).catch(() => undefined);
    }

    const updateClock = () =>
      setCurrentTime(
        new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    updateClock();
    const interval = setInterval(updateClock, 30_000);
    return () => clearInterval(interval);
  }, []);

  const nome = profile?.apelido?.trim() || profile?.nome?.trim() || "jogador";

  return (
    <AppShell>
      <main className="min-h-screen bg-void text-ink">
        <header className="border-b border-hairline/60 bg-void/80 px-4 py-6 backdrop-blur-xl md:px-8 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">
                {formatDate()}
              </p>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Bom dia, <span className="text-review">{nome}</span>.
              </h1>
              <p className="mt-2 text-sm text-muted">
                Foco · Estude · Execute · Evolua
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-4 py-3 sm:flex">
                <Clock3 size={17} className="text-review" />
                <span className="font-mono text-sm tnum text-ink">{currentTime}</span>
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-4 py-3 lg:flex">
                <WalletCards size={17} className="text-positive" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted/60">Bankroll total</p>
                  <p className="font-mono text-sm font-semibold tnum text-ink">$ 2.480,00</p>
                </div>
              </div>
              <button className="flex size-11 items-center justify-center rounded-xl border border-hairline bg-surface/60 text-muted transition-colors hover:border-review/40 hover:text-review">
                <Bell size={18} />
                <span className="sr-only">Notificações</span>
              </button>
              <Link
                href="/modulos"
                className="hidden items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-3 py-3 text-xs font-semibold text-muted transition-colors hover:border-review/40 hover:text-ink md:flex"
              >
                <LayoutGrid size={15} />
                Módulos
              </Link>
            </div>
          </div>
        </header>

        <Dashboard />
      </main>
    </AppShell>
  );
}

