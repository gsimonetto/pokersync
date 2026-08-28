// components/top-nav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleHelp, House, Trophy } from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "./avatar";
import { ProfileMenu } from "./profile-menu";
import { NotificationsMenu } from "./notifications-menu";
import { HelpMenu } from "./help-menu";
import { RankChip } from "./ui/rank-chip";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import { createClient } from "@/lib/supabase/client";
import { useInactivityLogout } from "@/lib/hooks/use-inactivity-logout";
import { usePresenceHeartbeat } from "@/lib/hooks/use-presence-heartbeat";

// Icone do atalho "Tarefas" bate com o icone do card "Hub de Evolução"
// (lib/modules-data.tsx) -- os dois levam pro mesmo /hub, entao usar
// icones diferentes pra mesma tela so' confundia no reconhecimento.
const TABS = [
  { label: "Início", href: "/modulos", icon: House },
  { label: "Tarefas", href: "/hub", icon: Trophy },
] as const;

type OpenMenu = "profile" | "notifications" | "help" | null;

const HIDDEN_ROUTES = ["/login", "/esqueci-senha", "/redefinir-senha", "/agent-login"];

function isHiddenRoute(pathname: string) {
  return HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Modulos que ja migraram pro AppShell (sidebar/topbar propria,
// components/app-shell.tsx) -- mostrar o TopNav global junto duplicaria
// navegacao no topo da tela. Prefixo, nao rota exata: cobre sub-rotas
// como /ranges/arvores/[id] ou /time/jogador/[id] sem listar cada uma.
//
// "/time/convite" fica de fora de proposito: e' o fluxo de aceitar
// convite, que nao usa o AppShell (pode rodar sem sessao/time ainda
// resolvido) -- ali o TopNav global continua sendo a unica navegacao.
// "/revisor/admin" tambem fica de fora: painel oculto (sem link no fluxo
// do jogador, acesso direto por URL restrito a um unico e-mail) que
// nunca foi migrado pro AppShell.
const APP_SHELL_ROUTE_PREFIXES = ["/modulos", "/banca", "/revisor", "/hub", "/performance", "/ranges", "/time", "/treino"];
const APP_SHELL_EXCLUDED_PREFIXES = ["/time/convite", "/revisor/admin"];

function usaAppShell(pathname: string) {
  if (APP_SHELL_EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return false;
  return APP_SHELL_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function TopNav() {
  const pathname = usePathname();
  // Montado no layout raiz (renderiza em toda pagina, mesmo devolvendo
  // null pro proprio nav em rotas com AppShell) -- ponto unico de
  // cobertura pro watcher de inatividade, sem duplicar o mount dentro
  // do AppShell tambem.
  useInactivityLogout();
  usePresenceHeartbeat();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const [p, { data: progressRow }, unreadCount] = await Promise.all([
          fetchProfile(),
          supabase.from("user_progress").select("level").maybeSingle(),
          fetchUnreadCount().catch(() => 0),
        ]);
        if (!alive) return;
        setProfile(p);
        setLevel(progressRow?.level ?? null);
        setUnread(unreadCount);
      } catch {
        // sem sessao configurada: mantem os fallbacks
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggle(menu: OpenMenu) {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  function closeAndRefreshUnread() {
    setOpenMenu(null);
    fetchUnreadCount()
      .then(setUnread)
      .catch(() => {});
  }

  if (isHiddenRoute(pathname) || usaAppShell(pathname)) {
    return null;
  }

  return (
    <header className="relative sm:sticky sm:top-0 z-30 border-b border-hairline bg-void/80 backdrop-blur-xl">
      {/* Full-width igual ao resto do app (px-6, padrao em toda pagina) —
          antes o header usava max-w-[1280px] centralizado, o que deixava
          logo/icones "recuados" enquanto o corpo da pagina foi esticado
          ate a borda pra matar o espaco vazio nas laterais em telas
          largas, dando a impressao de margem desalinhada. */}
      <div className="flex h-16 sm:h-18 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/modulos" aria-label="Ir para Módulos" className="shrink-0">
          <Logo className="h-8 w-auto sm:h-10" />
        </Link>

        <div className="flex items-center gap-1.5">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                title={tab.label}
                className={`grid size-9 place-items-center rounded-lg transition-colors ${
                  isActive ? "bg-white/[0.08] text-ink" : "text-muted hover:bg-white hover:text-void"
                }`}
              >
                <Icon className="size-[18px]" />
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("notifications")}
              className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
              aria-label="Notificações"
            >
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-evolution px-1 text-[9px] font-bold leading-[15px] text-void">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {openMenu === "notifications" && <NotificationsMenu onClose={closeAndRefreshUnread} />}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("help")}
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
              aria-label="Ajuda"
            >
              <CircleHelp className="size-[18px]" />
            </button>
            {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("profile")}
              className="ml-1.5 flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] py-1 pl-1 pr-2.5 transition-colors hover:bg-white/[0.08]"
              aria-label="Perfil"
            >
              <Avatar id={profile?.avatar_id ?? 1} url={profile?.avatar_url} size={34} />
              {level != null && <RankChip level={level} />}
            </button>
            {openMenu === "profile" && profile && (
              <ProfileMenu profile={profile} onProfileChange={setProfile} onClose={() => setOpenMenu(null)} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
