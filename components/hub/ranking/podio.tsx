"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown, Trophy } from "lucide-react";
import { EASE, Numero } from "@/components/painel/painel-card";
import { FotoRanking } from "@/components/hub/ranking/linha";
import type { JogadorRanking } from "@/lib/services/ranking-service";
import { MEDALHA, fmtXP } from "@/lib/hub/ranking-regras";

// Pódio dos 3 primeiros.
//
// Coreografia de entrada (roda UMA vez, ~1,6s, e a tela fica quieta):
//   1) as colunas crescem de baixo pra cima na ordem 3º -> 2º -> 1º,
//      o 1º por último (suspense de "quem ganhou");
//   2) cada foto "pousa" em cima da sua coluna logo depois;
//   3) a coroa cai sobre o 1º e solta uma única rajada de faíscas
//      douradas.
// Depois disso só sobra um brilho lento passando na coluna do 1º a cada
// ~7s -- sinal de "vivo" sem disputar atenção com os números (os fogos
// em loop infinito da versão anterior faziam isso). Quem pediu menos
// movimento no sistema vê tudo já no lugar.

const LUGARES = [
  { pos: 2, altura: "h-[72px] sm:h-24", foto: 62, atraso: 0.2 },
  { pos: 1, altura: "h-[104px] sm:h-32", foto: 80, atraso: 0.45 },
  { pos: 3, altura: "h-14 sm:h-[72px]", foto: 58, atraso: 0 },
] as const;

// Ângulos fixos (não aleatórios) pra render do servidor e do cliente
// baterem.
const FAISCAS = Array.from({ length: 14 }, (_, i) => {
  const ang = (i / 14) * Math.PI * 2;
  const raio = 46 + (i % 3) * 14;
  return { x: Math.cos(ang) * raio, y: Math.sin(ang) * raio * 0.8 - 10, tam: i % 2 ? 3 : 4 };
});

export function Podio({
  jogadores,
  onAbrir,
  chave,
}: {
  jogadores: JogadorRanking[];
  onAbrir: (j: JogadorRanking) => void;
  /** Muda quando o recorte muda -- refaz a entrada. */
  chave: string;
}) {
  const reduzir = useReducedMotion();
  const por = (p: number) => jogadores.find((j) => j.posicao === p);

  return (
    <div key={chave} className="relative mx-auto grid w-full max-w-[560px] grid-cols-3 items-end gap-2 px-1 pt-10 sm:gap-4">
      {/* Luz de palco atrás do 1º */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${MEDALHA[1]}2e, transparent 70%)` }}
      />
      {LUGARES.map((l) => {
        const j = por(l.pos);
        const cor = MEDALHA[l.pos];
        const primeiro = l.pos === 1;
        const atrasoFoto = reduzir ? 0 : l.atraso + 0.45;
        return (
          <div key={l.pos} className="relative flex min-w-0 flex-col items-center">
            {j ? (
              <motion.button
                type="button"
                onClick={() => onAbrir(j)}
                initial={reduzir ? false : { opacity: 0, y: 14, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE, delay: atrasoFoto }}
                className="group flex w-full min-w-0 flex-col items-center rounded-xl pb-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={`${l.pos}º lugar: ${j.nome}, ${fmtXP(j.xp)} XP. Abrir ficha`}
              >
                <span className="relative">
                  {primeiro && (
                    <motion.span
                      initial={reduzir ? false : { opacity: 0, y: -18, rotate: -12 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 14, delay: reduzir ? 0 : atrasoFoto + 0.35 }}
                      className="absolute -top-6 left-1/2 z-10 -translate-x-1/2"
                      style={{ color: cor, filter: `drop-shadow(0 0 8px ${cor}aa)` }}
                    >
                      <Crown size={22} fill={cor} strokeWidth={1.4} />
                    </motion.span>
                  )}
                  {primeiro && !reduzir && (
                    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
                      {FAISCAS.map((f, i) => (
                        <motion.span
                          key={i}
                          className="absolute rounded-full"
                          style={{ width: f.tam, height: f.tam, background: i % 3 ? cor : "#fff", boxShadow: `0 0 6px ${cor}` }}
                          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                          animate={{ x: f.x, y: [0, f.y, f.y + 18], opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
                          transition={{ duration: 1.1, ease: "easeOut", delay: atrasoFoto + 0.55, times: [0, 0.45, 1] }}
                        />
                      ))}
                    </span>
                  )}
                  <span className="relative block transition-transform duration-300 group-hover:-translate-y-0.5">
                    <FotoRanking j={j} tamanho={l.foto} animar brilho={primeiro} />
                  </span>
                  {j.souEu && (
                    <span className="absolute -right-2 -top-1 rounded-full bg-ink px-1.5 text-[9.5px] font-bold uppercase leading-4 text-void">
                      você
                    </span>
                  )}
                </span>
                <span className={`mt-2.5 flex w-full min-w-0 items-center justify-center gap-1 ${primeiro ? "text-[13px] sm:text-sm" : "text-[12px] sm:text-[13px]"} font-semibold text-ink`}>
                  <span className="truncate" title={j.nome}>
                    {j.nome}
                  </span>
                  {j.titulos.length > 0 && <Trophy size={11} className="shrink-0" fill="#F5D48C" color="#F5D48C" aria-label="Campeão de temporada" />}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="text-[12px] font-bold tabular-nums sm:text-[13px]" style={{ color: primeiro ? cor : "#E0B24C" }}>
                    <Numero valor={j.xp} formatar={fmtXP} duracao={1200} />
                  </span>
                </span>
              </motion.button>
            ) : (
              <div className="flex w-full flex-col items-center pb-2 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-white/15 text-muted">
                  ?
                </span>
                <span className="mt-2 text-[11.5px] text-muted">Vaga aberta</span>
              </div>
            )}

            <motion.div
              initial={reduzir ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: l.atraso }}
              style={{
                transformOrigin: "bottom",
                background: `linear-gradient(180deg, ${cor}2e, ${cor}08)`,
                boxShadow: `inset 0 1px 0 ${cor}88, inset 0 0 0 1px ${cor}33${primeiro ? `, 0 -8px 30px -12px ${cor}` : ""}`,
              }}
              className={`relative flex w-full items-start justify-center overflow-hidden rounded-t-xl pt-2 ${l.altura}`}
            >
              {primeiro && (
                <span
                  aria-hidden
                  className="hub-varre pointer-events-none absolute inset-y-0 left-0 w-1/3"
                  style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,.14), transparent)" }}
                />
              )}
              <span className="text-xl font-black tabular-nums sm:text-2xl" style={{ color: cor, textShadow: `0 0 14px ${cor}66` }}>
                {l.pos}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
