"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Crosshair, Gift, LocateFixed, Scale, Shield, Target, TrendingUp, Trophy } from "lucide-react";
import { EASE, Numero } from "@/components/painel/painel-card";
import type { Season } from "@/lib/services/xp-service";
import type { EscopoRanking } from "@/lib/services/ranking-service";
import { fmtXP, movimento, relogioTemporada, ritmoNecessario, type Corrida } from "@/lib/hub/ranking-regras";
import { FotoRanking, SetaMovimento } from "@/components/hub/ranking/linha";

const OURO = "#E0B24C";

function fmtData(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

// Temporada: o prêmio é o motivo de competir, então vem primeiro e em
// destaque; a régua do tempo mostra onde estamos no ciclo (dia 20 de 91)
// -- "71 dias" sozinho não diz se é começo ou reta final.
export function CartaoTemporada({ season }: { season: Season }) {
  const r = relogioTemporada(season);
  const retaFinal = r.restantes <= 7;
  const corTempo = retaFinal ? "#f97316" : OURO;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
      className="painel-vidro relative overflow-hidden rounded-3xl border p-4 sm:p-5 xl:p-4"
      style={{ borderColor: `${OURO}40` }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(135deg, ${OURO}1c, transparent 60%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${OURO}66, transparent)` }} />
      <Trophy aria-hidden size={120} strokeWidth={1} className="pointer-events-none absolute -right-6 -top-6 opacity-[0.06]" style={{ color: OURO }} />
      <div className="relative flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${OURO}1f`, color: OURO, boxShadow: `inset 0 0 0 1px ${OURO}40` }}>
          <Gift size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: OURO }}>
            Temporada #{season.seasonNumber} · Prêmio
          </p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{season.rewardTitle || "Temporada em andamento"}</p>
          {season.rewardDescription && <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-muted">{season.rewardDescription}</p>}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-baseline justify-between text-[11.5px]">
          <span className="font-semibold" style={{ color: corTempo }}>
            {r.restantes === 0 ? "Termina hoje" : `${r.restantes} ${r.restantes === 1 ? "dia restante" : "dias restantes"}`}
            {retaFinal && r.restantes > 0 && " · reta final"}
          </span>
          <span className="tabular-nums text-muted">
            Dia {r.dia} de {r.totalDias}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${r.pct}%` }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            style={{ background: corTempo }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10.5px] text-muted">
          <span>{fmtData(season.startsAt)}</span>
          <span>{fmtData(season.endsAt)}</span>
        </div>
      </div>
    </motion.section>
  );
}

const ROTULO_ESCOPO: Record<EscopoRanking, string> = { global: "Geral", amigos: "Entre amigos", time: "No time" };

// "Sua corrida": responde as 3 perguntas que o jogador tem ao abrir um
// ranking, nesta ordem -- onde estou? quanto falta pro próximo? alguém
// está chegando? A meta diária ("≈ 8 XP por dia") troca um número
// abstrato por uma ação do dia.
export function SuaCorrida({
  corrida,
  escopo,
  total,
  diasRestantes,
  onIrParaMim,
  completo,
  compacto = false,
  semMoldura = false,
}: {
  corrida: Corrida;
  escopo: EscopoRanking;
  total: number;
  diasRestantes: number;
  onIrParaMim?: () => void;
  completo: boolean;
  /** Celular: uma faixa curta (posição + quanto falta), pra não empurrar
   *  o pódio pra baixo da dobra. O resto fica na ficha e no desktop. */
  compacto?: boolean;
  /** Dentro de um PainelCard (que já traz título e "Me achar"). */
  semMoldura?: boolean;
}) {
  const { eu, alvo, faltam, perseguidor, vantagem, proximidadePct } = corrida;

  if (!eu || eu.posicao == null) {
    return (
      <section className="rounded-2xl border border-hairline bg-white/[0.02] p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Sua corrida · {ROTULO_ESCOPO[escopo]}</p>
        <p className="mt-2 text-[15px] font-semibold text-ink">Você ainda não pontuou nesta temporada</p>
        <p className="mt-1 text-[12px] leading-snug text-muted">Qualquer XP já te coloca no ranking. O caminho mais rápido é o Modo Treino.</p>
        <Link
          href="/treino"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12.5px] font-semibold text-void transition-opacity hover:opacity-90"
        >
          Treinar agora <ArrowRight size={14} />
        </Link>
      </section>
    );
  }

  if (compacto) {
    return (
      <section className="rounded-2xl border border-hairline bg-white/[0.02] px-3.5 py-3">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-3xl font-black leading-none tabular-nums text-ink">
            {eu.posicao}º<span className="ml-0.5 text-[11px] font-medium text-muted">/{total}</span>
          </p>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">
              {alvo ? (
                <>
                  Faltam <span className="font-bold tabular-nums" style={{ color: OURO }}>{fmtXP(faltam)} XP</span> pra passar{" "}
                  <span className="font-semibold">{alvo.nome}</span>
                </>
              ) : (
                <span className="font-semibold" style={{ color: OURO }}>
                  Você lidera{perseguidor ? ` · ${fmtXP(vantagem)} XP de vantagem` : ""}
                </span>
              )}
            </p>
            {alvo && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${proximidadePct}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
                  style={{ background: `linear-gradient(90deg, ${OURO}88, ${OURO})` }}
                />
              </div>
            )}
          </div>
          {completo && <SetaMovimento m={movimento(eu)} />}
        </div>
      </section>
    );
  }

  const ameacado = perseguidor && perseguidor.xp7d != null && eu.xp7d != null && perseguidor.xp7d > eu.xp7d;

  return (
    <section className={semMoldura ? "" : "rounded-2xl border border-hairline bg-white/[0.02] p-4"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{semMoldura ? ROTULO_ESCOPO[escopo] : `Sua corrida · ${ROTULO_ESCOPO[escopo]}`}</p>
        {onIrParaMim && !semMoldura && (
          <button
            type="button"
            onClick={onIrParaMim}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <LocateFixed size={12} /> Me achar
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-4xl font-black leading-none tabular-nums text-ink">
          {eu.posicao}º
          <span className="ml-1 text-sm font-medium text-muted">de {total}</span>
        </p>
        {completo && <SetaMovimento m={movimento(eu)} grande />}
      </div>

      <div className="mt-4 space-y-3">
        {alvo ? (
          <div>
            <p className="text-[13px] leading-snug text-ink">
              Faltam <span className="font-bold tabular-nums" style={{ color: OURO }}><Numero valor={faltam} formatar={fmtXP} /> XP</span> pra passar
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <FotoRanking j={alvo} tamanho={26} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                {alvo.nome} <span className="font-normal text-muted">· {alvo.posicao}º</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" title={`${fmtXP(eu.xp)} de ${fmtXP(alvo.xp)} XP`}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${proximidadePct}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
                style={{ background: `linear-gradient(90deg, ${OURO}88, ${OURO})` }}
              />
            </div>
            {diasRestantes > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-muted">
                <Crosshair size={12} /> ≈ {fmtXP(ritmoNecessario(faltam, diasRestantes))} XP por dia até o fim da temporada
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-3" style={{ background: `${OURO}12`, boxShadow: `inset 0 0 0 1px ${OURO}33` }}>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: OURO }}>
              <Trophy size={14} fill={OURO} /> Você lidera
            </p>
            {perseguidor && (
              <p className="mt-0.5 text-[12px] text-muted">
                {fmtXP(vantagem)} XP de vantagem sobre {perseguidor.nome}
              </p>
            )}
          </div>
        )}

        {perseguidor && alvo && (
          <p className={`flex items-start gap-1.5 text-[12px] leading-snug ${ameacado ? "text-[#f59e0b]" : "text-muted"}`}>
            <Shield size={13} className="mt-px shrink-0" />
            <span>
              <span className="font-semibold">{perseguidor.nome}</span> está {fmtXP(vantagem)} XP atrás
              {ameacado && " e ganhou mais XP que você nesta semana"}
            </span>
          </p>
        )}

        {eu.xp7d != null && (
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[12px]">
            <span className="text-muted">Seus últimos 7 dias</span>
            <span className={`font-bold tabular-nums ${eu.xp7d > 0 ? "text-positive" : "text-muted"}`}>+{fmtXP(eu.xp7d)} XP</span>
          </div>
        )}
      </div>
    </section>
  );
}


// Atalhos de "como ganhar XP" -- o ranking sem caminho de ação é só
// vitrine. Mesmas cores de módulo das missões.
const FONTES = [
  { href: "/treino", rotulo: "Modo Treino", detalhe: "XP por spot, com bônus de combo", icone: Target, cor: "#2FB89A" },
  { href: "/revisor", rotulo: "Revisão de Mãos", detalhe: "Registrar, revisar e se autoavaliar", icone: BookOpen, cor: "#A855F7" },
  { href: "/banca", rotulo: "Gestão de Banca", detalhe: "Lançar as sessões do dia", icone: Scale, cor: "#5AA6E0" },
] as const;

export function ComoSubir({ onMissoes, semMoldura = false }: { onMissoes: () => void; semMoldura?: boolean }) {
  return (
    <section className={semMoldura ? "" : "rounded-2xl border border-hairline bg-white/[0.02] p-4"}>
      {!semMoldura && (
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
          <TrendingUp size={12} /> Como subir
        </p>
      )}
      <ul className={`${semMoldura ? "-mx-2" : "mt-2.5"} flex flex-col gap-1`}>
        {FONTES.map((f) => {
          const Icone = f.icone;
          return (
            <li key={f.href}>
              <Link href={f.href} className="group flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/[0.04]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${f.cor}17`, color: f.cor }}>
                  <Icone size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{f.rotulo}</span>
                  <span className="block truncate text-[11.5px] text-muted">{f.detalhe}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMissoes} className="group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.04]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${OURO}17`, color: OURO }}>
              <Trophy size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">Missões</span>
              <span className="block truncate text-[11.5px] text-muted">O maior bônus de XP do dia</span>
            </span>
            <ArrowRight size={14} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          </button>
        </li>
      </ul>
    </section>
  );
}
