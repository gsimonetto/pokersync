"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { addStudyLog } from "@/lib/services/bankroll-service";
import { GlassCard } from "./glass-card";

const PRESETS = [15, 25, 50];
const RAIO = 78;
const PERIMETRO = 2 * Math.PI * RAIO;

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Timer de foco pro bloco de estudo/grind. A contagem é local (não existe
// tabela de "sessão de foco" no produto), mas o resultado NÃO morre na
// tela: ao terminar, o card oferece registrar os minutos como estudo no
// mesmo lugar que a Gestão de Banca usa (bankroll_study_logs), que é o
// que alimenta a meta de estudo em lib/bankroll/calc.ts.
export function FocusTimerCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [minutosAlvo, setMinutosAlvo] = useState(25);
  const [restante, setRestante] = useState(25 * 60);
  const [rodando, setRodando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Guarda o instante do fim em vez de decrementar um contador: aba em
  // segundo plano faz o navegador espaçar os timers, e um "-1 por tick"
  // atrasaria o relógio em vários minutos numa sessão longa.
  const fimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => {
      if (fimRef.current == null) return;
      const falta = Math.max(0, Math.round((fimRef.current - Date.now()) / 1000));
      setRestante(falta);
      if (falta === 0) setRodando(false);
    }, 250);
    return () => clearInterval(id);
  }, [rodando]);

  const trocarPreset = useCallback((min: number) => {
    setMinutosAlvo(min);
    setRestante(min * 60);
    setRodando(false);
    fimRef.current = null;
    setRegistrado(false);
    setErro(null);
  }, []);

  function alternar() {
    if (rodando) {
      setRodando(false);
      fimRef.current = null;
      return;
    }
    const base = restante > 0 ? restante : minutosAlvo * 60;
    setRestante(base);
    fimRef.current = Date.now() + base * 1000;
    setRodando(true);
    setRegistrado(false);
  }

  async function registrarEstudo() {
    setRegistrando(true);
    setErro(null);
    try {
      await addStudyLog({
        date: new Date().toISOString().slice(0, 10),
        minutes: minutosAlvo,
        note: "Sessão de foco",
      });
      setRegistrado(true);
    } catch {
      setErro("Não deu pra registrar agora.");
    } finally {
      setRegistrando(false);
    }
  }

  const progresso = 1 - restante / (minutosAlvo * 60);
  const terminou = restante === 0;

  return (
    <GlassCard title="Timer de foco" icon={<Timer size={13} />} style={style} className={className}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative grid place-items-center">
          <svg width="188" height="188" viewBox="0 0 188 188" className={rodando ? "psd-ring-live" : undefined}>
            <defs>
              <linearGradient id="psd-timer-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <circle cx="94" cy="94" r={RAIO} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <circle
              cx="94"
              cy="94"
              r={RAIO}
              fill="none"
              stroke="url(#psd-timer-grad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={PERIMETRO}
              strokeDashoffset={PERIMETRO * (1 - progresso)}
              transform="rotate(-90 94 94)"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="tnum text-4xl font-light leading-none">{mmss(restante)}</p>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
              {terminou ? "Concluído" : rodando ? "Focando" : "Foco"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={alternar}
            aria-label={rodando ? "Pausar timer" : "Iniciar timer"}
            className="psd-active flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          >
            {rodando ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => trocarPreset(minutosAlvo)}
            aria-label="Reiniciar timer"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="mt-4 flex gap-1.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => trocarPreset(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                m === minutosAlvo
                  ? "bg-white/12 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        {terminou && (
          <div className="mt-4 text-center">
            {registrado ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-positive">
                <Check size={13} /> {minutosAlvo} min registrados no estudo
              </p>
            ) : (
              <button
                type="button"
                onClick={registrarEstudo}
                disabled={registrando}
                className="rounded-full border border-[color:var(--psd-line-strong)] px-3.5 py-1.5 text-xs font-semibold text-[color:var(--psd-neon-soft)] transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                {registrando ? "Registrando…" : `Registrar ${minutosAlvo} min de estudo`}
              </button>
            )}
            {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
