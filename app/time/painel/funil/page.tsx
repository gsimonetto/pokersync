import { redirect } from "next/navigation";

// O Funil virou aba do painel do time. Links antigos (notificações,
// favoritos) continuam funcionando: caem direto na aba.
export default function FunilPage() {
  redirect("/time/painel?tab=funil");
}
