// app/api/agent/exchange-code/route.ts
//
// Troca um código de login de uso único (gerado em app/auth/confirm
// pro fluxo do agente desktop) pelos tokens de sessão reais. Existe
// pra tirar access_token/refresh_token da URL/tela do navegador (ver
// app/agent-login/concluido/concluido-form.tsx) -- o agente Rust chama
// isto assim que recebe o deep link radar-pokersync://auth?code=...
//
// Rota pública de propósito (mesmo motivo de /api/agent/ping e
// /api/agent/sync: o agente é um app nativo, sem cookie de sessão do
// navegador -- ver "/api/agent" em PUBLIC_ROUTES, lib/supabase/middleware.ts).
// A segurança aqui não vem de sessão, vem do código em si: aleatório,
// de uso único (a linha é apagada assim que trocada) e de vida curta
// (expira em minutos) -- ver migration create_agent_login_codes.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // O código em si já é praticamente impossível de adivinhar (256 bits
  // aleatórios), mas um limite aqui custa pouco e corta qualquer
  // tentativa de força bruta de uma vez.
  const limit = rateLimit(`agent-exchange-code:${clientIp(request)}`, 20, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Código ausente." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Apaga e devolve na mesma operação -- garante uso único mesmo sob
  // corrida (duas trocas concorrentes do mesmo código): só uma delas
  // recebe a linha de volta, a outra recebe array vazio.
  const { data, error } = await supabase
    .from("agent_login_codes")
    .delete()
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("access_token, refresh_token")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Código inválido, expirado ou já usado." }, { status: 400 });
  }

  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
}
