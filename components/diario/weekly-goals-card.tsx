"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchGoals, fetchSessions, fetchStudyLogs } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import type { Goal, Session, StudyLog } from "@/lib/bankroll/types";

// "Suas metas esta semana" — reaproveita o mesmo sistema de metas do
// MinhasMetasModalBody/Gestão de Banca (lib/services/bankroll-service.ts
// + lib/bankroll/calc.ts), filtrado só pras metas semanais ativas. Não
// existe hoje uma meta de "Drills" nesse sistema (só Volume de sessões e
// Estudo) — mostrar uma terceira barra inventada aqui seria dado fake,
// então o card só lista o que o jogador realmente tem cadastrado.

const GOAL_LABEL: Record<Goal["type"], string> = {
  volume: "Volume",
  estudo: "Estudo",
};

// "Ritmo bom" (>= 70% do esperado pro dia da semana atual) — sem
// created_at na meta pra saber quando ela começou, a referência usada é
// a semana corrente (segunda a domingo): dia 3 de 7 já "deveria" ter
// ~43% do alvo feito, etc. Heurística, não um cálculo exato de janela
// rolante (esse já existe em goalProgress, que usa os últimos 7 dias).
function fracaoDaSemanaAtual(): number {
  const diaIso = new Date().getDay() || 7; // domingo=0 -> 7
  return diaIso / 7;
}

export function WeeklyGoalsCard({ style }: { style?: React.CSSProperties }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [g, s, l] = await Promise.all([fetchGoals(), fetchSessions(), fetchStudyLogs()]);
        if (!alive) return;
        setGoals(g);
        setSessions(s);
        setStudyLogs(l);
      } catch {
        // sem Supabase configurado ou sem sessão: card não quebra a tela
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);
  const metasSemanais = goals.filter((g) => g.period === "semanal" && g.deadline >= hoje);
  const fracaoSemana = fracaoDaSemanaAtual();

  return (
    <section className="fade-in-up rounded-2xl border border-hairline bg-surface p-5" style={style}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">Suas metas esta semana</h2>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : metasSemanais.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nenhuma meta semanal definida ainda.{" "}
          <Link href="/modulos" className="font-semibold text-ink underline underline-offset-2 hover:text-training">
            Criar em Gestão de Banca → Minhas Metas
          </Link>
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {metasSemanais.map((g) => {
            const p = goalProgress(g, sessions, studyLogs);
            const esperadoAgora = g.target * fracaoSemana;
            const emRitmoBom = esperadoAgora > 0 && p.current / esperadoAgora >= 0.7;
            return (
              <li key={g.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {GOAL_LABEL[g.type]}
                    {emRitmoBom && <span aria-label="Em ritmo bom">🔥</span>}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-muted">
                    {p.current}/{g.target}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${p.pct >= 100 ? "bg-positive" : "bg-training"}`}
                    style={{ width: `${Math.max(4, p.pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
