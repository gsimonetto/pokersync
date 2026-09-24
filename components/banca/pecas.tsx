"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Pencil, Trash2, type LucideIcon } from "lucide-react";
import type { BrmReading } from "@/lib/bankroll/calc";
import { net } from "@/lib/bankroll/calc";
import type { Session } from "@/lib/bankroll/types";
import { fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { EASE, Linha, Numero, Selo } from "@/components/painel/painel-card";
import { InfoHover, type Explicacao } from "@/components/painel/info-hover";
import { COR_ALERTA, COR_NEGATIVO, COR_POSITIVO, dataCurta, num1 } from "./util";

// Peças visuais repetidas entre as abas da Gestão de Banca.

// ---------------------------------------------------------------------
// Bloco de indicador: mesmo desenho dos números do "Seu resumo" da
// Performance (rótulo + ícone em cima, número grande que conta no meio,
// detalhe embaixo) e a explicação ao passar o mouse.
export function Indicador({
  rotulo,
  icone: Icone,
  valor,
  formatar,
  cor = "#ffffff",
  detalhe,
  explicacao,
  indice = 0,
  className = "",
}: {
  rotulo: string;
  icone: LucideIcon;
  valor: number | null;
  formatar: (n: number) => string;
  cor?: string;
  detalhe?: React.ReactNode;
  explicacao: Explicacao;
  indice?: number;
  className?: string;
}) {
  return (
    <motion.li
      className={`min-w-0 ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.25 + indice * 0.06 }}
    >
      <InfoHover explicacao={explicacao} className="h-full">
        <Linha className="flex h-full min-w-0 flex-col justify-between gap-1.5 !p-3">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[11.5px] leading-tight text-muted/80">{rotulo}</span>
            <Icone size={14} className="shrink-0 text-muted" aria-hidden />
          </span>
          <p className="tnum max-w-full truncate text-[clamp(16px,1.45vw,24px)] font-bold leading-none tracking-[-0.02em]" style={{ color: cor }}>
            {valor == null ? "—" : <Numero valor={valor} formatar={formatar} />}
          </p>
          {detalhe && <div className="max-w-full truncate text-[11px] leading-tight text-muted/80">{detalhe}</div>}
        </Linha>
      </InfoHover>
    </motion.li>
  );
}

// ---------------------------------------------------------------------
// Uma sessão na lista: formato e data em cima, plataforma e notas
// embaixo, resultado colorido à direita. Editar/excluir aparecem ao
// passar o mouse (no celular ficam sempre visíveis).
export function LinhaSessao({
  s,
  moeda,
  revisadas = 0,
  onEditar,
  onExcluir,
  compacta = false,
}: {
  s: Session;
  moeda: string;
  revisadas?: number;
  onEditar?: (s: Session) => void;
  onExcluir?: (s: Session) => void;
  /** Sem botões: a linha inteira abre a edição (cards estreitos). */
  compacta?: boolean;
}) {
  const r = net(s);
  const extras = [s.stake, s.mood === "tilt" ? "tilt" : s.mood, s.ownPct != null && s.ownPct < 100 ? `${s.ownPct}% sua` : null].filter(Boolean);
  const sub = [s.venue || "Sem plataforma", s.notes, s.diaryNote].filter(Boolean).join(" · ");
  const conteudo = (
    <>
      <div className="grid h-9 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[11px] font-semibold text-ink/80 ring-1 ring-inset ring-white/[0.06]">
        {dataCurta(s.date)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-medium text-ink">
          <span className="shrink-0">{s.format}</span>
          {extras.length > 0 && <span className="min-w-0 truncate font-normal text-muted">· {extras.join(" · ")}</span>}
          {revisadas > 0 && (
            <Link
              href="/revisor"
              title={`${revisadas} mão(s) revisada(s) desta sessão`}
              className="flex shrink-0 items-center gap-0.5 rounded-md border border-review/30 bg-review/[0.12] px-1 py-0.5 text-[10px] font-semibold text-review"
            >
              <BookOpen size={9} /> {revisadas}
            </Link>
          )}
          {s.importedHandSessionId && (
            <span
              title="Importada automaticamente de um torneio que o Radar capturou"
              className="shrink-0 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1 py-px text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#f59e0b]"
            >
              Radar
            </span>
          )}
        </p>
        <p className="truncate text-[11.5px] text-muted">{sub}</p>
      </div>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: r >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
        {fmtSignedMoneyIn(r, moeda)}
      </span>
      {!compacta && (onEditar || onExcluir) && (
        <div className="flex shrink-0 items-center gap-1 transition-opacity md:opacity-0 md:group-hover/linha:opacity-100 md:focus-within:opacity-100">
          {onEditar && (
            <button type="button" onClick={() => onEditar(s)} aria-label="Editar sessão" title="Editar sessão" className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-ink">
              <Pencil size={14} />
            </button>
          )}
          {onExcluir && (
            <button type="button" onClick={() => onExcluir(s)} aria-label="Excluir sessão" title="Excluir sessão" className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-negative">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </>
  );
  if (compacta && onEditar) {
    return (
      <button type="button" onClick={() => onEditar(s)} title="Editar sessão" className="block w-full text-left">
        <Linha className="flex items-center gap-3 !py-2.5">{conteudo}</Linha>
      </button>
    );
  }
  return <Linha className="group/linha flex items-center gap-3 !py-2.5">{conteudo}</Linha>;
}

// ---------------------------------------------------------------------
// Régua do BRM: onde a banca está entre "desça de stake" e "pode subir",
// em buy-ins do formato que você mais joga. Mais rápido de ler que o
// número solto -- o olho vê a posição do ponteiro na faixa.
export const STATUS_BRM = {
  moveup: { rotulo: "Pode subir", cor: COR_POSITIVO },
  hold: { rotulo: "Mantenha", cor: "#c4c7c8" },
  movedown: { rotulo: "Desça de stake", cor: COR_NEGATIVO },
} as const;

export function ReguaBrm({ leitura, compacta = false }: { leitura: BrmReading; compacta?: boolean }) {
  const { movedownBuyins: desce, moveupBuyins: sobe } = leitura.threshold;
  const fim = Math.max(sobe * 1.35, leitura.buyInsCovered * 1.05, 1);
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / fim) * 100))}%`;
  const status = STATUS_BRM[leitura.status];
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] text-muted">
          <span className="font-semibold text-ink">{leitura.format}</span> · buy-in médio {leitura.avgBuyIn.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
        </p>
        <Selo cor={status.cor} pequeno>
          {status.rotulo}
        </Selo>
      </div>
      <div className={`relative ${compacta ? "mt-3" : "mt-4"}`}>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
          <span className="absolute inset-y-0 left-0" style={{ width: pos(desce), background: `${COR_NEGATIVO}55` }} />
          <span className="absolute inset-y-0" style={{ left: pos(desce), width: `calc(${pos(sobe)} - ${pos(desce)})`, background: "rgba(255,255,255,0.10)" }} />
          <span className="absolute inset-y-0 right-0" style={{ left: pos(sobe), background: `${COR_POSITIVO}55` }} />
        </div>
        <motion.span
          className="absolute -top-1.5 h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
          initial={{ left: "0%" }}
          animate={{ left: pos(leitura.buyInsCovered) }}
          transition={{ duration: 1, ease: EASE, delay: 0.35 }}
        />
        <div className="relative mt-1.5 h-4 text-[10.5px] tabular-nums text-muted/80">
          <span className="absolute -translate-x-1/2" style={{ left: pos(desce) }}>
            {desce}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: pos(sobe) }}>
            {sobe}
          </span>
        </div>
      </div>
      <p className={`${compacta ? "mt-1" : "mt-2"} text-[12.5px] text-muted`}>
        Sua banca cobre <span className="font-semibold tabular-nums text-ink">{num1(leitura.buyInsCovered)}</span> buy-ins.{" "}
        {leitura.status === "moveup"
          ? `Acima de ${sobe}: dá pra subir de stake.`
          : leitura.status === "movedown"
            ? `Abaixo de ${desce}: o ideal é descer de stake.`
            : `Entre ${desce} e ${sobe}: siga no stake atual.`}
      </p>
    </div>
  );
}

export function corRuina(pct: number) {
  return pct >= 20 ? COR_NEGATIVO : pct >= 8 ? COR_ALERTA : COR_POSITIVO;
}
