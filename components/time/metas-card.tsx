"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
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
// 30 dias a partir de agora) mede o PROGRESSO, mas quem decide quando a
// meta sai de "Ativas" e vai pra "Finalizadas" e' o prazo (deadline),
// batendo o alvo ou nao (decisao 2026-09-04: meta nao pode ficar avulsa
// sem prazo). "Finalizada" (prazo passou) e "atingida" (bateu o alvo)
// sao dois estados independentes.

const METRICAS: GoalMetric[] = ["treinos", "maos_revisadas", "maos_compartilhadas"];
const DIAS_PADRAO: Record<GoalPeriod, number> = { semana: 7, mes: 30 };

function prazoPadrao(periodo: GoalPeriod): string {
  const d = new Date();
  d.setDate(d.getDate() + DIAS_PADRAO[periodo]);
  return d.toISOString().slice(0, 10);
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function MetasCard({
  playerId,
  podeGerenciar,
}: {
  playerId: string;
  podeGerenciar: boolean;
}) {
  const [metas, setMetas] = useState<PlayerGoal[]>([]);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [aba, setAba] = useState<"ativas" | "finalizadas">("ativas");

  const [metrica, setMetrica] = useState<GoalMetric>("treinos");
  const [periodo, setPeriodo] = useState<GoalPeriod>("semana");
  const [alvo, setAlvo] = useState(5);
  const [prazo, setPrazo] = useState(() => prazoPadrao("semana"));
  const [prazoTocado, setPrazoTocado] = useState(false);
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

  // Recalcula o prazo sugerido quando o periodo muda, a nao ser que o
  // coach ja tenha escolhido uma data com a mao (nao pisa em cima).
  function onPeriodoChange(p: GoalPeriod) {
    setPeriodo(p);
    if (!prazoTocado) setPrazo(prazoPadrao(p));
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const prazoValido = prazo > hojeISO;

  async function salvar() {
    if (!prazoValido) {
      setErro("O prazo precisa ser uma data futura.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await createPlayerGoal(playerId, metrica, periodo, alvo, prazo);
      setCriando(false);
      setAlvo(5);
      setPrazoTocado(false);
      setPrazo(prazoPadrao(periodo));
      carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(goalId: string) {
    if (!(await confirm({ title: "Remover meta", message: "A meta sai do painel do jogador.", confirmLabel: "Remover" }))) return;
    try {
      await deactivatePlayerGoal(goalId);
      carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    }
  }

  if (loading) return null;
  if (metas.length === 0 && !podeGerenciar) return null;

  const ativas = metas.filter((m) => !m.finalizada);
  const finalizadas = metas.filter((m) => m.finalizada);
  const listaAtual = aba === "ativas" ? ativas : finalizadas;

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
              onChange={(e) => onPeriodoChange(e.target.value as GoalPeriod)}
              className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
            >
              <option value="semana">Semana</option>
              <option value="mes">Mês</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Prazo final</label>
            <input
              type="date"
              min={hojeISO}
              value={prazo}
              onChange={(e) => {
                setPrazo(e.target.value);
                setPrazoTocado(true);
              }}
              className="rounded-lg border border-hairline bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
            />
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
              disabled={salvando || !prazoValido}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              <Check size={15} />
              {salvando ? "Salvando…" : "Criar"}
            </button>
          </div>
        </div>
      )}

      {metas.length > 0 && (
        <div className="mt-4 flex gap-1 rounded-lg bg-elevated p-1 text-[12px] font-semibold">
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

      {metas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {podeGerenciar ? "Nenhuma meta ativa. Defina uma para dar direção ao estudo do jogador." : "Nenhuma meta ativa."}
        </p>
      ) : listaAtual.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {aba === "ativas" ? "Nenhuma meta ativa no momento." : "Nenhuma meta finalizada ainda."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {listaAtual.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            return (
              <li key={m.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">
                    {METRICA_LABEL[m.metric]} · {m.period === "semana" ? "por semana" : "por mês"}
                    <span className="ml-1.5 text-[11px] font-normal text-muted">até {fmtData(m.deadline)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-semibold tnum ${m.atingida ? "text-positive" : "text-ink/85"}`}>
                      {m.progress}/{m.target}
                    </span>
                    {podeGerenciar && aba === "ativas" && (
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
                {m.finalizada && !m.atingida && <p className="mt-1 text-[11px] text-muted">Prazo encerrado sem bater o alvo.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
