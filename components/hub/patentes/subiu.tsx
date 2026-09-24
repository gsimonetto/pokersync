"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ModalPortal } from "@/components/modal-portal";
import { EASE } from "@/components/painel/painel-card";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";
import { EmblemaPatente, faixaDoNivel } from "@/components/hub/patentes/emblema";

// "Subiu de nível": o Hub lembra o último nível que a pessoa viu e,
// quando ela volta mais alto, o emblema antigo se transforma no novo com
// uma comemoração curta -- uma vez só. Troca de patente (ex.: Ouro ->
// Esmeralda) ganha a versão maior: mais faíscas e o nome da patente em
// destaque. Só conveniência local: sem storage, simplesmente não comemora.

const CHAVE = "pokersync:hub-nivel-visto";

/** Nível visto na última visita (null = primeira vez / sem storage). Já grava o atual. */
export function nivelVistoAntes(atual: number): number | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    window.localStorage.setItem(CHAVE, String(atual));
    const n = bruto == null ? null : Number(bruto);
    return n != null && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const FAISCAS = Array.from({ length: 24 }, (_, i) => {
  const ang = (i / 24) * Math.PI * 2;
  const raio = 110 + (i % 4) * 22;
  return { x: Math.cos(ang) * raio, y: Math.sin(ang) * raio, tam: i % 3 === 0 ? 6 : 4 };
});

export function SubiuDeNivel({ de, para, onFechar }: { de: number; para: number; onFechar: () => void }) {
  const reduzir = useReducedMotion();
  const novaPatente = faixaDoNivel(para) > faixaDoNivel(de);
  const [fase, setFase] = useState<"antes" | "depois">(reduzir ? "depois" : "antes");
  const cor = levelColor(para);

  useEffect(() => {
    if (reduzir) return;
    const t = window.setTimeout(() => setFase("depois"), 1100);
    return () => window.clearTimeout(t);
  }, [reduzir]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const qtdFaiscas = novaPatente ? 24 : 12;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Você subiu de nível">
        <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onFechar} aria-hidden />
        {/* Luz de fundo na cor da patente nova */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: fase === "depois" ? 0.55 : 0.15, scale: fase === "depois" ? 1 : 0.7 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{ background: `radial-gradient(circle, ${cor}, transparent 65%)` }}
        />

        <div className="relative flex flex-col items-center text-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
            className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60"
          >
            {novaPatente ? "Nova patente" : "Subiu de nível"}
          </motion.p>

          <div className="relative mt-5 grid h-[200px] w-[200px] place-items-center">
            <AnimatePresence mode="popLayout">
              {fase === "antes" ? (
                <motion.div
                  key="antes"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4, rotate: -25, filter: "blur(8px) brightness(3)" }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <EmblemaPatente nivel={de} tamanho={170} animar={false} />
                </motion.div>
              ) : (
                <motion.div
                  key="depois"
                  initial={reduzir ? false : { opacity: 0, scale: 0.3, rotate: 20, filter: "blur(10px) brightness(3)" }}
                  animate={{ opacity: 1, scale: [0.3, 1.18, 1], rotate: 0, filter: "blur(0px) brightness(1)" }}
                  transition={{ duration: 0.8, ease: EASE, times: [0, 0.6, 1] }}
                >
                  <EmblemaPatente nivel={para} tamanho={170} mostrarDivisao />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clarão + faíscas no instante da troca */}
            {fase === "depois" && !reduzir && (
              <>
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: "radial-gradient(circle, #fff, transparent 60%)" }}
                  initial={{ opacity: 0.9, scale: 0.3 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
                {FAISCAS.slice(0, qtdFaiscas).map((f, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                    style={{ width: f.tam, height: f.tam, background: i % 3 ? cor : "#fff", boxShadow: `0 0 8px ${cor}` }}
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: f.x * (novaPatente ? 1 : 0.7), y: [0, f.y * (novaPatente ? 1 : 0.7), f.y * (novaPatente ? 1 : 0.7) + 30], opacity: [1, 1, 0] }}
                    transition={{ duration: 1.3, ease: "easeOut", times: [0, 0.5, 1] }}
                  />
                ))}
              </>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: fase === "depois" ? 1 : 0, y: fase === "depois" ? 0 : 10 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
            className="mt-4"
          >
            <p className={`${novaPatente ? "text-3xl" : "text-2xl"} font-black uppercase tracking-[0.06em]`} style={{ color: cor, textShadow: `0 0 24px ${cor}99` }}>
              {novaPatente ? levelMaterial(para) : `Nível ${para}`}
            </p>
            <p className="mt-1 text-[13px] text-white/70">
              {novaPatente
                ? `Você chegou em ${levelMaterial(para)} ${levelSubTier(para)} · nível ${para}`
                : `${levelMaterial(para)} ${levelSubTier(para)}${para - de > 1 ? ` · +${para - de} níveis desde a última visita` : ""}`}
            </p>
            <button
              type="button"
              onClick={onFechar}
              className="mt-6 rounded-xl bg-ink px-6 py-2.5 text-[13.5px] font-semibold text-void transition-opacity hover:opacity-90"
              autoFocus
            >
              Continuar
            </button>
          </motion.div>
        </div>
      </div>
    </ModalPortal>
  );
}
