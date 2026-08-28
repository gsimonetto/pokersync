import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  }

  return response;
}
