"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CircleHelp, Home, LogOut, MessageCircle, PanelLeftClose, PanelLeftOpen, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { NotificationsMenu } from "@/components/notifications-menu";
import { HelpMenu } from "@/components/help-menu";
import { ProfileMenu } from "@/components/profile-menu";
import { RankChip } from "@/components/ui/rank-chip";
import { ChatCenter } from "@/components/chat/chat-center";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import { fetchTeamUnreadCount } from "@/lib/services/team-service";
import { fetchFriendUnreadCount } from "@/lib/services/friend-service";
import { modules } from "@/lib/modules-data";

type OpenMenu = "notifications" | "help" | "profile" | "chats" | null;

// Badge do icone de Conversas soma as duas fontes -- time e amigos sao
// tabelas separadas (team_messages/friend_messages), ver
// components/chat/chat-center.tsx.
async function fetchAllChatUnread(): Promise<number> {
  const [time, amigos] = await Promise.all([
    fetchTeamUnreadCount().catch(() => 0),
    fetchFriendUnreadCount().catch(() => 0),
  ]);
  return time + amigos;
}

const SIDEBAR_COLLAPSE_KEY = "pokersync:sidebar-collapsed";

// Casca compartilhada (sidebar + topbar) entre os módulos que já migraram
// pro layout novo -- hoje /modulos e /banca. Cada módulo continua dono do
// próprio conteúdo/dados; isto aqui é só navegação e identidade (perfil,
// notificações, ajuda), igual ao TopNav global fazia antes pra essas rotas
// (que agora ficam escondidas dele, ver components/top-nav.tsx).
//
// REGRA DE PADRÃO VISUAL (pedido explícito: "todos seguindo o mesmo
// padrão do modo treino") -- todo `app/**/page.tsx` que usa <AppShell>
// segue isto, com /treino como referência:
//   1. `<main className="w-full px-6 py-10 ...">` -- full-bleed, sem
//      `max-w-*`/`mx-auto`: telas largas não podem sobrar espaço vazio
//      nas laterais (isso é o que deixava a informação "espremida" no
//      centro). /modulos (Home) usa `px-4 py-6 md:px-6` -- variação só
//      de margem lateral/vertical no mobile, mesmo princípio full-width.
//      Nunca outro valor de `py-*` fora desses dois casos.
//   2. O PRIMEIRO elemento renderizado dentro do `<main>` (ignorando um
//      banner de erro condicional) NUNCA leva `mt-*` -- ele encosta
//      direto no padding do `<main>`, na mesma distância do topbar em
//      toda tela. Erro condicional usa `mb-*` (não `mt-*`) pra não
//      empurrar o conteúdo abaixo quando aparece.
//   3. Prefira UM container único (`rounded-2xl border border-hairline
//      bg-surface p-4 sm:p-5`) envolvendo toda ferramenta de tela única
//      (Treino, Construtor de Ranges, Comparar, Equidade, Árvores) --
//      exceção: telas de galeria/lista (Biblioteca, Time, Journal,
//      lista de Árvores) usam cards por item, não um envelope único.
//   4. Uma barra de utilidade fixa (AppHeader com abas/toggle/período --
//      Hub, Performance, Revisor, abas do Construtor de Ranges) é a
//      única exceção aceita à distância idêntica ao Treino: ela precisa
//      ficar sticky pra continuar acessível ao rolar, o que Treino não
//      tem porque o card dele já é de altura fixa. Mantenha essa barra
//      enxuta (sem título/ícone/voltar quando o menu lateral já
//      identifica o módulo -- ver components/app-header.tsx).
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Deep link do sino de notificacao de chat (?chat=<userId>) -- abre a
  // Central de Conversas ja na thread de quem mandou a mensagem. Le
  // direto de window.location (nao useSearchParams): esse hook exige
  // suspense boundary em toda pagina que usa AppShell, so' pra um valor
  // que a gente le uma unica vez no mount.
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    } catch {
      // localStorage indisponível (ex: modo privado) -- mantém expandida
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      let supabase: ReturnType<typeof createClient>;
      try {
        supabase = createClient();
      } catch {
        return;
      }
      const [profileRes, progressRes, unreadRes, unreadChatsRes] = await Promise.allSettled([
        fetchProfile(),
        supabase.from("user_progress").select("level").maybeSingle(),
        fetchUnreadCount(),
        fetchAllChatUnread(),
      ]);
      if (!alive) return;
      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (progressRes.status === "fulfilled") setLevel(progressRes.value.data?.level ?? null);
      if (unreadRes.status === "fulfilled") setUnread(unreadRes.value);
      if (unreadChatsRes.status === "fulfilled") setUnreadChats(unreadChatsRes.value);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const chatId = new URLSearchParams(window.location.search).get("chat");
    if (!chatId) return;
    setPendingChatId(chatId);
    setOpenMenu("chats");
    // limpa o parametro da URL pra nao reabrir num refresh/voltar
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // segue sem persistir se localStorage falhar
      }
      return next;
    });
  }

  function toggleMenu(menu: OpenMenu) {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  }

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // segue o logout mesmo se a chamada falhar (inclusive se
      // createClient() lancar por env do Supabase ausente)
    }
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <>
      {modules.map((m) => {
        const Icon = m.icon;
        const active = pathname === m.href;
        // Hover usa a cor do proprio modulo (m.accent) com o mesmo
        // tratamento do Chip (fundo translucido + glow) em vez de um
        // hover cinza generico -- pedido explicito pra ficar "nitido",
        // igual ao resto do produto ja associa cor a cada modulo.
        const hovered = hoverKey === m.key;
        return (
          <Link
            key={m.key}
            href={m.href ?? "#"}
            title={collapsed ? m.title : undefined}
            onClick={() => setMobileOpen(false)}
            onMouseEnter={() => setHoverKey(m.key)}
            onMouseLeave={() => setHoverKey((k) => (k === m.key ? null : k))}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              collapsed ? "justify-center" : ""
            } ${active || hovered ? "text-ink" : "text-muted"}`}
            style={{
              background: hovered ? `${m.accent}1A` : active ? "rgba(255,255,255,0.06)" : undefined,
              boxShadow: hovered ? `0 0 14px ${m.accent}55, 0 0 2px ${m.accent}` : undefined,
            }}
          >
            <span
              className="absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-opacity"
              style={{ background: m.accent, opacity: active || hovered ? 1 : 0 }}
            />
            <Icon size={18} strokeWidth={1.75} className="shrink-0" style={{ color: active || hovered ? m.accent : undefined }} />
            {!collapsed && m.title}
          </Link>
        );
      })}
    </>
  );

  const footer = (
    <>
      <button
        onClick={handleLogout}
        title={collapsed ? "Sair" : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-negative/[0.08] hover:text-negative ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
        {!collapsed && "Sair"}
      </button>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-void">
      {/* ============ SIDEBAR (desktop) ============ */}
      <aside
        className={`hidden md:flex h-full shrink-0 flex-col border-r border-hairline bg-surface transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-[76px]" : "w-[264px]"
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-hairline ${
            collapsed ? "justify-center px-2" : "justify-between px-5"
          }`}
        >
          {!collapsed && (
            <Link href="/modulos" aria-label="Ir para Módulos">
              <Logo className="h-10 w-auto" />
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-hidden px-3 py-4">
          {!collapsed && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Módulos</p>}
          {nav}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-hairline px-3 py-3">{footer}</div>
      </aside>

      {/* ============ SIDEBAR (mobile drawer) ============ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[264px] flex-col border-r border-hairline bg-surface">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-5">
              <Link href="/modulos" aria-label="Ir para Módulos" onClick={() => setMobileOpen(false)}>
                <Logo className="h-10 w-auto" />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
                aria-label="Fechar menu"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Módulos</p>
              {nav}
            </nav>
            <div className="flex shrink-0 flex-col gap-0.5 border-t border-hairline px-3 py-3">{footer}</div>
          </div>
        </div>
      )}

      {/* ============ MAIN ============ */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-center gap-2 border-b border-hairline px-4 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-auto grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-[18px]" />
          </button>
          <div className="flex items-center gap-1.5">
            <Link
              href="/modulos"
              className={`grid size-9 place-items-center rounded-lg transition-colors hover:bg-white hover:text-void ${
                pathname === "/modulos" ? "text-ink" : "text-muted"
              }`}
              aria-label="Início"
              title="Início"
            >
              <Home className="size-[18px]" />
            </Link>
            <button
              onClick={() => toggleMenu("chats")}
              className="relative grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
              aria-label="Conversas"
              title="Conversas"
            >
              <MessageCircle className="size-[18px]" />
              {unreadChats > 0 && (
                <span className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-evolution px-1 text-[9px] font-bold leading-[15px] text-void">
                  {unreadChats > 9 ? "9+" : unreadChats}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => toggleMenu("notifications")}
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
              {openMenu === "notifications" && (
                <NotificationsMenu
                  onClose={() => {
                    setOpenMenu(null);
                    fetchUnreadCount()
                      .then(setUnread)
                      .catch(() => {});
                  }}
                />
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => toggleMenu("help")}
                className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-void"
                aria-label="Ajuda"
              >
                <CircleHelp className="size-[18px]" />
              </button>
              {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}
            </div>
            <div className="relative">
              <button
                onClick={() => toggleMenu("profile")}
                aria-label="Perfil"
                className="ml-1.5 flex items-center gap-2 rounded-full border border-hairline bg-elevated py-1 pl-1 pr-3 transition-colors hover:border-white/20"
              >
                <Avatar id={profile?.avatar_id ?? 1} url={profile?.avatar_url} size={28} />
                {level != null && <RankChip level={level} />}
              </button>
              {openMenu === "profile" && profile && (
                <ProfileMenu profile={profile} onProfileChange={setProfile} onClose={() => setOpenMenu(null)} />
              )}
            </div>
          </div>
          {/* espaçador simétrico ao botão de hamburguer, só pra manter os
              ícones centralizados também no mobile */}
          <div className="ml-auto size-9 md:hidden" aria-hidden="true" />
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>

      {openMenu === "chats" && (
        <ChatCenter
          initialOtherUserId={pendingChatId}
          onClose={() => {
            setOpenMenu(null);
            setPendingChatId(null);
            fetchAllChatUnread().then(setUnreadChats);
          }}
        />
      )}
    </div>
  );
}
