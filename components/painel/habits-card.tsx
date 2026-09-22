"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Flame, Target, TrendingUp } from "lucide-react";
import { fetchGoals, fetchSessions, fetchStudyLogs } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import { fetchLast7DaysActivity } from "@/lib/services/xp-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import type { Goal, Session, StudyLog } from "@/lib/bankroll/types";
import { CardHint, Linha, PainelCard, Selo, TileIcone } from "./painel-card";

const ROTULO: Record<Goal["type"], string> = { volume: "Volume", estudo: "Estudo" };

// Ícone e cor por tipo de meta — mesma identidade de cor dos módulos de
// origem (volume vem da Banca, estudo vem do Revisor/estudo).
const VISUAL: Record<Goal["type"], { icone: typeof Target; cor: string }> = {
  volume: { icone: TrendingUp, cor: "#5AA6E0" },
  estudo: { icone: BookOpen, cor: "#A855F7" },
};

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
    <PainelCard
      title="Metas e hábitos"
      icon={<Target size={15} />}
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
              <Link href="/banca" className="font-semibold text-ink underline underline-offset-2">
                Criar na Gestão de Banca
              </Link>
            </CardHint>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {semanais.map((g) => {
                const p = goalProgress(g, sessions, studyLogs);
                const pct = Math.min(100, Math.round(p.pct));
                const { icone: Icone, cor } = VISUAL[g.type];
                return (
                  <li key={g.id}>
                    <Linha>
                      <div className="flex items-center gap-3">
                        <TileIcone cor={cor}>
                          <Icone size={14} />
                        </TileIcone>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">{ROTULO[g.type]}</span>
                            <span className="tnum text-xs text-muted">
                              {Math.round(p.current)}/{g.target} {g.unit}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-[width] duration-700"
                              style={{
                                width: `${pct}%`,
                                // Barra na cor da meta — o mesmo código de cor do
                                // quadradinho ao lado, pra ligar os dois num olhar.
                                background: `linear-gradient(90deg, ${cor}, ${cor}66)`,
                              }}
                            />
                          </div>
                        </div>
                        <Selo cor={pct >= 100 ? "#22c55e" : "#c4c7c8"}>{pct}%</Selo>
                      </div>
                    </Linha>
                  </li>
                );
              })}
            </ul>
          )}

          {dias && (
            <div className="mt-4">
              <Linha>
                <div className="flex items-center gap-3">
                  <TileIcone cor="#F59E0B">
                    <Flame size={14} />
                  </TileIcone>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Dias ativos</span>
                    <span className="block text-[11px] text-muted/60">nesta semana</span>
                  </span>
                  <Selo cor={dias.filter(Boolean).length >= 5 ? "#22c55e" : "#c4c7c8"}>
                    {dias.filter(Boolean).length} de 7
                  </Selo>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {dias.map((ativo, i) => (
                    <span key={i} className="flex flex-col items-center gap-1.5">
                      <span className="text-[9px] text-muted/50">{letras[i]}</span>
                      <span
                        aria-label={ativo ? "dia ativo" : "dia sem atividade"}
                        className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${
                          ativo ? "bg-ink text-void" : "border border-hairline text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </span>
                  ))}
                </div>
              </Linha>
            </div>
          )}
        </>
      )}
    </PainelCard>
  );
}
