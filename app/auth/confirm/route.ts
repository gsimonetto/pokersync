// app/auth/confirm/route.ts
import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sairDesteAparelho } from "@/lib/supabase/sair-deste-aparelho";

// Vida curta de propósito: só o tempo de o navegador redirecionar pra
// /agent-login/concluido e o agente desktop chamar o exchange-code (ou,
// no caminho manual, o jogador copiar/colar o link) -- ver
// app/api/agent/exchange-code/route.ts.
const AGENT_LOGIN_CODE_TTL_MS = 5 * 60 * 1000;

function randomCode(): string {
  // 32 bytes aleatórios em base64url -- não é um JWT nem carrega
  // nenhum dado, só um identificador de uso único opaco.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Cliente só pro login do Radar: lê os cookies do navegador (o
// verificador do OAuth que o signInWithOAuth de app/agent-login gravou),
// mas NUNCA grava a sessão nova neles — essa sessão é do Radar, não desta
// aba. Antes a sessão virava cookie e, pra "limpar a aba", o código
// chamava signOut(), que por padrão encerra TODAS as sessões da conta:
// derrubava na hora a sessão que tinha acabado de entregar pro Radar (e
// ainda deslogava o jogador do site no celular). Assim, quem já estava
// logado no site neste navegador continua logado, e nada precisa ser
// encerrado.
async function createAgentLoginClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // De propósito: nenhum cookie de sessão nesta aba.
      },
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const agentState = searchParams.get("agent_state");

  const supabase = await createClient();

  // Fluxo 1: confirmação de cadastro por e-mail (link do Resend)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // E-mail confirmado. Deslogamos de propósito: queremos que o
      // usuário volte para a tela de login e entre "de novo".
      await sairDesteAparelho(supabase);
      redirect("/login?email_confirmado=1");
    }

    redirect("/login?erro_confirmacao=1");
  }

  // Fluxo 2b: login com Google que começou no Radar PokerSync (ver
  // app/agent-login/page.tsx). Não redireciona direto pro deep link
  // (radar-pokersync://auth) — registro de esquema customizado depende de
  // COMO o instalador rodou em cada SO, e quando falha o navegador só fica
  // "carregando" pra sempre, sem erro nenhum pro usuário ver (relatado:
  // "eu confirmo e fica apenas rodando"). Em vez disso, manda pra uma
  // página nossa que tenta o deep link E mostra um link pra colar
  // manualmente no Radar se não abrir sozinho.
  if (code && agentState) {
    const agentClient = await createAgentLoginClient();
    const { data, error } = await agentClient.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      redirect("/agent-login?erro_confirmacao=1");
    }

    // Tokens reais NUNCA vão pra URL/tela — só um código opaco de uso
    // único, trocado pelos tokens de verdade no exchange-code (ver
    // app/api/agent/exchange-code/route.ts). Isso evita
    // access_token/refresh_token completos ficarem expostos em histórico
    // do navegador, logs de proxy, ou na tela de "copiar link".
    const loginCode = randomCode();
    const serviceClient = createServiceClient();
    // Códigos vencidos e nunca trocados (o jogador fechou o navegador no
    // meio) não ficam guardados pra sempre.
    await serviceClient.from("agent_login_codes").delete().lt("expires_at", new Date().toISOString());
    const { error: insertError } = await serviceClient.from("agent_login_codes").insert({
      code: loginCode,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: new Date(Date.now() + AGENT_LOGIN_CODE_TTL_MS).toISOString(),
    });
    if (insertError) {
      redirect("/agent-login?erro_confirmacao=1");
    }

    const params = new URLSearchParams({ code: loginCode, state: agentState });
    redirect(`/agent-login/concluido?${params.toString()}`);
  }

  // Fluxo 2: login social (Google) no site — Supabase manda um "code" na URL
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Prova de consentimento (LGPD art. 8): o login com Google pode
      // ser o próprio primeiro cadastro (Supabase cria a conta na hora)
      // e nunca passa pela caixinha de aceite de app/login/login-form.tsx
      // -- por isso fica registrado aqui, no primeiro sucesso de sessão
      // por esse caminho. Erro (ex.: já aceito nessa versão) é esperado
      // e ignorado de propósito.
      if (data.session?.user) {
        await supabase
          .from("user_consents")
          .insert({ user_id: data.session.user.id, terms_version: "2026-09" })
          .then(
            () => {},
            () => {}
          );
      }

      // Login com Google já cria sessão de verdade — aqui SIM deixamos
      // o usuário entrar direto, sem precisar digitar senha de novo.
      redirect("/inicio");
    }

    redirect("/login?erro_confirmacao=1");
  }

  // Nem token_hash nem code: link inválido
  redirect("/login?erro_confirmacao=1");
}
