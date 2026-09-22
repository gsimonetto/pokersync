"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Flame, Plus, Target, Trash2, TrendingUp, X } from "lucide-react";
import { addGoal, deleteGoal } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import type { GoalType } from "@/lib/bankroll/types";
import { CardHint, Esqueleto, Linha, PainelCard, Selo, TileIcone } from "./painel-card";
import { usePainelDados } from "./painel-dados";
import { num } from "./formato";
import { SITUACAO_VISUAL, situacaoMeta, textoProgresso } from "./metas";

const ROTULO: Record<GoalType, string> = { volume: "Volume", estudo: "Estudo" };
// Unidade gravada por tipo -- a MESMA convenção do formulário da Gestão
// de Banca (components/goals/minhas-metas-modal.tsx): volume em sessões,
// estudo em horas.
const UNIDADE: Record<GoalType, string> = {
  volume: "sessões",
  estudo: "horas",
};

const VISUAL: Record<GoalType, { icone: typeof Target; cor: string }> = {
  volume: { icone: TrendingUp, cor: "#5AA6E0" },
  estudo: { icone: BookOpen, cor: "#A855F7" },
};

const OURO = "#d4af37";

// Iniciais dos últimos 7 dias, do mais antigo pro de hoje -- mesma ordem
// que fetchLast7DaysActivity() devolve.
function iniciaisDaSemana(): string[] {
  const letras = ["D", "S", "T", "Q", "Q", "S", "S"];
  const hoje = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => letras[(hoje - 6 + i + 7) % 7]);
}

// Chave de dia no fuso do jogador (não em UTC): uma mão importada às 23h
// de segunda tem que contar na segunda, não na terça.
function chaveLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Prazo padrão de uma meta semanal: sábado desta semana, último dia do
// período que goalProgress conta (domingo a sábado). No próprio sábado
// sugere o da semana que vem -- o prazo precisa ser uma data futura.
function fimDaSemana(): string {
  const d = new Date();
  const faltam = 6 - d.getDay();
  d.setDate(d.getDate() + (faltam === 0 ? 7 : faltam));
  return d.toISOString().slice(0, 10);
}

// "Metas da semana": o jogador cria as próprias metas aqui, com barra de
// progresso. É o mesmo sistema de metas da Gestão de Banca (bankroll_goals
// + goalProgress), então o que for criado aqui aparece lá e vice-versa.
// Embaixo, "Sua semana": dias ativos (xp_events) e volume de mãos
// importadas por dia, com o total da semana anterior pra comparar.
export function HabitsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const { carregando, metas, setMetas, todasSessoes, logsEstudo, diasAtivos7, drillsHoje, maos14d } = usePainelDados();

  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState<GoalType>("volume");
  const [alvo, setAlvo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Datas só depois de montar no cliente: o servidor roda em UTC e o
  // navegador no fuso do jogador, e o React acusaria erro de hidratação.
  const [hoje, setHoje] = useState("");
  const [letras, setLetras] = useState<string[]>([]);
  useEffect(() => {
    setHoje(new Date().toISOString().slice(0, 10));
    setLetras(iniciaisDaSemana());
    setPrazo(fimDaSemana());
  }, []);
  const semanais = metas.filter((g) => g.period === "semanal" && g.deadline >= hoje);

  // Volume de mãos IMPORTADAS por dia nos últimos 7 dias (mesma regra do
  // Performance: mão colada à mão não conta), na ordem das bolinhas de
  // dias ativos, mais o total dos 7 dias anteriores. A data é a da
  // importação (hand_reviews.created_at), que é o que o banco guarda.
  const volume = useMemo(() => {
    if (!maos14d || !hoje) return null;
    const agora = new Date();
    const dias7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(agora);
      d.setDate(agora.getDate() - (6 - i));
      return chaveLocal(d);
    });
    const porDia = new Map<string, number>();
    let anterior = 0;
    const inicioAnterior = new Date(agora);
    inicioAnterior.setDate(agora.getDate() - 13);
    const chaveInicioAnterior = chaveLocal(inicioAnterior);
    for (const r of maos14d) {
      const chave = chaveLocal(new Date(r.playedAt));
      if (dias7.includes(chave)) porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
      else if (chave >= chaveInicioAnterior && chave < dias7[0]) anterior++;
    }
    const contagens = dias7.map((c) => porDia.get(c) ?? 0);
    return {
      contagens,
      semana: contagens.reduce((a, b) => a + b, 0),
      anterior,
      maximo: Math.max(1, ...contagens),
    };
  }, [maos14d, hoje]);

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
      const criada = await addGoal({
        type: tipo,
        period: "semanal",
        target: numero,
        unit: UNIDADE[tipo],
        deadline: prazo,
      });
      setMetas((l) => [...l, criada]);
      setAlvo("");
      setCriando(false);
    } catch {
      setErro("Não deu pra salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function removerMeta(id: string) {
    const antes = metas;
    setMetas((l) => l.filter((g) => g.id !== id));
    try {
      await deleteGoal(id);
    } catch {
      setMetas(antes);
    }
  }

  const campo =
    "w-full rounded-xl border border-hairline bg-elevated px-2.5 py-2 text-sm focus:border-[#d4af37]/70 focus:outline-none";

  return (
    <PainelCard
      title="Metas da semana"
      icon={<Target size={15} />}
      action={
        <button
          type="button"
          onClick={() => {
            setCriando((v) => !v);
            setErro(null);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-[#d4af37]/50 hover:text-[#f1d78a]"
        >
          {criando ? <X size={12} /> : <Plus size={12} />}
          {criando ? "Cancelar" : "Nova meta"}
        </button>
      }
      style={style}
      className={className}
    >
      {criando && (
        <form onSubmit={salvarMeta} className="mb-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px] flex-1">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted/80">Meta de</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as GoalType)} className={campo}>
                <option value="volume">Volume (sessões)</option>
                <option value="estudo">Estudo (horas)</option>
              </select>
            </label>
            <label className="w-20">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted/80">Alvo</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={alvo}
                onChange={(e) => setAlvo(e.target.value)}
                placeholder="20"
                className={campo}
              />
            </label>
            <label className="min-w-[130px] flex-1">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-muted/80">Até</span>
              <input
                type="date"
                value={prazo}
                min={hoje}
                onChange={(e) => setPrazo(e.target.value)}
                className={campo}
              />
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-xl bg-[#d4af37] px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e2c35a] disabled:opacity-40"
            >
              {salvando ? "Salvando…" : "Criar"}
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}
          <p className="mt-2 text-[11px] text-muted/80">
            A meta vale por semana e aparece também na Gestão de Banca — é o mesmo cadastro.
          </p>
        </form>
      )}

      {carregando ? (
        <Esqueleto linhas={3} altura={58} />
      ) : (
        <>
          {semanais.length === 0 ? (
            <CardHint>
              Nenhuma meta ativa. Use <span className="font-semibold text-ink">Nova meta</span> para definir quanto você
              quer jogar ou estudar nesta semana.
            </CardHint>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {semanais.map((g) => {
                const p = goalProgress(g, todasSessoes, logsEstudo);
                const feito = Math.min(100, Math.round(p.pct));
                const situacao = SITUACAO_VISUAL[situacaoMeta(p.pct)];
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
                            <span className="tnum text-xs text-muted">{textoProgresso(g, p.current)}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-[width] duration-700"
                              style={{
                                width: `${feito}%`,
                                background: `linear-gradient(90deg, ${cor}, ${cor}66)`,
                              }}
                            />
                          </div>
                        </div>
                        {/* Selo com o RITMO da meta (em dia / atrasada /
                            concluída) no lugar do percentual, que só
                            repetia o "2 de 20" ao lado. */}
                        <Selo cor={situacao.cor}>{situacao.texto}</Selo>
                        <button
                          type="button"
                          onClick={() => removerMeta(g.id)}
                          aria-label={`Apagar meta de ${ROTULO[g.type]}`}
                          className="shrink-0 text-transparent transition-colors hover:text-negative focus:text-negative group-hover/meta:text-muted/60"
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

          {diasAtivos7 && (
            <div className="mt-4">
              <Linha>
                <div className="flex items-center gap-3">
                  <TileIcone cor="#F59E0B">
                    <Flame size={14} />
                  </TileIcone>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Sua semana</span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted/80">
                      {volume ? (
                        <span className="tnum">
                          <span className="font-semibold text-ink/90">{num(volume.semana)}</span> mãos
                          {volume.anterior > 0 && <> · {num(volume.anterior)} na anterior</>}
                        </span>
                      ) : (
                        <span>dias ativos</span>
                      )}
                      {drillsHoje != null && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="tnum inline-flex items-center gap-1 text-training">
                            <CheckCircle2 size={11} />
                            {num(drillsHoje)} drill{drillsHoje === 1 ? "" : "s"} hoje
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                  <Selo cor={diasAtivos7.filter(Boolean).length >= 5 ? "#22c55e" : "#c4c7c8"}>
                    {diasAtivos7.filter(Boolean).length} de 7 dias
                  </Selo>
                </div>
                {/* Cada coluna é um dia: número de mãos, barrinha (altura
                    relativa ao dia mais cheio) e bolinha de dia ativo. O
                    número fica sempre à vista -- antes só aparecia
                    passando o mouse, e no celular não dava pra ver. */}
                <div className="mt-3 flex items-end justify-between">
                  {diasAtivos7.map((ativo, i) => {
                    const qtd = volume?.contagens[i] ?? 0;
                    const temMaos = volume != null && volume.semana > 0;
                    return (
                      <span key={i} className="flex min-w-[26px] flex-col items-center gap-1">
                        {temMaos && (
                          <>
                            <span className="tnum h-3.5 text-[11px] leading-none text-muted/80">
                              {qtd > 0 ? num(qtd) : ""}
                            </span>
                            <span className="flex h-5 items-end">
                              <span
                                className="w-1.5 rounded-full"
                                style={{
                                  height: qtd > 0 ? `${Math.max(3, Math.round((qtd / volume.maximo) * 20))}px` : "2px",
                                  background: qtd > 0 ? OURO : "rgba(255,255,255,0.12)",
                                }}
                              />
                            </span>
                          </>
                        )}
                        <span className="text-[11px] text-muted/70">{letras[i] ?? ""}</span>
                        <span
                          aria-label={ativo ? "dia ativo" : "dia sem atividade"}
                          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                            ativo ? "bg-[#d4af37] text-black" : "border border-hairline text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </span>
                    );
                  })}
                </div>
              </Linha>
            </div>
          )}
        </>
      )}
    </PainelCard>
  );
}
