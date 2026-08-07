"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleHelp } from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "./avatar";
import { ProfileMenu } from "./profile-menu";
import { NotificationsMenu } from "./notifications-menu";
import { HelpMenu } from "./help-menu";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { label: "Início", href: "/modulos" },
  { label: "Tarefas", href: "/hub" },
] as const;

type OpenMenu = "profile" | "notifications" | "help" | null;

export function TopNav() {
  const pathname = usePathname();
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

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-24 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo className="h-14 w-auto sm:h-16" />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                <span
                  className={`absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-ink transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("notifications")}
              className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-ink"
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
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-ink"
              aria-label="Ajuda"
            >
              <CircleHelp className="size-[18px]" />
            </button>
            {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}
          </div>

          {/* Avatar maior + nivel ao lado — antes so tinha iniciais pequenas. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("profile")}
              className="ml-1.5 flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] py-1 pl-1 pr-2.5 transition-colors hover:bg-white/[0.08]"
              aria-label="Perfil"
            >
              <Avatar id={profile?.avatar_id ?? 1} url={profile?.avatar_url} size={34} />
              {level != null && (
                <span className="flex items-center gap-1 text-xs font-bold text-ink">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Nv</span>
                  {level}
                </span>
              )}
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
