"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Flame, Trophy, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { EASE } from "@/components/painel/painel-card";
import type { JogadorRanking } from "@/lib/services/ranking-service";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";
import { MEDALHA, fmtXP, movimento } from "@/lib/hub/ranking-regras";
import { FotoRanking, SetaMovimento } from "@/components/hub/ranking/linha";
import { faixaDoNivel } from "@/components/hub/patentes/emblema";
import { CantosDeco, MicroTexto, ondas, rosacea } from "@/components/ui/gravuras";

const OURO = "#E0B24C";

// ============================================================
// Ficha do jogador no ranking -- uma carta (pedido explícito: "mesmo
// nível de qualidade" da carta de Membro Fundador).
//
// A moldura é do material da patente do jogador (bronze, prata, ouro,
// pedras, platina, diamante, lendário), com gravuras de cédula no fundo
// (rosácea de guilhochê, ondas, micro-texto, cantos art déco) na cor da
// patente. Os 3 primeiros ganham uma fita de medalha no canto. A
// posição aparece enorme, gravada no fundo, como em carta colecionável.
//
// Continua sendo a ficha de sempre: posição, XP da temporada, 7 dias,
// movimento, sequência, títulos e o "Você × ele" (o que transforma o
// ranking em rivalidade). No computador a carta inclina seguindo o mouse
// e o brilho acompanha a luz; no celular o brilho passa sozinho; com
// "menos movimento" fica parada. Esc e clique fora fecham.
// ============================================================

// Moldura por patente: [claro, base, escuro].
const MOLDURA: [string, string, string][] = [
  ["#ffdcae", "#b07a41", "#35190a"], // Bronze
  ["#ffffff", "#aab2ba", "#3f474f"], // Prata
  ["#fff6cf", "#d9a531", "#5a3804"], // Ouro
  ["#b8f5d2", "#12a15a", "#02301a"], // Esmeralda
  ["#cfe0ff", "#2f63e0", "#050d3d"], // Safira
  ["#ecd9ff", "#9a4ee0", "#230842"], // Ametista
  ["#ffd2d7", "#b3122a", "#1c0003"], // Rubi
  ["#ffffff", "#b4c2cc", "#46545e"], // Platina
  ["#ffffff", "#c6d2dd", "#46526a"], // Diamante
  ["#fffbe6", "#e6b441", "#4d2f02"], // Lendário
];

const GUILHOCHE = rosacea(170, 150, { raio: 78, aneis: 8, amplitude: 18, petalas: 20 });
const ONDAS = ondas(0, 340, 0, 6);

export function FichaJogador({ j, eu, onFechar }: { j: JogadorRanking; eu: JogadorRanking | null; onFechar: () => void }) {
  const reduzir = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [interagiu, setInteragiu] = useState(false);

  // -0.5..0.5 na horizontal e vertical
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), { stiffness: 180, damping: 18 });
  const brilhoX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const brilhoY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const cor = levelColor(j.nivel);
  const faixa = faixaDoNivel(j.nivel);
  const [claro, base, escuro] = MOLDURA[faixa];
  const diamante = faixa === 8;
  const medalha = j.posicao != null ? MEDALHA[j.posicao] : undefined;
  const duelo = eu && !j.souEu && eu.posicao != null && j.posicao != null;
  const dif = duelo ? j.xp - eu!.xp : 0;
  const maior = duelo ? Math.max(j.xp, eu!.xp, 1) : 1;
  // Cor das gravuras: a da patente, mas a do Diamante (rosa no app) vira
  // prata-azulada pra combinar com a pedra incolor.
  const tinta = diamante ? "#dfe9ff" : cor;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${j.nome}`}>
        <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onFechar} aria-hidden />

        <div className="relative flex flex-col items-center gap-4" style={{ perspective: 900 }}>
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30, rotateY: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
            style={reduzir ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse" || reduzir) return;
              const r = ref.current?.getBoundingClientRect();
              if (!r) return;
              setInteragiu(true);
              px.set((e.clientX - r.left) / r.width - 0.5);
              py.set((e.clientY - r.top) / r.height - 0.5);
            }}
            onPointerLeave={() => {
              px.set(0);
              py.set(0);
            }}
            className="relative w-[min(90vw,340px)] rounded-[22px] p-[1.5px]"
          >
            {/* Moldura externa no metal/pedra da patente */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[22px]"
              style={{
                background: diamante
                  ? "linear-gradient(145deg, #ffffff, #c6d2dd 25%, #9ad8ff 40%, #46526a 55%, #ffd6f0 70%, #eef4f9 85%, #7c8aa0)"
                  : `linear-gradient(145deg, ${claro}, ${base} 30%, ${escuro} 55%, ${base} 80%, ${escuro})`,
                boxShadow: `0 40px 90px -20px rgba(0,0,0,0.95), 0 0 60px -22px ${base}`,
              }}
            />

            <div
              className="relative min-h-[500px] overflow-hidden rounded-[20.5px]"
              style={{ background: `radial-gradient(120% 60% at 50% 18%, ${tinta}1f 0%, #0d0d0f 55%, #060607 100%)` }}
            >
              {/* Gravuras */}
              <svg viewBox="0 0 340 300" className="pointer-events-none absolute inset-x-0 top-0 w-full" aria-hidden>
                <g fill="none" stroke={tinta} strokeOpacity=".1" strokeWidth=".45">
                  {GUILHOCHE.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
              </svg>
              <svg viewBox="0 0 340 24" className="pointer-events-none absolute inset-x-0 bottom-3 w-full" aria-hidden>
                <g fill="none" stroke={tinta} strokeOpacity=".13" strokeWidth=".4">
                  {ONDAS.map((d, i) => (
                    <path key={i} d={d} transform="translate(0 3)" />
                  ))}
                </g>
              </svg>
              {/* Posição gigante gravada no fundo */}
              {j.posicao != null && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -left-1 top-6 select-none text-[120px] font-black leading-none tabular-nums"
                  style={{ color: "transparent", WebkitTextStroke: `1px ${medalha ?? tinta}40` }}
                >
                  {j.posicao}
                </span>
              )}
              {/* Moldura interna dupla + micro-texto + cantos */}
              <div aria-hidden className="pointer-events-none absolute inset-[10px] rounded-[14px] border" style={{ borderColor: `${claro}55` }} />
              <div aria-hidden className="pointer-events-none absolute inset-[16px] rounded-[10px] border" style={{ borderColor: `${claro}22` }} />
              <MicroTexto texto="POKERSYNC · RANKING DA TEMPORADA · " cor={`${claro}80`} className="inset-x-[28px] top-[11.5px]" />
              <MicroTexto texto="POKERSYNC · RANKING DA TEMPORADA · " cor={`${claro}80`} className="inset-x-[28px] bottom-[11.5px]" />
              <CantosDeco cor={claro} />

              {/* Brilho holográfico (acompanha o mouse) */}
              <motion.div
                aria-hidden
                className={`pointer-events-none absolute inset-0 mix-blend-color-dodge ${!interagiu && !reduzir ? "ficha-holo-auto" : ""}`}
                style={{
                  backgroundImage: diamante
                    ? "linear-gradient(115deg, transparent 30%, rgba(255,106,213,.2) 40%, rgba(124,255,203,.18) 46%, rgba(148,208,255,.2) 52%, rgba(255,252,124,.16) 58%, transparent 68%)"
                    : `linear-gradient(115deg, transparent 32%, ${claro}33 44%, ${tinta}2a 50%, transparent 64%)`,
                  backgroundSize: "250% 250%",
                  backgroundPositionX: interagiu ? brilhoX : undefined,
                  backgroundPositionY: interagiu ? brilhoY : undefined,
                  opacity: 0.55,
                }}
              />

              {/* Fita de medalha dos 3 primeiros */}
              {medalha && j.posicao != null && (
                <svg viewBox="0 0 40 56" width="40" height="56" className="absolute right-7 top-0" aria-label={`${j.posicao}º lugar`}>
                  <path d="M6 0 H34 V46 L20 38 L6 46 Z" fill={medalha} />
                  <path d="M6 0 H34 V46 L20 38 L6 46 Z" fill="url(#ficha-fita)" />
                  <defs>
                    <linearGradient id="ficha-fita" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#000" stopOpacity=".35" />
                      <stop offset=".5" stopColor="#fff" stopOpacity=".25" />
                      <stop offset="1" stopColor="#000" stopOpacity=".35" />
                    </linearGradient>
                  </defs>
                  <text x="20" y="22" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="900" fill="#1a1204">
                    {j.posicao}º
                  </text>
                </svg>
              )}

              {/* Conteúdo */}
              <div className="relative flex flex-col items-center px-7 pb-8 pt-8 text-center" style={{ transform: "translateZ(30px)" }}>
                <p className="text-[9px] font-bold uppercase tracking-[0.38em]" style={{ color: `${claro}bb` }}>
                  PokerSync · Ranking
                </p>
                <div className="mt-2 flex w-full items-center justify-center gap-2" aria-hidden>
                  <span className="h-px w-14" style={{ background: `linear-gradient(90deg, transparent, ${claro}99)` }} />
                  <span className="h-1.5 w-1.5 rotate-45" style={{ background: claro }} />
                  <span className="h-px w-14" style={{ background: `linear-gradient(90deg, ${claro}99, transparent)` }} />
                </div>

                <div className="mt-5">
                  <FotoRanking j={j} tamanho={100} animar brilho />
                </div>
                <p className="mt-5 max-w-full truncate text-[21px] font-bold tracking-tight text-white" style={{ textShadow: `0 0 22px ${tinta}55` }}>
                  {j.nome}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px]">
                  <span className="font-semibold uppercase tracking-[0.12em]" style={{ color: tinta }}>
                    {levelMaterial(j.nivel)} {levelSubTier(j.nivel)}
                  </span>
                  <span className="text-white/50">· Nível {j.nivel}</span>
                </p>
                {j.titulos.length > 0 && (
                  <p className="mt-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color: "#F5D48C", borderColor: "#F5D48C44", background: "#F5D48C12" }}>
                    <Trophy size={11} fill="#F5D48C" /> Campeão da Temporada {j.titulos.map((n) => `#${n}`).join(", ")}
                  </p>
                )}

                {/* Painel gravado com os números */}
                <div
                  className="mt-5 grid w-full grid-cols-3 rounded-2xl border py-3 text-center"
                  style={{ borderColor: `${claro}30`, background: "rgba(0,0,0,0.35)", boxShadow: `inset 0 1px 0 ${claro}22` }}
                >
                  {[
                    { r: "Posição", v: j.posicao != null ? `${j.posicao}º` : "—", c: medalha ?? "#fff" },
                    { r: "Temporada", v: fmtXP(j.xp), c: OURO },
                    { r: "7 dias", v: j.xp7d != null ? `+${fmtXP(j.xp7d)}` : "—", c: j.xp7d ? "#22c55e" : "rgba(255,255,255,.5)" },
                  ].map((s, i) => (
                    <div key={s.r} className={i ? "border-l" : ""} style={i ? { borderColor: `${claro}1f` } : undefined}>
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.2em]" style={{ color: `${claro}99` }}>
                        {s.r}
                      </p>
                      <p className="mt-0.5 text-[18px] font-black tabular-nums" style={{ color: s.c }}>
                        {s.v}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted">
                  <SetaMovimento m={movimento(j)} grande />
                  {j.streak > 0 && (
                    <span className="flex items-center gap-1 rounded-md bg-orange-400/10 px-1.5 py-0.5 font-semibold text-orange-300">
                      <Flame size={12} /> {j.streak} {j.streak === 1 ? "dia" : "dias"} seguidos
                    </span>
                  )}
                </div>

                {duelo && (
                  <div className="mt-4 w-full rounded-2xl border p-3 text-left" style={{ borderColor: `${claro}26`, background: "rgba(0,0,0,0.25)" }}>
                    <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.2em]" style={{ color: `${claro}99` }}>
                      Você × {j.nome}
                    </p>
                    {[
                      { rotulo: "Você", xp: eu!.xp, cor: OURO },
                      { rotulo: j.nome, xp: j.xp, cor: tinta },
                    ].map((b, i) => (
                      <div key={i} className="mt-2 flex items-center gap-2 text-[11.5px]">
                        <span className="w-20 shrink-0 truncate text-white/60">{b.rotulo}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.span
                            className="block h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(3, (b.xp / maior) * 100)}%` }}
                            transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.1 }}
                            style={{ background: `linear-gradient(90deg, ${b.cor}aa, ${b.cor})` }}
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
              </div>
            </div>
          </motion.div>

          <button
            type="button"
            onClick={onFechar}
            className="relative flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/[0.06]"
          >
            <X size={15} /> Fechar
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fichaHolo { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
        .ficha-holo-auto { animation: fichaHolo 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ficha-holo-auto { animation: none; } }
      `}</style>
    </ModalPortal>
  );
}
