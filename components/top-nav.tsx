"use client";

import { useEffect, useState } from "react";
import { Bell, CircleHelp } from "lucide-react";
import { Logo } from "./logo";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Início", "Desempenho"] as const;

function initialsFrom(nome?: string | null, apelido?: string | null, email?: string | null) {
  const source = apelido || nome || email || "";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TopNav() {
  const [active, setActive] = useState<(typeof tabs)[number]>("Início");
  const [initials, setInitials] = useState("PS");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!alive || !data.user) return;
        const meta = data.user.user_metadata || {};
        setInitials(initialsFrom(meta.nome, meta.apelido, data.user.email));
      } catch {
        // sem sessao configurada: mantem o fallback "PS"
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {tabs.map((tab) => {
            const isActive = active === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActive(tab)}
                aria-current={isActive ? "page" : undefined}
                className={`relative rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {tab}
                <span
                  className={`absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-ink transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-ink"
            aria-label="Notificações"
          >
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-ink ring-2 ring-void" />
          </button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-ink"
            aria-label="Ajuda"
          >
            <CircleHelp className="size-[18px]" />
          </button>

          <button
            type="button"
            className="relative ml-1.5 flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] py-1 pl-1 pr-2.5 transition-colors hover:bg-white/[0.08]"
            aria-label="Perfil"
          >
            <span className="grid size-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-void">
              {initials}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
