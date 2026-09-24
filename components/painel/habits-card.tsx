"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Target, Trash2, TrendingUp, X } from "lucide-react";
import { addGoal, deleteGoal } from "@/lib/services/bankroll-service";
import { goalProgress } from "@/lib/bankroll/calc";
import type { GoalType } from "@/lib/bankroll/types";
import {
  BarraProgresso,
  CardHint,
  Esqueleto,
  ItemAnimado,
  Linha,
  ListaLimitada,
  PainelCard,
  Selo,
  TileIcone,
} from "./painel-card";
import { usePainelDados } from "./painel-dados";
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
export function HabitsCard({
  style,
  className,
  ordem,
}: {
  style?: React.CSSProperties;
  className?: string;
  ordem?: number;
}) {
  const { carregando, metas, setMetas, todasSessoes, logsEstudo } = usePainelDados();

  const [criando, setCriando] = useState(false);
  const [tipo, setTipo] = useState<GoalType>("volume");
  const [alvo, setAlvo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Datas só depois de montar no cliente: o servidor roda em UTC e o
  // navegador no fuso do jogador, e o React acusaria erro de hidratação.
  const [hoje, setHoje] = useState("");
  useEffect(() => {
    setHoje(new Date().toISOString().slice(0, 10));
    setPrazo(fimDaSemana());
  }, []);
  const semanais = metas.filter((g) => g.period === "semanal" && g.deadline >= hoje);

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
      ordem={ordem}
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
          {/* No máximo 3 metas à vista; a partir daí a lista rola. */}
          <ListaLimitada>
                {semanais.map((g, i) => {
                  const p = goalProgress(g, todasSessoes, logsEstudo);
                  const feito = Math.min(100, Math.round(p.pct));
                  const situacao = SITUACAO_VISUAL[situacaoMeta(p.pct)];
                  const { icone: Icone, cor } = VISUAL[g.type];
                  return (
                    <ItemAnimado key={g.id} indice={i} className="group/meta">
                      <Linha className="!p-2.5">
                        {/* Dois andares: nome + "5 de 20 sessões" + ritmo em
                            cima, barra embaixo. Compacto pra 3 itens caberem
                            no card sem barra de rolagem; o progresso fica ao
                            lado do nome e corta com reticências se faltar
                            espaço, sem empurrar o selo. */}
                        <div className="flex items-center gap-3">
                          <TileIcone cor={cor}>
                            <Icone size={14} />
                          </TileIcone>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-sm">
                                <span className="font-medium">{ROTULO[g.type]}</span>
                                <span className="tnum text-[11px] text-muted"> · {textoProgresso(g, p.current)}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                {/* Selo com o RITMO da meta (em dia / atrasada /
                                    concluída) no lugar do percentual, que só
                                    repetia o "2 de 20" logo abaixo. */}
                                <Selo cor={situacao.cor} pequeno>
                                  {situacao.texto}
                                </Selo>
                                <button
                                  type="button"
                                  onClick={() => removerMeta(g.id)}
                                  aria-label={`Apagar meta de ${ROTULO[g.type]}`}
                                  className="grid h-6 w-6 place-items-center rounded-md text-transparent transition-colors hover:text-negative focus:text-negative group-hover/meta:text-muted/60"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </span>
                            </div>
                            <BarraProgresso
                              className="mt-2 h-1.5"
                              pct={feito}
                              cor={cor}
                              fundo={`linear-gradient(90deg, ${cor}, ${cor}66)`}
                              atraso={0.45 + i * 0.06}
                            />
                          </div>
                        </div>
                      </Linha>
                    </ItemAnimado>
                  );
                })}
          </ListaLimitada>

          {semanais.length === 0 && (
            <div className="mt-3">
              <CardHint>
                Nenhuma meta ativa. Use <span className="font-semibold text-ink">Nova meta</span> para definir quanto você
                quer jogar ou estudar nesta semana.
              </CardHint>
            </div>
          )}
        </>
      )}
    </PainelCard>
  );
}
