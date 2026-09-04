import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAddonUnlocked, isModuleUnlocked, resolveAddonForRoute, resolveModuleForRoute, toPlanId } from "@/lib/plans/plans-data";

// Nao usa isModuleUnlockedFor/isAddonUnlockedFor daqui: essas ja assumem
// hasTeamAccess resolvido, mas aqui so' vale a pena consultar
// team_members quando o proprio plano JA falhou (ver bloco abaixo) --
// pouparia uma query no caso comum (usuario com plano que ja libera).

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 horas
const LAST_ACTIVITY_COOKIE = "pokersync_last_activity";
const PUBLIC_ROUTES = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/auth/confirm",
  "/agent-login",
  // Convite de time: funciona sem sessão de propósito (mostra o nome do
  // time + botão "Fazer login" — ver app/time/convite/[token]/page.tsx).
  // Sem isso o middleware redireciona pro /login antes da página carregar
  // e o convidado perde o contexto de qual time/papel está aceitando.
  "/time/convite",
  // API do agente desktop: autentica por header Authorization: Bearer
  // (lib/supabase/agent.ts), não por cookie de sessão do navegador — o
  // agente é um app nativo, não tem cookie nenhum. Sem isso aqui, TODA
  // chamada do agente (ping/sync) recebia um redirect 307 pro /login
  // antes de chegar no route handler, e o cliente (reqwest, no Rust)
  // não conseguia interpretar a resposta como JSON — reportado como
  // "erro ao testar conexão e ao sincronizar".
  "/api/agent",
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicRoute = isPublicRoute(pathname);

  // Bloqueio: sem sessão tentando acessar rota protegida
  if (!user && !publicRoute) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    return redirect;
  }

  if (user) {
    const last = Number(
      request.cookies.get(LAST_ACTIVITY_COOKIE)?.value ?? 0
    );

    if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("expirado", "1");
      if (pathname !== "/") loginUrl.searchParams.set("redirectTo", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      // signOut() grava a limpeza dos cookies de sessão em `response`,
      // que seria descartado ao retornar `redirect`. Copiamos aqui.
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });
      redirect.cookies.delete(LAST_ACTIVITY_COOKIE);
      return redirect;
    }

    response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    // Trava real de plano: o menu (components/app-shell.tsx) so' esconde
    // visualmente o modulo bloqueado -- isso e' cosmetico e roda no
    // navegador, entao nao impede ninguem de digitar a URL direto (ex:
    // /revisor). Aqui, no servidor, e' onde o bloqueio vale de verdade
    // pra qualquer jeito de chegar na rota.
    const moduleKey = resolveModuleForRoute(pathname);
    // "radar" e' addon, nao modulo (ver AddonKey em lib/plans/plans-data.ts)
    // -- so' entra aqui quando moduleKey nao resolveu nada, os dois
    // conjuntos de rotas nunca se sobrepoem.
    const addonKey = moduleKey ? null : resolveAddonForRoute(pathname);

    if (moduleKey || addonKey) {
      const { data: planRow } = await supabase.from("user_plans").select("plan, radar_addon").maybeSingle();
      const plan = toPlanId(planRow?.plan);
      let allowed = moduleKey
        ? isModuleUnlocked(plan, moduleKey)
        : isAddonUnlocked(plan, addonKey!, Boolean(planRow?.radar_addon));

      // Acesso em cascata do Time: um jogador vinculado a um time usa o
      // acesso do time, nao o proprio (ver isModuleUnlockedFor em
      // lib/plans/plans-data.ts) -- so' consulta team_members quando o
      // proprio plano ja falhou, pra nao gastar query em toda rota pra
      // quem ja tem acesso pelo plano.
      if (!allowed) {
        const { data: membership } = await supabase
          .from("team_members")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (membership?.status === "ativo") {
          // Membro ATIVO: acesso completo, igual a quem paga Team
          // Pro/Elite diretamente -- vale pra qualquer modulo ou o addon.
          allowed = true;
        } else if (moduleKey === "time" && membership) {
          // "Meu Time" tem uma segunda excecao: membro 'pendente' (ainda
          // na fila de aprovacao) precisa ver a propria tela de espera,
          // mesmo sem cascata completa ainda.
          allowed = true;
        }
      }

      if (!allowed) {
        const redirect = NextResponse.redirect(new URL(`/modulos?locked=${moduleKey ?? addonKey}`, request.url));
        response.cookies.getAll().forEach((cookie) => {
          redirect.cookies.set(cookie);
        });
        return redirect;
      }
    }
  }

  return response;
}
