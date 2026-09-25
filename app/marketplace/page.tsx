"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Check, Plus, Search, SlidersHorizontal, Star } from "lucide-react";
import { CascaVagas } from "@/components/marketplace/casca-vagas";
import { CartaoVaga } from "@/components/marketplace/cartao-vaga";
import { FaixaCartao, SeuCartao } from "@/components/marketplace/meu-cartao";
import { VagasDoTime } from "@/components/marketplace/vagas-do-time";
import { Chip } from "@/components/ranges/pecas";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { PERFIL_MUDOU } from "@/lib/eventos-perfil";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  bateTudo,
  fetchContagemCandidatos,
  fetchMeuCartao,
  fetchMeusMatches,
  fetchMyApplications,
  fetchMyFavoriteIds,
  fetchMyTeamListings,
  fetchNaoLidas,
  fetchOpenListings,
  setLookingForTeam,
  stakeTierOf,
  toggleFavorite,
  STAKE_TIER_LABEL,
  STAKE_TIER_ORDER,
  type ApplicationStatus,
  type ContagemCandidatos,
  type Listing,
  type ListingFormat,
  type MeuCartao,
  type MeuMatch,
} from "@/lib/services/marketplace-service";

const FORMATOS: ListingFormat[] = ["MTT", "Cash", "SNG", "Spin"];

// Feed das Vagas: cada vaga já mostra, requisito por requisito, se o
// jogador bate (o match vem do banco, marketplace_meus_matches). Separado
// por faixa de stakes (pedido explícito), melhor match primeiro dentro de
// cada faixa. Quem é admin/coach vê as vagas do próprio time na coluna
// da esquerda; quem procura time vê ali o próprio cartão.
export default function VagasPage() {
  const [vagas, setVagas] = useState<Listing[] | null>(null);
  const [matches, setMatches] = useState<Map<string, MeuMatch> | null>(null);
  const [time, setTime] = useState<MyTeam | null | undefined>(undefined);
  const [cartao, setCartao] = useState<MeuCartao | null | undefined>(undefined);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [minhas, setMinhas] = useState<Map<string, { id: string; status: ApplicationStatus }>>(new Map());
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [vagasDoTime, setVagasDoTime] = useState<Listing[]>([]);
  const [contagem, setContagem] = useState<Map<string, ContagemCandidatos>>(new Map());
  const [salvandoProcurando, setSalvandoProcurando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [formato, setFormato] = useState<ListingFormat | "todos">("todos");
  const [soBato, setSoBato] = useState(false);
  const [soFavoritas, setSoFavoritas] = useState(false);

  const gerente = time?.role === "admin" || time?.role === "coach";

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [abertas, meuTime, favs, meuCartao, apps, lidas] = await Promise.all([
          fetchOpenListings(),
          fetchMyTeam().catch(() => null),
          fetchMyFavoriteIds().catch(() => new Set<string>()),
          fetchMeuCartao().catch(() => null),
          fetchMyApplications().catch(() => []),
          fetchNaoLidas()
            .then((n) => n.porCandidatura)
            .catch(() => new Map<string, number>()),
        ]);
        if (!vivo) return;
        setVagas(abertas);
        setTime(meuTime);
        setFavoritos(favs);
        setCartao(meuCartao);
        setMinhas(new Map(apps.map((a) => [a.listingId, { id: a.id, status: a.status }])));
        setNaoLidas(lidas);
        fetchMeusMatches()
          .then((m) => vivo && setMatches(m))
          .catch(() => vivo && setMatches(new Map()));
        if (meuTime && (meuTime.role === "admin" || meuTime.role === "coach")) {
          const doTime = await fetchMyTeamListings(meuTime.team.id);
          if (!vivo) return;
          setVagasDoTime(doTime);
          setContagem(await fetchContagemCandidatos(doTime.map((l) => l.id)).catch(() => new Map()));
        }
      } catch (e) {
        if (vivo) setErro((e as Error)?.message ?? "Não foi possível carregar as vagas.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Mudou horário/dias em Configurações: o cartão acompanha.
  useEffect(() => {
    const recarregar = () => fetchMeuCartao().then(setCartao).catch(() => {});
    window.addEventListener(PERFIL_MUDOU, recarregar);
    return () => window.removeEventListener(PERFIL_MUDOU, recarregar);
  }, []);

  const onProcurando = useCallback(
    async (v: boolean) => {
      if (!cartao) return;
      setSalvandoProcurando(true);
      setCartao({ ...cartao, procurandoVaga: v });
      try {
        await setLookingForTeam(v);
      } catch {
        setCartao({ ...cartao, procurandoVaga: !v });
      } finally {
        setSalvandoProcurando(false);
      }
    },
    [cartao],
  );

  async function onFavoritar(id: string) {
    const era = favoritos.has(id);
    const troca = (s: Set<string>, ligar: boolean) => {
      const n = new Set(s);
      if (ligar) n.add(id);
      else n.delete(id);
      return n;
    };
    setFavoritos((s) => troca(s, !era));
    try {
      await toggleFavorite(id, !era);
    } catch {
      setFavoritos((s) => troca(s, era));
    }
  }

  // Vagas de outros times (as do próprio time ficam na coluna da esquerda).
  const outras = useMemo(() => (vagas ?? []).filter((l) => !time || l.teamId !== time.team.id), [vagas, time]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return outras.filter((l) => {
      if (formato !== "todos" && l.format !== formato) return false;
      if (soFavoritas && !favoritos.has(l.id)) return false;
      if (soBato) {
        const m = matches?.get(l.id);
        if (!m || !bateTudo(m)) return false;
      }
      if (termo && !`${l.title} ${l.teamName}`.toLocaleLowerCase("pt-BR").includes(termo)) return false;
      return true;
    });
  }, [outras, busca, formato, soFavoritas, soBato, favoritos, matches]);

  const porFaixa = useMemo(() => {
    const grupos = new Map<string, Listing[]>();
    for (const l of filtradas) {
      const faixa = stakeTierOf(l);
      grupos.set(faixa, [...(grupos.get(faixa) ?? []), l]);
    }
    const nota = (l: Listing) => matches?.get(l.id)?.match ?? -1;
    return STAKE_TIER_ORDER.map((tier) => ({ tier, vagas: [...(grupos.get(tier) ?? [])].sort((a, b) => nota(b) - nota(a)) })).filter(
      (g) => g.vagas.length > 0,
    );
  }, [filtradas, matches]);

  const filtrosAtivos = formato !== "todos" || soBato || soFavoritas || busca.trim() !== "";
  const nomeTime = time?.team.name ?? null;

  return (
    <CascaVagas
      titulo="Vagas"
      subtitulo={
        gerente
          ? "Publique vagas do seu time e veja quem combina com cada uma."
          : "Times procurando jogadores — veja na hora se você combina com cada vaga."
      }
      acoes={
        gerente ? (
          <Link href="/marketplace/nova" className={`${BOTAO_OURO} whitespace-nowrap`}>
            <Plus size={16} strokeWidth={2.2} /> Nova vaga
          </Link>
        ) : null
      }
      aba="vagas"
    >
      {erro && <p className="mb-3 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>}

      <div className="grid items-start gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Coluna da esquerda: vagas do time (admin/coach) ou o cartão. */}
        {gerente && time ? (
          <VagasDoTime nomeTime={time.team.name} vagas={vagasDoTime} contagem={contagem} naoLidas={naoLidas} />
        ) : cartao ? (
          <>
            <FaixaCartao cartao={cartao} nomeTime={nomeTime} onProcurando={onProcurando} salvando={salvandoProcurando} />
            <div className="hidden lg:block">
              <SeuCartao cartao={cartao} nomeTime={nomeTime} onProcurando={onProcurando} salvando={salvandoProcurando} />
            </div>
          </>
        ) : (
          <div className="painel-vidro h-[88px] animate-pulse rounded-2xl border border-white/10 lg:h-[420px]" aria-hidden />
        )}

        <div className="flex min-w-0 flex-col gap-3">
          <section className="painel-vidro flex flex-col gap-2 rounded-2xl border border-white/10 p-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-1.5">
            <label className="relative mr-1 flex min-w-[180px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar time ou vaga"
                aria-label="Buscar time ou vaga"
                className={`${CAMPO} !py-2 !pl-8`}
              />
            </label>
            <div className="painel-scroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 lg:contents">
              <Chip ativo={formato === "todos"} onClick={() => setFormato("todos")}>
                Todos
              </Chip>
              {FORMATOS.map((f) => (
                <Chip key={f} ativo={formato === f} onClick={() => setFormato(formato === f ? "todos" : f)}>
                  {f}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 self-stretch bg-white/10" aria-hidden />
              <Chip ativo={soBato} onClick={() => setSoBato((v) => !v)} title="Só as vagas em que você bate todos os requisitos">
                <Check size={11} /> Só as que eu bato
              </Chip>
              <Chip ativo={soFavoritas} onClick={() => setSoFavoritas((v) => !v)}>
                <Star size={11} /> Favoritas
              </Chip>
            </div>
            <span className="inline-flex items-center gap-1 text-[12px] text-muted lg:ml-auto">
              <SlidersHorizontal size={13} /> Melhor match primeiro
            </span>
          </section>

          {vagas === null ? (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,22.5rem),1fr))]" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="painel-vidro h-[210px] animate-pulse rounded-2xl border border-white/10" />
              ))}
            </div>
          ) : outras.length === 0 ? (
            <SemVagas
              gerente={gerente}
              procurando={cartao?.procurandoVaga ?? false}
              temTime={Boolean(time)}
              onLigar={() => onProcurando(true)}
            />
          ) : filtradas.length === 0 ? (
            <section className="painel-vidro flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 p-8 text-center">
              <p className="m-0 text-[14px] font-semibold">Nenhuma vaga com esses filtros.</p>
              {filtrosAtivos && (
                <button
                  type="button"
                  className={BOTAO_VIDRO}
                  onClick={() => {
                    setBusca("");
                    setFormato("todos");
                    setSoBato(false);
                    setSoFavoritas(false);
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </section>
          ) : (
            porFaixa.map(({ tier, vagas: lista }) => (
              <section key={tier} className="flex flex-col gap-2">
                <h2 className="m-0 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {STAKE_TIER_LABEL[tier]} <span className="text-muted/60">({lista.length})</span>
                </h2>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,22.5rem),1fr))]">
                  {lista.map((l) => (
                    <CartaoVaga
                      key={l.id}
                      vaga={l}
                      meu={matches?.get(l.id)}
                      carregandoMatch={matches === null}
                      favorita={favoritos.has(l.id)}
                      onFavoritar={() => onFavoritar(l.id)}
                      candidatura={minhas.get(l.id)?.status ?? null}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </CascaVagas>
  );
}

function SemVagas({ gerente, procurando, temTime, onLigar }: { gerente: boolean; procurando: boolean; temTime: boolean; onLigar: () => void }) {
  return (
    <section className="painel-vidro flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 p-8 text-center">
      <Briefcase size={30} className="text-[#e8cb6a]" />
      <h2 className="m-0 text-[18px] font-semibold">Nenhuma vaga aberta agora</h2>
      <p className="m-0 max-w-md text-[13px] leading-relaxed text-muted">
        {gerente ? (
          "Nenhum outro time está com vaga aberta. Publique a vaga do seu time: quem procura time e combina com ela recebe um aviso."
        ) : temTime ? (
          "Quando um time abrir vaga, ela aparece aqui com o seu match."
        ) : (
          <>
            Com <b className="text-ink/90">Procurando time</b> ligado, a gente te avisa assim que um time abrir vaga que combine com você.
            Enquanto isso, deixe seu cartão completo: é ele que os times olham primeiro.
          </>
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {gerente ? (
          <Link href="/marketplace/nova" className={BOTAO_OURO}>
            <Plus size={15} /> Publicar vaga
          </Link>
        ) : (
          <>
            {!temTime && !procurando && (
              <button type="button" onClick={onLigar} className={BOTAO_OURO}>
                Ligar Procurando time
              </button>
            )}
            {!temTime && (
              <Link href="/time" className={BOTAO_VIDRO}>
                Tem um time? Publique uma vaga
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
