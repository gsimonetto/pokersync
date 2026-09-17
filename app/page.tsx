import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Raiz do site — nunca renderiza conteudo proprio, so decide pra onde
// mandar o visitante. Antes disso era uma pagina de status da migracao
// (placeholder do bootstrap do projeto), que ficou exposta no dominio
// principal depois do corte de DNS.
//
// A partir da Home Diário (app/inicio/page.tsx), quem loga cai direto
// nela em vez do grid de módulos -- /modulos continua existindo e
// acessível por um link dentro do próprio Diário, so deixou de ser o
// destino padrão pós-login.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/inicio" : "/login");
}
