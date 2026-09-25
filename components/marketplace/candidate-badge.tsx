"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2, MessageCircle, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import { BOTAO_VIDRO } from "@/components/banca/util";
import { Modal } from "@/components/ui/modal";
import { ModalPortal } from "@/components/modal-portal";
import { Chip } from "@/components/chip";
import { PlayerBadge, crachaDoCandidato } from "@/components/time/player-badge";
import { BRL } from "@/lib/format";
import {
  fetchCandidateSnapshot,
  decideApplication,
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_COLOR,
  type CandidateSnapshot,
} from "@/lib/services/marketplace-service";
import {
  TEMPO_EXPERIENCIA_LABEL,
  HORARIO_TREINO_LABEL,
  DIA_SEMANA_LABEL,
  type TempoExperiencia,
  type HorarioTreino,
  type DiaSemana,
} from "@/lib/services/profile-service";
import { ConversaCandidatura } from "./conversa-candidatura";
import { AnelMatch, Numero } from "./pecas";

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

// Cracha na lista de candidatos -- o mesmo crachá do jogador do time
// (components/time/player-badge), pra o time comparar candidato e elenco
// na mesma régua: resultado/ROI, buy-in/volume, acerto/treinos, mais o
// match com a vaga. O detalhe completo (números, disponibilidade,
// histórico, conversa, aceitar/recusar) mora no modal, aberto so' quando
// o time clica -- evita uma parede de cards grandes quando a vaga tem
// varios candidatos.
export function CandidateBadge({
  applicationId,
  status,
  podeDecidir,
  onDecided,
  naoLidas = 0,
  onLidas,
  abrirAoCarregar = false,
}: {
  applicationId: string;
  /** Status que a lista conhece: mudou (decisão), o crachá recarrega. */
  status?: string;
  podeDecidir: boolean;
  onDecided?: (status: "aceita" | "recusada") => void;
  /** Mensagens do candidato ainda não lidas. */
  naoLidas?: number;
  onLidas?: () => void;
  /** Abre o detalhe assim que carregar (link da notificação). */
  abrirAoCarregar?: boolean;
}) {
  const [snap, setSnap] = useState<CandidateSnapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const linha = useRef<HTMLDivElement>(null);
  // O link da notificação abre o detalhe uma vez só (não de novo a cada
  // recarga depois de uma decisão).
  const jaAbriu = useRef(false);

  useEffect(() => {
    let alive = true;
    fetchCandidateSnapshot(applicationId)
      .then((s) => {
        if (!alive) return;
        setSnap(s);
        if (abrirAoCarregar && !jaAbriu.current) {
          jaAbriu.current = true;
          setAberto(true);
          linha.current?.scrollIntoView({ block: "center" });
        }
      })
      .catch((e) => alive && setErro(e?.message ?? "Não foi possível carregar o candidato."));
    return () => {
      alive = false;
    };
  }, [applicationId, status, abrirAoCarregar]);

  if (erro) return <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-negative">{erro}</p>;
  if (!snap) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <Loader2 size={16} className="animate-spin text-muted" />
      </div>
    );
  }

  const nome = snap.apelido || snap.nome;
  return (
    <div ref={linha}>
      <PlayerBadge
        dados={crachaDoCandidato(snap)}
        variante="linha"
        onClick={() => setAberto(true)}
        ariaLabel={`Ver candidatura de ${nome}`}
        subtitulo={
          <span className="flex flex-wrap items-center gap-1.5">
            <Chip color={APPLICATION_STATUS_COLOR[snap.status]} size="sm">
              {APPLICATION_STATUS_LABEL[snap.status]}
            </Chip>
            {naoLidas > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d4af37] px-1.5 py-px text-[10.5px] font-bold text-black">
                <MessageCircle size={11} /> {naoLidas} {naoLidas === 1 ? "mensagem nova" : "mensagens novas"}
              </span>
            )}
          </span>
        }
        lateral={
          <span className="flex shrink-0 items-center gap-2">
            <AnelMatch valor={snap.matchScore} tamanho={44} />
            <ChevronRight size={16} className="text-muted" />
          </span>
        }
      />

      {/* Portal: a lista mora num card de vidro (backdrop-filter), que
          prenderia o modal "fixed" dentro dele em vez da tela inteira. */}
      {aberto && (
        <ModalPortal>
          <Modal open onClose={() => setAberto(false)} title={nome} wide>
            <CandidateDetail
              snap={snap}
              podeDecidir={podeDecidir}
              onLidas={onLidas}
              onDecided={(status) => {
                onDecided?.(status);
                setAberto(false);
              }}
            />
          </Modal>
        </ModalPortal>
      )}
    </div>
  );
}

function CandidateDetail({
  snap,
  podeDecidir,
  onDecided,
  onLidas,
}: {
  snap: CandidateSnapshot;
  podeDecidir: boolean;
  onDecided: (status: "aceita" | "recusada") => void;
  onLidas?: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<"aceita" | "recusada" | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const nome = snap.apelido || snap.nome;

  async function decidir(decisao: "aceita" | "recusada", reason?: string) {
    setDecidindo(decisao);
    try {
      await decideApplication(snap.applicationId, decisao, reason);
      onDecided(decisao);
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível registrar a decisão.");
    } finally {
      setDecidindo(null);
    }
  }

  const sinal = (v: number | null) => (v !== null && v > 0 ? "+" : "");
  return (
    <div>
      {/* O modal so' tem o nome como titulo (Modal e' generico, nao leva
          foto) -- a foto do jogador entra aqui, no topo do conteudo,
          pra manter a identidade visual de "crachá" tambem no detalhe. */}
      <div className="flex items-center gap-3">
        <AvatarNivel userId={snap.userId} avatarId={snap.avatarId} avatarUrl={snap.avatarUrl} tamanho={60} quadrado />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-ink">{nome}</p>
          {snap.apelido && snap.nome !== snap.apelido && <p className="truncate text-sm text-muted">{snap.nome}</p>}
          <Chip color={APPLICATION_STATUS_COLOR[snap.status]} size="sm">
            {APPLICATION_STATUS_LABEL[snap.status]}
          </Chip>
        </div>
        <span className="flex shrink-0 flex-col items-center gap-1">
          <AnelMatch valor={snap.matchScore} tamanho={64} />
          <span className="text-[10.5px] text-muted">com a vaga</span>
        </span>
      </div>

      {snap.message && <p className="mt-4 text-sm italic text-muted">&ldquo;{snap.message}&rdquo;</p>}

      {/* Disponibilidade -- vem do que o jogador preencheu em
          Configurações. Pro time, isso pesa tanto quanto os números: dado
          que bate com a vaga mas incompatível de horário não serve. */}
      {(snap.tempoExperiencia || snap.horarioTreino || (snap.diasTreinoSemana && snap.diasTreinoSemana.length > 0)) && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {snap.tempoExperiencia && (
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="shrink-0 text-muted/70" />
              {TEMPO_EXPERIENCIA_LABEL[snap.tempoExperiencia as TempoExperiencia] ?? snap.tempoExperiencia} de poker
            </span>
          )}
          {snap.horarioTreino && (
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="shrink-0 text-muted/70" />
              Joga de {HORARIO_TREINO_LABEL[snap.horarioTreino as HorarioTreino] ?? snap.horarioTreino}
            </span>
          )}
          {snap.diasTreinoSemana && snap.diasTreinoSemana.length > 0 && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={12} className="shrink-0 text-muted/70" />
              {snap.diasTreinoSemana.length === 7
                ? "Todos os dias"
                : snap.diasTreinoSemana.map((d) => DIA_SEMANA_LABEL[d as DiaSemana] ?? d).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Número em bloquinho (título em cima, número embaixo): nunca
          quebra letra por letra, nem no celular. */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero titulo="Ganhos totais" valor={snap.lucroAcumulado !== null ? BRL.format(snap.lucroAcumulado) : "—"} />
        <Numero titulo="ROI acumulado" valor={snap.roiPct !== null ? `${sinal(snap.roiPct)}${fmtPct(snap.roiPct)}` : "—"} />
        <Numero titulo="Buy-in médio" valor={snap.abiTorneio !== null ? BRL.format(snap.abiTorneio) : "—"} />
        <Numero titulo="Evolução" valor={snap.scoreGeral !== null ? String(Math.round(snap.scoreGeral)) : "—"} />
        <Numero titulo="Sessões registradas" valor={String(snap.numSessoes ?? 0)} detalhe={`${snap.numTorneios ?? 0} torneios · ${snap.numCash ?? 0} cash`} />
        <Numero
          titulo="Sessões por semana"
          valor={snap.frequenciaSemanalSessoes !== null ? snap.frequenciaSemanalSessoes.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
        />
        <Numero titulo="Mãos importadas" valor={snap.hands.toLocaleString("pt-BR")} />
        <Numero titulo="VPIP / PFR" valor={`${fmtPct(snap.vpipPct)} / ${fmtPct(snap.pfrPct)}`} />
        <Numero titulo="3-bet" valor={fmtPct(snap.threeBetPct)} />
        <Numero titulo="Agressão (AF)" valor={snap.aggressionFactor !== null ? snap.aggressionFactor.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"} />
        <Numero titulo="C-bet no flop" valor={fmtPct(snap.cbetFlopPct)} />
        <Numero
          titulo="Acerto GTO"
          valor={snap.taxaAcertoTreinoPct !== null ? `${Math.round(snap.taxaAcertoTreinoPct)}%` : "—"}
          detalhe={snap.numDrills !== null ? `${snap.numDrills} treinos` : undefined}
        />
      </div>

      {snap.historicoTimes.length > 0 && (
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Histórico em outros times</p>
          <ul className="flex flex-wrap gap-2">
            {snap.historicoTimes.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] text-ink/85"
                title="Só duração e papel — sem dado financeiro ou de performance do time anterior"
              >
                {h.teamName} · {h.role === "admin" ? "admin" : h.role === "coach" ? "coach" : "jogador"} ·{" "}
                <span className="font-semibold">
                  {h.months} {h.months === 1 ? "mês" : "meses"}
                </span>
                <span className="text-muted">
                  {" "}
                  · saiu há {h.endedMonthsAgo === 0 ? "menos de 1 mês" : `${h.endedMonthsAgo} ${h.endedMonthsAgo === 1 ? "mês" : "meses"}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <ConversaCandidatura applicationId={snap.applicationId} lado="time" status={snap.status} nomeOutroLado={nome} onLidas={onLidas} compacta />
      </div>

      {/* Aceito virou colega de time -- atalho pro chat do time (a
          Central de Conversas abre na thread dele). */}
      {snap.status === "aceita" && (
        <div className="mt-3 flex justify-end">
          <Link href={`/marketplace?chat=${snap.userId}`} className={BOTAO_VIDRO}>
            <MessageCircle size={14} /> Abrir no chat do time
          </Link>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-negative">{erro}</p>}

      {podeDecidir && snap.status === "pendente" && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] pt-4">
          {!recusando ? (
            <>
              <button
                onClick={() => setRecusando(true)}
                disabled={decidindo !== null}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-negative/40 hover:text-negative disabled:opacity-50"
              >
                <X size={14} />
                Recusar
              </button>
              <button
                onClick={() => decidir("aceita")}
                disabled={decidindo !== null}
                className="inline-flex items-center gap-1.5 rounded-xl bg-positive px-3 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {decidindo === "aceita" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aceitar no time
              </button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:max-w-sm">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo da recusa (opcional, vai pro jogador)"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-[#d4af37]/60"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRecusando(false);
                    setMotivo("");
                  }}
                  disabled={decidindo !== null}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => decidir("recusada", motivo || undefined)}
                  disabled={decidindo !== null}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-negative px-3 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {decidindo === "recusada" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Confirmar recusa
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
