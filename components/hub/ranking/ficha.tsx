"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { EASE } from "@/components/painel/painel-card";
import type { JogadorRanking } from "@/lib/services/ranking-service";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";
import { MEDALHA, fmtXP, movimento } from "@/lib/hub/ranking-regras";
import { FotoRanking, SetaMovimento } from "@/components/hub/ranking/linha";
import { SeloFundador } from "@/components/achievements/selo-fundador";
import { FounderCard } from "@/components/achievements/founder-card";
import { fetchConquistasDoJogador, type Achievement } from "@/lib/services/achievements-service";

const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

const OURO = "#E0B24C";

// Ficha rápida de um jogador do ranking. No celular sobe de baixo
// (alcance do polegar); no computador abre no centro. O bloco "Você x
// ele" é o que transforma o ranking de vitrine em rivalidade: duas
// barras lado a lado e a diferença exata.
//
// Conquistas PokerSync (ex.: Membro Fundador) ficam em evidência logo
// abaixo do nome -- o selo também vai pregado na foto -- e abrem a carta
// da conquista (pedido explícito).
export function FichaJogador({ j, eu, onFechar }: { j: JogadorRanking; eu: JogadorRanking | null; onFechar: () => void }) {
  const [conquistas, setConquistas] = useState<Achievement[]>([]);
  const [cartaAberta, setCartaAberta] = useState<Achievement | null>(null);

  useEffect(() => {
    // Com a carta da conquista aberta, o Esc fecha só ela.
    if (cartaAberta) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar, cartaAberta]);

  useEffect(() => {
    let vivo = true;
    fetchConquistasDoJogador(j.userId)
      .then((c) => vivo && setConquistas(c))
      .catch(() => vivo && setConquistas([]));
    return () => {
      vivo = false;
    };
  }, [j.userId]);

  const fundador = conquistas.find((c) => c.code === "founder");
  const outras = conquistas.filter((c) => c.code !== "founder");

  const cor = levelColor(j.nivel);
  const medalha = j.posicao != null ? MEDALHA[j.posicao] : undefined;
  const duelo = eu && !j.souEu && eu.posicao != null && j.posicao != null;
  const dif = duelo ? j.xp - eu!.xp : 0;
  const maior = duelo ? Math.max(j.xp, eu!.xp, 1) : 1;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${j.nome}`}>
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onFechar}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative w-full overflow-hidden rounded-t-3xl border border-white/10 bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-3xl sm:pb-5"
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: `radial-gradient(ellipse at 50% 0%, ${medalha ?? cor}26, transparent 70%)` }} />
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
          <button
            type="button"
            onClick={onFechar}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>

          <div className="relative flex flex-col items-center px-5 pt-5 text-center">
            <span className="relative">
              <FotoRanking j={j} tamanho={92} animar brilho />
              {fundador && (
                <button
                  type="button"
                  onClick={() => setCartaAberta(fundador)}
                  className="absolute -right-4 -top-2 rotate-12 transition-transform hover:rotate-0 hover:scale-110"
                  aria-label="Ver carta de Membro Fundador"
                  title="Membro Fundador"
                >
                  <SeloFundador tamanho={40} animar={false} />
                </button>
              )}
            </span>
            <p className="mt-3 max-w-full truncate text-lg font-bold text-ink">{j.nome}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px]">
              <span className="font-semibold" style={{ color: cor }}>
                {levelMaterial(j.nivel)} {levelSubTier(j.nivel)}
              </span>
              <span className="text-muted">· Nível {j.nivel}</span>
            </p>
            {j.titulos.length > 0 && (
              <p className="mt-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: "#F5D48C", background: "#F5D48C1a" }}>
                <Trophy size={11} fill="#F5D48C" /> Campeão da Temporada {j.titulos.map((n) => `#${n}`).join(", ")}
              </p>
            )}

            {/* Conquistas PokerSync em destaque */}
            {fundador && (
              <button
                type="button"
                onClick={() => setCartaAberta(fundador)}
                className="group mt-3 flex w-full items-center gap-3 rounded-2xl border p-2 pr-3 text-left transition-colors hover:border-[#f2c65a]/60"
                style={{ borderColor: "#f2c65a33", background: "linear-gradient(100deg, #3a0710cc, #12060899 60%, #f2c65a14)" }}
              >
                <SeloFundador tamanho={44} animar={false} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#f2c65a]/70">Conquista PokerSync</span>
                  <span className="block truncate text-[15px] font-bold text-[#f5d27a]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    Membro Fundador
                  </span>
                  <span className="block text-[11px] text-white/55">desde {mesAno.format(new Date(fundador.unlockedAt))}</span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-[#f2c65a]/70 transition-colors group-hover:text-[#f5d27a]">Ver carta ›</span>
              </button>
            )}
            {outras.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {outras.map((c) => (
                  <span key={c.code} title={c.description} className="flex items-center gap-1 rounded-full border border-evolution/30 bg-evolution/10 px-2 py-0.5 text-[11px] font-semibold text-evolution">
                    <Trophy size={11} /> {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative mx-5 mt-4 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02] py-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Posição</p>
              <p className="mt-0.5 text-lg font-black tabular-nums" style={{ color: medalha ?? undefined }}>
                {j.posicao != null ? `${j.posicao}º` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Temporada</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: OURO }}>
                {fmtXP(j.xp)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">7 dias</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${j.xp7d ? "text-positive" : "text-muted"}`}>
                {j.xp7d != null ? `+${fmtXP(j.xp7d)}` : "—"}
              </p>
            </div>
          </div>

          <div className="relative mx-5 mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted">
            <SetaMovimento m={movimento(j)} grande />
            {j.streak > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-orange-400/10 px-1.5 py-0.5 font-semibold text-orange-300">
                <Flame size={12} /> {j.streak} {j.streak === 1 ? "dia" : "dias"} seguidos
              </span>
            )}
          </div>

          {duelo && (
            <div className="relative mx-5 mt-4 rounded-2xl border border-white/[0.06] p-3">
              <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Você × {j.nome}</p>
              {[
                { rotulo: "Você", xp: eu!.xp, cor: OURO },
                { rotulo: j.nome, xp: j.xp, cor: "#9aa3ad" },
              ].map((b, i) => (
                <div key={i} className="mt-2 flex items-center gap-2 text-[11.5px]">
                  <span className="w-20 shrink-0 truncate text-muted">{b.rotulo}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.span
                      className="block h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(3, (b.xp / maior) * 100)}%` }}
                      transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.1 }}
                      style={{ background: b.cor }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-ink">{fmtXP(b.xp)}</span>
                </div>
              ))}
              <p className="mt-2.5 text-[12.5px] text-ink">
                {dif > 0 ? (
                  <>
                    Faltam <span className="font-bold" style={{ color: OURO }}>{fmtXP(dif + 1)} XP</span> pra você passar.
                  </>
                ) : dif < 0 ? (
                  <>
                    Você está <span className="font-bold text-positive">{fmtXP(-dif)} XP</span> à frente.
                  </>
                ) : (
                  "Empatados em XP."
                )}
              </p>
            </div>
          )}
        </motion.div>
      </div>
      {cartaAberta && (
        <FounderCard open onClose={() => setCartaAberta(null)} description={cartaAberta.description} unlockedAt={cartaAberta.unlockedAt} nome={j.nome} />
      )}
    </ModalPortal>
  );
}
