"use client";

import { useEffect, useState } from "react";
import { Target, Plus, Check, X, Trash2 } from "lucide-react";
import {
  METRICA_LABEL,
  createPlayerGoal,
  deactivatePlayerGoal,
  fetchPlayerGoals,
  traduzErroTime,
  type GoalMetric,
  type GoalPeriod,
  type PlayerGoal,
} from "@/lib/services/team-service";

// Metas que o coach define pro jogador — janela rolante (ultimos 7 ou
// 30 dias a partir de agora). Progresso vem calculado do banco; aqui so
// exibe barra + estado. Fecha o ciclo acompanhar -> agir -> cobrar que
// faltava no Modo Team.

const METRICAS: GoalMetric[] = ["treinos", "maos_revisadas", "maos_compartilhadas"];

export function MetasCard({
  playerId,
  podeGerenciar,
}: {
  playerId: string;
  podeGerenciar: boolean;
}) {
  const [metas, setMetas] = useState<PlayerGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);

  const [metrica, setMetrica] = useState<GoalMetric>("treinos");
  const [periodo, setPeriodo] = useState<GoalPeriod>("semana");
  const [alvo, setAlvo] = useState(5);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      setMetas(await fetchPlayerGoals(playerId));
    } catch {
      // ficha do proprio jogador ou coach sem vinculo: card so nao mostra nada
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      await createPlayerGoal(playerId, metrica, periodo, alvo);
      setCriando(false);
      setAlvo(5);
      carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(goalId: string) {
    if (!confirm("Remover esta meta?")) return;
    try {
      await deactivatePlayerGoal(goalId);
      carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    }
  }

  if (loading) return null;
  if (metas.length === 0 && !podeGerenciar) return null;

  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <Target size={15} className="text-training" />
          Metas
        </h2>
        {podeGerenciar && !criando && (
          <button
            onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink/40"
          >
            <Plus size={13} />
            Nova meta
          </button>
        )}
      </div>

      {erro && <p className="mt-2 text-[12px] text-negative">{erro}</p>}

      {criando && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-elevated p-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">O quê</label>
            <select
              value={metrica}
              onChange={(e) => setMetrica(e.target.value as GoalMetric)}
              className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
            >
              {METRICAS.map((m) => (
                <option key={m} value={m}>{METRICA_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Quanto</label>
            <input
              type="number"
              min={1}
              value={alvo}
              onChange={(e) => setAlvo(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Por</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as GoalPeriod)}
              className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
            >
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={() => setCriando(false)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-hairline text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              <Check size={15} />
              {salvando ? "Salvando…" : "Criar"}
            </button>
          </div>
        </div>
      )}

      {metas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {podeGerenciar ? "Nenhuma meta ativa. Defina uma para dar direção ao estudo do jogador." : "Nenhuma meta ativa."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {metas.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            return (
              <li key={m.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">
                    {METRICA_LABEL[m.metric]} · {m.period === "semana" ? "por semana" : "por mês"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold tnum ${m.atingida ? "text-positive" : "text-ink/85"}`}>
                      {m.progress}/{m.target}
                    </span>
                    {podeGerenciar && (
                      <button
                        onClick={() => remover(m.id)}
                        aria-label="Remover meta"
                        className="text-muted transition-colors hover:text-negative"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${m.atingida ? "bg-positive" : "bg-training"}`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
                {m.atingida && <p className="mt-1 text-[11px] text-positive">Meta atingida 🎯</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
