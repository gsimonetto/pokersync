// components/top-nav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleHelp, CreditCard, Crown, House, Trophy } from "lucide-react";
import { Logo } from "./logo";
import { AvatarNivel } from "./avatar-nivel";
import { NotificationsMenu } from "./notifications-menu";
import { HelpMenu } from "./help-menu";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import { fetchMyPlanId } from "@/lib/services/plan-service";
import type { PlanId } from "@/lib/plans/plans-data";
import { createClient } from "@/lib/supabase/client";
import { useInactivityLogout } from "@/lib/hooks/use-inactivity-logout";
import { usePresenceHeartbeat } from "@/lib/hooks/use-presence-heartbeat";

// Icone do atalho "Tarefas" bate com o icone do card "Hub de Evolução"
// (lib/modules-data.tsx) -- os dois levam pro mesmo /hub, entao usar
// icones diferentes pra mesma tela so' confundia no reconhecimento.
const TABS = [
  { label: "Início", href: "/inicio", icon: House },
  { label: "Tarefas", href: "/hub", icon: Trophy },
] as const;

type OpenMenu = "notifications" | "help" | null;

const HIDDEN_ROUTES = ["/login", "/esqueci-senha", "/redefinir-senha", "/agent-login"];

function isHiddenRoute(pathname: string) {
  return HIDDEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Modulos que ja migraram pro AppShell (sidebar/topbar propria,
// components/app-shell.tsx) -- mostrar o TopNav global junto duplicaria
// navegacao no topo da tela. Prefixo, nao rota exata: cobre sub-rotas
// como /time/jogador/[id] sem listar cada uma.
//
// "/time/convite" fica de fora de proposito: e' o fluxo de aceitar
// convite, que nao usa o AppShell (pode rodar sem sessao/time ainda
// resolvido) -- ali o TopNav global continua sendo a unica navegacao.
// "/revisor/admin" tambem fica de fora: painel oculto (sem link no fluxo
// do jogador, acesso direto por URL restrito a um unico e-mail) que
// nunca foi migrado pro AppShell.
const APP_SHELL_ROUTE_PREFIXES = ["/inicio", "/modulos", "/banca", "/revisor", "/hub", "/performance", "/ranges", "/time", "/treino", "/planos", "/radar", "/minha-conta", "/marketplace", "/configuracoes", "/notificacoes"];
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
  const [xpNivel, setXpNivel] = useState(0);
  const [unread, setUnread] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [plan, setPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const [p, { data: progressRow }, unreadCount, planId] = await Promise.all([
          fetchProfile(),
          supabase.from("user_progress").select("level, xp_current").maybeSingle(),
          fetchUnreadCount().catch(() => 0),
          fetchMyPlanId().catch(() => null),
        ]);
        if (!alive) return;
        setProfile(p);
        setLevel(progressRow?.level ?? null);
        setXpNivel(progressRow?.xp_current ?? 0);
        setUnread(unreadCount);
        setPlan(planId);
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
    <header className="relative sm:sticky sm:top-0 z-30 border-b border-white/[0.06] bg-[#0c0c0c]/80 backdrop-blur-xl">
      {/* Full-width igual ao resto do app (px-6, padrao em toda pagina) —
          antes o header usava max-w-[1280px] centralizado, o que deixava
          logo/icones "recuados" enquanto o corpo da pagina foi esticado
          ate a borda pra matar o espaco vazio nas laterais em telas
          largas, dando a impressao de margem desalinhada. */}
      {/* No celular (abaixo de sm) tudo aperta um pouco -- logo menor,
          ícones de 32px com 2px entre eles, menos respiro nas bordas -- pra
          caber em 360px sem rolagem lateral (se ainda faltar espaço, o logo
          encolhe sem deformar). No computador nada muda. */}
      <div className="flex h-16 sm:h-18 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/modulos" aria-label="Ir para Módulos" className="min-w-0 shrink">
          <Logo className="h-7 w-auto object-contain object-left sm:h-10" />
        </Link>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
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
                className={`grid size-8 place-items-center rounded-lg transition-colors sm:size-9 ${
                  isActive ? "bg-white/[0.08] text-ink" : "text-muted hover:bg-white/[0.06] hover:text-ink"
                }`}
              >
                <Icon className="size-[18px]" />
              </Link>
            );
          })}

          {/* Coroa (upsell) so' pra quem e' Free -- quem ja paga algo ve
              "Meu Plano" no lugar. Mesma regra de components/app-shell.tsx. */}
          {plan === "free" ? (
            <Link
              href="/planos"
              aria-current={pathname === "/planos" ? "page" : undefined}
              aria-label="Planos"
              title="Planos"
              className={`grid size-8 place-items-center rounded-lg text-[#E8B93C] transition-colors sm:size-9 hover:bg-[#E8B93C]/10 ${
                pathname === "/planos" ? "bg-[#E8B93C]/10" : ""
              }`}
            >
              <Crown className="size-[18px]" />
            </Link>
          ) : (
            <Link
              href="/minha-conta"
              aria-current={pathname === "/minha-conta" ? "page" : undefined}
              aria-label="Meu Plano"
              title="Meu Plano"
              className={`grid size-8 place-items-center rounded-lg transition-colors hover:bg-white/[0.06] hover:text-ink sm:size-9 ${
                pathname === "/minha-conta" ? "text-ink" : "text-muted"
              }`}
            >
              <CreditCard className="size-[18px]" />
            </Link>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => toggle("notifications")}
              className="relative grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink sm:size-9"
              aria-label="Notificações"
            >
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-[#d4af37] px-1 text-[9px] font-bold leading-[15px] text-black">
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
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink sm:size-9"
              aria-label="Ajuda"
            >
              <CircleHelp className="size-[18px]" />
            </button>
            {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}
          </div>

          {/* Foto leva pras Configurações (página própria, /configuracoes). */}
          <div className="relative">
            <Link
              href="/configuracoes"
              className="ml-1 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-1.5 transition-colors hover:border-[#d4af37]/40 hover:bg-white/[0.08] sm:ml-1.5 sm:gap-2 sm:pr-2.5"
              aria-label="Configurações"
              title="Configurações"
            >
              {/* Anel de nível (cor da patente + quanto falta pro próximo),
                  o mesmo de toda foto de jogador no app. */}
              <AvatarNivel avatarId={profile?.avatar_id ?? 1} avatarUrl={profile?.avatar_url} tamanho={36} nivel={level} xpAtual={xpNivel} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
