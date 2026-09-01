import { redirect } from "next/navigation";

// Player Evolution consolidou tudo isso na tela raiz — este redirect
// existe só pra links/favoritos antigos que ainda apontam pra /performance/analise.
export default function AnalisePageRedirect() {
  redirect("/performance");
}
