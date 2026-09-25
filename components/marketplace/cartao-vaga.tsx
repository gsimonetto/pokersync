"use client";

import Link from "next/link";
import { ChevronRight, Clock, Star } from "lucide-react";
import { Chip } from "@/components/ranges/pecas";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  formatarBuyIn,
  requisitosAvaliados,
  type ApplicationStatus,
  type Listing,
  type MeuMatch,
} from "@/lib/services/marketplace-service";
import { AMBAR, AnelMatch, MarcaTime, ReqChip, diasAte, haDias, requisitosDaVaga, tempoDeResposta } from "./pecas";

/** Chip "encerra em N dias" (só nos últimos 3 dias). */
export function ChipEncerra({ expiresAt }: { expiresAt: string | null }) {
  const dias = diasAte(expiresAt);
  if (dias === null || dias > 3) return null;
  return (
    <Chip cor={AMBAR}>
      <Clock size={11} /> {dias <= 0 ? "encerra hoje" : `encerra em ${dias} ${dias === 1 ? "dia" : "dias"}`}
    </Chip>
  );
}

// Cartão de uma vaga no feed: time, título, o que ela oferece, cada
// requisito já marcado (verde bate, vermelho não) e o match do jogador.
export function CartaoVaga({
  vaga,
  meu,
  carregandoMatch = false,
  favorita = false,
  onFavoritar,
  candidatura,
}: {
  vaga: Listing;
  /** Match do jogador logado (sem ele: requisitos neutros). */
  meu?: MeuMatch;
  carregandoMatch?: boolean;
  favorita?: boolean;
  onFavoritar?: () => void;
  /** Status da candidatura da pessoa nessa vaga, se ela já se candidatou. */
  candidatura?: ApplicationStatus | null;
}) {
  const reqs = meu?.requisitos ?? requisitosDaVaga(vaga);
  const buyIn = formatarBuyIn(vaga);
  const responde = vaga.time?.tempoMedioRespostaDias;
  const candidatos = meu?.candidatos;

  return (
    <article className="painel-vidro relative flex flex-col gap-3 rounded-2xl border border-white/10 p-4 transition hover:border-white/20">
      <div className="flex items-start gap-3">
        <MarcaTime nome={vaga.teamName} cor={vaga.teamAccent} logoUrl={vaga.teamLogoUrl} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[12px] text-muted">
            {vaga.teamName}
            {responde != null && ` · responde em ${tempoDeResposta(responde)}`}
          </p>
          <h3 className="m-0 mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
            <Link href={`/marketplace/${vaga.id}`} className="after:absolute after:inset-0 after:rounded-2xl after:content-['']">
              {vaga.title}
            </Link>
          </h3>
        </div>
        {onFavoritar && (
          <button
            type="button"
            onClick={onFavoritar}
            title={favorita ? "Tirar das favoritas" : "Favoritar vaga"}
            aria-label={favorita ? "Tirar das favoritas" : "Favoritar vaga"}
            aria-pressed={favorita}
            className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${
              favorita ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#e8cb6a]" : "border-white/10 text-muted hover:text-ink"
            }`}
          >
            <Star size={14} fill={favorita ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip>{vaga.format}</Chip>
        {buyIn && <Chip>Buy-in {buyIn}</Chip>}
        {vaga.stakingPct != null && <Chip>Staking {vaga.stakingPct.toLocaleString("pt-BR")}%</Chip>}
        <ChipEncerra expiresAt={vaga.expiresAt} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {reqs.length ? (
          reqs.map((r) => <ReqChip key={r.chave} r={r} moeda={vaga.moeda} />)
        ) : (
          <span className="text-[12px] text-muted">Sem requisitos: qualquer jogador pode se candidatar.</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
        <span className="min-w-0 text-[11.5px] leading-snug text-muted">
          {candidatura && candidatura !== "retirada" ? (
            <span className="font-semibold" style={{ color: APPLICATION_STATUS_COLOR[candidatura] }}>
              Você se candidatou · {APPLICATION_STATUS_LABEL[candidatura]}
            </span>
          ) : (
            <>
              {candidatos == null
                ? null
                : candidatos === 0
                  ? "Nenhum candidato ainda · "
                  : `${candidatos} ${candidatos === 1 ? "candidato" : "candidatos"} · `}
              publicada {haDias(vaga.createdAt)}
            </>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {carregandoMatch ? (
            <span className="h-[58px] w-[58px] animate-pulse rounded-full border border-white/10" aria-hidden />
          ) : (
            <AnelMatch
              valor={meu?.match ?? null}
              estado={reqs.length === 0 ? "livre" : !meu || requisitosAvaliados(meu).length === 0 ? "sem-dados" : "numero"}
            />
          )}
          <ChevronRight size={16} className="text-muted" aria-hidden />
        </span>
      </div>
    </article>
  );
}
