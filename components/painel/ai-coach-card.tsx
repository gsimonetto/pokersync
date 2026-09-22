"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Check, Info, LineChart, Sparkles, Target, ThumbsUp, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchBrmThresholds, fetchGoals, fetchSessions, fetchSettings, fetchStudyLogs } from "@/lib/services/bankroll-service";
import { buildCoachTips } from "@/lib/bankroll/coach";
import { goalProgress } from "@/lib/bankroll/calc";
import { fetchPlayerInsights, fetchPlayerPerformance } from "@/lib/services/performance-service";
import { listReviews } from "@/lib/services/hand-review-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { CardHint, Linha, PainelCard, Selo, TileIcone } from "./painel-card";

// Memória de "já vi isso", no navegador (não no banco: é preferência de
// leitura, não precisa sincronizar entre aparelhos). Mesmo padrão já
// usado pelo Assistente do coach em components/time/assistente-coach.tsx.
// Uma dica vista volta a poder aparecer depois de 7 dias -- se o problema
// continuar existindo daqui a uma semana, ele merece ser lembrado de novo.
const MEMORIA_KEY = "psd:coach-vistos";
const MEMORIA_EXPIRA_MS = 7 * 24 * 60 * 60 * 1000;

type Nivel = "ruim" | "atencao" | "bom" | "info";

type Dica = {
  // Identidade estável da dica. Inclui o título porque o mesmo assunto
  // com número diferente ("downswing de 12 buy-ins" -> "de 20") é uma
  // informação nova, e não pode ser engolida por um "já vi" antigo.
  chave: string;
  modulo: string;
  cor: string;
  nivel: Nivel;
  titulo: string;
  texto: string;
  href: string;
  cta: string;
};

const PESO: Record<Nivel, number> = { ruim: 0, atencao: 1, info: 2, bom: 3 };

// Ícone por módulo de origem — o mesmo de lib/modules-data.tsx, pra
// dica de Banca parecer Banca e dica de Treino parecer Treino.
const ICONE_MODULO: Record<string, typeof Target> = {
  Banca: TrendingUp,
  Performance: LineChart,
  Revisor: BookOpen,
  Metas: Target,
  Treino: Target,
};

// Selo de urgência, pra dizer em uma palavra o peso da dica (mesma ideia
// dos "High"/"Medium" da referência visual).
const URGENCIA: Record<Nivel, { texto: string; cor: string; icone: typeof Info }> = {
  ruim: { texto: "Prioridade", cor: "#e0555a", icone: AlertTriangle },
  atencao: { texto: "Atenção", cor: "#f59e0b", icone: AlertTriangle },
  bom: { texto: "Boa notícia", cor: "#22c55e", icone: ThumbsUp },
  info: { texto: "Dica", cor: "#c4c7c8", icone: Info },
};

const ESTILO: Record<Nivel, { borda: string; texto: string }> = {
  ruim: { borda: "border-negative/40", texto: "text-negative" },
  atencao: { borda: "border-evolution/40", texto: "text-evolution" },
  bom: { borda: "border-positive/40", texto: "text-positive" },
  info: { borda: "border-ink/30", texto: "text-ink" },
};

function lerMemoria(): Record<string, number> {
  try {
    const cru = JSON.parse(localStorage.getItem(MEMORIA_KEY) ?? "{}") as Record<string, number>;
    const agora = Date.now();
    // Limpa o que já expirou na leitura — senão o registro só cresce.
    return Object.fromEntries(Object.entries(cru).filter(([, quando]) => agora - quando < MEMORIA_EXPIRA_MS));
  } catch {
    // Modo privado/localStorage bloqueado: degrada pra "mostra tudo".
    return {};
  }
}

function gravarMemoria(memoria: Record<string, number>) {
  try {
    localStorage.setItem(MEMORIA_KEY, JSON.stringify(memoria));
  } catch {
    // sem localStorage: a dica volta no próximo carregamento, sem quebrar nada
  }
}

// Junta num só lugar o que cada módulo tem a dizer hoje. Nada aqui é
// texto inventado na hora: são as mesmas regras que a Gestão de Banca
// (buildCoachTips), o Performance (get_player_insights + top_leaks), o
// Revisor (fila), as Metas e o Treino já usam nas telas deles.
async function montarDicas(): Promise<Dica[]> {
  const dicas: Dica[] = [];

  const [sessoes, settings, thresholds, metas, logsEstudo, perf, insights, drillsHoje] = await Promise.allSettled([
    fetchSessions(),
    fetchSettings(),
    fetchBrmThresholds(),
    fetchGoals(),
    fetchStudyLogs(),
    fetchPlayerPerformance(),
    fetchPlayerInsights(),
    fetchTodayTrainingCount(),
  ]);

  const listaSessoes = sessoes.status === "fulfilled" ? sessoes.value : [];

  // --- Gestão de Banca -------------------------------------------------
  if (listaSessoes.length > 0) {
    const tips = buildCoachTips(listaSessoes, {
      bankroll: settings.status === "fulfilled" ? settings.value.bankroll : undefined,
      brmThresholds: thresholds.status === "fulfilled" ? thresholds.value : undefined,
    });
    for (const t of tips) {
      if (t.id === "empty") continue;
      dicas.push({
        chave: `banca:${t.id}:${t.title}`,
        modulo: "Banca",
        cor: "#5AA6E0",
        nivel: t.level === "bad" ? "ruim" : t.level === "warn" ? "atencao" : t.level === "good" ? "bom" : "info",
        titulo: t.title,
        texto: t.text,
        href: "/banca",
        cta: "Abrir Gestão de Banca",
      });
    }
  }

  // --- Performance ------------------------------------------------------
  if (perf.status === "fulfilled" && perf.value) {
    for (const leak of (perf.value.top_leaks ?? []).slice(0, 2)) {
      dicas.push({
        chave: `leak:${leak.code}:${leak.ocorrencias}`,
        modulo: "Performance",
        cor: "#22D3EE",
        nivel: "atencao",
        titulo: `Vazamento recorrente: ${leak.label ?? leak.code}`,
        texto: `Apareceu ${leak.ocorrencias} ${leak.ocorrencias === 1 ? "vez" : "vezes"} nas suas mãos revisadas. Treinar essa situação é o caminho mais curto de ganho agora.`,
        href: "/treino",
        cta: "Treinar essa situação",
      });
    }
  }
  if (insights.status === "fulfilled") {
    for (const frase of insights.value.slice(0, 3)) {
      dicas.push({
        chave: `insight:${frase}`,
        modulo: "Performance",
        cor: "#22D3EE",
        nivel: "info",
        titulo: "Comparando seus períodos",
        texto: frase,
        href: "/performance",
        cta: "Ver análise completa",
      });
    }
  }

  // --- Revisor ----------------------------------------------------------
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const pendentes = (await listReviews(data.user.id)).filter((r) => r.status !== "concluida");
      if (pendentes.length > 0) {
        dicas.push({
          chave: `revisor:fila:${pendentes.length}`,
          modulo: "Revisor",
          cor: "#A855F7",
          nivel: pendentes.length >= 5 ? "atencao" : "info",
          titulo: `${pendentes.length} ${pendentes.length === 1 ? "mão esperando" : "mãos esperando"} revisão`,
          texto:
            pendentes.length >= 5
              ? "A fila está crescendo. Mão marcada e não revisada não vira aprendizado — reserve um bloco hoje."
              : "Revisar enquanto a mão está fresca na memória rende muito mais que revisar semanas depois.",
          href: "/revisor",
          cta: "Abrir a fila",
        });
      }
    }
  } catch {
    // sem sessão: o Revisor simplesmente não contribui com dica nenhuma
  }

  // --- Metas -------------------------------------------------------------
  if (metas.status === "fulfilled" && listaSessoes.length >= 0) {
    const hoje = new Date().toISOString().slice(0, 10);
    const semanais = metas.value.filter((g) => g.period === "semanal" && g.deadline >= hoje);
    const logs = logsEstudo.status === "fulfilled" ? logsEstudo.value : [];
    // Fração da semana já vivida (segunda a domingo) — a mesma heurística
    // de ritmo usada no card de metas do Diário.
    const fracaoSemana = (new Date().getDay() || 7) / 7;
    for (const meta of semanais) {
      const p = goalProgress(meta, listaSessoes, logs);
      if (p.pct / 100 < fracaoSemana - 0.2) {
        dicas.push({
          chave: `meta:${meta.id}:atrasada`,
          modulo: "Metas",
          cor: "#E0B24C",
          nivel: "atencao",
          titulo: `Meta de ${meta.type === "volume" ? "volume" : "estudo"} atrás do ritmo`,
          texto: `Você está em ${Math.round(p.current)} de ${meta.target} ${meta.unit} e a semana já passou de ${Math.round(fracaoSemana * 100)}%. Dá pra recuperar distribuindo o que falta nos próximos dias.`,
          href: "/banca",
          cta: "Ver minhas metas",
        });
      }
    }
  }

  // --- Treino -------------------------------------------------------------
  if (drillsHoje.status === "fulfilled" && drillsHoje.value === 0) {
    dicas.push({
      chave: `treino:zero:${new Date().toISOString().slice(0, 10)}`,
      modulo: "Treino",
      cor: "#2FB89A",
      nivel: "info",
      titulo: "Nenhum drill hoje ainda",
      texto: "Dez minutos de drill já mantêm a sequência viva e fixam a decisão que você revisou ontem.",
      href: "/treino",
      cta: "Começar um drill",
    });
  }

  return dicas.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
}

// AI Coach — mostra UMA orientação por vez, a mais urgente primeiro.
// Assim que o jogador vê, ela é marcada como lida e dá lugar à próxima
// (pedido do usuário), então a mesma frase não fica ocupando o card
// todo dia.
export function AiCoachCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [memoria, setMemoria] = useState<Record<string, number>>({});
  const [indice, setIndice] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setMemoria(lerMemoria());
    (async () => {
      const lista = await montarDicas().catch(() => [] as Dica[]);
      if (!vivo) return;
      setDicas(lista);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Fila = o que ainda não foi visto. Calculada uma vez por carregamento
  // (a memória só é relida no próximo acesso) pra que marcar a dica atual
  // como lida não a faça sumir debaixo dos olhos de quem está lendo.
  const fila = useMemo(() => {
    if (carregando) return [];
    return dicas.filter((d) => memoria[d.chave] == null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dicas, carregando]);

  const atual = fila[indice] ?? null;

  const marcarVista = useCallback((chave: string) => {
    const atualizada = { ...lerMemoria(), [chave]: Date.now() };
    gravarMemoria(atualizada);
    setMemoria(atualizada);
  }, []);

  // Marca como lida assim que a dica aparece na tela.
  useEffect(() => {
    if (atual) marcarVista(atual.chave);
  }, [atual, marcarVista]);

  const estilo = atual ? ESTILO[atual.nivel] : ESTILO.info;
  const restantes = Math.max(0, fila.length - indice - 1);

  return (
    <PainelCard
      title="AI Coach"
      icon={<Sparkles size={15} />}
      action={
        fila.length > 0 && (
          <span className="tnum text-[11px] text-muted/60">
            {Math.min(indice + 1, fila.length)} de {fila.length}
          </span>
        )
      }
      style={style}
      className={className}
    >
      {carregando ? (
        <CardHint>Lendo seus módulos…</CardHint>
      ) : !atual ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <Check size={22} className="text-positive" />
          <p className="mt-2 text-sm font-medium">Tudo em dia por aqui</p>
          <p className="mt-1 max-w-[34ch] text-[13px] text-muted/70">
            Você já viu tudo que era relevante hoje. Volte depois de jogar, revisar ou treinar.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="flex items-start gap-3.5">
            <TileIcone cor={atual.cor} grande>
              {(() => {
                const Icone = ICONE_MODULO[atual.modulo] ?? Sparkles;
                return <Icone size={17} />;
              })()}
            </TileIcone>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: atual.cor }}>
                  {atual.modulo}
                </span>
                <Selo cor={URGENCIA[atual.nivel].cor}>
                  {(() => {
                    const Icone = URGENCIA[atual.nivel].icone;
                    return <Icone size={10} />;
                  })()}
                  {URGENCIA[atual.nivel].texto}
                </Selo>
              </div>
              <h3 className={`mt-1.5 text-[17px] font-semibold leading-snug ${estilo.texto}`}>{atual.titulo}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{atual.texto}</p>
            </div>
          </div>

          {/* O que vem depois — mostra que o Coach tem fila, e o jogador
              já sabe o que o espera antes de clicar em "Já vi". */}
          {fila.length > indice + 1 && (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted/50">A seguir</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {fila.slice(indice + 1, indice + 4).map((d) => {
                  const Icone = ICONE_MODULO[d.modulo] ?? Sparkles;
                  return (
                    <li key={d.chave}>
                      <Linha className="px-3 py-2">
                        <span className="flex items-center gap-2.5">
                          <TileIcone cor={d.cor}>
                            <Icone size={12} />
                          </TileIcone>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{d.titulo}</span>
                          <Selo cor={URGENCIA[d.nivel].cor}>{URGENCIA[d.nivel].texto}</Selo>
                        </span>
                      </Linha>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              href={atual.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#a855f7] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#a855f7]/25 transition-colors hover:bg-[#9333ea]"
            >
              {atual.cta}
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setIndice((i) => i + 1)}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-white/30 hover:text-ink"
            >
              {restantes > 0 ? `Já vi · próxima (${restantes})` : "Já vi"}
            </button>
          </div>
        </div>
      )}
    </PainelCard>
  );
}
