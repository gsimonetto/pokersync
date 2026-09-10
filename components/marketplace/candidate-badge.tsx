"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2, MessageCircle, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/ui/modal";
import { SpeedGauge } from "@/components/dashboard/kit";
import { Chip } from "@/components/chip";
import { BRL } from "@/lib/format";
import {
  fetchCandidateSnapshot,
  decideApplication,
  APPLICATION_STATUS_LABEL,
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

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v >= 0 ? "" : ""}${v}%`;
}

const STATUS_COLOR: Record<CandidateSnapshot["status"], string> = {
  pendente: "#E0B24C",
  aceita: "#2FB89A",
  recusada: "#e0555a",
  retirada: "#8A94A3",
};

// Cracha compacto na lista de candidatos -- so' o essencial pra decidir
// se vale abrir (nome, ganhos, buy-in, partidas jogadas). O detalhe
// completo (Player Evolution, disponibilidade, historico, aceitar/
// recusar) mora no modal, aberto so' quando o time clica -- evita uma
// parede de cards grandes quando a vaga tem varios candidatos.
export function CandidateBadge({
  applicationId,
  idealMin = 70,
  podeDecidir,
  onDecided,
}: {
  applicationId: string;
  idealMin?: number;
  podeDecidir: boolean;
  onDecided?: (status: "aceita" | "recusada") => void;
}) {
  const [snap, setSnap] = useState<CandidateSnapshot | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCandidateSnapshot(applicationId)
      .then((s) => alive && setSnap(s))
      .catch((e) => alive && setErro(e?.message ?? "Não foi possível carregar o candidato."));
    return () => {
      alive = false;
    };
  }, [applicationId]);

  if (erro) return <p className="rounded-lg border border-hairline bg-elevated p-4 text-sm text-negative">{erro}</p>;
  if (!snap) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-hairline bg-elevated p-6">
        <Loader2 size={16} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-elevated p-3.5 text-left transition-colors hover:border-white/15"
      >
        <Avatar id={snap.avatarId} url={snap.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{snap.apelido || snap.nome}</p>
            <Chip color={STATUS_COLOR[snap.status]} size="sm">
              {APPLICATION_STATUS_LABEL[snap.status]}
            </Chip>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
            <span>
              Ganhos{" "}
              <b className={snap.lucroAcumulado === null ? "text-muted" : snap.lucroAcumulado >= 0 ? "text-positive" : "text-negative"}>
                {snap.lucroAcumulado !== null ? BRL.format(snap.lucroAcumulado) : "—"}
              </b>
            </span>
            <span>
              Buy-in <b className="text-ink">{snap.abiTorneio !== null ? BRL.format(snap.abiTorneio) : "—"}</b>
            </span>
            <span>
              Partidas <b className="text-ink">{snap.numSessoes ?? 0}</b>
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-base font-bold tabular-nums ${snap.matchScore >= idealMin ? "text-positive" : "text-negative"}`}>
            {snap.matchScore}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-muted/60">match</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted" />
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title={snap.apelido || snap.nome} wide>
        <CandidateDetail
          snap={snap}
          idealMin={idealMin}
          podeDecidir={podeDecidir}
          onDecided={(status) => {
            onDecided?.(status);
            setAberto(false);
          }}
        />
      </Modal>
    </>
  );
}

function CandidateDetail({
  snap,
  idealMin,
  podeDecidir,
  onDecided,
}: {
  snap: CandidateSnapshot;
  idealMin: number;
  podeDecidir: boolean;
  onDecided: (status: "aceita" | "recusada") => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<"aceita" | "recusada" | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

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

  return (
    <div>
      {/* O modal so' tem o nome como titulo (Modal e' generico, nao leva
          foto) -- a foto do jogador entra aqui, no topo do conteudo,
          pra manter a identidade visual de "crachá" tambem no detalhe. */}
      <div className="flex items-center gap-3">
        <Avatar id={snap.avatarId} url={snap.avatarUrl} shape="square" size={56} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-ink">{snap.apelido || snap.nome}</p>
          {snap.apelido && snap.nome !== snap.apelido && <p className="truncate text-sm text-muted">{snap.nome}</p>}
        </div>
      </div>

      {snap.message && <p className="mt-4 text-sm italic text-muted">&ldquo;{snap.message}&rdquo;</p>}

      {/* Disponibilidade -- vem do que o jogador preencheu em Minha
          Conta. Pro time, isso pesa tanto quanto os números: dado que
          bate com a vaga mas incompatível de horário não serve. */}
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

      <div className="mt-6 grid min-w-0 grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-3">
          <Metric label="Ganhos totais" value={snap.lucroAcumulado !== null ? BRL.format(snap.lucroAcumulado) : "—"} tone={snap.lucroAcumulado === null ? undefined : snap.lucroAcumulado >= 0 ? "bom" : "ruim"} />
          <Metric label="ROI acumulado" value={snap.roiPct !== null ? `${snap.roiPct >= 0 ? "+" : ""}${fmtPct(snap.roiPct)}` : "—"} tone={snap.roiPct === null ? undefined : snap.roiPct >= 0 ? "bom" : "ruim"} />
          <Metric label="Buy-in médio" value={snap.abiTorneio !== null ? BRL.format(snap.abiTorneio) : "—"} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Metric label="Partidas jogadas" value={String(snap.numSessoes ?? 0)} />
          <Metric label="Torneios / Cash" value={`${snap.numTorneios ?? 0} / ${snap.numCash ?? 0}`} />
          <Metric label="Score de evolução" value={snap.scoreGeral !== null ? String(Math.round(snap.scoreGeral)) : "—"} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Metric label="Sessões/semana" value={snap.frequenciaSemanalSessoes !== null ? snap.frequenciaSemanalSessoes.toFixed(1) : "—"} />
          <Metric label="Mãos etiquetadas" value={String(snap.hands)} />
          <Metric label="VPIP" value={fmtPct(snap.vpipPct)} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Metric label="PFR" value={fmtPct(snap.pfrPct)} />
          <Metric label="3-Bet" value={fmtPct(snap.threeBetPct)} />
          <Metric label="Aggression Factor" value={snap.aggressionFactor !== null ? snap.aggressionFactor.toFixed(2) : "—"} />
        </div>
      </div>

      {snap.historicoTimes.length > 0 && (
        <div className="mt-6 border-t border-hairline pt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">Histórico em outros times</p>
          <ul className="flex flex-wrap gap-2">
            {snap.historicoTimes.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[11.5px] text-ink/85"
                title="Só duração e papel — sem dado financeiro ou de performance do time anterior"
              >
                {h.teamName} · {h.role === "admin" ? "admin" : h.role === "coach" ? "coach" : "jogador"} ·{" "}
                <span className="font-semibold">{h.months} {h.months === 1 ? "mês" : "meses"}</span>
                <span className="text-muted"> · saiu há {h.endedMonthsAgo === 0 ? "menos de 1 mês" : `${h.endedMonthsAgo} ${h.endedMonthsAgo === 1 ? "mês" : "meses"}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p className="mt-3 text-sm text-negative">{erro}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
        <SpeedGauge score={snap.matchScore} idealMin={idealMin} size={120} label="Match com a vaga" />

        {podeDecidir && snap.status === "pendente" && !recusando && (
          <div className="flex gap-2">
            <button
              onClick={() => setRecusando(true)}
              disabled={decidindo !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-negative/40 hover:text-negative disabled:opacity-50"
            >
              <X size={14} />
              Recusar
            </button>
            <button
              onClick={() => decidir("aceita")}
              disabled={decidindo !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-positive px-3 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {decidindo === "aceita" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Aceitar
            </button>
          </div>
        )}

        {podeDecidir && snap.status === "pendente" && recusando && (
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Motivo da recusa (opcional, vai pro jogador)"
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRecusando(false);
                  setMotivo("");
                }}
                disabled={decidindo !== null}
                className="rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-elevated disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => decidir("recusada", motivo || undefined)}
                disabled={decidindo !== null}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-negative px-3 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {decidindo === "recusada" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Confirmar recusa
              </button>
            </div>
          </div>
        )}

        {/* Aceito virou colega de time nesse exato momento (ou ja' era
            de antes) -- atalho direto pro chat em vez do coach ter que
            procurar o contato na Central de Conversas depois. */}
        {snap.status === "aceita" && (
          <Link
            href={`/marketplace?chat=${snap.userId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-elevated"
          >
            <MessageCircle size={14} />
            Conversar
          </Link>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bom" | "ruim" }) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted/60">{label}</span>
      <span className={`min-w-0 break-words text-right text-sm font-semibold tabular-nums ${cor}`}>{value}</span>
    </div>
  );
}
