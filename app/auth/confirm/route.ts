// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  // Fluxo 1: confirmação de cadastro por e-mail (link do Resend)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // E-mail confirmado. Deslogamos de propósito: queremos que o
      // usuário volte para a tela de login e entre "de novo".
      await supabase.auth.signOut();
      redirect("/login?email_confirmado=1");
    }

    redirect("/login?erro_confirmacao=1");
  }

  // Fluxo 2: login social (Google) — Supabase manda um "code" na URL
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fluxo 2b: esse login começou no agente desktop (ver
      // app/agent-login/page.tsx). Não redireciona direto pro deep link
      // (radar-pokersync://auth) — registro de esquema customizado
      // depende de COMO o instalador rodou em cada SO (varia até entre
      // .deb e AppImage no Linux), e quando falha o navegador só fica
      // "carregando" pra sempre, sem erro nenhum pro usuário ver
      // (relatado: "eu confirmo e fica apenas rodando"). Em vez disso,
      // manda pra uma página nossa que tenta o deep link E mostra um
      // link pra colar manualmente no agente se não abrir sozinho.
      const agentState = searchParams.get("agent_state");
      if (agentState && data.session) {
        // Tokens reais NUNCA vão pra URL/tela daqui pra frente — só um
        // código opaco de uso único, trocado pelos tokens de verdade no
        // exchange-code (ver app/api/agent/exchange-code/route.ts). Isso
        // evita access_token/refresh_token completos ficarem expostos em
        // histórico do navegador, logs de proxy, ou na tela de "copiar
        // link" (fallback pra quando o deep link não abre sozinho).
        const code = randomCode();
        const serviceClient = createServiceClient();
        const { error: insertError } = await serviceClient.from("agent_login_codes").insert({
          code,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: new Date(Date.now() + AGENT_LOGIN_CODE_TTL_MS).toISOString(),
        });

        // Sessão web não deve continuar logada nesta aba — quem está
        // usando essa janela de navegador é o agente, não o jogador
        // navegando o produto.
        await supabase.auth.signOut();

        if (insertError) {
          redirect("/agent-login?erro_confirmacao=1");
        }

        const params = new URLSearchParams({ code, state: agentState });
        redirect(`/agent-login/concluido?${params.toString()}`);
      }

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
      redirect("/modulos");
    }

    redirect("/login?erro_confirmacao=1");
  }

  // Nem token_hash nem code: link inválido
  redirect("/login?erro_confirmacao=1");
}
