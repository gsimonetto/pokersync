import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Raiz do site — nunca renderiza conteudo proprio, so decide pra onde
// mandar o visitante. Antes disso era uma pagina de status da migracao
// (placeholder do bootstrap do projeto), que ficou exposta no dominio
// principal depois do corte de DNS.
export default async function Home() {
  let hasUser = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasUser = Boolean(user);
  } catch {
    // O preview pode renderizar antes das variáveis do Supabase serem injetadas.
    // Nesse caso, encaminha para login em vez de derrubar a aplicação inteira.
  }

  redirect(hasUser ? "/modulos" : "/login");
}
