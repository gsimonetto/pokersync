"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Check, Share2, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { SeloFundador } from "@/components/achievements/selo-fundador";
import { CANTO_DECO, ondas, rosacea } from "@/components/ui/gravuras";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const EASE = [0.22, 1, 0.36, 1] as const;

// ============================================================
// Carta de Membro Fundador -- aberta ao clicar no selo em
// app/modulos/page.tsx. Desenhada como um certificado de fundação
// (pedido explícito: "realista, única, rica em detalhes"), com os
// elementos de segurança de uma cédula:
//   * guilhochê: rosácea de linhas finas entrelaçadas no fundo;
//   * micro-texto correndo pela moldura ("POKERSYNC · MEMBRO FUNDADOR");
//   * faixa holográfica vertical que muda de cor com a luz;
//   * cantos art déco em ouro e moldura dupla;
//   * o lacre de cera com fitas de seda no centro.
// Comportamento igual ao da carta de patente: no computador inclina
// seguindo o mouse; no celular o brilho passa sozinho; com "menos
// movimento" fica parada. Esc e clique fora fecham.
// ============================================================

const W = 320;
const H = 448;

const GUILHOCHE = rosacea(W / 2, 196);
const ONDAS = ondas(16, W - 16, H - 58);
const CANTO = CANTO_DECO;

const MICRO = "POKERSYNC · MEMBRO FUNDADOR · ".repeat(14);

export function FounderCard({
  open,
  onClose,
  description,
  unlockedAt,
  nome,
  numero,
}: {
  open: boolean;
  onClose: () => void;
  description: string;
  unlockedAt: string;
  /** Nome que vai gravado na carta. */
  nome?: string;
  /** Número de ordem do fundador (1º, 2º...), quando conhecido. */
  numero?: number;
}) {
  const reduzir = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [interagiu, setInteragiu] = useState(false);

  // -0.5..0.5 na horizontal e vertical
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 180, damping: 18 });
  const brilhoX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const brilhoY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open) return null;

  const desde = dateFmt.format(new Date(unlockedAt));

  const compartilhar = async () => {
    const texto = `Sou Membro Fundador do PokerSync${numero ? ` (nº ${numero})` : ""}, desde ${desde}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Membro Fundador · PokerSync", text: texto, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      // cancelado pelo usuário: nada a fazer
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Carta de Membro Fundador">
        <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} aria-hidden />

        <div className="relative flex flex-col items-center gap-4" style={{ perspective: 900 }}>
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30, rotateY: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
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
            className="relative aspect-[5/7] w-[min(82vw,320px)] rounded-[22px] p-[1.5px] shadow-[0_40px_90px_-20px_rgba(0,0,0,0.95),0_0_60px_-20px_rgba(242,198,90,0.35)]"
            // Moldura externa em folha de ouro
          >
            <div aria-hidden className="absolute inset-0 rounded-[22px]" style={{ background: "linear-gradient(145deg, #fff1c1, #c8912c 30%, #5a3a08 55%, #f2c65a 80%, #8a5a12)" }} />

            <div className="relative h-full w-full overflow-hidden rounded-[20.5px]" style={{ background: "radial-gradient(120% 70% at 50% 38%, #2a0a10 0%, #120608 45%, #070405 100%)" }}>
              {/* Gravuras: guilhochê, ondas, micro-texto, moldura e cantos */}
              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="fund-ouro" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff1c1" />
                    <stop offset=".45" stopColor="#d9a33a" />
                    <stop offset="1" stopColor="#8a5a12" />
                  </linearGradient>
                  <path id="fund-moldura" d={`M30 18 H${W - 30} Q${W - 18} 18 ${W - 18} 30 V${H - 30} Q${W - 18} ${H - 18} ${W - 30} ${H - 18} H30 Q18 ${H - 18} 18 ${H - 30} V30 Q18 18 30 18 Z`} />
                </defs>
                <g fill="none" stroke="#f2c65a" strokeOpacity=".09" strokeWidth=".45">
                  {GUILHOCHE.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                <g fill="none" stroke="#f2c65a" strokeOpacity=".12" strokeWidth=".4">
                  {ONDAS.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                {/* Moldura dupla gravada */}
                <rect x="10" y="10" width={W - 20} height={H - 20} rx="14" fill="none" stroke="url(#fund-ouro)" strokeOpacity=".7" strokeWidth=".8" />
                <use href="#fund-moldura" fill="none" stroke="url(#fund-ouro)" strokeOpacity=".35" strokeWidth=".5" />
                {/* Micro-texto correndo pela moldura */}
                <text fontSize="4.1" letterSpacing=".6" fill="#f2c65a" fillOpacity=".55" fontFamily="Georgia, serif">
                  <textPath href="#fund-moldura">{MICRO}</textPath>
                </text>
                {/* Cantos art déco */}
                <g fill="none" stroke="url(#fund-ouro)" strokeWidth="1" strokeLinecap="round">
                  <path d={CANTO} />
                  <path d={CANTO} transform={`translate(${W} 0) scale(-1 1)`} />
                  <path d={CANTO} transform={`translate(0 ${H}) scale(1 -1)`} />
                  <path d={CANTO} transform={`translate(${W} ${H}) scale(-1 -1)`} />
                </g>
                {/* Filetes do cabeçalho */}
                <g stroke="url(#fund-ouro)" strokeWidth=".7" strokeOpacity=".8">
                  <path d={`M70 88 H${W / 2 - 10}`} />
                  <path d={`M${W / 2 + 10} 88 H${W - 70}`} />
                </g>
                <path d={`M${W / 2} 84 L${W / 2 + 4} 88 L${W / 2} 92 L${W / 2 - 4} 88 Z`} fill="url(#fund-ouro)" />
              </svg>

              {/* Faixa holográfica de segurança (vertical, à direita) */}
              <motion.div
                aria-hidden
                className={`absolute bottom-[34px] top-[34px] w-[10px] overflow-hidden rounded-[2px] ${!interagiu && !reduzir ? "fund-holo-auto" : ""}`}
                style={{
                  right: 24,
                  backgroundImage: "linear-gradient(180deg, #ff6ad5, #c774e8, #8795e8, #94d0ff, #7cffcb, #fffc7c, #ffb07c, #ff6ad5)",
                  backgroundSize: "100% 300%",
                  backgroundPositionY: interagiu ? brilhoY : undefined,
                  opacity: 0.32,
                  mixBlendMode: "screen",
                }}
              >
                <span className="absolute inset-0 whitespace-nowrap text-center text-[5px] font-bold leading-[10px] tracking-[0.3em] text-black/60" style={{ writingMode: "vertical-rl" }}>
                  {"FUNDADOR ✦ POKERSYNC ✦ ".repeat(12)}
                </span>
              </motion.div>

              {/* Brilho holográfico geral (acompanha o mouse) */}
              <motion.div
                aria-hidden
                className={`pointer-events-none absolute inset-0 mix-blend-color-dodge ${!interagiu && !reduzir ? "fund-holo-auto" : ""}`}
                style={{
                  backgroundImage:
                    "linear-gradient(115deg, transparent 32%, rgba(255,215,120,.22) 42%, rgba(255,160,180,.16) 48%, rgba(160,210,255,.16) 54%, transparent 66%)",
                  backgroundSize: "250% 250%",
                  backgroundPositionX: interagiu ? brilhoX : undefined,
                  backgroundPositionY: interagiu ? brilhoY : undefined,
                  opacity: 0.7,
                }}
              />

              {/* Conteúdo */}
              <div className="relative flex h-full flex-col items-center px-10 pb-7 pt-9 text-center" style={{ transform: "translateZ(30px)" }}>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.42em] text-[#f2c65a]/75">PokerSync</p>
                <p
                  className="mt-1 whitespace-nowrap bg-clip-text text-[19px] font-bold uppercase tracking-[0.1em] text-transparent"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", backgroundImage: "linear-gradient(180deg, #fff4c8, #f2c65a 45%, #b98220 60%, #f5d27a)" }}
                >
                  Membro Fundador
                </p>

                <div className="mt-6">
                  <SeloFundador tamanho={138} fitas />
                </div>

                <p className="mt-1 max-w-full truncate text-[20px] italic text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  {nome || "Jogador"}
                </p>
                <p className="mt-1 line-clamp-3 text-[10.5px] leading-snug text-white/60">{description}</p>

                <div className="mt-auto grid w-full grid-cols-2 border-t border-[#f2c65a]/25 pt-2.5 text-left">
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#f2c65a]/60">{numero ? "Nº de fundador" : "Geração"}</p>
                    <p className="text-[14px] font-bold tabular-nums text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {numero ? `Nº ${String(numero).padStart(4, "0")}` : "Fundação"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#f2c65a]/60">Membro desde</p>
                    <p className="text-[14px] font-bold text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {desde}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="relative flex gap-2">
            <button
              type="button"
              onClick={compartilhar}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-void transition-opacity hover:opacity-90"
            >
              {copiado ? <Check size={15} /> : <Share2 size={15} />}
              {copiado ? "Texto copiado" : "Compartilhar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/[0.06]"
            >
              <X size={15} /> Fechar
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fundHolo { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
        .fund-holo-auto { animation: fundHolo 6s ease-in-out infinite; }
        @keyframes embVarre { 0% { transform: translateX(-90px) skewX(-18deg); } 60%, 100% { transform: translateX(200px) skewX(-18deg); } }
        .emb-varre { animation: embVarre var(--vel, 5s) ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .fund-holo-auto, .emb-varre { animation: none; } }
      `}</style>
    </ModalPortal>
  );
}
