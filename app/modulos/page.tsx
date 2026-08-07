import { TopNav } from "@/components/top-nav";
import { WelcomeHero } from "@/components/welcome-hero";
import { StatCards } from "@/components/stat-cards";
import { ProgressSection } from "@/components/progress-section";
import { BrandValues } from "@/components/brand-values";
import { modules } from "@/lib/modules-data";
import { ModuleCard } from "@/components/module-card";
import { getPatente } from "@/lib/services/xp-service";
import { aggregate } from "@/lib/bankroll/calc";
import { fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/bankroll/format";
import type { Session } from "@/lib/bankroll/types";
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
  };
}

export default async function ModulosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = (user?.user_metadata ?? {}) as { nome?: string; apelido?: string };
  const displayName = meta.apelido || meta.nome || "Jogador";

  const [{ data: progressRow }, { data: sessionRows }] = await Promise.all([
    supabase.from("user_progress").select("level, streak_days").maybeSingle(),
    supabase.from("bankroll_sessions").select("*"),
  ]);

  const level = progressRow?.level ?? 1;
  const streakDays = progressRow?.streak_days ?? 0;
  const patente = getPatente(level);

  const sessions = (sessionRows ?? []).map(rowToSession);
  const agg = aggregate(sessions);
  const tourneyCount = sessions.filter((s) => TOURNEY_FORMATS.has(s.format)).length;

  return (
    <div className="min-h-screen bg-void">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-6">
          <WelcomeHero name={displayName} streakDays={streakDays} patente={patente} />

          <StatCards
            bankrollAtual={fmtMoney(agg.profit)}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {modules.map(({ key, ...mod }) => (
                <ModuleCard key={key} {...mod} />
              ))}
            </div>
          </section>

          <ProgressSection />
          <BrandValues />
        </div>
      </main>
    </div>
  );
}
