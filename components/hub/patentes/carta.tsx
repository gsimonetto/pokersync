"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Check, Share2, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { EASE } from "@/components/painel/painel-card";
import { MAX_LEVEL, levelColor, levelMaterial, levelSubTier, xpForNextLevel, type Progress } from "@/lib/services/xp-service";
import { EmblemaPatente } from "@/components/hub/patentes/emblema";

// Carta holográfica da patente -- abre ao tocar no emblema do Hub, pra
// exibir (e compartilhar) a patente em tela cheia.
//
// No computador a carta inclina seguindo o mouse e o brilho holográfico
// acompanha a luz; no celular (sem mouse) o brilho passa sozinho, em
// loop lento. Com "menos movimento" ligado no sistema, fica parada.
export function CartaPatente({ progress, nome, onFechar }: { progress: Progress; nome: string; onFechar: () => void }) {
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
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const nivel = progress.level;
  const cor = levelColor(nivel);
  const max = nivel >= MAX_LEVEL;
  const necessario = max ? 0 : xpForNextLevel(nivel);
  const pct = max ? 100 : Math.min(100, (progress.xp_current / necessario) * 100);
  const patente = `${levelMaterial(nivel)} ${levelSubTier(nivel)}`;

  const compartilhar = async () => {
    const texto = `Cheguei em ${patente} (nível ${nivel}) no PokerSync!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Minha patente no PokerSync", text: texto, url: window.location.origin });
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
      <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`Carta da patente ${patente}`}>
        <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onFechar} aria-hidden />

        <div className="relative flex flex-col items-center gap-4" style={{ perspective: 900 }}>
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30, rotateY: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={reduzir ? { borderColor: `${cor}66` } : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", borderColor: `${cor}66` }}
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
            className="relative aspect-[5/7] w-[min(78vw,300px)] overflow-hidden rounded-[22px] border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            {/* Fundo na cor da patente, com trama fina (textura de carta)
                por baixo do holográfico. */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(120% 80% at 50% 0%, ${cor}40, transparent 60%), linear-gradient(160deg, #161616, #0a0a0a 60%, ${cor}26)`,
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "10px 10px" }}
            />
            <div aria-hidden className="absolute inset-[6px] rounded-[18px] border" style={{ borderColor: `${cor}55` }} />

            {/* Holográfico: arco-íris que acompanha o mouse (ou passa
                sozinho no toque) com mistura "color-dodge". */}
            <motion.div
              aria-hidden
              className={`pointer-events-none absolute inset-0 mix-blend-color-dodge ${!interagiu && !reduzir ? "carta-holo-auto" : ""}`}
              style={{
                backgroundImage:
                  "linear-gradient(115deg, transparent 30%, rgba(255,106,213,.22) 40%, rgba(124,255,203,.2) 46%, rgba(148,208,255,.22) 52%, rgba(255,252,124,.18) 58%, transparent 68%)",
                backgroundSize: "250% 250%",
                backgroundPositionX: interagiu ? brilhoX : undefined,
                backgroundPositionY: interagiu ? brilhoY : undefined,
                opacity: 0.6,
              }}
            />

            <div className="relative flex h-full flex-col items-center px-5 pb-5 pt-5 text-center" style={{ transform: "translateZ(30px)" }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-white/60">PokerSync · Patente</p>
              <div className="mt-3">
                <EmblemaPatente nivel={nivel} tamanho={150} mostrarDivisao />
              </div>
              <p className="mt-2 text-[22px] font-black uppercase tracking-[0.08em]" style={{ color: cor, textShadow: `0 0 18px ${cor}88` }}>
                {patente}
              </p>
              <p className="text-[13px] font-semibold text-white/85">Nível {nivel}</p>
              <div className="mt-auto grid w-full grid-cols-3 gap-1 border-t border-white/10 pt-3 text-center">
                {[
                  ["XP total", progress.xp_total.toLocaleString("pt-BR")],
                  ["Sequência", `${progress.streak_days}d`],
                  ["Recorde", `${progress.streak_best}d`],
                ].map(([r, v]) => (
                  <div key={r}>
                    <p className="text-[9.5px] uppercase tracking-wider text-white/50">{r}</p>
                    <p className="text-[14px] font-bold tabular-nums text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 w-full">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cor}, #fff)` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-white/60">
                  <span className="max-w-[60%] truncate">{nome}</span>
                  <span>{max ? "Nível máximo" : `${Math.round(pct)}% pro ${nivel + 1}`}</span>
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
              onClick={onFechar}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-white/[0.06]"
            >
              <X size={15} /> Fechar
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes cartaHolo { 0% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
        .carta-holo-auto { animation: cartaHolo 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .carta-holo-auto { animation: none; } }
      `}</style>
    </ModalPortal>
  );
}
