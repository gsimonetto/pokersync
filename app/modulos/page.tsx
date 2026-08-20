import { WelcomeHero } from "@/components/welcome-hero";
import { StatCards } from "@/components/stat-cards";
import { modules } from "@/lib/modules-data";
import { ModuleCard } from "@/components/module-card";
import { aggregate, netWorth } from "@/lib/bankroll/calc";
import { fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/bankroll/format";
import type { Session, Transaction } from "@/lib/bankroll/types";
import { createClient } from "@/lib/supabase/server";
const TOURNEY_FORMATS = new Set(["MTT", "SNG", "Spin"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(r: any): Session {
  return {
    id: r.id,
    date: r.date,
    time: r.time || "",
    format: r.format,
    buyIn: Number(r.buy_in) || 0,
    reentries: Number(r.reentries) || 0,
    cashout: Number(r.cashout) || 0,
    stake: r.stake || "",
    venue: r.venue || "",
    notes: r.notes || "",
    currency: r.currency || "BRL",
    // Staking: sem isso aqui, o resumo desta tela ficava divergente do
    // que /banca mostra pra quem vende parte da acao -- net()/invested()
    // em lib/bankroll/calc.ts ja tratam esses campos, so precisavam
    // chegar preenchidos.
    ownPct: r.own_pct != null ? Number(r.own_pct) : undefined,
    markup: r.markup != null ? Number(r.markup) : undefined,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTransaction(r: any): Transaction {
  return { id: r.id, date: r.date, type: r.type, amount: Number(r.amount) || 0, currency: r.currency || "BRL" };
}
export default async function ModulosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as { nome?: string; apelido?: string };
  const displayName = meta.apelido || meta.nome || "Jogador";
  const [{ data: sessionRows }, { data: txRows }, { data: settingsRow }, { data: planRow }, { data: teamRow }, { data: progressRow }, { count: unreadCount }] =
    await Promise.all([
      supabase.from("bankroll_sessions").select("*"),
      supabase.from("bankroll_transactions").select("*"),
      supabase.from("bankroll_settings").select("bankroll").maybeSingle(),
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
  // Resumo desta tela e' so' 3 numeros — sem filtro de moeda de verdade
  // (isso vive em /banca). Pra nao somar R$ com $ como se fossem a mesma
  // unidade, o resumo aqui so' considera as sessoes/transacoes em BRL,
  // que e' o caso da esmagadora maioria (moeda default).
  const sessions = (sessionRows ?? []).map(rowToSession).filter((s) => (s.currency || "BRL") === "BRL");
  const transactions = (txRows ?? []).map(rowToTransaction).filter((t) => (t.currency || "BRL") === "BRL");
  const agg = aggregate(sessions);
  const nw = netWorth(Number(settingsRow?.bankroll) || 0, agg.profit, transactions);
  const tourneyCount = sessions.filter((s) => TOURNEY_FORMATS.has(s.format)).length;
  const hubBadge = progressRow ? `Nível ${progressRow.level}` : undefined;
  const modulesWithLiveData = modules.map((m) => {
    if (m.key === "hub") return { ...m, badge: hubBadge, dot: (unreadCount ?? 0) > 0 };
    if (m.key === "time" && team) return { ...m, badge: team.name };
    return m;
  });
  return (
    <div className="min-h-screen bg-void">
      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="space-y-6">
          <WelcomeHero name={displayName} plan={plan} team={team} />
          <StatCards
            bankrollAtual={fmtMoney(nw.playingBankroll)}
            resultado={fmtSignedMoney(agg.profit)}
            roi={fmtPct(agg.roi)}
            itmPct={`${agg.itm.toFixed(0)}%`}
            sessionsCount={agg.n}
            tourneyCount={tourneyCount}
            resultadoPositivo={agg.profit >= 0}
          />
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
