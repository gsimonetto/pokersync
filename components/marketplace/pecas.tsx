"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import {
  formatarBuyIn,
  formatarValor,
  type ChaveRequisito,
  type Listing,
  type Moeda,
  type Requisito,
} from "@/lib/services/marketplace-service";

// Peças das Vagas: anel do match, marca do time, chip de requisito,
// interruptor e os textos dos requisitos. Cores do resto do produto:
// verde = bate, dourado = no meio, vermelho = longe.

export const VERDE = "#34D399";
export const OURO = "#d4af37";
export const OURO_CLARO = "#e8cb6a";
export const VERMELHO = "#F87171";
export const AMBAR = "#f59e0b";

export function corMatch(v: number): string {
  return v >= 70 ? VERDE : v >= 50 ? OURO_CLARO : VERMELHO;
}

/** Como o match aparece: número, vaga sem requisito ou jogador sem dado. */
export type EstadoMatch = "numero" | "livre" | "sem-dados";

export function AnelMatch({ valor, estado = "numero", tamanho = 58 }: { valor: number | null; estado?: EstadoMatch; tamanho?: number }) {
  const grande = tamanho >= 80;
  if (estado !== "numero" || valor == null) {
    const livre = estado === "livre";
    return (
      <span
        role="img"
        aria-label={livre ? "Vaga aberta a todos, sem requisitos" : "Match sem dados pra comparar"}
        title={livre ? "A vaga não pede requisitos" : "Ainda não temos seus números pra comparar"}
        className="grid shrink-0 place-items-center rounded-full border border-dashed border-white/20 text-center"
        style={{ width: tamanho, height: tamanho }}
      >
        <span className={`font-semibold leading-tight text-muted ${grande ? "text-[12px]" : "text-[9.5px]"}`}>
          {livre ? (
            <>
              aberta
              <br />a todos
            </>
          ) : (
            <>
              <span className={`block text-ink/70 ${grande ? "text-[26px]" : "text-[15px]"}`}>?</span>
              sem dados
            </>
          )}
        </span>
      </span>
    );
  }
  const traco = grande ? 6 : 4;
  const r = tamanho / 2 - traco;
  const c = 2 * Math.PI * r;
  const cor = corMatch(valor);
  return (
    <span role="img" aria-label={`Match ${valor} de 100`} className="relative grid shrink-0 place-items-center" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={traco} fill="none" />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          stroke={cor}
          strokeWidth={traco}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, valor)) / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="block font-bold tabular-nums" style={{ color: cor, fontSize: grande ? 30 : tamanho >= 56 ? 17 : 14 }}>
          {valor}
        </span>
        {tamanho >= 56 && <span className="mt-0.5 block text-[8.5px] uppercase tracking-wider text-muted/70">match</span>}
      </span>
    </span>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? "T").slice(0, 2)).toUpperCase();
}

/** Logo do time (ou as iniciais na cor dele). */
export function MarcaTime({ nome, cor, logoUrl, tamanho = 40 }: { nome: string; cor: string; logoUrl?: string | null; tamanho?: number }) {
  if (logoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="shrink-0 rounded-xl border object-cover"
        style={{ width: tamanho, height: tamanho, borderColor: `${cor}66` }}
      />
    );
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl border font-bold"
      style={{ width: tamanho, height: tamanho, borderColor: `${cor}66`, background: `${cor}1f`, color: cor, fontSize: Math.round(tamanho * 0.33) }}
    >
      {iniciais(nome)}
    </span>
  );
}

export const NOME_REQUISITO: Record<ChaveRequisito, string> = {
  roi: "ROI",
  volume: "Volume",
  evolucao: "Evolução",
  buyin: "Buy-in médio",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** O que a vaga pede: "5% ou mais" (ou curto: "5%+"). */
export function textoPedido(r: Requisito, moeda: Moeda, curto = false): string {
  switch (r.chave) {
    case "roi":
      return curto ? `${fmt(r.pedidoMin)}%+` : `${fmt(r.pedidoMin)}% ou mais`;
    case "volume":
      return curto ? `${fmt(r.pedidoMin)}/mês` : `${fmt(r.pedidoMin)} sessões por mês`;
    case "evolucao":
      return curto ? `${fmt(r.pedidoMin)}+` : `${fmt(r.pedidoMin)} ou mais`;
    case "buyin":
      return formatarBuyIn({ buyInMin: r.pedidoMin, buyInMax: r.pedidoMax, moeda }) ?? "";
  }
}

/** O número do jogador no requisito. */
export function textoMeu(r: Requisito, moeda: Moeda): string {
  if (r.meu == null) return "sem dado ainda";
  switch (r.chave) {
    case "roi":
      return `${fmt(r.meu)}%`;
    case "volume":
      return `${fmt(r.meu)} por mês`;
    case "evolucao":
      return String(Math.round(r.meu));
    case "buyin":
      return moeda === "USD" && r.meuNaMoeda != null
        ? `${formatarValor(r.meuNaMoeda, "USD")} (${formatarValor(r.meu, "BRL")})`
        : formatarValor(r.meu, "BRL");
  }
}

/** Requisitos da vaga sem o número de ninguém -- pra mostrar o que ela pede. */
export function requisitosDaVaga(l: Listing): Requisito[] {
  const base = { pedidoMax: null, meu: null, meuNaMoeda: null, ok: null, pontos: null, pontosSeBater: null };
  const out: Requisito[] = [];
  if (l.minRoiPct != null) out.push({ ...base, chave: "roi", peso: 30, pedidoMin: l.minRoiPct });
  if (l.minVolumeSessionsMonth != null && l.minVolumeSessionsMonth > 0)
    out.push({ ...base, chave: "volume", peso: 25, pedidoMin: l.minVolumeSessionsMonth });
  if (l.minScoreGeral != null) out.push({ ...base, chave: "evolucao", peso: 25, pedidoMin: l.minScoreGeral });
  if (l.buyInMin != null && l.buyInMax != null) out.push({ ...base, chave: "buyin", peso: 20, pedidoMin: l.buyInMin, pedidoMax: l.buyInMax });
  return out;
}

/** Chip de um requisito: verde se bate, vermelho se não, neutro sem dado. */
export function ReqChip({ r, moeda }: { r: Requisito; moeda: Moeda }) {
  const cor = r.ok === true ? VERDE : r.ok === false ? VERMELHO : null;
  const titulo = r.ok === null ? `A vaga pede ${textoPedido(r, moeda)}` : `Você: ${textoMeu(r, moeda)} · pedido: ${textoPedido(r, moeda)}`;
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
      style={
        cor
          ? { borderColor: `${cor}59`, background: `${cor}14`, color: r.ok ? "#6EE7B7" : "#FCA5A5" }
          : { borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.72)" }
      }
    >
      {r.ok === true && <Check size={11} strokeWidth={3} aria-label="bate" />}
      {r.ok === false && <X size={11} strokeWidth={3} aria-label="não bate" />}
      {NOME_REQUISITO[r.chave]} {textoPedido(r, moeda, true)}
    </span>
  );
}

/** Liga/desliga (tamanho fixo: a bolinha nunca sai de dentro). */
export function Interruptor({
  ligado,
  onChange,
  rotulo,
  disabled,
}: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  rotulo: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
      className="inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full px-[3px] transition-colors disabled:opacity-60"
      style={{ background: ligado ? OURO : "rgba(255,255,255,0.15)" }}
    >
      <span className={`h-4 w-4 rounded-full transition-transform ${ligado ? "translate-x-[18px] bg-black" : "translate-x-0 bg-white/80"}`} />
    </button>
  );
}

const UM_DIA_MS = 86_400_000;

/** Dias até a data (arredondado pra cima); null sem data. */
export function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / UM_DIA_MS);
}

/** "hoje", "ontem", "há 5 dias". */
export function haDias(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / UM_DIA_MS);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
}

/** "~2 dias" / "~1 dia" / "no mesmo dia". */
export function tempoDeResposta(dias: number): string {
  if (dias < 1) return "no mesmo dia";
  const n = Math.round(dias * 10) / 10;
  return `~${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n < 2 ? "dia" : "dias"}`;
}

/** Status da vaga pra chip: aberta, expirada ou fechada. */
export function situacaoDaVaga(l: Pick<Listing, "status" | "expiresAt">): { texto: string; cor: string } {
  if (l.status !== "aberta") return { texto: "Fechada", cor: "#8A94A3" };
  if (l.expiresAt && new Date(l.expiresAt) <= new Date()) return { texto: "Expirada", cor: AMBAR };
  return { texto: "Aberta", cor: VERDE };
}

/** Bloquinho de número (título pequeno em cima, número embaixo). */
export function Numero({ titulo, valor, detalhe }: { titulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="painel-bloco min-w-0 rounded-xl border border-white/5 p-3">
      <div className="truncate text-[11px] text-muted">{titulo}</div>
      <div className="mt-0.5 truncate text-[16px] font-bold tabular-nums text-ink">{valor}</div>
      {detalhe && <div className="truncate text-[10.5px] text-muted">{detalhe}</div>}
    </div>
  );
}
