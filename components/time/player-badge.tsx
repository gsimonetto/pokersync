"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/avatar";
import { EASE } from "@/components/painel/painel-card";
import { BRL, BRL_CURTO } from "@/lib/format";
import { calcularScore, type PlayerDetail, type TeamDashboardRow } from "@/lib/services/team-service";
import type { CandidateSnapshot } from "@/lib/services/marketplace-service";

// ============================================================
// Crachá do jogador -- a versão pequena da ficha. Um componente só pra
// todo lugar que mostra um jogador (lista do time, vagas, funil, a
// própria ficha), pra que o coach aprenda a ler UMA vez e reconheça em
// qualquer tela.
//
// Leitura, da esquerda pra direita, sempre na mesma ordem:
//   anel = score de evolução (cor = faixa de risco: <40 / <70 / 70+)
//   1) Resultado  -- R$ em destaque, ROI embaixo
//   2) Buy-in     -- buy-in médio em destaque, volume de sessões embaixo
//   3) Acerto GTO -- % em destaque, quantidade de treinos embaixo
// Valor em destaque + detalhe menor embaixo: 6 números em 3 blocos sem
// virar planilha. Número que não existe vira "—", nunca zero inventado.
//
// Formatos:
//   "cartao"   -- bloco da grade (aba Jogadores)
//   "linha"    -- linha de lista (candidatos de uma vaga)
//   "compacto" -- cabeçalho do cartão do funil
//   "cracha"   -- crachá vertical, a ficha vista como crachá
// ============================================================

export interface CrachaDados {
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  /** 0-100 -- anel em volta da foto. null esconde o anel. */
  score: number | null;
  resultado: {
    /** "No time" (membro) ou "Ganhos" (candidato). */
    rotulo: string;
    valor: number | null;
    roiPct: number | null;
    /** Explica de onde vem o número (tooltip). */
    ajuda: string;
  };
  volume: { abi: number | null; sessoes: number | null; ajuda: string };
  estudo: { acertoPct: number | null; treinos: number | null; ajuda: string };
  etiqueta?: { nome: string; cor: string } | null;
}

// Mesmas faixas do selo de risco da ficha (calcularScore).
export function corDoScore(v: number): string {
  return v < 40 ? "#e0555a" : v < 70 ? "#f59e0b" : "#22c55e";
}

const BRL_INTEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function brlCompacto(v: number): string {
  const abs = Math.abs(v);
  if (abs < 1000) return BRL_INTEIRO.format(v);
  return `${v < 0 ? "-" : ""}R$ ${BRL_CURTO.format(abs)}`;
}

function sinalPct(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

const corDoSinal = (v: number | null) => (v == null || v === 0 ? undefined : v > 0 ? "#22c55e" : "#e0555a");

// ------------------------------------------------------------
// Adaptadores: cada tela entrega o dado que tem, o crachá é o mesmo.
// ------------------------------------------------------------

export function crachaDoTime(j: TeamDashboardRow): CrachaDados {
  return {
    nome: j.nome,
    avatarId: j.avatarId,
    avatarUrl: j.avatarUrl,
    score: calcularScore(j).valor,
    resultado: {
      rotulo: "No time",
      valor: j.jogosNoTime > 0 ? j.lucroNoTime : null,
      roiPct: j.roiPct,
      ajuda: "Resultado desde que entrou no time · ROI de carreira (todas as sessões registradas)",
    },
    volume: {
      abi: j.abiTorneio,
      sessoes: j.numSessoes,
      ajuda: "Buy-in médio de torneio e total de sessões registradas (carreira)",
    },
    estudo: {
      acertoPct: j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null,
      treinos: j.treinos,
      ajuda: "Acerto GTO e treinos no período escolhido no painel",
    },
    etiqueta: j.labelName ? { nome: j.labelName, cor: j.labelColor ?? "#c4c7c8" } : null,
  };
}

// Ficha aberta: estudo e resultado vêm da própria ficha (respeitam o
// período escolhido no topo dela); buy-in, volume e ROI de carreira só
// existem na linha do painel, quando a ficha foi aberta a partir dele.
export function crachaDaFicha(p: PlayerDetail, j?: TeamDashboardRow): CrachaDados {
  return {
    nome: p.nome,
    avatarId: p.avatarId,
    avatarUrl: p.avatarUrl,
    score: calcularScore(p).valor,
    resultado: {
      rotulo: "No time",
      valor: p.jogosNoTime > 0 ? p.lucroNoTime : null,
      roiPct: j?.roiPct ?? null,
      ajuda: "Resultado desde que entrou no time · ROI de carreira (todas as sessões registradas)",
    },
    volume: {
      abi: j?.abiTorneio ?? null,
      sessoes: j?.numSessoes ?? null,
      ajuda: "Buy-in médio de torneio e total de sessões registradas (carreira)",
    },
    estudo: {
      acertoPct: p.treinos > 0 ? Math.round((p.acertosGto / p.treinos) * 100) : null,
      treinos: p.treinos,
      ajuda: "Acerto GTO e treinos no período escolhido na ficha",
    },
    etiqueta: j?.labelName ? { nome: j.labelName, cor: j.labelColor ?? "#c4c7c8" } : null,
  };
}

export function crachaDoCandidato(s: CandidateSnapshot): CrachaDados {
  return {
    nome: s.apelido || s.nome,
    avatarId: s.avatarId,
    avatarUrl: s.avatarUrl,
    score: s.scoreGeral == null ? null : Math.round(s.scoreGeral),
    resultado: {
      rotulo: "Ganhos",
      valor: s.lucroAcumulado,
      roiPct: s.roiPct,
      ajuda: "Ganhos e ROI de carreira (todas as sessões registradas)",
    },
    volume: {
      abi: s.abiTorneio,
      sessoes: s.numSessoes,
      ajuda: "Buy-in médio de torneio e total de sessões registradas",
    },
    estudo: {
      acertoPct: s.taxaAcertoTreinoPct == null ? null : Math.round(s.taxaAcertoTreinoPct),
      treinos: s.numDrills,
      ajuda: "Acerto GTO e treinos feitos no PokerSync (carreira)",
    },
  };
}

interface Bloco {
  rotulo: string;
  principal: string;
  secundario: string | null;
  cor?: string;
  corSecundario?: string;
  ajuda: string;
}

function blocos(d: CrachaDados): Bloco[] {
  const { resultado: r, volume: v, estudo: e } = d;
  return [
    {
      rotulo: r.rotulo,
      principal: r.valor == null ? "—" : brlCompacto(r.valor),
      secundario: r.roiPct == null ? null : `${sinalPct(r.roiPct)} ROI`,
      cor: corDoSinal(r.valor),
      corSecundario: corDoSinal(r.roiPct),
      ajuda: r.valor == null ? r.ajuda : `${BRL.format(r.valor)} · ${r.ajuda}`,
    },
    {
      rotulo: "Buy-in médio",
      principal: v.abi == null ? "—" : BRL_INTEIRO.format(v.abi),
      secundario: v.sessoes == null ? null : `${v.sessoes.toLocaleString("pt-BR")} ${v.sessoes === 1 ? "sessão" : "sessões"}`,
      ajuda: v.ajuda,
    },
    {
      rotulo: "Acerto GTO",
      principal: e.acertoPct == null ? "—" : `${e.acertoPct}%`,
      secundario: e.treinos == null ? null : `${e.treinos} ${e.treinos === 1 ? "treino" : "treinos"}`,
      ajuda: e.ajuda,
    },
  ];
}

// ------------------------------------------------------------
// Anel do score em volta da foto
// ------------------------------------------------------------

export function AnelScore({
  score,
  avatarId,
  avatarUrl,
  tamanho = 64,
  mostrarNumero = true,
  animar = true,
}: {
  score: number | null;
  avatarId: number;
  avatarUrl: string | null;
  tamanho?: number;
  mostrarNumero?: boolean;
  animar?: boolean;
}) {
  const espessura = tamanho >= 80 ? 4 : 3;
  const foto = Math.round(tamanho * 0.8);
  const R = tamanho / 2 - espessura / 2 - 0.5;
  const C = 2 * Math.PI * R;
  const cor = score == null ? "rgba(255,255,255,0.18)" : corDoScore(score);
  const offset = score == null ? C : C * (1 - Math.max(0, Math.min(100, score)) / 100);
  const numeroPequeno = tamanho < 48;

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: tamanho, height: tamanho }}
      title={score == null ? "Score de evolução indisponível" : `Score de evolução ${score}/100`}
    >
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={espessura} />
        {score != null &&
          (animar ? (
            <motion.circle
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={R}
              fill="none"
              stroke={cor}
              strokeWidth={espessura}
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            />
          ) : (
            <circle
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={R}
              fill="none"
              stroke={cor}
              strokeWidth={espessura}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
            />
          ))}
      </svg>
      <Avatar id={avatarId} url={avatarUrl} size={foto} />
      {mostrarNumero && score != null && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-[#141414] font-bold tabular-nums text-black ${
            numeroPequeno ? "-bottom-1.5 px-1 text-[8.5px] leading-3" : "-bottom-1 px-1.5 text-[10px] leading-4"
          }`}
          style={{ background: cor }}
        >
          {score}
        </span>
      )}
    </span>
  );
}

function Etiqueta({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span
      className="inline-block max-w-full truncate rounded-full border px-2 py-px text-[10.5px] font-medium"
      style={{ color: cor, borderColor: `${cor}55` }}
    >
      {nome}
    </span>
  );
}

function BlocoMetrica({ b, alinhamento = "centro" }: { b: Bloco; alinhamento?: "centro" | "esquerda" }) {
  return (
    <span className={`min-w-0 ${alinhamento === "centro" ? "text-center" : "text-left"}`} title={b.ajuda}>
      <span className="block truncate text-[10px] text-muted/70">{b.rotulo}</span>
      <span className="block truncate text-[13px] font-bold tabular-nums" style={{ color: b.cor ?? "#ffffff" }}>
        {b.principal}
      </span>
      <span className="block truncate text-[10.5px] tabular-nums text-muted/80" style={{ color: b.corSecundario }}>
        {b.secundario ?? " "}
      </span>
    </span>
  );
}

// ------------------------------------------------------------
// Crachá
// ------------------------------------------------------------

export function PlayerBadge({
  dados,
  variante = "cartao",
  subtitulo,
  lateral,
  rodape,
  acento = "#d4af37",
  onClick,
  ariaLabel,
  animar = true,
}: {
  dados: CrachaDados;
  variante?: "cartao" | "linha" | "compacto" | "cracha";
  /** Linha abaixo do nome (atividade, fase, papel…). */
  subtitulo?: React.ReactNode;
  /** Canto direito (match da vaga, prioridade, ação…). */
  lateral?: React.ReactNode;
  /** Só no "cracha": linha final (time, desde quando). */
  rodape?: React.ReactNode;
  /** Só no "cracha": cor da faixa do topo (cor do time). */
  acento?: string;
  onClick?: () => void;
  ariaLabel?: string;
  animar?: boolean;
}) {
  const bs = blocos(dados);

  if (variante === "compacto") {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <AnelScore score={dados.score} avatarId={dados.avatarId} avatarUrl={dados.avatarUrl} tamanho={38} animar={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-ink">{dados.nome}</p>
          {/* Uma linha só, na ordem fixa do crachá: resultado · buy-in · acerto. */}
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[11px] tabular-nums text-muted">
            {bs.every((b) => b.principal === "—") ? (
              <span className="text-muted/60">Sem dados de jogo ainda</span>
            ) : bs.map((b, i) => (
              <span key={b.rotulo} className="flex shrink-0 items-center gap-1.5" title={`${b.rotulo} · ${b.ajuda}`}>
                {i > 0 && <span className="text-muted/30">·</span>}
                <span style={{ color: b.cor }}>{b.principal}</span>
              </span>
            ))}
          </p>
        </div>
        {lateral}
      </div>
    );
  }

  if (variante === "linha") {
    const Tag = onClick ? "button" : "div";
    return (
      <Tag
        {...(onClick ? { type: "button" as const, onClick, "aria-label": ariaLabel ?? `Ver ${dados.nome}` } : {})}
        className={`flex w-full items-center gap-3 rounded-xl border border-hairline bg-elevated p-3 text-left ${
          onClick ? "transition-colors hover:border-white/15" : ""
        }`}
      >
        <AnelScore score={dados.score} avatarId={dados.avatarId} avatarUrl={dados.avatarUrl} tamanho={48} animar={animar} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{dados.nome}</span>
          {subtitulo && <span className="mt-0.5 block min-w-0 text-[11.5px] text-muted">{subtitulo}</span>}
          {dados.etiqueta && (
            <span className="mt-1 block">
              <Etiqueta {...dados.etiqueta} />
            </span>
          )}
        </span>
        {/* Largura fixa: numa lista, os números de uma linha ficam
            alinhados com os da linha de baixo (comparar candidatos). */}
        <span className="hidden w-[340px] shrink-0 grid-cols-3 gap-4 md:grid">
          {bs.map((b) => (
            <BlocoMetrica key={b.rotulo} b={b} alinhamento="esquerda" />
          ))}
        </span>
        {lateral}
      </Tag>
    );
  }

  if (variante === "cracha") {
    return (
      <div
        className="relative w-full max-w-[320px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0e0e0e] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
        role="group"
        aria-label={`Crachá de ${dados.nome}`}
      >
        {/* Faixa do topo na cor do time + o furo do cordão: o suficiente
            pra ler "crachá" sem virar ilustração. */}
        <div
          className="relative h-20"
          style={{ background: `linear-gradient(135deg, ${acento}55 0%, ${acento}14 60%, transparent 100%)` }}
        >
          <span className="absolute left-1/2 top-3 h-2 w-12 -translate-x-1/2 rounded-full border border-white/15 bg-black/70" aria-hidden />
        </div>
        <div className="-mt-12 flex flex-col items-center px-5 pb-5 text-center">
          <span className="rounded-full bg-[#0e0e0e] p-1">
            <AnelScore score={dados.score} avatarId={dados.avatarId} avatarUrl={dados.avatarUrl} tamanho={96} animar={animar} />
          </span>
          <p className="mt-3 max-w-full truncate text-[18px] font-bold tracking-tight text-ink">{dados.nome}</p>
          {subtitulo && <div className="mt-0.5 max-w-full text-[12px] text-muted">{subtitulo}</div>}
          {dados.etiqueta && (
            <span className="mt-2 max-w-full">
              <Etiqueta {...dados.etiqueta} />
            </span>
          )}
          <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-white/[0.07] pt-3.5">
            {bs.map((b) => (
              <BlocoMetrica key={b.rotulo} b={b} />
            ))}
          </div>
          {rodape && (
            <div className="mt-4 w-full border-t border-dashed border-white/[0.08] pt-3 text-[10.5px] uppercase tracking-[0.14em] text-muted/60">
              {rodape}
            </div>
          )}
        </div>
      </div>
    );
  }

  // "cartao"
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-label": ariaLabel ?? `Ver ${dados.nome}` } : {})}
      className={`painel-bloco group flex w-full flex-col gap-3 rounded-2xl border border-white/5 p-3.5 text-left ${
        onClick ? "transition hover:border-white/15 active:scale-[0.99]" : ""
      }`}
    >
      <span className="flex items-center gap-3">
        <AnelScore score={dados.score} avatarId={dados.avatarId} avatarUrl={dados.avatarUrl} tamanho={64} animar={animar} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[14px] font-semibold text-ink ${onClick ? "group-hover:underline" : ""}`}>
            {dados.nome}
          </span>
          {subtitulo && <span className="mt-0.5 block min-w-0 text-[11.5px]">{subtitulo}</span>}
          {dados.etiqueta && (
            <span className="mt-1 block">
              <Etiqueta {...dados.etiqueta} />
            </span>
          )}
        </span>
        {lateral}
      </span>
      <span className="grid grid-cols-3 gap-1.5 border-t border-white/[0.06] pt-2.5">
        {bs.map((b) => (
          <BlocoMetrica key={b.rotulo} b={b} />
        ))}
      </span>
    </Tag>
  );
}
