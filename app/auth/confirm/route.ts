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
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Login com Google já cria sessão de verdade — aqui SIM deixamos
      // o usuário entrar direto, sem precisar digitar senha de novo.
      redirect("/modulos");
    }

    redirect("/login?erro_confirmacao=1");
  }

  // Nem token_hash nem code: link inválido
  redirect("/login?erro_confirmacao=1");
}
