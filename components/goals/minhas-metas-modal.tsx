"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, Check, BookOpen } from "lucide-react";
import type { Goal, GoalType, GoalPeriod, Session, StudyLog } from "@/lib/bankroll/types";
import { goalProgress } from "@/lib/bankroll/calc";
import { todayISO } from "@/lib/bankroll/format";
import {
  fetchGoals,
  addGoal,
  deleteGoal,
  fetchSessions,
  fetchStudyLogs,
  addStudyLog,
} from "@/lib/services/bankroll-service";

// Corpo reaproveitavel do modal "Minhas Metas" -- usado tanto no botao
// da Gestao de Banca quanto no card novo da tela inicial (mesma fonte
// de dados, sem duplicar logica). Busca sessions/studyLogs por conta
// propria (nao depende do estado de quem chama) pra funcionar em
// qualquer lugar que so' tenha o <Modal> em volta.

const DIAS_PADRAO: Record<GoalPeriod, number> = { semanal: 7, mensal: 30 };

function prazoPadrao(periodo: GoalPeriod): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_PADRAO[periodo]);
  return d.toISOString().slice(0, 10);
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function mesLabel(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MinhasMetasModalBody() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"ativas" | "finalizadas">("ativas");

  const [goalType, setGoalType] = useState<GoalType>("volume");
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>("semanal");
  const [goalTarget, setGoalTarget] = useState("");
  const [deadline, setDeadline] = useState(() => prazoPadrao("semanal"));
  const [deadlineTocado, setDeadlineTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [minutos, setMinutos] = useState("");
  const [registrando, setRegistrando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [g, s, l] = await Promise.all([fetchGoals(), fetchSessions(), fetchStudyLogs()]);
      setGoals(g);
      setSessions(s);
      setStudyLogs(l);
    } catch {
      setErro("Não foi possível carregar suas metas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function onPeriodoChange(p: GoalPeriod) {
    setGoalPeriod(p);
    if (!deadlineTocado) setDeadline(prazoPadrao(p));
  }

  const hoje = todayISO();
  const deadlineValido = deadline > hoje;

  async function handleAddGoal() {
    if (!goalTarget) return;
    if (!deadlineValido) {
      setErro("O prazo precisa ser uma data futura.");
      return;
    }
    setSalvando(true);
    setErro("");
    const unit = goalType === "volume" ? "sessões" : "horas";
    try {
      await addGoal({ type: goalType, period: goalPeriod, target: Number(goalTarget), unit, deadline });
      setGoalTarget("");
      setDeadlineTocado(false);
      setDeadline(prazoPadrao(goalPeriod));
      await carregar();
    } catch {
      setErro("Não foi possível criar a meta.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemoveGoal(id: string) {
    try {
      await deleteGoal(id);
      await carregar();
    } catch {
      setErro("Não foi possível remover a meta.");
    }
  }

  async function handleRegistrarEstudo() {
    const mins = Number(minutos);
    if (!mins || mins <= 0) return;
    setRegistrando(true);
    try {
      await addStudyLog({ date: hoje, minutes: mins });
      setMinutos("");
      await carregar();
    } catch {
      setErro("Não foi possível registrar o estudo.");
    } finally {
      setRegistrando(false);
    }
  }

  const ativas = useMemo(() => goals.filter((g) => g.deadline >= hoje), [goals, hoje]);
  const finalizadas = useMemo(() => goals.filter((g) => g.deadline < hoje), [goals, hoje]);

  const finalizadasPorMes = useMemo(() => {
    const grupos = new Map<string, Goal[]>();
    for (const g of finalizadas) {
      const chave = g.deadline.slice(0, 7);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(g);
    }
    return [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [finalizadas]);

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div className="space-y-4">
      {erro && <p className="text-[12px] text-negative">{erro}</p>}

      {goals.length > 0 && (
        <div className="flex gap-1 rounded-lg bg-elevated p-1 text-[12px] font-semibold">
          <button
            onClick={() => setAba("ativas")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${aba === "ativas" ? "bg-surface text-ink" : "text-muted"}`}
          >
            Ativas ({ativas.length})
          </button>
          <button
            onClick={() => setAba("finalizadas")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${aba === "finalizadas" ? "bg-surface text-ink" : "text-muted"}`}
          >
            Finalizadas ({finalizadas.length})
          </button>
        </div>
      )}

      {aba === "ativas" && (
        <div className="space-y-4">
          {ativas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma meta ativa. Crie uma abaixo.</p>
          ) : (
            <ul className="space-y-3">
              {ativas.map((g) => {
                const p = goalProgress(g, sessions, studyLogs);
                return (
                  <li key={g.id} className="rounded-lg border border-hairline bg-elevated p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">
                        {g.type === "volume" ? "Volume de sessões" : "Horas de estudo"}
                        <span className="ml-1.5 text-[11px] font-normal text-muted">
                          {g.period === "semanal" ? "semanal" : "mensal"} · até {fmtData(g.deadline)}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-semibold tnum ${p.pct >= 100 ? "text-positive" : "text-ink/85"}`}>
                          {p.current}/{g.target}
                        </span>
                        <button
                          onClick={() => handleRemoveGoal(g.id)}
                          aria-label="Remover meta"
                          className="text-muted transition-colors hover:text-negative"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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

          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-hairline p-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Tipo</label>
              <select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as GoalType)}
                className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
              >
                <option value="volume">Volume (sessões)</option>
                <option value="estudo">Estudo (horas)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Período</label>
              <select
                value={goalPeriod}
                onChange={(e) => onPeriodoChange(e.target.value as GoalPeriod)}
                className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
              >
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Alvo</label>
              <input
                placeholder="Ex: 12"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-20 rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Prazo final</label>
              <input
                type="date"
                min={hoje}
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setDeadlineTocado(true);
                }}
                className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
              />
            </div>
            <button
              onClick={handleAddGoal}
              disabled={salvando || !goalTarget || !deadlineValido}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              <Check size={14} />
              {salvando ? "Salvando…" : "Criar meta"}
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2">
            <BookOpen size={14} className="text-muted" />
            <input
              type="number"
              min={1}
              placeholder="Minutos estudados agora"
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
            />
            <button
              onClick={handleRegistrarEstudo}
              disabled={registrando || !minutos}
              className="flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-semibold text-ink disabled:opacity-50"
            >
              <Plus size={12} />
              Registrar
            </button>
          </div>
        </div>
      )}

      {aba === "finalizadas" &&
        (finalizadasPorMes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma meta finalizada ainda.</p>
        ) : (
          <div className="space-y-4">
            {finalizadasPorMes.map(([mes, itens]) => (
              <div key={mes}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted/60">{mesLabel(mes + "-01")}</p>
                <ul className="space-y-3">
                  {itens.map((g) => {
                    const p = goalProgress(g, sessions, studyLogs);
                    const atingida = p.pct >= 100;
                    return (
                      <li key={g.id} className="rounded-lg border border-hairline bg-elevated p-3 opacity-80">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-medium">
                            {g.type === "volume" ? "Volume de sessões" : "Horas de estudo"}
                            <span className="ml-1.5 text-[11px] font-normal text-muted">encerrada em {fmtData(g.deadline)}</span>
                          </span>
                          <span className={`text-[13px] font-semibold tnum ${atingida ? "text-positive" : "text-muted"}`}>
                            {p.current}/{g.target}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void">
                          <div
                            className={`h-full rounded-full ${atingida ? "bg-positive" : "bg-muted/50"}`}
                            style={{ width: `${Math.max(4, p.pct)}%` }}
                          />
                        </div>
                        {!atingida && <p className="mt-1 text-[11px] text-muted">Prazo encerrado sem bater o alvo.</p>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
