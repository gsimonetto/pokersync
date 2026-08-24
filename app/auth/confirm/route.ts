// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // E-mail confirmado com sucesso.
      // Deslogamos de propósito: queremos que o usuário volte para a tela
      // de login e entre "de novo", em vez de cair direto logado.
      await supabase.auth.signOut();
      redirect("/login?email_confirmado=1");
    }
  }

  // token ausente, inválido ou expirado
  redirect("/login?erro_confirmacao=1");
}
