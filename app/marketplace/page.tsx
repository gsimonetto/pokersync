"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus, Users2, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/chip";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  fetchOpenListings,
  fetchMyTeamListings,
  fetchMatchScore,
  type Listing,
  FORMAT_LABEL,
} from "@/lib/services/marketplace-service";

// Feed do Marketplace de vagas: qualquer jogador navega e ve o match
// score dele contra cada vaga aberta (calculado em RPC, nao inventado
// no cliente). Quem gerencia um time ve tambem as proprias vagas
// (abertas e fechadas) numa segunda secao, com atalho pra criar uma
// nova.
export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [minhasVagas, setMinhasVagas] = useState<Listing[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const podeGerenciar = myTeam?.role === "admin" || myTeam?.role === "coach";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [open, team] = await Promise.all([fetchOpenListings(), fetchMyTeam().catch(() => null)]);
        if (!alive) return;
        setListings(open);
        setMyTeam(team);
        if (team && (team.role === "admin" || team.role === "coach")) {
          fetchMyTeamListings(team.team.id).then((l) => alive && setMinhasVagas(l));
        }
        const entries = await Promise.all(
          open.map(async (l) => [l.id, await fetchMatchScore(l.id).catch(() => null)] as const)
        );
        if (alive) setScores(Object.fromEntries(entries));
      } catch (e) {
        if (alive) setErro((e as Error)?.message ?? "Não foi possível carregar o marketplace.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const outrasVagas = useMemo(
    () => (listings ?? []).filter((l) => !myTeam || l.teamId !== myTeam.team.id),
    [listings, myTeam]
  );

  return (
    <AppShell>
      <main className="w-full px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-500">
                <Briefcase size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink">Marketplace de Vagas</h1>
                <p className="text-sm text-muted">Times publicam vagas, você se candidata com um clique.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/marketplace/minhas-candidaturas"
                className="rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-elevated"
              >
                Minhas candidaturas
              </Link>
              {podeGerenciar && (
                <Link
                  href="/marketplace/nova"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90"
                >
                  <Plus size={14} /> Nova vaga
                </Link>
              )}
            </div>
          </div>

          {erro && <p className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">{erro}</p>}

          {podeGerenciar && minhasVagas.length > 0 && (
            <section>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">Vagas do seu time</h2>
              <div className="flex flex-col gap-3">
                {minhasVagas.map((l) => (
                  <ListingCard key={l.id} listing={l} showStatus />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">Vagas abertas</h2>
            {listings === null ? (
              <div className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-10">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            ) : outrasVagas.length === 0 ? (
              <p className="rounded-xl border border-hairline bg-surface p-6 text-sm text-muted">
                Nenhuma vaga aberta no momento. Volte mais tarde.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {outrasVagas.map((l) => (
                  <ListingCard key={l.id} listing={l} matchScore={scores[l.id] ?? null} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function ListingCard({ listing, matchScore, showStatus }: { listing: Listing; matchScore?: number | null; showStatus?: boolean }) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-white/15"
    >
      {listing.teamBannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.teamBannerUrl}
          alt={listing.teamName}
          className="h-11 w-16 shrink-0 rounded-lg border border-hairline object-cover sm:h-12 sm:w-20"
        />
      ) : (
        <div
          className="grid size-11 shrink-0 place-items-center rounded-lg border"
          style={{ borderColor: `${listing.teamAccent}55`, background: `${listing.teamAccent}1A`, color: listing.teamAccent }}
        >
          <Users2 size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-ink">{listing.title}</p>
          <Chip color="#5AA6E0" size="sm">
            {FORMAT_LABEL[listing.format]}
          </Chip>
          {showStatus && (
            <Chip color={listing.status === "aberta" ? "#2FB89A" : "#8A94A3"} size="sm">
              {listing.status === "aberta" ? "Aberta" : "Fechada"}
            </Chip>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {listing.teamName}
          {listing.buyInMin !== null && listing.buyInMax !== null && ` · Buy-in R$ ${listing.buyInMin} – R$ ${listing.buyInMax}`}
          {listing.stakingPct !== null && ` · Staking ${listing.stakingPct}%`}
        </p>
      </div>
      {matchScore !== null && matchScore !== undefined && (
        <div className="shrink-0 text-right">
          <p className={`text-lg font-bold tabular-nums ${matchScore >= 70 ? "text-positive" : "text-negative"}`}>{matchScore}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted/60">match</p>
        </div>
      )}
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </Link>
  );
}
