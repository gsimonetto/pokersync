"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users2, ChevronRight, Loader2, Star, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/chip";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterPopover } from "@/components/ui/filter-popover";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  fetchOpenListings,
  fetchMyTeamListings,
  fetchMatchScore,
  fetchMyFavoriteIds,
  toggleFavorite,
  type Listing,
  type ListingFormat,
  FORMAT_LABEL,
} from "@/lib/services/marketplace-service";

const FORMATS: ListingFormat[] = ["MTT", "Cash", "SNG", "Spin"];

interface Filtros {
  formats: ListingFormat[];
  buyInMax: string;
  stakingMin: string;
  somenteFavoritos: boolean;
}

const FILTROS_VAZIOS: Filtros = { formats: [], buyInMax: "", stakingMin: "", somenteFavoritos: false };

// Feed do Marketplace de vagas: qualquer jogador navega e ve o match
// score dele contra cada vaga aberta (calculado em RPC, nao inventado
// no cliente). Quem gerencia um time ve tambem as proprias vagas
// (abertas e fechadas) numa segunda secao, com atalho pra criar uma
// nova. Filtros seguem o mesmo padrao do resto do produto (FilterChip +
// FilterPopover, ver Player Evolution/Gestao de Banca) em vez de
// inventar um componente novo so' pra essa tela.
export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [minhasVagas, setMinhasVagas] = useState<Listing[]>([]);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [erro, setErro] = useState<string | null>(null);

  const podeGerenciar = myTeam?.role === "admin" || myTeam?.role === "coach";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [open, team, favs] = await Promise.all([
          fetchOpenListings(),
          fetchMyTeam().catch(() => null),
          fetchMyFavoriteIds().catch(() => new Set<string>()),
        ]);
        if (!alive) return;
        setListings(open);
        setMyTeam(team);
        setFavoritos(favs);
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

  async function onToggleFavorite(listingId: string) {
    const favoritado = favoritos.has(listingId);
    setFavoritos((prev) => {
      const next = new Set(prev);
      if (favoritado) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      await toggleFavorite(listingId, !favoritado);
    } catch {
      // reverte se a chamada falhar
      setFavoritos((prev) => {
        const next = new Set(prev);
        if (favoritado) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }
  }

  const outrasVagas = useMemo(() => {
    let base = (listings ?? []).filter((l) => !myTeam || l.teamId !== myTeam.team.id);
    if (filtros.formats.length > 0) base = base.filter((l) => filtros.formats.includes(l.format));
    if (filtros.buyInMax.trim() !== "") {
      const max = Number(filtros.buyInMax);
      base = base.filter((l) => l.buyInMin === null || l.buyInMin <= max);
    }
    if (filtros.stakingMin.trim() !== "") {
      const min = Number(filtros.stakingMin);
      base = base.filter((l) => l.stakingPct !== null && l.stakingPct >= min);
    }
    if (filtros.somenteFavoritos) base = base.filter((l) => favoritos.has(l.id));
    return base;
  }, [listings, myTeam, filtros, favoritos]);

  const filtrosAtivos =
    filtros.formats.length + (filtros.buyInMax ? 1 : 0) + (filtros.stakingMin ? 1 : 0) + (filtros.somenteFavoritos ? 1 : 0);

  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        {erro && (
          <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
        )}

        <div className="mx-auto max-w-4xl rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
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

          <section className={podeGerenciar && minhasVagas.length > 0 ? "mt-6" : undefined}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">Vagas abertas</h2>
              <FilterPopover active={filtrosAtivos > 0} label="Filtros" icon={SlidersHorizontal}>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map((f) => (
                    <FilterChip
                      key={f}
                      label={f}
                      active={filtros.formats.includes(f)}
                      onClick={() =>
                        setFiltros((prev) => ({
                          ...prev,
                          formats: prev.formats.includes(f) ? prev.formats.filter((x) => x !== f) : [...prev.formats, f],
                        }))
                      }
                    />
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
                  Buy-in máximo (R$)
                  <input
                    type="number"
                    min="0"
                    value={filtros.buyInMax}
                    onChange={(e) => setFiltros((prev) => ({ ...prev, buyInMax: e.target.value }))}
                    className="rounded-md border border-hairline bg-elevated px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
                  Staking mínimo (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filtros.stakingMin}
                    onChange={(e) => setFiltros((prev) => ({ ...prev, stakingMin: e.target.value }))}
                    className="rounded-md border border-hairline bg-elevated px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                  <input
                    type="checkbox"
                    checked={filtros.somenteFavoritos}
                    onChange={(e) => setFiltros((prev) => ({ ...prev, somenteFavoritos: e.target.checked }))}
                  />
                  Somente favoritos
                </label>
                {filtrosAtivos > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltros(FILTROS_VAZIOS)}
                    className="text-left text-[11px] font-semibold text-muted underline-offset-2 hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </FilterPopover>
            </div>

            {listings === null ? (
              <div className="flex items-center justify-center rounded-lg border border-hairline bg-elevated p-10">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            ) : outrasVagas.length === 0 ? (
              <p className="rounded-lg border border-hairline bg-elevated p-6 text-sm text-muted">
                {filtrosAtivos > 0 ? "Nenhuma vaga corresponde aos filtros." : "Nenhuma vaga aberta no momento. Volte mais tarde."}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {outrasVagas.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    matchScore={scores[l.id] ?? null}
                    favorito={favoritos.has(l.id)}
                    onToggleFavorite={() => onToggleFavorite(l.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function ListingCard({
  listing,
  matchScore,
  showStatus,
  favorito,
  onToggleFavorite,
}: {
  listing: Listing;
  matchScore?: number | null;
  showStatus?: boolean;
  favorito?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated p-4 transition-colors hover:border-white/15">
      <Link href={`/marketplace/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-4">
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
      {onToggleFavorite && (
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
  );
}
