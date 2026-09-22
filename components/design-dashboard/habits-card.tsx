"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Target } from "lucide-react";
import { fetchGoals, fetchSessions, fetchStudyLogs } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import { fetchLast7DaysActivity } from "@/lib/services/xp-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import type { Goal, Session, StudyLog } from "@/lib/bankroll/types";
import { CardHint, GlassCard } from "./glass-card";

const ROTULO: Record<Goal["type"], string> = { volume: "Volume", estudo: "Estudo" };

// Iniciais dos últimos 7 dias, do mais antigo pro de hoje — mesma ordem
// que fetchLast7DaysActivity() devolve.
function iniciaisDaSemana(): string[] {
  const letras = ["D", "S", "T", "Q", "Q", "S", "S"];
  const hoje = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => letras[(hoje - 6 + i + 7) % 7]);
}

// "Metas e hábitos": junta as metas semanais reais do jogador (mesmo
// sistema da Gestão de Banca) com a sequência de dias ativos do Hub
// (xp_events). Não existe hoje uma contagem de drills POR DIA da semana
// — só a de hoje (fetchTodayTrainingCount) —, então o card mostra o
// número de hoje em vez de inventar uma barrinha por dia.
export function HabitsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [dias, setDias] = useState<boolean[] | null>(null);
  const [drillsHoje, setDrillsHoje] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [g, s, l, d, t] = await Promise.allSettled([
        fetchGoals(),
        fetchSessions(),
        fetchStudyLogs(),
        fetchLast7DaysActivity(),
        fetchTodayTrainingCount(),
      ]);
      if (!vivo) return;
      if (g.status === "fulfilled") setGoals(g.value);
      if (s.status === "fulfilled") setSessions(s.value);
      if (l.status === "fulfilled") setStudyLogs(l.value);
      if (d.status === "fulfilled") setDias(d.value);
      if (t.status === "fulfilled") setDrillsHoje(t.value);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);
  const semanais = goals.filter((g) => g.period === "semanal" && g.deadline >= hoje);
  const letras = iniciaisDaSemana();

  return (
    <GlassCard
      title="Metas e hábitos"
      icon={<Target size={13} />}
      action={
        drillsHoje != null && (
          <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-training/12 px-2.5 py-1 text-[11px] font-semibold text-training">
            <CheckCircle2 size={12} />
            {drillsHoje} drill{drillsHoje === 1 ? "" : "s"} hoje
          </span>
        )
      }
      style={style}
      className={className}
    >
      {carregando ? (
        <CardHint>Carregando…</CardHint>
      ) : (
        <>
          {semanais.length === 0 ? (
            <CardHint>
              Nenhuma meta semanal ativa.{" "}
              <Link href="/banca" className="font-semibold text-[color:var(--psd-neon-soft)] underline underline-offset-2">
                Criar na Gestão de Banca
              </Link>
            </CardHint>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {semanais.map((g) => {
                const p = goalProgress(g, sessions, studyLogs);
                const pct = Math.min(100, Math.round(p.pct));
                return (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{ROTULO[g.type]}</span>
                      <span className="tnum text-xs text-white/50">
                        {Math.round(p.current)}/{g.target} {g.unit}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, #c084fc, #6366f1)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {dias && (
            <div className="mt-5 border-t border-white/8 pt-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">Últimos 7 dias</p>
              <div className="mt-2.5 flex items-center justify-between">
                {dias.map((ativo, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-white/35">{letras[i]}</span>
                    <span
                      aria-label={ativo ? "dia ativo" : "dia sem atividade"}
                      className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${
                        ativo ? "psd-active text-white" : "border border-white/10 text-transparent"
                      }`}
                    >
                      {ativo ? "✓" : "·"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
