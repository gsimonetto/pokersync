"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Briefcase, Loader2, Lock, Unlock, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/chip";
import { SpeedGauge } from "@/components/dashboard/kit";
import { CandidateBadge } from "@/components/marketplace/candidate-badge";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  fetchListing,
  fetchMatchScore,
  fetchMyApplicationForListing,
  fetchApplicationsForListing,
  fetchTeamStats,
  fetchMyFavoriteIds,
  toggleFavorite,
  applyToListing,
  withdrawApplication,
  closeListing,
  reopenListing,
  FORMAT_LABEL,
  APPLICATION_STATUS_LABEL,
  type Listing,
  type MyApplication,
  type ApplicationSummary,
  type TeamMarketplaceStats,
} from "@/lib/services/marketplace-service";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [minhaCandidatura, setMinhaCandidatura] = useState<MyApplication | null>(null);
  const [candidatos, setCandidatos] = useState<ApplicationSummary[] | null>(null);
  const [stats, setStats] = useState<TeamMarketplaceStats | null>(null);
  const [favorito, setFavorito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const l = await fetchListing(id);
      setListing(l);
      if (!l) return;

      fetchTeamStats(l.teamId).then(setStats).catch(() => {});
      fetchMyFavoriteIds().then((ids) => setFavorito(ids.has(l.id))).catch(() => {});

      const team = await fetchMyTeam().catch(() => null);
      setMyTeam(team);
      const souGerente = team && (team.role === "admin" || team.role === "coach") && team.team.id === l.teamId;

      if (souGerente) {
        setCandidatos(await fetchApplicationsForListing(l.id));
      } else {
        const [score, app] = await Promise.all([
          fetchMatchScore(l.id).catch(() => null),
          fetchMyApplicationForListing(l.id).catch(() => null),
        ]);
        setMatchScore(score);
        setMinhaCandidatura(app);
      }
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível carregar a vaga.");
    }
  }, [id]);

  async function onToggleFavorite() {
    if (!listing) return;
    setFavorito((v) => !v);
    try {
      await toggleFavorite(listing.id, !favorito);
    } catch {
      setFavorito((v) => !v);
    }
  }

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (listing === undefined) {
    return (
      <AppShell>
        <main className="flex flex-1 items-center justify-center p-10">
          <Loader2 size={20} className="animate-spin text-muted" />
        </main>
      </AppShell>
    );
  }

  if (!listing) {
    return (
      <AppShell>
        <main className="w-full px-4 py-10 md:px-6">
          <div className="mx-auto max-w-lg rounded-xl border border-hairline bg-surface p-6 text-center text-sm text-muted">
            Vaga não encontrada.
          </div>
        </main>
      </AppShell>
    );
  }

  const souGerente = myTeam && (myTeam.role === "admin" || myTeam.role === "coach") && myTeam.team.id === listing.teamId;
  const idealMin = listing.minScoreGeral ?? 70;

  return (
    <AppShell>
      <main className="w-full px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <section className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-500">
                  <Briefcase size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ink">{listing.title}</h1>
                  <p className="text-sm text-muted">{listing.teamName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip color="#5AA6E0">{FORMAT_LABEL[listing.format]}</Chip>
                <Chip color={listing.status === "aberta" ? "#2FB89A" : "#8A94A3"}>
                  {listing.status === "aberta" ? "Aberta" : "Fechada"}
                </Chip>
                {!souGerente && (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    title={favorito ? "Remover dos favoritos" : "Favoritar vaga"}
                    aria-label={favorito ? "Remover dos favoritos" : "Favoritar vaga"}
                    className={`grid size-8 shrink-0 place-items-center rounded-lg border transition-colors ${
                      favorito ? "border-evolution/50 bg-evolution/10 text-evolution" : "border-hairline text-muted hover:text-ink"
                    }`}
                  >
                    <Star size={14} fill={favorito ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            </div>

            {listing.description && <p className="mt-4 text-sm leading-relaxed text-ink/85">{listing.description}</p>}

            {stats && stats.totalCandidaturas > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
                <span>
                  <b className="text-ink">{stats.totalVagas}</b> vaga{stats.totalVagas === 1 ? "" : "s"} publicada
                  {stats.totalVagas === 1 ? "" : "s"}
                </span>
                {stats.taxaAceitePct !== null && (
                  <span>
                    Taxa de aceite <b className="text-ink">{stats.taxaAceitePct}%</b>
                  </span>
                )}
                {stats.tempoMedioRespostaDias !== null && (
                  <span>
                    Responde em média em <b className="text-ink">{stats.tempoMedioRespostaDias}d</b>
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-hairline pt-4 text-[13px] text-muted">
              {listing.buyInMin !== null && listing.buyInMax !== null && (
                <span>
                  Buy-in <b className="text-ink">R$ {listing.buyInMin} – R$ {listing.buyInMax}</b>
                </span>
              )}
              {listing.stakingPct !== null && (
                <span>
                  Staking <b className="text-ink">{listing.stakingPct}%</b>
                </span>
              )}
              {listing.minRoiPct !== null && (
                <span>
                  ROI mínimo <b className="text-ink">{listing.minRoiPct}%</b>
                </span>
              )}
              {listing.minVolumeSessionsMonth !== null && (
                <span>
                  Volume mínimo <b className="text-ink">{listing.minVolumeSessionsMonth} sessões/mês</b>
                </span>
              )}
            </div>

            {souGerente && (
              <div className="mt-4 flex justify-end border-t border-hairline pt-4">
                {listing.status === "aberta" ? (
                  <button
                    onClick={() => closeListing(listing.id).then(carregar)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated"
                  >
                    <Lock size={13} /> Fechar vaga
                  </button>
                ) : (
                  <button
                    onClick={() => reopenListing(listing.id).then(carregar)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated"
                  >
                    <Unlock size={13} /> Reabrir vaga
                  </button>
                )}
              </div>
            )}
          </section>

          {erro && <p className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">{erro}</p>}

          {souGerente ? (
            <section>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">
                Candidatos {candidatos ? `(${candidatos.length})` : ""}
              </h2>
              {candidatos === null ? (
                <div className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-8">
                  <Loader2 size={18} className="animate-spin text-muted" />
                </div>
              ) : candidatos.length === 0 ? (
                <p className="rounded-xl border border-hairline bg-surface p-6 text-sm text-muted">
                  Ninguém se candidatou ainda.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {candidatos.map((c) => (
                    <CandidateBadge key={c.id} applicationId={c.id} idealMin={idealMin} podeDecidir onDecided={carregar} />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <ApplySection
              listing={listing}
              matchScore={matchScore}
              idealMin={idealMin}
              minhaCandidatura={minhaCandidatura}
              onChanged={carregar}
            />
          )}
        </div>
      </main>
    </AppShell>
  );
}

function ApplySection({
  listing,
  matchScore,
  idealMin,
  minhaCandidatura,
  onChanged,
}: {
  listing: Listing;
  matchScore: number | null;
  idealMin: number;
  minhaCandidatura: MyApplication | null;
  onChanged: () => void;
}) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function candidatar() {
    setEnviando(true);
    setErro(null);
    try {
      await applyToListing(listing.id, mensagem || undefined);
      onChanged();
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível enviar a candidatura.");
    } finally {
      setEnviando(false);
    }
  }

  async function retirar() {
    if (!minhaCandidatura) return;
    setEnviando(true);
    try {
      await withdrawApplication(minhaCandidatura.id);
      onChanged();
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível retirar a candidatura.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      {matchScore !== null && (
        <div className="flex justify-center sm:justify-start">
          <SpeedGauge score={matchScore} idealMin={idealMin} label="Seu match com a vaga" />
        </div>
      )}

      <div className="flex-1">
        {minhaCandidatura && minhaCandidatura.status !== "retirada" ? (
          <div className="flex flex-col items-start gap-2">
            <Chip
              color={
                minhaCandidatura.status === "aceita" ? "#2FB89A" : minhaCandidatura.status === "recusada" ? "#e0555a" : "#E0B24C"
              }
            >
              {APPLICATION_STATUS_LABEL[minhaCandidatura.status]}
            </Chip>
            {minhaCandidatura.status === "pendente" && (
              <button
                onClick={retirar}
                disabled={enviando}
                className="text-xs font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-50"
              >
                Retirar candidatura
              </button>
            )}
          </div>
        ) : listing.status === "aberta" ? (
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={2}
              placeholder="Mensagem opcional pro time (por que você é a pessoa certa)"
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink"
            />
            <button
              onClick={candidatar}
              disabled={enviando}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {enviando && <Loader2 size={14} className="animate-spin" />}
              Candidatar-se
            </button>
            {erro && <p className="text-xs text-negative">{erro}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Esta vaga está fechada.</p>
        )}
      </div>
    </section>
  );
}
