"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CircleHelp, CreditCard, Crown, Home, Lock, LogOut, MessageCircle, PanelLeftClose, PanelLeftOpen, Menu, Settings, Trophy, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationsMenu } from "@/components/notifications-menu";
import { HelpMenu } from "@/components/help-menu";
import { ChatCenter } from "@/components/chat/chat-center";
import { PlanLockModal } from "@/components/plan-lock-modal";
import { PainelStyles } from "@/components/painel/painel-styles";
import { createClient } from "@/lib/supabase/client";
import { sairDesteAparelho } from "@/lib/supabase/sair-deste-aparelho";
import { fetchUnreadCount } from "@/lib/services/notification-service";
import { fetchMyMembership } from "@/lib/services/team-service";
import { fetchFriendUnreadCount } from "@/lib/services/friend-service";
import { fetchMyPlanState } from "@/lib/services/plan-service";
import { ABRIR_CONFIGURACOES } from "@/lib/eventos-perfil";
import { isAddonUnlockedFor, isModuleUnlockedFor, type ModuleKey, type PlanId } from "@/lib/plans/plans-data";
import { modules } from "@/lib/modules-data";

type OpenMenu = "notifications" | "help" | "chats" | null;

// Badge do chat: só conversas com amigos -- o chat com o time saiu da
// Central de Conversas (pedido explícito), ver components/chat/chat-center.tsx.
async function fetchAllChatUnread(): Promise<number> {
  return fetchFriendUnreadCount().catch(() => 0);
}

const SIDEBAR_COLLAPSE_KEY = "pokersync:sidebar-collapsed";
// Dourado do visual de vidro (mesmo dos botões principais, ver
// BOTAO_OURO em components/banca/util.ts) -- destaque do topo, do chat e
// dos contadores.
const OURO = "#d4af37";

// Botão de ícone do topo no visual de vidro: sem o "flash" branco antigo
// no hover; a tela atual ganha fundo sutil e um risquinho dourado embaixo.
function iconeTopo(ativo: boolean) {
  return `relative grid size-9 place-items-center rounded-xl transition-colors hover:bg-white/[0.06] hover:text-ink ${
    ativo ? "bg-white/[0.06] text-ink" : "text-muted"
  }`;
}
function MarcaAtivo({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return <span className="absolute -bottom-[3px] left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full" style={{ background: OURO }} aria-hidden="true" />;
}

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
//      (Treino) -- exceção: telas de galeria/lista (Meus ranges do
//      Construtor, Time) usam cards por item, não um envelope único.
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

  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  // null == plano ainda nao carregou -- nenhum modulo aparece travado
  // nesse meio tempo (evita "piscar" cadeado antes da resposta chegar).
  // A trava de verdade e' no servidor (lib/supabase/middleware.ts); isto
  // aqui e' so' pra nao deixar o jogador clicar num link que o servidor
  // vai barrar de qualquer jeito.
  const [plan, setPlan] = useState<PlanId | null>(null);
  // Radar comprado avulso, independente do plano (ver isAddonUnlocked).
  const [radarAddon, setRadarAddon] = useState(false);
  // Qualquer membro (mesmo 'pendente', ainda na fila de aprovacao)
  // enxerga "Meu Time" -- e' onde ele ve o proprio status. So' membro
  // 'ativo' usa a CASCATA de verdade (todos os outros modulos + Radar +
  // sem limite de Free), ver isModuleUnlockedFor/isAddonUnlockedFor.
  const [hasTeamMembership, setHasTeamMembership] = useState(false);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [lockedModule, setLockedModule] = useState<ModuleKey | "radar" | null>(null);

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
      try {
        createClient();
      } catch {
        return;
      }
      const [unreadRes, unreadChatsRes, planRes, membershipRes] = await Promise.allSettled([
        fetchUnreadCount(),
        fetchAllChatUnread(),
        fetchMyPlanState(),
        fetchMyMembership(),
      ]);
      if (!alive) return;
      if (unreadRes.status === "fulfilled") setUnread(unreadRes.value);
      if (unreadChatsRes.status === "fulfilled") setUnreadChats(unreadChatsRes.value);
      if (planRes.status === "fulfilled") {
        setPlan(planRes.value.plan);
        setRadarAddon(planRes.value.radarAddon);
      }
      if (membershipRes.status === "fulfilled") {
        setHasTeamMembership(membershipRes.value !== null);
        setHasTeamAccess(membershipRes.value?.status === "ativo");
      }
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

  // Outra tela pediu pra abrir as Configurações (ex.: "Preencher" no
  // cartão das Vagas) -- ver lib/eventos-perfil.ts. Configurações virou
  // página própria: leva direto pra aba de disponibilidade.
  useEffect(() => {
    const abrir = () => router.push("/configuracoes?aba=disponibilidade");
    window.addEventListener(ABRIR_CONFIGURACOES, abrir);
    return () => window.removeEventListener(ABRIR_CONFIGURACOES, abrir);
  }, [router]);

  // Chegou aqui via redirect do middleware (rota bloqueada pro plano
  // atual, ver lib/supabase/middleware.ts) -- abre a mesma modal de
  // upsell que o clique no menu abriria.
  useEffect(() => {
    const locked = new URLSearchParams(window.location.search).get("locked");
    if (!locked) return;
    setLockedModule(locked as ModuleKey | "radar");
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
      await sairDesteAparelho(supabase);
    } catch {
      // segue o logout mesmo se a chamada falhar (inclusive se
      // createClient() lancar por env do Supabase ausente)
    }
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <>
      {/* "hub" virou icone no topo (junto com Home/Notificacoes/Plano) e
          "radar" passou pra dentro do Player Evolution -- nenhum dos dois
          precisa mais de entrada propria no menu lateral. Continuam
          existindo em modules-data.tsx porque outras telas (ex.: pagina
          de planos) reaproveitam o icone/copy de "hub" de la. */}
      {modules
        .filter((m) => m.key !== "hub" && m.key !== "radar")
        .map((m) => {
        const Icon = m.icon;
        const active = pathname === m.href || (!!m.href && m.href !== "/" && pathname.startsWith(`${m.href}/`));
        // Cada modulo continua com a propria cor (m.accent) no item ativo
        // e no hover (pedido explicito) -- so' o acabamento mudou pro
        // vidro: fundo translucido na cor do modulo, borda fina e o
        // risco lateral, sem o glow forte antigo.
        const hovered = hoverKey === m.key;
        // "radar" nao e' ModuleKey -- e' addon, vendido a parte do plano
        // base (ver lib/plans/plans-data.ts) -- checa hasAddon() em vez
        // de isModuleUnlocked() pra essa entrada.
        const moduleKey = m.key as ModuleKey | "radar";
        // plan === null (ainda carregando) nunca trava nada aqui -- so'
        // decide travar depois que a resposta chega, pra nao acender e
        // apagar cadeado na tela toda hora que o menu monta.
        const locked =
          plan !== null &&
          (moduleKey === "radar"
            ? !isAddonUnlockedFor(plan, "radar", radarAddon, hasTeamAccess)
            : // "Meu Time" tem uma segunda excecao: membro 'pendente' (ainda
              // na fila, hasTeamMembership mas nao hasTeamAccess) precisa
              // ver a propria tela de espera -- os outros modulos so'
              // liberam com hasTeamAccess (membro 'ativo').
              !isModuleUnlockedFor(plan, moduleKey, hasTeamAccess) && !(moduleKey === "time" && hasTeamMembership));

        if (locked) {
          return (
            <button
              key={m.key}
              type="button"
              title={collapsed ? `${m.title} (bloqueado)` : undefined}
              onClick={() => {
                setMobileOpen(false);
                setLockedModule(moduleKey);
              }}
              onMouseEnter={() => setHoverKey(m.key)}
              onMouseLeave={() => setHoverKey((k) => (k === m.key ? null : k))}
              className={`relative flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-[13.5px] font-medium text-muted/60 transition-colors duration-150 ${
                collapsed ? "justify-center" : ""
              } ${hovered ? "bg-white/[0.03]" : ""}`}
            >
              <Icon size={18} className="shrink-0 opacity-50" />
              {!collapsed && <span className="flex-1 truncate">{m.title}</span>}
              <Lock size={12} className="shrink-0 text-[#d4af37]/70" />
            </button>
          );
        }

        const aceso = active || hovered;
        return (
          <Link
            key={m.key}
            href={m.href ?? "#"}
            title={collapsed ? m.title : undefined}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            onMouseEnter={() => setHoverKey(m.key)}
            onMouseLeave={() => setHoverKey((k) => (k === m.key ? null : k))}
            className={`relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150 ${
              collapsed ? "justify-center" : ""
            } ${aceso ? "text-ink" : "border-transparent text-muted"}`}
            style={{
              background: active ? `${m.accent}1F` : hovered ? `${m.accent}12` : undefined,
              borderColor: active ? `${m.accent}40` : hovered ? `${m.accent}24` : undefined,
            }}
          >
            <span
              className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full transition-opacity"
              style={{ background: m.accent, opacity: active ? 1 : 0, boxShadow: `0 0 10px ${m.accent}` }}
            />
            <Icon size={18} className="shrink-0 transition-colors" style={{ color: aceso ? m.accent : undefined }} />
            {!collapsed && <span className="truncate">{m.title}</span>}
          </Link>
        );
      })}
    </>
  );

  // Ajuda, Configurações e Sair moram juntos no rodapé do menu lateral.
  // Ajuda abre uma janela por cima da tela; Configurações virou página
  // própria (/configuracoes, com abas).
  const itemRodape = `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors ${
    collapsed ? "justify-center" : ""
  }`;
  const configAtiva = pathname === "/configuracoes";
  const footer = (
    <>
      <button
        onClick={() => {
          setMobileOpen(false);
          toggleMenu("help");
        }}
        title={collapsed ? "Ajuda" : undefined}
        className={`${itemRodape} ${
          openMenu === "help" ? "border-white/10 bg-white/[0.06] text-ink" : "border-transparent text-muted hover:bg-white/[0.04] hover:text-ink"
        }`}
      >
        <CircleHelp size={18} className="shrink-0" />
        {!collapsed && "Ajuda"}
      </button>
      <Link
        href="/configuracoes"
        onClick={() => setMobileOpen(false)}
        title={collapsed ? "Configurações" : undefined}
        aria-current={configAtiva ? "page" : undefined}
        className={`${itemRodape} ${
          configAtiva ? "border-[#d4af37]/30 bg-[#d4af37]/10 text-ink" : "border-transparent text-muted hover:bg-white/[0.04] hover:text-ink"
        }`}
      >
        <Settings size={18} className="shrink-0" style={{ color: configAtiva ? OURO : undefined }} />
        {!collapsed && "Configurações"}
      </Link>
      <button
        onClick={handleLogout}
        title={collapsed ? "Sair" : undefined}
        className={`${itemRodape} border-transparent text-muted hover:bg-negative/[0.08] hover:text-negative`}
      >
        <LogOut size={18} className="shrink-0" />
        {!collapsed && "Sair"}
      </button>
    </>
  );

  const rotuloModulos = (
    <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/50">Módulos</p>
  );

  return (
    <div className="casca flex h-screen w-full overflow-hidden bg-void">
      {/* Define o vidro fosco (.painel-vidro), a barra de rolagem fina e o
          traço fino dos ícones pra toda tela que usa a casca -- antes só
          existiam nas telas que já tinham migrado pro visual novo. */}
      <PainelStyles />
      <style>{`
        .casca svg.lucide { stroke-width: 1.6; }
        /* Brilho dourado bem suave no alto do menu lateral: o vidro
           precisa de algo atrás pra não virar caixa chapada. */
        .casca-lateral {
          background:
            radial-gradient(22rem 16rem at 0% 0%, rgba(212, 175, 55, 0.07), transparent 70%),
            rgba(12, 12, 12, 0.9);
        }
      `}</style>

      {/* ============ SIDEBAR (desktop) ============ */}
      <aside
        className={`casca-lateral hidden md:flex h-full shrink-0 flex-col border-r border-white/[0.06] transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-[76px]" : "w-[252px]"
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/[0.06] ${
            collapsed ? "justify-center px-2" : "justify-between px-5"
          }`}
        >
          {!collapsed && (
            <Link href="/inicio" aria-label="Ir para Início">
              <Logo className="h-10 w-auto" />
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-ink"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="painel-scroll flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {!collapsed && rotuloModulos}
          {nav}
        </nav>

        <div className="flex shrink-0 flex-col gap-1 border-t border-white/[0.06] px-3 py-3">{footer}</div>
      </aside>

      {/* ============ SIDEBAR (mobile drawer) ============ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="casca-lateral relative flex h-full w-[264px] flex-col border-r border-white/[0.06]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
              <Link href="/inicio" aria-label="Ir para Início" onClick={() => setMobileOpen(false)}>
                <Logo className="h-10 w-auto" />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="painel-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              {rotuloModulos}
              {nav}
            </nav>
            <div className="flex shrink-0 flex-col gap-1 border-t border-white/[0.06] px-3 py-3">{footer}</div>
          </div>
        </div>
      )}

      {/* ============ MAIN ============ */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-center gap-2 border-b border-white/[0.06] bg-[#0c0c0c]/80 px-4 backdrop-blur-xl md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-auto grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-white/[0.06] hover:text-ink md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-[18px]" />
          </button>
          {/* Os ícones do topo ficam juntos numa "pílula" de vidro. */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
            <Link href="/inicio" className={iconeTopo(pathname === "/inicio")} aria-label="Início" title="Início">
              <Home className="size-[18px]" />
              <MarcaAtivo ativo={pathname === "/inicio"} />
            </Link>
            <Link href="/hub" className={iconeTopo(pathname === "/hub")} aria-label="Hub de Evolução" title="Hub de Evolução">
              <Trophy className="size-[18px]" />
              <MarcaAtivo ativo={pathname === "/hub"} />
            </Link>
            <div className="relative">
              <button
                onClick={() => toggleMenu("notifications")}
                className={iconeTopo(openMenu === "notifications" || pathname === "/notificacoes")}
                aria-label={unread > 0 ? `Notificações, ${unread} por ler` : "Notificações"}
                title="Notificações"
              >
                <Bell className="size-[18px]" />
                {unread > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full border-2 border-[#0c0c0c] px-1 text-[9px] font-bold leading-[12px] text-black"
                    style={{ background: OURO }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
                <MarcaAtivo ativo={pathname === "/notificacoes"} />
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
            {/* Coroa (upsell) so' pra quem e' Free -- quem ja paga algo
                (ou usa acesso de time) ve "Meu Plano" no lugar, pra
                gerenciar em vez de ser empurrado pra comprar de novo. */}
            {plan === "free" ? (
              <Link
                href="/planos"
                className={`relative grid size-9 place-items-center rounded-xl transition-colors hover:bg-[#d4af37]/10 ${
                  pathname === "/planos" ? "bg-[#d4af37]/10" : ""
                }`}
                style={{ color: OURO }}
                aria-label="Planos"
                title="Planos"
              >
                <Crown className="size-[18px]" />
                <MarcaAtivo ativo={pathname === "/planos"} />
              </Link>
            ) : (
              <Link href="/minha-conta" className={iconeTopo(pathname === "/minha-conta")} aria-label="Meu Plano" title="Meu Plano">
                <CreditCard className="size-[18px]" />
                <MarcaAtivo ativo={pathname === "/minha-conta"} />
              </Link>
            )}
          </div>
          {/* espaçador simétrico ao botão de hamburguer, só pra manter os
              ícones centralizados também no mobile */}
          <div className="ml-auto size-9 md:hidden" aria-hidden="true" />
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>

      {/* Chat em botão flutuante, disponível por cima de qualquer módulo.
          Vidro com o dourado do visual novo. Some enquanto o ChatCenter
          está aberto (a própria janela já cobre a tela). */}
      {openMenu !== "chats" && (
        <button
          type="button"
          onClick={() => toggleMenu("chats")}
          aria-label={unreadChats > 0 ? `Abrir chat, ${unreadChats} mensagem${unreadChats === 1 ? "" : "s"} não lida${unreadChats === 1 ? "" : "s"}` : "Abrir chat"}
          title="Chat"
          className="painel-vidro fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full border shadow-lg shadow-black/50 transition-transform hover:scale-105 active:scale-95 print:hidden"
          style={{ borderColor: `${OURO}55`, color: OURO, boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 18px ${OURO}22` }}
        >
          <MessageCircle size={24} />
          {unreadChats > 0 && (
            <span
              className="absolute -right-1 -top-1 grid min-w-[22px] place-items-center rounded-full border-2 border-black px-1 text-[11px] font-bold leading-[19px] text-black"
              style={{ background: OURO }}
            >
              {unreadChats > 9 ? "9+" : unreadChats}
            </span>
          )}
        </button>
      )}

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

      {openMenu === "help" && <HelpMenu onClose={() => setOpenMenu(null)} />}

      <PlanLockModal moduleKey={lockedModule} onClose={() => setLockedModule(null)} />
    </div>
  );
}
