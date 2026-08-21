// BACKUP da tela de Módulos anterior ao redesenho com sidebar (2026-08).
// Arquivo com prefixo "_" -- o Next.js ignora pastas/arquivos assim pra
// efeito de rotas, entao isto nao vira uma URL. Existe so' pra permitir
// reverter rapido: renomeie pra "page.tsx" (substituindo o novo) se
// precisar voltar pra esta versao.
import { WelcomeHero } from "@/components/welcome-hero";
import { modules } from "@/lib/modules-data";
import { ModuleCard } from "@/components/module-card";
import { createClient } from "@/lib/supabase/server";

export default async function ModulosPageBackup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as { nome?: string; apelido?: string };
  const displayName = meta.apelido || meta.nome || "Jogador";
  const [{ data: planRow }, { data: teamRow }, { data: progressRow }, { count: unreadCount }] = await Promise.all([
    supabase.from("user_plans").select("plan").maybeSingle(),
    // Filtro por user_id e' obrigatorio aqui: a RLS de team_members libera
    // TODO membro do mesmo time (necessario pro painel do coach ver o
    // time inteiro), entao sem esse filtro a query junta as N linhas do
    // time e o .maybeSingle() abaixo falha com "multiple rows returned" —
    // erro que ficava engolido silenciosamente, sem badge de time.
    supabase.from("team_members").select("teams ( name, accent )").eq("user_id", user?.id ?? "").maybeSingle(),
    supabase.from("user_progress").select("level").maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
  ]);
  // Ausencia de linha em user_plans == free (nao exige trigger de signup).
  const plan = (planRow?.plan as "free" | "pro" | "master") ?? "free";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamData = teamRow?.teams as any;
  const team = teamData ? { name: teamData.name as string, accent: teamData.accent as string } : null;
  const hubBadge = progressRow ? `Nível ${progressRow.level}` : undefined;
  const modulesWithLiveData = modules.map((m) => {
    if (m.key === "hub") return { ...m, badge: hubBadge, dot: (unreadCount ?? 0) > 0 };
    if (m.key === "time" && team) return { ...m, badge: team.name };
    return m;
  });
  return (
    <div className="min-h-screen bg-void">
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="space-y-6">
          <WelcomeHero name={displayName} plan={plan} team={team} />
          <section aria-labelledby="modules-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="modules-heading" className="text-sm font-medium text-muted">
                Módulos Principais
              </h2>
              <span className="text-xs text-muted/60">{modules.length} módulos</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modulesWithLiveData.map(({ key, ...mod }) => (
                <ModuleCard key={key} {...mod} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
