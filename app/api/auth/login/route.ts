// app/api/auth/login/route.ts
//
// Login por e-mail/senha passa por aqui em vez de chamar
// supabase.auth.signInWithPassword direto do navegador -- é o único
// jeito de aplicar um limite de tentativas de verdade (um limite só no
// cliente não impede nada, um script bate direto na API do Supabase
// ignorando o navegador). Ver lib/rate-limit.ts.
//
// Rota pública de propósito (é o próprio login, antes de existir
// sessão) -- ver "/api/auth/login" em PUBLIC_ROUTES,
// lib/supabase/middleware.ts.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Informe e-mail e senha." }, { status: 400 });
  }

  // Dois limites por motivo diferente: por IP corta um cliente
  // martelando qualquer conta; por e-mail corta força bruta numa conta
  // específica vinda de IPs diferentes/rotativos. Nenhum dos dois
  // revela se o e-mail existe ou não -- a mensagem de erro do Supabase
  // já é genérica ("Invalid login credentials").
  const ipLimit = rateLimit(`login:ip:${clientIp(request)}`, 15, 5 * 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);
  const emailLimit = rateLimit(`login:email:${email}`, 8, 15 * 60_000);
  if (!emailLimit.allowed) return rateLimitResponse(emailLimit.retryAfterSeconds);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "Não foi possível entrar. Verifique suas credenciais." },
      { status: 401 }
    );
  }

  // Prova de consentimento (LGPD art. 8): a caixinha em handleRegister já
  // barra o cadastro sem aceite, mas o e-mail precisa ser confirmado
  // antes de existir sessão pra gravar -- por isso o registro fica pra
  // este primeiro login bem-sucedido, não pro momento do cadastro em si.
  // Erro aqui (ex.: já registrado pra essa versão -- conflito de chave
  // primária) é esperado e ignorado de propósito.
  if (data.user) {
    await supabase
      .from("user_consents")
      .insert({ user_id: data.user.id, terms_version: "2026-09" })
      .then(
        () => {},
        () => {}
      );
  }

  return NextResponse.json({ ok: true });
}
