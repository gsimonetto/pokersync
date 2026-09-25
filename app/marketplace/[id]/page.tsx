"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Link2, Loader2, Lock, Star, Unlock, Users } from "lucide-react";
import { CascaVagas } from "@/components/marketplace/casca-vagas";
import { CandidateBadge } from "@/components/marketplace/candidate-badge";
import { ChipEncerra } from "@/components/marketplace/cartao-vaga";
import { ConversaCandidatura } from "@/components/marketplace/conversa-candidatura";
import { MatchExplicado } from "@/components/marketplace/match-explicado";
import { MarcaTime, Numero, ReqChip, haDias, requisitosDaVaga, situacaoDaVaga, tempoDeResposta } from "@/components/marketplace/pecas";
import { PlayerBadge, crachaDoMeuCartao } from "@/components/time/player-badge";
import { Chip } from "@/components/ranges/pecas";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { useConfirm } from "@/components/confirm-dialog";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  applyToListing,
  closeListing,
  fetchApplicationsForListing,
  fetchListing,
  fetchMeuCartao,
  fetchMeusMatches,
  fetchMyApplicationForListing,
  fetchMyFavoriteIds,
  fetchNaoLidas,
  formatarBuyIn,
  isListingOpen,
  reopenListing,
  toggleFavorite,
  withdrawApplication,
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  FORMAT_LABEL,
  type ApplicationSummary,
  type Listing,
  type MeuCartao,
  type MeuMatch,
  type MyApplication,
} from "@/lib/services/marketplace-service";

// Uma vaga: quem procura time vê o que ela oferece, o time, o próprio
// match explicado requisito por requisito, se candidata e conversa com o
// time; quem gerencia o time vê os candidatos (com conversa e decisão).
// Links das notificações: ?conversa=1 (candidato) desce até a conversa;
// ?candidato=<id> (time) abre aquele candidato.
export default function VagaPage() {
  const { id } = useParams<{ id: string }>();
  const [vaga, setVaga] = useState<Listing | null | undefined>(undefined);
  const [time, setTime] = useState<MyTeam | null>(null);
  const [meu, setMeu] = useState<MeuMatch | null | undefined>(undefined);
  const [cartao, setCartao] = useState<MeuCartao | null>(null);
  const [candidatura, setCandidatura] = useState<MyApplication | null>(null);
  const [candidatos, setCandidatos] = useState<ApplicationSummary[] | null>(null);
  const [naoLidas, setNaoLidas] = useState<Map<string, number>>(new Map());
  const [favorita, setFavorita] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<{ candidato: string | null; conversa: boolean }>({ candidato: null, conversa: false });

  // Lido uma vez só (sem useSearchParams, que pediria Suspense na página).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setLink({ candidato: p.get("candidato"), conversa: p.get("conversa") === "1" });
  }, []);

  const atualizarNaoLidas = useCallback(() => {
    fetchNaoLidas()
      .then((n) => setNaoLidas(n.porCandidatura))
      .catch(() => {});
  }, []);

  const carregar = useCallback(async () => {
    try {
      const l = await fetchListing(id);
      setVaga(l);
      if (!l) return;
      const meuTime = await fetchMyTeam().catch(() => null);
      setTime(meuTime);
      atualizarNaoLidas();
      const gerenteDaVaga = !!meuTime && (meuTime.role === "admin" || meuTime.role === "coach") && meuTime.team.id === l.teamId;
      if (gerenteDaVaga) {
        setCandidatos(await fetchApplicationsForListing(l.id));
        return;
      }
      fetchMyFavoriteIds()
        .then((ids) => setFavorita(ids.has(l.id)))
        .catch(() => {});
      const [m, app, c] = await Promise.all([
        fetchMeusMatches([l.id])
          .then((mm) => mm.get(l.id) ?? null)
          .catch(() => null),
        fetchMyApplicationForListing(l.id).catch(() => null),
        fetchMeuCartao().catch(() => null),
      ]);
      setMeu(m);
      setCandidatura(app);
      setCartao(c);
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível carregar a vaga.");
      setVaga((v) => (v === undefined ? null : v));
    }
  }, [id, atualizarNaoLidas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ?conversa=1: desce até a conversa quando ela aparecer.
  useEffect(() => {
    if (link.conversa && candidatura) document.getElementById("conversa")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [link.conversa, candidatura]);

  const gerente = !!vaga && !!time && (time.role === "admin" || time.role === "coach") && time.team.id === vaga.teamId;

  if (vaga === undefined) {
    return (
      <CascaVagas titulo="Vagas" aba="vagas" atalhos={false}>
        <div className="grid place-items-center p-10">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      </CascaVagas>
    );
  }

  if (!vaga) {
    return (
      <CascaVagas titulo="Vagas" aba="vagas" atalhos={false}>
        <section className="painel-vidro mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-white/10 p-8 text-center">
          <p className="m-0 text-sm text-muted">{erro ?? "Essa vaga não existe mais ou fechou antes de você se candidatar."}</p>
          <Link href="/marketplace" className={BOTAO_VIDRO}>
            <ArrowLeft size={14} /> Ver as vagas abertas
          </Link>
        </section>
      </CascaVagas>
    );
  }

  async function onFavoritar() {
    if (!vaga) return;
    setFavorita((v) => !v);
    try {
      await toggleFavorite(vaga.id, !favorita);
    } catch {
      setFavorita((v) => !v);
    }
  }

  return (
    <CascaVagas titulo="Vagas" aba="vagas" atalhos={false}>
      <Link href="/marketplace" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition hover:text-ink">
        <ArrowLeft size={14} /> Todas as vagas
      </Link>
      {erro && <p className="mb-3 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>}

      {/* No computador: vaga e time à esquerda, match/candidatura à
          direita. No celular: cabeçalho, depois o que importa pra quem
          está vendo (o match ou os candidatos), depois o resto. */}
      {/* A 2ª linha é flexível: a coluna da direita (que ocupa as duas
          linhas) cresce sem abrir buraco embaixo do cabeçalho. */}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          <Cabecalho vaga={vaga} favorita={favorita} onFavoritar={gerente ? undefined : onFavoritar} />
        </div>

        {gerente ? (
          <>
            <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
              <Candidatos
                candidatos={candidatos}
                naoLidas={naoLidas}
                abrir={link.candidato}
                onMudou={carregar}
                onLidas={atualizarNaoLidas}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <GerenciarVaga vaga={vaga} candidatos={candidatos} onMudou={carregar} />
              <OQueAVagaPede vaga={vaga} />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <MatchExplicado vaga={vaga} meu={meu} />
              {candidatura && candidatura.status !== "retirada" ? (
                <>
                  <SuaCandidatura candidatura={candidatura} vaga={vaga} onMudou={carregar} />
                  <div id="conversa" className="scroll-mt-24">
                    <ConversaCandidatura
                      applicationId={candidatura.id}
                      lado="candidato"
                      status={candidatura.status}
                      nomeOutroLado={vaga.teamName}
                      onLidas={atualizarNaoLidas}
                    />
                  </div>
                </>
              ) : (
                <Candidatar vaga={vaga} cartao={cartao} nomeTime={time?.team.name ?? null} onMudou={carregar} />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
              <OQueOferece vaga={vaga} />
              <SobreOTime vaga={vaga} />
            </div>
          </>
        )}
      </div>
    </CascaVagas>
  );
}

function Cabecalho({ vaga, favorita, onFavoritar }: { vaga: Listing; favorita: boolean; onFavoritar?: () => void }) {
  const sit = situacaoDaVaga(vaga);
  const cor = vaga.teamAccent;
  return (
    <section className="painel-vidro overflow-hidden rounded-2xl border border-white/10">
      <div className="relative h-16 overflow-hidden sm:h-20">
        {vaga.teamBannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vaga.teamBannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${cor}55, ${cor}10 60%, transparent)` }} />
      </div>
      <div className="-mt-7 px-4 pb-4 sm:px-5">
        <div className="flex items-end justify-between gap-3">
          <span className="relative rounded-2xl bg-[#0b0b0b] p-1">
            <MarcaTime nome={vaga.teamName} cor={cor} logoUrl={vaga.teamLogoUrl} tamanho={56} />
          </span>
          {onFavoritar && (
            <button
              type="button"
              onClick={onFavoritar}
              aria-pressed={favorita}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition ${
                favorita ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#e8cb6a]" : "border-white/10 text-muted hover:text-ink"
              }`}
            >
              <Star size={13} fill={favorita ? "currentColor" : "none"} /> {favorita ? "Favorita" : "Favoritar"}
            </button>
          )}
        </div>
        <h2 className="m-0 mt-2 text-[20px] font-semibold leading-snug tracking-tight">{vaga.title}</h2>
        <p className="m-0 mt-0.5 text-[13px] text-muted">
          {vaga.teamName} · publicada {haDias(vaga.createdAt)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip>{FORMAT_LABEL[vaga.format]}</Chip>
          <Chip cor={sit.cor}>{sit.texto}</Chip>
          {sit.texto === "Aberta" && <ChipEncerra expiresAt={vaga.expiresAt} />}
        </div>
        {vaga.description && <p className="m-0 mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/85">{vaga.description}</p>}
      </div>
    </section>
  );
}

function OQueOferece({ vaga }: { vaga: Listing }) {
  const buyIn = formatarBuyIn(vaga);
  const aberta = isListingOpen(vaga);
  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <h3 className="m-0 text-sm font-semibold">O que o time oferece</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero titulo="Staking" valor={vaga.stakingPct != null ? `${vaga.stakingPct.toLocaleString("pt-BR")}%` : "—"} />
        <Numero titulo="Buy-ins" valor={buyIn ?? "—"} detalhe={vaga.moeda === "USD" ? "em dólar" : undefined} />
        <Numero titulo="Formato" valor={FORMAT_LABEL[vaga.format]} />
        <Numero
          titulo={aberta ? "Aberta até" : "Prazo"}
          valor={vaga.expiresAt ? new Date(vaga.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : aberta ? "Sem prazo" : "—"}
        />
      </div>
    </section>
  );
}

function SobreOTime({ vaga }: { vaga: Listing }) {
  const t = vaga.time;
  if (!t) return null;
  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <h3 className="m-0 text-sm font-semibold">Sobre o {t.nome}</h3>
      {t.descricao && <p className="m-0 mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink/80">{t.descricao}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero titulo="Jogadores" valor={t.jogadores} />
        <Numero titulo="Vagas publicadas" valor={t.totalVagas} detalhe={`${t.vagasAbertas} ${t.vagasAbertas === 1 ? "aberta" : "abertas"}`} />
        <Numero titulo="Aceita" valor={t.taxaAceitePct != null ? `${t.taxaAceitePct.toLocaleString("pt-BR")}%` : "—"} detalhe={t.taxaAceitePct != null ? "das candidaturas" : "ainda sem decisões"} />
        <Numero titulo="Responde em" valor={t.tempoMedioRespostaDias != null ? tempoDeResposta(t.tempoMedioRespostaDias) : "—"} />
      </div>
    </section>
  );
}

function Candidatar({ vaga, cartao, nomeTime, onMudou }: { vaga: Listing; cartao: MeuCartao | null; nomeTime: string | null; onMudou: () => void }) {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aberta = isListingOpen(vaga);

  async function candidatar() {
    setEnviando(true);
    setErro(null);
    try {
      await applyToListing(vaga.id, mensagem.trim() || undefined);
      onMudou();
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível enviar a candidatura.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <h3 className="m-0 text-sm font-semibold">O que o time vai ver de você</h3>
      {cartao && (
        <div className="mt-2.5">
          <PlayerBadge dados={crachaDoMeuCartao(cartao)} variante="compacto" animar={false} />
        </div>
      )}
      {nomeTime && (
        <p className="m-0 mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-muted">
          <Users size={14} className="mt-px shrink-0 text-ink/70" />
          <span>
            Você joga pelo <b className="text-ink/90">{nomeTime}</b>. Pode se candidatar, mas pra ser aceito aqui precisa sair dele antes.
          </span>
        </p>
      )}
      {aberta ? (
        <>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Mensagem pro time (opcional): por que você é a pessoa certa"
            aria-label="Mensagem pro time"
            className={`${CAMPO} mt-3 resize-none`}
          />
          <button type="button" onClick={candidatar} disabled={enviando} className={`${BOTAO_OURO} mt-2.5 w-full py-2.5`}>
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Candidatar-se
          </button>
          <p className="m-0 mt-2 text-[11px] leading-snug text-muted/80">Depois de se candidatar, você conversa com o time por aqui.</p>
          {erro && <p className="m-0 mt-2 text-[12px] text-negative">{erro}</p>}
        </>
      ) : (
        <p className="m-0 mt-3 text-[13px] text-muted">{vaga.status === "aberta" ? "O prazo dessa vaga encerrou." : "Essa vaga está fechada."}</p>
      )}
    </section>
  );
}

function SuaCandidatura({ candidatura, vaga, onMudou }: { candidatura: MyApplication; vaga: Listing; onMudou: () => void }) {
  const confirmar = useConfirm();
  const [retirando, setRetirando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cor = APPLICATION_STATUS_COLOR[candidatura.status];

  async function retirar() {
    const ok = await confirmar({
      title: "Retirar candidatura?",
      message: "O time deixa de ver você entre os candidatos e a conversa fecha. Dá pra se candidatar de novo enquanto a vaga estiver aberta.",
      confirmLabel: "Retirar",
      tone: "danger",
    });
    if (!ok) return;
    setRetirando(true);
    try {
      await withdrawApplication(candidatura.id);
      onMudou();
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível retirar a candidatura.");
    } finally {
      setRetirando(false);
    }
  }

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">Sua candidatura</h3>
        <Chip cor={cor}>{APPLICATION_STATUS_LABEL[candidatura.status]}</Chip>
      </div>
      <p className="m-0 mt-2 text-[12.5px] leading-snug text-muted">
        Enviada {haDias(candidatura.createdAt)}.{" "}
        {candidatura.status === "pendente" && "O time ainda vai decidir — enquanto isso, vocês podem conversar aqui embaixo."}
        {candidatura.status === "aceita" && (
          <>
            Você agora faz parte do <b className="text-ink/90">{vaga.teamName}</b>.{" "}
            <Link href="/time" className="font-semibold text-[#e8cb6a] hover:underline">
              Ir pro time ›
            </Link>
          </>
        )}
        {candidatura.status === "recusada" && "O time não aceitou dessa vez."}
      </p>
      {candidatura.status === "recusada" && candidatura.decisionNote && (
        <p className="m-0 mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] italic text-ink/80">
          Motivo: &ldquo;{candidatura.decisionNote}&rdquo;
        </p>
      )}
      {candidatura.message && <p className="m-0 mt-2 text-[12.5px] italic text-muted">Sua mensagem: &ldquo;{candidatura.message}&rdquo;</p>}
      {candidatura.status === "pendente" && (
        <button type="button" onClick={retirar} disabled={retirando} className="mt-3 text-[12px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
          Retirar candidatura
        </button>
      )}
      {erro && <p className="m-0 mt-2 text-[12px] text-negative">{erro}</p>}
    </section>
  );
}

function Candidatos({
  candidatos,
  naoLidas,
  abrir,
  onMudou,
  onLidas,
}: {
  candidatos: ApplicationSummary[] | null;
  naoLidas: Map<string, number>;
  abrir: string | null;
  onMudou: () => void;
  onLidas: () => void;
}) {
  const ativos = (candidatos ?? []).filter((c) => c.status !== "retirada");
  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">Candidatos {candidatos ? `(${ativos.length})` : ""}</h3>
        <span className="text-[11.5px] text-muted">melhor match primeiro</span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {candidatos === null ? (
          <div className="grid place-items-center p-6">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : ativos.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-white/10 p-5 text-center text-[13px] text-muted">
            Ninguém se candidatou ainda. Quem procura time e combina com a vaga recebe um aviso.
          </p>
        ) : (
          ativos.map((c) => (
            <CandidateBadge
              key={c.id}
              applicationId={c.id}
              status={c.status}
              podeDecidir
              onDecided={onMudou}
              naoLidas={naoLidas.get(c.id) ?? 0}
              onLidas={onLidas}
              abrirAoCarregar={abrir === c.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

function GerenciarVaga({ vaga, candidatos, onMudou }: { vaga: Listing; candidatos: ApplicationSummary[] | null; onMudou: () => void }) {
  const confirmar = useConfirm();
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const aberta = isListingOpen(vaga);
  const buyIn = formatarBuyIn(vaga);
  const ativos = (candidatos ?? []).filter((c) => c.status !== "retirada");
  const pendentes = ativos.filter((c) => c.status === "pendente").length;

  async function alternar() {
    if (aberta) {
      const ok = await confirmar({
        title: "Fechar a vaga?",
        message: "Ninguém mais consegue se candidatar. Quem já se candidatou continua vendo a vaga e você ainda pode decidir cada um.",
        confirmLabel: "Fechar vaga",
      });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      await (aberta ? closeListing(vaga.id) : reopenListing(vaga.id));
      onMudou();
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/marketplace/${vaga.id}`);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão de área de transferência: nada a fazer
    }
  }

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <h3 className="m-0 text-sm font-semibold">Vaga do seu time</h3>
      <p className="m-0 mt-1.5 text-[12.5px] text-muted">
        {ativos.length} {ativos.length === 1 ? "candidato" : "candidatos"}
        {pendentes > 0 && ` · ${pendentes} esperando sua decisão`}
      </p>
      {(buyIn || vaga.stakingPct != null) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {buyIn && <Chip>Buy-in {buyIn}</Chip>}
          {vaga.stakingPct != null && <Chip>Staking {vaga.stakingPct.toLocaleString("pt-BR")}%</Chip>}
          <ChipEncerra expiresAt={aberta ? vaga.expiresAt : null} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className={BOTAO_VIDRO}>
          {copiado ? <Check size={14} /> : <Link2 size={14} />} {copiado ? "Link copiado" : "Copiar link"}
        </button>
        <button type="button" onClick={alternar} disabled={ocupado} className={BOTAO_VIDRO}>
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : aberta ? <Lock size={14} /> : <Unlock size={14} />}
          {aberta ? "Fechar vaga" : "Reabrir vaga"}
        </button>
      </div>
    </section>
  );
}

function OQueAVagaPede({ vaga }: { vaga: Listing }) {
  const reqs = requisitosDaVaga(vaga);
  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <h3 className="m-0 text-sm font-semibold">O que a vaga pede</h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {reqs.length ? (
          reqs.map((r) => <ReqChip key={r.chave} r={r} moeda={vaga.moeda} />)
        ) : (
          <span className="text-[12.5px] text-muted">Sem requisitos: qualquer jogador pode se candidatar.</span>
        )}
      </div>
      <p className="m-0 mt-3 text-[11px] leading-snug text-muted/80">
        Cada candidato vê o próprio match com esses requisitos, e o número dele ao lado de cada um.
      </p>
    </section>
  );
}
