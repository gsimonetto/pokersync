"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Flame, Plus, Target, Trash2, TrendingUp, X } from "lucide-react";
import { addGoal, deleteGoal, fetchGoals, fetchSessions, fetchStudyLogs } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import { fetchLast7DaysActivity } from "@/lib/services/xp-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import type { Goal, GoalType, Session, StudyLog } from "@/lib/bankroll/types";
import { CardHint, Linha, PainelCard, Selo, TileIcone } from "./painel-card";

const ROTULO: Record<GoalType, string> = { volume: "Volume", estudo: "Estudo" };
// Unidade por tipo — a MESMA convenção do formulário da Gestão de Banca
// (components/goals/minhas-metas-modal.tsx): volume conta sessões,
// estudo conta horas. Mudar aqui desalinharia o cálculo de goalProgress.
const UNIDADE: Record<GoalType, string> = { volume: "sessões", estudo: "horas" };

const VISUAL: Record<GoalType, { icone: typeof Target; cor: string }> = {
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

// Prazo padrão de uma meta semanal: domingo desta semana. Serve como
// sugestão no formulário; o jogador pode trocar.
function fimDaSemana(): string {
  const d = new Date();
  d.setDate(d.getDate() + (7 - (d.getDay() || 7)));
  return d.toISOString().slice(0, 10);
}

// "Metas da semana": o jogador cria as próprias metas aqui mesmo, com
// barra de progresso. É o mesmo sistema de metas da Gestão de Banca
// (bankroll_goals + goalProgress), então o que for criado aqui aparece
// lá e vice-versa — não é uma lista paralela. Embaixo, a sequência de
// dias ativos vinda do Hub (xp_events).
export function HabitsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [dias, setDias] = useState<boolean[] | null>(null);
  const [drillsHoje, setDrillsHoje] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Formulário de nova meta
  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState<GoalType>("volume");
  const [alvo, setAlvo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  // Mesma precaução do calendário: data só depois de montar no cliente,
  // senão o dia calculado no servidor (UTC) diverge do dia do jogador e
  // o React descarta a árvore por erro de hidratação.
  const [hoje, setHoje] = useState("");
  const [letras, setLetras] = useState<string[]>([]);
  useEffect(() => {
    setHoje(new Date().toISOString().slice(0, 10));
    setLetras(iniciaisDaSemana());
    setPrazo(fimDaSemana());
  }, []);
  const semanais = goals.filter((g) => g.period === "semanal" && g.deadline >= hoje);

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault();
    const numero = Number(alvo);
    if (!numero || numero <= 0) {
      setErro("Informe um alvo maior que zero.");
      return;
    }
    if (prazo <= hoje) {
      setErro("O prazo precisa ser uma data futura.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criada = await addGoal({ type: tipo, period: "semanal", target: numero, unit: UNIDADE[tipo], deadline: prazo });
      setGoals((l) => [...l, criada]);
      setAlvo("");
      setCriando(false);
    } catch {
      setErro("Não deu pra salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function removerMeta(id: string) {
    const antes = goals;
    setGoals((l) => l.filter((g) => g.id !== id));
    try {
      await deleteGoal(id);
    } catch {
      setGoals(antes);
    }
  }

  return (
    <PainelCard
      title="Metas da semana"
      icon={<Target size={15} />}
      action={
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCriando((v) => !v);
              setErro(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            {criando ? <X size={12} /> : <Plus size={12} />}
            {criando ? "Cancelar" : "Nova meta"}
          </button>
        </span>
      }
      style={style}
      className={className}
    >
      {criando && (
        <form onSubmit={salvarMeta} className="mb-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px] flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted/70">Meta de</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as GoalType)}
                className="w-full rounded-xl border border-hairline bg-elevated px-2.5 py-2 text-sm focus:border-[#a855f7]/70 focus:outline-none"
              >
                <option value="volume">Volume (sessões)</option>
                <option value="estudo">Estudo (horas)</option>
              </select>
            </label>
            <label className="w-20">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted/70">Alvo</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={alvo}
                onChange={(e) => setAlvo(e.target.value)}
                placeholder="20"
                className="w-full rounded-xl border border-hairline bg-elevated px-2.5 py-2 text-sm focus:border-[#a855f7]/70 focus:outline-none"
              />
            </label>
            <label className="min-w-[130px] flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-muted/70">Até</span>
              <input
                type="date"
                value={prazo}
                min={hoje}
                onChange={(e) => setPrazo(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-elevated px-2.5 py-2 text-sm focus:border-[#a855f7]/70 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-xl bg-[#a855f7] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9333ea] disabled:opacity-40"
            >
              {salvando ? "Salvando…" : "Criar"}
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}
          <p className="mt-2 text-[11px] text-muted/60">
            A meta vale por semana e aparece também na Gestão de Banca — é o mesmo cadastro.
          </p>
        </form>
      )}

      {carregando ? (
        <CardHint>Carregando…</CardHint>
      ) : (
        <>
          {semanais.length === 0 ? (
            <CardHint>
              Nenhuma meta ativa. Use <span className="font-semibold text-ink">Nova meta</span> para definir quanto você quer jogar ou estudar nesta semana.
            </CardHint>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {semanais.map((g) => {
                const p = goalProgress(g, sessions, studyLogs);
                const pct = Math.min(100, Math.round(p.pct));
                const { icone: Icone, cor } = VISUAL[g.type];
                return (
                  <li key={g.id} className="group/meta">
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
                        <button
                          type="button"
                          onClick={() => removerMeta(g.id)}
                          aria-label={`Apagar meta de ${ROTULO[g.type]}`}
                          className="shrink-0 text-transparent transition-colors hover:text-negative focus:text-negative group-hover/meta:text-muted/50"
                        >
                          <Trash2 size={13} />
                        </button>
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
                    <span className="flex items-center gap-1.5 text-[11px] text-muted/60">
                      nesta semana
                      {drillsHoje != null && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="tnum inline-flex items-center gap-1 text-training">
                            <CheckCircle2 size={11} />
                            {drillsHoje} drill{drillsHoje === 1 ? "" : "s"} hoje
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  <Selo cor={dias.filter(Boolean).length >= 5 ? "#22c55e" : "#c4c7c8"}>
                    {dias.filter(Boolean).length} de 7
                  </Selo>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {dias.map((ativo, i) => (
                    <span key={i} className="flex flex-col items-center gap-1.5">
                      <span className="text-[9px] text-muted/50">{letras[i] ?? ""}</span>
                      <span
                        aria-label={ativo ? "dia ativo" : "dia sem atividade"}
                        className={`grid h-6 w-6 place-items-center rounded-full text-[10px] ${
                          ativo ? "bg-[#a855f7] text-white" : "border border-hairline text-transparent"
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
