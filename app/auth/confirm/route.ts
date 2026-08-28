// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      // (pokersync-agent://auth) — registro de esquema customizado
      // depende de COMO o instalador rodou em cada SO (varia até entre
      // .deb e AppImage no Linux), e quando falha o navegador só fica
      // "carregando" pra sempre, sem erro nenhum pro usuário ver
      // (relatado: "eu confirmo e fica apenas rodando"). Em vez disso,
      // manda pra uma página nossa que tenta o deep link E mostra um
      // link pra colar manualmente no agente se não abrir sozinho.
      const agentState = searchParams.get("agent_state");
      if (agentState && data.session) {
        const params = new URLSearchParams({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          state: agentState,
        });
        // Sessão web não deve continuar logada nesta aba — quem está
        // usando essa janela de navegador é o agente, não o jogador
        // navegando o produto.
        await supabase.auth.signOut();
        redirect(`/agent-login/concluido?${params.toString()}`);
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
