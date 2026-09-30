import { AdminDrillsPanel } from "@/components/revisor/admin-drills-panel";
import { createClient } from "@/lib/supabase/server";
import { TelaVidro } from "@/components/ui/tela-vidro";

// E-mail espelha exatamente a policy RLS de hand_review_drill_suggestions
// (hrds_owner_read_all etc: auth.jwt()->>'email' = 'gsimonetto1@gmail.com').
// Antes so' o RLS barrava -- qualquer usuario logado via a UI de admin
// inteira montada (formulario, listas) antes de qualquer query falhar.
const ADMIN_EMAIL = "gsimonetto1@gmail.com";

// Painel administrativo de sugestoes de drill. Sem link visivel no fluxo do
// jogador — acesso direto por URL, restrito a gsimonetto1@gmail.com.
export default async function AdminDrillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email !== ADMIN_EMAIL) {
    return (
      <TelaVidro semCasca titulo="Acesso restrito">
        <p className="text-sm text-muted">Você não tem permissão para acessar esta página.</p>
      </TelaVidro>
    );
  }

  return <AdminDrillsPanel />;
}
