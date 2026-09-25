"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronRight, MessageCircle } from "lucide-react";
import { CascaVagas } from "@/components/marketplace/casca-vagas";
import { AnelMatch, MarcaTime, haDias, situacaoDaVaga } from "@/components/marketplace/pecas";
import { Chip } from "@/components/ranges/pecas";
import { BOTAO_OURO } from "@/components/banca/util";
import {
  fetchMeusMatches,
  fetchMyApplications,
  fetchNaoLidas,
  requisitosAvaliados,
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  type MeuMatch,
  type MyApplication,
} from "@/lib/services/marketplace-service";

// Minhas candidaturas: em que pé está cada uma, mensagens novas do time
// (a conversa abre na página da vaga) e o match de hoje com cada vaga.
export default function MinhasCandidaturasPage() {
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [matches, setMatches] = useState<Map<string, MeuMatch>>(new Map());
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [lista, lidas] = await Promise.all([
          fetchMyApplications(),
          fetchNaoLidas()
            .then((n) => n.porCandidatura)
            .catch(() => new Map<string, number>()),
        ]);
        if (!vivo) return;
        setApps(lista);
        setNaoLidas(lidas);
        if (lista.length) {
          const m = await fetchMeusMatches(lista.map((a) => a.listingId)).catch(() => new Map<string, MeuMatch>());
          if (vivo) setMatches(m);
        }
      } catch (e) {
        if (vivo) {
          setErro((e as Error)?.message ?? "Não foi possível carregar suas candidaturas.");
          setApps([]);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const { ativas, encerradas } = useMemo(() => {
    const todas = apps ?? [];
    return {
      ativas: todas.filter((a) => a.status === "pendente" || a.status === "aceita"),
      encerradas: todas.filter((a) => a.status === "recusada" || a.status === "retirada"),
    };
  }, [apps]);

  return (
    <CascaVagas
      titulo="Vagas"
      subtitulo="Acompanhe suas candidaturas e converse com os times."
      aba="candidaturas"
    >
      {erro && <p className="mb-3 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>}

      {apps === null ? (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,22.5rem),1fr))]" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="painel-vidro h-[150px] animate-pulse rounded-2xl border border-white/10" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <section className="painel-vidro mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <Briefcase size={28} className="text-[#e8cb6a]" />
          <h2 className="m-0 text-[17px] font-semibold">Você ainda não se candidatou a nenhuma vaga</h2>
          <p className="m-0 max-w-md text-[13px] leading-relaxed text-muted">
            Em cada vaga você vê na hora se bate os requisitos. Depois de se candidatar, a conversa com o time aparece aqui.
          </p>
          <Link href="/marketplace" className={BOTAO_OURO}>
            Ver as vagas
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {ativas.length > 0 && (
            <Grupo titulo="Em andamento">
              {ativas.map((a) => (
                <CartaoCandidatura key={a.id} a={a} meu={matches.get(a.listingId)} naoLidas={naoLidas.get(a.id) ?? 0} />
              ))}
            </Grupo>
          )}
          {encerradas.length > 0 && (
            <Grupo titulo="Encerradas">
              {encerradas.map((a) => (
                <CartaoCandidatura key={a.id} a={a} meu={matches.get(a.listingId)} naoLidas={naoLidas.get(a.id) ?? 0} />
              ))}
            </Grupo>
          )}
        </div>
      )}
    </CascaVagas>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{titulo}</h2>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,22.5rem),1fr))]">{children}</div>
    </section>
  );
}

function CartaoCandidatura({ a, meu, naoLidas }: { a: MyApplication; meu?: MeuMatch; naoLidas: number }) {
  const l = a.listing;
  const sit = situacaoDaVaga(l);
  const match = meu?.match ?? a.matchScore;
  const reqs = meu?.requisitos ?? [];
  return (
    <Link
      href={`/marketplace/${l.id}${naoLidas > 0 ? "?conversa=1" : ""}`}
      className="painel-vidro flex flex-col gap-3 rounded-2xl border border-white/10 p-4 transition hover:border-white/20"
    >
      <div className="flex items-start gap-3">
        <MarcaTime nome={l.teamName} cor={l.teamAccent} logoUrl={l.teamLogoUrl} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[12px] text-muted">
            {l.teamName} · enviada {haDias(a.createdAt)}
          </p>
          <h3 className="m-0 mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{l.title}</h3>
        </div>
        {meu === undefined && match == null ? null : (
          <AnelMatch
            valor={match}
            tamanho={48}
            estado={meu && reqs.length === 0 ? "livre" : meu && requisitosAvaliados(meu).length === 0 ? "sem-dados" : "numero"}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip cor={APPLICATION_STATUS_COLOR[a.status]}>{APPLICATION_STATUS_LABEL[a.status]}</Chip>
        {sit.texto !== "Aberta" && <Chip cor={sit.cor}>Vaga {sit.texto.toLocaleLowerCase("pt-BR")}</Chip>}
        {naoLidas > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#d4af37] px-2 py-0.5 text-[11px] font-bold text-black">
            <MessageCircle size={11} /> {naoLidas} {naoLidas === 1 ? "mensagem do time" : "mensagens do time"}
          </span>
        )}
      </div>
      {a.status === "recusada" && a.decisionNote && <p className="m-0 text-[12.5px] italic text-muted">Motivo: &ldquo;{a.decisionNote}&rdquo;</p>}
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[12px] text-muted">
        <span>{a.status === "pendente" || a.status === "aceita" ? "Abrir a vaga e a conversa" : "Ver a vaga"}</span>
        <ChevronRight size={15} />
      </div>
    </Link>
  );
}
