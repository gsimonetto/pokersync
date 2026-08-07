import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_COOKIE = "pokersync_last_activity";

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

  if (user) {
    const last = Number(
      request.cookies.get(LAST_ACTIVITY_COOKIE)?.value ?? 0
    );

    if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
      await supabase.auth.signOut();
      const redirect = NextResponse.redirect(
        new URL("/login?expirado=1", request.url)
      );
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
