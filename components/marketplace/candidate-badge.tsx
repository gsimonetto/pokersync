"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Loader2, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SpeedGauge } from "@/components/dashboard/kit";
import { Chip } from "@/components/chip";
import {
  fetchCandidateSnapshot,
  decideApplication,
  APPLICATION_STATUS_LABEL,
  type CandidateSnapshot,
} from "@/lib/services/marketplace-service";

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v >= 0 ? "" : ""}${v}%`;
}

// O "crachá" do candidato — mesmo layout do card de perfil da tela
// inicial (app/modulos/page.tsx: foto + identidade + colunas de
// métricas), só que puxando o Player Evolution de outro jogador via
// marketplace_candidate_snapshot (permissão checada no banco: só quem
// gerencia a vaga ou o próprio candidato vê isso). O velocímetro mostra
// o match score contra os requisitos da vaga. Estatísticas de
// frequência (VPIP/PFR/3-Bet) ficam "—" até o jogador importar mãos —
// manual ou via Radar PokerSync.
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
  const [decidindo, setDecidindo] = useState<"aceita" | "recusada" | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCandidateSnapshot(applicationId)
      .then((s) => alive && setSnap(s))
      .catch((e) => alive && setErro(e?.message ?? "Não foi possível carregar o candidato."));
    return () => {
      alive = false;
    };
  }, [applicationId]);

  async function decidir(decisao: "aceita" | "recusada") {
    setDecidindo(decisao);
    try {
      await decideApplication(applicationId, decisao);
      onDecided?.(decisao);
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível registrar a decisão.");
    } finally {
      setDecidindo(null);
    }
  }

  if (erro) return <p className="rounded-xl border border-hairline bg-surface p-4 text-sm text-negative">{erro}</p>;
  if (!snap) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-8">
        <Loader2 size={18} className="animate-spin text-muted" />
      </div>
    );
  }

  const statusColor =
    snap.status === "aceita" ? "#2FB89A" : snap.status === "recusada" ? "#e0555a" : snap.status === "retirada" ? "#8A94A3" : "#E0B24C";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface sm:flex-row">
      <div className="mx-auto flex aspect-square w-full max-w-[160px] shrink-0 items-center justify-center bg-elevated p-4 sm:mx-0 sm:aspect-auto sm:h-auto sm:w-[160px]">
        <Avatar id={snap.avatarId} url={snap.avatarUrl} shape="square" size={128} />
      </div>

      <div className="flex-1 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold tracking-tight text-ink">{snap.apelido || snap.nome}</h3>
            {snap.apelido && snap.nome !== snap.apelido && <p className="text-sm text-muted">{snap.nome}</p>}
          </div>
          <Chip color={statusColor}>{APPLICATION_STATUS_LABEL[snap.status]}</Chip>
        </div>

        {snap.message && <p className="mt-2 text-sm italic text-muted">&ldquo;{snap.message}&rdquo;</p>}

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2.5">
            <Metric label="ROI acumulado" value={snap.roiPct !== null ? `${snap.roiPct >= 0 ? "+" : ""}${fmtPct(snap.roiPct)}` : "—"} tone={snap.roiPct === null ? undefined : snap.roiPct >= 0 ? "bom" : "ruim"} />
            <Metric label="Buy-in médio" value={snap.abiTorneio !== null ? `R$ ${snap.abiTorneio.toFixed(0)}` : "—"} />
            <Metric label="Torneios / Cash" value={`${snap.numTorneios ?? 0} / ${snap.numCash ?? 0}`} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Metric label="Score de evolução" value={snap.scoreGeral !== null ? String(Math.round(snap.scoreGeral)) : "—"} />
            <Metric label="Sessões/semana" value={snap.frequenciaSemanalSessoes !== null ? snap.frequenciaSemanalSessoes.toFixed(1) : "—"} />
            <Metric label="Mãos etiquetadas" value={String(snap.hands)} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Metric label="VPIP" value={fmtPct(snap.vpipPct)} />
            <Metric label="PFR" value={fmtPct(snap.pfrPct)} />
            <Metric label="3-Bet" value={fmtPct(snap.threeBetPct)} />
          </div>
        </div>

        {snap.historicoTimes.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-4">
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-4">
          <SpeedGauge score={snap.matchScore} idealMin={idealMin} size={120} label="Match com a vaga" />

          {podeDecidir && snap.status === "pendente" && (
            <div className="flex gap-2">
              <button
                onClick={() => decidir("recusada")}
                disabled={decidindo !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-negative/40 hover:text-negative disabled:opacity-50"
              >
                {decidindo === "recusada" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
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
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bom" | "ruim" }) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${cor}`}>{value}</span>
    </div>
  );
}
