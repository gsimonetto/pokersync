"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Info,
  LineChart,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { buildCoachTips } from "@/lib/bankroll/coach";
import { goalProgress } from "@/lib/bankroll/calc";
import { Esqueleto, Linha, PainelCard, Selo, TileIcone } from "./painel-card";
import { usePainelDados, type PainelDados } from "./painel-dados";
import { num, pct } from "./formato";
import { fracaoDaSemana, situacaoMeta, textoProgresso } from "./metas";

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
// Revisor (fila), as Metas e o Treino já usam nas telas deles. Os dados
// vêm do carregador único do Painel (painel-dados.tsx).
function montarDicas(d: PainelDados): Dica[] {
  const dicas: Dica[] = [];

  // --- Gestão de Banca -------------------------------------------------
  // Banca = a MESMA conta da tela de Banca (base + lucro + depósitos -
  // saques). Antes ia só a base cadastrada, e o "cobre X buy-ins" daqui
  // não batia com o de lá.
  if (d.sessoes.length > 0) {
    const tips = buildCoachTips(d.sessoes, {
      bankroll: d.bancaAtual ?? undefined,
      brmThresholds: d.limitesBrm,
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
  // Só entra vazamento com nome e contagem válidos. Veio do banco um item
  // sem esses campos e o Coach mostrou "Vazamento recorrente: undefined"
  // / "Apareceu NaN vezes" -- melhor não mostrar a dica do que mostrar lixo.
  const leaks = (d.performance?.top_leaks ?? []).filter(
    (l) => Boolean(l?.label?.trim() || l?.code?.trim()) && Number.isFinite(l?.ocorrencias) && l.ocorrencias > 0,
  );
  for (const leak of leaks.slice(0, 2)) {
    dicas.push({
      chave: `leak:${leak.code}:${leak.ocorrencias}`,
      modulo: "Performance",
      cor: "#22D3EE",
      nivel: "atencao",
      titulo: `Vazamento recorrente: ${leak.label?.trim() || leak.code}`,
      texto: `Apareceu ${num(leak.ocorrencias)} ${leak.ocorrencias === 1 ? "vez" : "vezes"} nas suas mãos revisadas. Treinar essa situação é o caminho mais curto de ganho agora.`,
      href: "/treino",
      cta: "Treinar essa situação",
    });
  }
  for (const frase of d.insights.slice(0, 3)) {
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

  // --- Revisor ----------------------------------------------------------
  const fila = d.pendentes.length;
  if (fila > 0) {
    dicas.push({
      chave: `revisor:fila:${fila}`,
      modulo: "Revisor",
      cor: "#A855F7",
      nivel: fila >= 5 ? "atencao" : "info",
      titulo: `${num(fila)} ${fila === 1 ? "mão esperando" : "mãos esperando"} revisão`,
      texto:
        fila >= 5
          ? "A fila está crescendo. Mão marcada e não revisada não vira aprendizado — reserve um bloco hoje."
          : "Revisar enquanto a mão está fresca na memória rende muito mais que revisar semanas depois.",
      href: "/revisor",
      cta: "Abrir a fila",
    });
  }

  // --- Metas -------------------------------------------------------------
  // Mesma regra de "atrasada" do card de metas (metas.ts), com a semana
  // começando no domingo como a conta de progresso. Antes o Coach contava
  // a partir da segunda e, todo domingo, dava a semana por 100% vivida.
  const hoje = new Date().toISOString().slice(0, 10);
  const fracao = fracaoDaSemana();
  for (const meta of d.metas.filter((g) => g.period === "semanal" && g.deadline >= hoje)) {
    const p = goalProgress(meta, d.todasSessoes, d.logsEstudo);
    if (situacaoMeta(p.pct) !== "atrasada") continue;
    dicas.push({
      chave: `meta:${meta.id}:atrasada`,
      modulo: "Metas",
      cor: "#E0B24C",
      nivel: "atencao",
      titulo: `Meta de ${meta.type === "volume" ? "volume" : "estudo"} atrás do ritmo`,
      texto: `Você está em ${textoProgresso(meta, p.current)} e a semana já passou de ${pct(fracao * 100, { casas: 0 })}. Dá pra recuperar distribuindo o que falta nos próximos dias.`,
      href: "/banca",
      cta: "Ver minhas metas",
    });
  }

  // --- Treino -------------------------------------------------------------
  if (d.drillsHoje === 0) {
    dicas.push({
      chave: `treino:zero:${hoje}`,
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
  const dados = usePainelDados();
  const [fila, setFila] = useState<Dica[] | null>(null);
  const [indice, setIndice] = useState(0);

  // Fila = o que ainda não foi visto. Montada UMA vez, quando os dados
  // chegam: se o jogador remove uma mão da fila do Revisor ou cria uma
  // meta, o Coach não se reembaralha debaixo dos olhos de quem está lendo
  // (a lista nova vale no próximo acesso).
  useEffect(() => {
    if (dados.carregando || fila !== null) return;
    const vistos = lerMemoria();
    setFila(montarDicas(dados).filter((d) => vistos[d.chave] == null));
  }, [dados, fila]);

  const carregando = fila === null;

  const atual = fila?.[indice] ?? null;

  // Marca como lida assim que a dica aparece na tela.
  useEffect(() => {
    if (atual) gravarMemoria({ ...lerMemoria(), [atual.chave]: Date.now() });
  }, [atual]);

  const estilo = atual ? ESTILO[atual.nivel] : ESTILO.info;
  const total = fila?.length ?? 0;
  const proximas = fila ? fila.slice(indice + 1, indice + 3) : [];

  return (
    <PainelCard
      title="AI Coach"
      icon={<Sparkles size={15} />}
      action={
        atual &&
        total > 1 && (
          <span className="tnum text-[11px] text-muted">
            {num(indice + 1)} de {num(total)}
          </span>
        )
      }
      style={style}
      className={className}
    >
      {carregando ? (
        <Esqueleto linhas={4} />
      ) : !atual ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <Check size={22} className="text-positive" />
          <p className="mt-2 text-sm font-medium">Tudo em dia por aqui</p>
          <p className="mt-1 max-w-[34ch] text-[13px] text-muted">
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
          {/* A partir do tablet, "A seguir" e os botões começam na mesma
              linha vertical do título (depois do ícone de 40px + vão de
              14px), em vez de na borda do card -- antes o bloco de baixo
              ficava "fora do eixo" do texto a que se refere. No celular
              ocupam a largura toda, que é o que cabe. */}
          {proximas.length > 0 && (
            <div className="mt-5 sm:pl-[54px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">A seguir</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {proximas.map((d) => {
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

          {/* Botões logo abaixo do conteúdo (não colados no rodapé do
              card): com poucas dicas, ficavam longe do texto a que se
              referem. */}
          <div className="flex flex-wrap items-center gap-2 pt-5 sm:pl-[54px]">
            <Link
              href={atual.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#d4af37] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#d4af37]/20 transition-colors hover:bg-[#e2c35a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
            >
              {atual.cta}
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setIndice((i) => i + 1)}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-[#d4af37]/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
            >
              {proximas.length > 0 ? "Já vi, próxima" : "Já vi"}
            </button>
          </div>
        </div>
      )}
    </PainelCard>
  );
}
