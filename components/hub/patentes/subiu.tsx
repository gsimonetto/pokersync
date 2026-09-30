"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ModalPortal } from "@/components/modal-portal";
import { EASE } from "@/components/painel/painel-card";
import { levelColor, levelMaterial, levelSubTier } from "@/lib/services/xp-service";
import { EmblemaPatente, faixaDoNivel } from "@/components/hub/patentes/emblema";

// "Subiu de nível": o Hub compara o nível atual com o último já
// comemorado (guardado na conta) e mostra a comemoração uma vez só.
// Nível comum: o emblema antigo vira o novo com clarão e faíscas.
// Troca de patente (ex.: Bronze -> Prata): sequência maior, em
// <NovaPatente> -- o emblema antigo carrega energia e estilhaça, raios de
// luz giram, ondas de choque, o emblema novo sobe e o nome da patente
// aparece letra a letra com confete na cor dela.

export function SubiuDeNivel({ de, para, onFechar }: { de: number; para: number; onFechar: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  return faixaDoNivel(para) > faixaDoNivel(de) ? (
    <NovaPatente de={de} para={para} onFechar={onFechar} />
  ) : (
    <NivelNovo de={de} para={para} onFechar={onFechar} />
  );
}

// Moldura comum: fundo escuro clicável e a luz na cor da patente nova.
function Palco({ cor, forte, rotulo, onFechar, children }: { cor: string; forte: boolean; rotulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden p-4" role="dialog" aria-modal="true" aria-label={rotulo}>
        <motion.div className="absolute inset-0 bg-black/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onFechar} aria-hidden />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: forte ? 0.55 : 0.15, scale: forte ? 1 : 0.7 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{ background: `radial-gradient(circle, ${cor}, transparent 65%)` }}
        />
        <div className="relative flex flex-col items-center text-center">{children}</div>
      </div>
    </ModalPortal>
  );
}

function BotaoContinuar({ onFechar }: { onFechar: () => void }) {
  return (
    <button
      type="button"
      onClick={onFechar}
      className="mt-6 rounded-xl bg-[#d4af37] px-7 py-2.5 text-[13.5px] font-semibold text-black shadow-[0_0_24px_rgba(212,175,55,0.35)] outline-none transition hover:bg-[#e2c35a] focus-visible:ring-2 focus-visible:ring-[#d4af37]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.97]"
      autoFocus
    >
      Continuar
    </button>
  );
}

const FAISCAS = Array.from({ length: 12 }, (_, i) => {
  const ang = (i / 12) * Math.PI * 2;
  const raio = 80 + (i % 3) * 16;
  return { x: Math.cos(ang) * raio, y: Math.sin(ang) * raio, tam: i % 3 === 0 ? 6 : 4 };
});

// Subida dentro da mesma patente: curta e direta.
function NivelNovo({ de, para, onFechar }: { de: number; para: number; onFechar: () => void }) {
  const reduzir = useReducedMotion();
  const [depois, setDepois] = useState(!!reduzir);
  const cor = levelColor(para);

  useEffect(() => {
    if (reduzir) return;
    const t = window.setTimeout(() => setDepois(true), 900);
    return () => window.clearTimeout(t);
  }, [reduzir]);

  return (
    <Palco cor={cor} forte={depois} rotulo="Você subiu de nível" onFechar={onFechar}>
      <motion.p
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
        className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60"
      >
        Subiu de nível
      </motion.p>

      <div className="relative mt-5 grid h-[180px] w-[180px] place-items-center">
        <AnimatePresence mode="popLayout">
          {!depois ? (
            <motion.div
              key="antes"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(6px) brightness(2.5)" }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <EmblemaPatente nivel={de} tamanho={150} animar={false} />
            </motion.div>
          ) : (
            <motion.div
              key="depois"
              initial={reduzir ? false : { opacity: 0, scale: 0.4, filter: "blur(8px) brightness(2.5)" }}
              animate={{ opacity: 1, scale: [0.4, 1.1, 1], filter: "blur(0px) brightness(1)" }}
              transition={{ duration: 0.7, ease: EASE, times: [0, 0.6, 1] }}
            >
              <EmblemaPatente nivel={para} tamanho={150} mostrarDivisao />
            </motion.div>
          )}
        </AnimatePresence>

        {depois && !reduzir && (
          <>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, #fff, transparent 60%)" }}
              initial={{ opacity: 0.8, scale: 0.3 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            {FAISCAS.map((f, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                style={{ width: f.tam, height: f.tam, background: i % 3 ? cor : "#fff", boxShadow: `0 0 8px ${cor}` }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: f.x, y: [0, f.y, f.y + 24], opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.5, 1] }}
              />
            ))}
          </>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: depois ? 1 : 0, y: depois ? 0 : 10 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
        className="mt-4"
      >
        <p className="text-2xl font-black uppercase tracking-[0.06em]" style={{ color: cor, textShadow: `0 0 24px ${cor}99` }}>
          Nível {para}
        </p>
        <p className="mt-1 text-[13px] text-white/70">
          {levelMaterial(para)} {levelSubTier(para)}
          {para - de > 1 ? ` · +${para - de} níveis desde a última visita` : ""}
        </p>
        <BotaoContinuar onFechar={onFechar} />
      </motion.div>
    </Palco>
  );
}

// Estilhaços do emblema antigo: cada um sai numa direção girando.
const ESTILHACOS = Array.from({ length: 14 }, (_, i) => {
  const ang = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const raio = 150 + (i % 4) * 40;
  return { x: Math.cos(ang) * raio, y: Math.sin(ang) * raio, giro: (i % 2 ? 1 : -1) * (120 + i * 25), tam: 10 + (i % 3) * 6 };
});

// Confete caindo do topo, espalhado na largura da tela.
const CONFETE = Array.from({ length: 36 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  atraso: (i % 9) * 0.12,
  queda: 0.7 + (i % 5) * 0.12,
  giro: (i % 2 ? 1 : -1) * (180 + (i % 4) * 90),
  largo: i % 3 === 0,
}));

type Ato = "carrega" | "estilhaca" | "revela" | "nome";

// Troca de patente: a comemoração grande, em quatro atos.
function NovaPatente({ de, para, onFechar }: { de: number; para: number; onFechar: () => void }) {
  const reduzir = useReducedMotion();
  const [ato, setAto] = useState<Ato>(reduzir ? "nome" : "carrega");
  const cor = levelColor(para);
  const corAntiga = levelColor(de);
  const nome = levelMaterial(para);

  useEffect(() => {
    if (reduzir) return;
    const tempos: [Ato, number][] = [
      ["estilhaca", 1300],
      ["revela", 1750],
      ["nome", 2700],
    ];
    const ts = tempos.map(([a, ms]) => window.setTimeout(() => setAto(a), ms));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [reduzir]);

  const revelado = ato === "revela" || ato === "nome";

  return (
    <Palco cor={revelado ? cor : corAntiga} forte={revelado} rotulo={`Nova patente: ${nome}`} onFechar={onFechar}>
      <motion.p
        initial={{ opacity: 0, letterSpacing: "0.6em" }}
        animate={{ opacity: 1, letterSpacing: "0.3em" }}
        transition={{ duration: 0.8, ease: EASE }}
        className="text-[11px] font-bold uppercase text-white/60"
      >
        Nova patente
      </motion.p>

      <div className="relative mt-6 grid h-[240px] w-[240px] place-items-center">
        {/* Raios de luz girando atrás do emblema novo */}
        {revelado && !reduzir && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{ opacity: 0.5, rotate: 360, scale: 1 }}
            transition={{ opacity: { duration: 0.6 }, scale: { duration: 0.8, ease: EASE }, rotate: { duration: 24, ease: "linear", repeat: Infinity } }}
            style={{
              background: `repeating-conic-gradient(from 0deg, ${cor}55 0deg 6deg, transparent 6deg 30deg)`,
              maskImage: "radial-gradient(circle, black 15%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle, black 15%, transparent 65%)",
            }}
          />
        )}

        {/* Ato 1: o emblema antigo treme e acumula energia */}
        <AnimatePresence>
          {ato === "carrega" && (
            <motion.div
              key="antigo"
              className="relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [1, 1.04, 1.02, 1.07], x: [0, -2, 2, -3, 3, 0], filter: ["brightness(1)", "brightness(1.4)", "brightness(2)"] }}
              exit={{ opacity: 0, scale: 1.25, filter: "brightness(4) blur(4px)" }}
              transition={{ duration: 1.25, ease: "easeIn" }}
            >
              <EmblemaPatente nivel={de} tamanho={180} animar={false} />
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-[-18px] rounded-full border-2"
                style={{ borderColor: cor, boxShadow: `0 0 30px ${cor}, inset 0 0 30px ${cor}` }}
                initial={{ opacity: 0, scale: 1.4 }}
                animate={{ opacity: [0, 0.9], scale: [1.4, 0.95] }}
                transition={{ duration: 1.2, ease: "easeIn" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ato 2: estilhaça -- clarão branco e pedaços voando */}
        {ato !== "carrega" && !reduzir && (
          <>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, #fff, transparent 62%)" }}
              initial={{ opacity: 1, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.4 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
            {ESTILHACOS.map((e, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={{
                  width: e.tam,
                  height: e.tam * 0.7,
                  background: `linear-gradient(135deg, #fff, ${corAntiga})`,
                  clipPath: "polygon(50% 0, 100% 70%, 20% 100%)",
                }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: e.x, y: [0, e.y, e.y + 60], rotate: e.giro, opacity: [1, 1, 0] }}
                transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.55, 1] }}
              />
            ))}
            {/* Ondas de choque */}
            {[0, 0.18, 0.36].map((atraso) => (
              <motion.span
                key={atraso}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: cor }}
                initial={{ opacity: 0.9, scale: 0.3 }}
                animate={{ opacity: 0, scale: 2.2 }}
                transition={{ duration: 1.1, ease: "easeOut", delay: atraso }}
              />
            ))}
          </>
        )}

        {/* Ato 3: o emblema novo sobe e assenta */}
        {revelado && (
          <motion.div
            className="relative"
            initial={reduzir ? false : { opacity: 0, scale: 0.2, y: 40, filter: "blur(12px) brightness(3)" }}
            animate={{ opacity: 1, scale: [0.2, 1.22, 0.96, 1], y: 0, filter: "blur(0px) brightness(1)" }}
            transition={{ duration: 1, ease: EASE, times: [0, 0.55, 0.8, 1] }}
          >
            <EmblemaPatente nivel={para} tamanho={200} mostrarDivisao />
          </motion.div>
        )}
      </div>

      {/* Ato 4: nome da patente letra a letra + confete */}
      <div className="mt-5 min-h-[150px]">
        {ato === "nome" && (
          <>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">
              <span style={{ color: corAntiga }}>{levelMaterial(de)}</span>
              <span className="mx-2">→</span>
              <span style={{ color: cor }}>{nome}</span>
            </p>
            <h2 className="mt-2 flex justify-center text-4xl font-black uppercase tracking-[0.08em] sm:text-5xl" aria-label={nome}>
              {Array.from(nome).map((letra, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  initial={reduzir ? false : { opacity: 0, y: 24, scale: 1.6, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
                  style={{ color: cor, textShadow: `0 0 28px ${cor}aa` }}
                >
                  {letra}
                </motion.span>
              ))}
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 + nome.length * 0.06 }}
            >
              <p className="mt-2 text-[13px] text-white/70">
                Você chegou em {nome} {levelSubTier(para)} · nível {para}
              </p>
              <BotaoContinuar onFechar={onFechar} />
            </motion.div>
          </>
        )}
      </div>

      {ato === "nome" && !reduzir && (
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          {CONFETE.map((c, i) => (
            <motion.span
              key={i}
              className="absolute top-0 rounded-[2px]"
              style={{ left: `${50 + c.x}%`, width: c.largo ? 10 : 6, height: c.largo ? 5 : 10, background: i % 4 === 0 ? "#fff" : i % 2 ? cor : `${cor}aa` }}
              initial={{ y: -20, rotate: 0, opacity: 1 }}
              animate={{ y: "105vh", rotate: c.giro, opacity: [1, 1, 0] }}
              transition={{ duration: 2.6 / c.queda, ease: "easeIn", delay: c.atraso, times: [0, 0.8, 1] }}
            />
          ))}
        </div>
      )}
    </Palco>
  );
}
