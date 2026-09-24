"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Crosshair,
  Info,
  LineChart,
  Send,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";
import { buildCoachTips } from "@/lib/bankroll/coach";
import { goalProgress } from "@/lib/bankroll/calc";
import { TOURNEY_FORMATS } from "@/lib/bankroll/format";
import { ALERTA_LABEL, assignTeamDrill, calcularScore, type TeamAlertKind } from "@/lib/services/team-service";
import { progressoPronto } from "@/lib/services/team-funnel-service";
import { EASE, Esqueleto, PainelCard, Selo, TileIcone } from "./painel-card";
import { usePainelDados, type PainelDados } from "./painel-dados";
import { num, pct } from "./formato";
import { fracaoDaSemana, situacaoMeta, textoProgresso } from "./metas";

// Memória de "já vi isso", no navegador (não no banco: é preferência de
// leitura, não precisa sincronizar entre aparelhos).
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
  /** Ação feita ali mesmo, sem sair da tela (hoje: enviar o drill de um
   *  leak do time pra todos os jogadores afetados). Devolve a frase de
   *  resultado que aparece no lugar do botão. */
  acao?: { rotulo: string; executar: () => Promise<string> };
};

// Stack curto típico de late-stage de torneio -- o mesmo que o Treino
// usava no aviso "seu maior leak na banca" (que agora mora aqui).
const STACK_CURTO_BB = 15;

// Alertas do time que não pedem decisão do coach: "lembrete_estudo" é só
// o registro de que o sistema mandou um lembrete automático.
const ALERTA_IRRELEVANTE: Set<TeamAlertKind> = new Set(["lembrete_estudo"]);

// "Ana, Bruno e mais 2" -- nomes suficientes pra o coach saber de quem
// se trata sem a dica virar uma lista.
function nomes(lista: string[]): string {
  if (lista.length <= 2) return lista.join(" e ");
  return `${lista.slice(0, 2).join(", ")} e mais ${lista.length - 2}`;
}

const PESO: Record<Nivel, number> = { ruim: 0, atencao: 1, info: 2, bom: 3 };

// Ícone por módulo de origem — o mesmo de lib/modules-data.tsx, pra
// dica de Banca parecer Banca e dica de Treino parecer Treino.
const ICONE_MODULO: Record<string, typeof Target> = {
  Banca: TrendingUp,
  Performance: LineChart,
  Revisor: BookOpen,
  Metas: Target,
  Treino: Target,
  "Leak Finder": Crosshair,
  Time: Users,
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

// Único lugar do app com as orientações automáticas. Cada módulo tinha a
// sua caixa (o "AI Coach" da Gestão de Banca, o Leak Finder do Revisor,
// o aviso de leak do Treino, o Assistente do coach e os leaks do time no
// modo Time) e tudo foi reunido aqui -- as regras são as mesmas de antes,
// só mudaram de lugar. Os dados vêm do carregador único do Painel
// (painel-dados.tsx).
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
      // Vazamento num formato de torneio: o passo prático é treinar stack
      // curto (era o botão "Focar treino" do aviso que ficava no Treino).
      const treinarStack = t.id === "worst" && t.format != null && TOURNEY_FORMATS.has(t.format);
      dicas.push({
        chave: `banca:${t.id}:${t.title}`,
        modulo: "Banca",
        cor: "#5AA6E0",
        nivel: t.level === "bad" ? "ruim" : t.level === "warn" ? "atencao" : t.level === "good" ? "bom" : "info",
        titulo: t.title,
        texto: t.text,
        href: treinarStack ? `/treino?stack=${STACK_CURTO_BB}` : "/banca",
        cta: treinarStack ? "Treinar stack curto" : "Abrir Gestão de Banca",
      });
    }
  }

  // --- Leak Finder (mãos revisadas) -------------------------------------
  // Era o card "Leaks recorrentes" do Revisor. Substitui a dica que lia
  // top_leaks da view de performance: aquela fonte chegava sem nome nem
  // contagem ("Vazamento recorrente: undefined / NaN vezes"), esta é a
  // mesma que já alimentava o Revisor e o treino sugerido.
  for (const l of d.leaksRecorrentes.slice(0, 3)) {
    dicas.push({
      chave: `leakfinder:${l.motivo}:${l.rua}:${l.ocorrencias}`,
      modulo: "Leak Finder",
      cor: "#A855F7",
      nivel: "atencao",
      titulo: `Leak recorrente: ${l.motivo}`,
      texto:
        `Apareceu ${num(l.ocorrencias)} ${l.ocorrencias === 1 ? "vez" : "vezes"}` +
        `${l.rua ? ` no ${l.rua.toLowerCase()}` : ""} nas suas mãos revisadas dos últimos 30 dias.` +
        (l.treinavel && l.drillTitulo ? ` Treino sugerido: ${l.drillTitulo}.` : ""),
      href: l.treinavel && l.drillId ? `/treino?suggestionId=${l.drillId}` : "/revisor",
      cta: l.treinavel ? "Treinar esse leak" : "Ver no Revisor",
    });
  }

  // --- Performance ------------------------------------------------------
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

  // --- Time (só coach/admin) --------------------------------------------
  // Era o Assistente do coach (aba Jogadores/Visão geral) e os "Leaks mais
  // frequentes" do time. Cada tipo de aviso vira UMA dica com os nomes,
  // não uma dica por jogador -- senão o time inteiro engolia a fila.
  const t = d.timeCoach;
  if (t) {
    const porId = new Map(t.jogadores.map((j) => [j.userId, j]));
    const nome = (id: string) => porId.get(id)?.nome ?? "Jogador";
    // Jogador pior no Score de evolução aparece primeiro na lista de nomes.
    const risco = (id: string) => {
      const j = porId.get(id);
      return j ? calcularScore(j).valor : 100;
    };
    const ordenar = (ids: string[]) => [...new Set(ids)].sort((a, b) => risco(a) - risco(b));

    const prontos = ordenar(t.cards.filter(progressoPronto).map((c) => c.playerId));
    if (prontos.length > 0) {
      dicas.push({
        chave: `time:prontos:${prontos.join(",")}`,
        modulo: "Time",
        cor: "#6366F1",
        nivel: "atencao",
        titulo: `${num(prontos.length)} ${prontos.length === 1 ? "jogador pronto" : "jogadores prontos"} pra subir de fase`,
        texto: `${nomes(prontos.map(nome))} ${prontos.length === 1 ? "bateu" : "bateram"} a meta de drills e revisões da fase atual no Funil.`,
        href: "/time/painel/funil",
        cta: "Abrir o Funil",
      });
    }

    const limite = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const parados = ordenar(
      t.cards
        .filter(
          (c) =>
            !progressoPronto(c) &&
            new Date(c.movedAt).getTime() < limite &&
            c.drillsDone === 0 &&
            c.reviewsDone === 0,
        )
        .map((c) => c.playerId),
    );
    if (parados.length > 0) {
      dicas.push({
        chave: `time:parados:${parados.join(",")}`,
        modulo: "Time",
        cor: "#6366F1",
        nivel: "atencao",
        titulo: `${num(parados.length)} ${parados.length === 1 ? "jogador parado" : "jogadores parados"} há mais de 14 dias`,
        texto: `${nomes(parados.map(nome))} não ${parados.length === 1 ? "fez" : "fizeram"} nenhum drill nem revisão desde que ${parados.length === 1 ? "entrou" : "entraram"} na fase atual.`,
        href: "/time/painel/funil",
        cta: "Abrir o Funil",
      });
    }

    const faltosos = ordenar(t.cards.filter((c) => c.eventosAusente >= 2).map((c) => c.playerId));
    if (faltosos.length > 0) {
      dicas.push({
        chave: `time:faltas:${faltosos.join(",")}`,
        modulo: "Time",
        cor: "#6366F1",
        nivel: "atencao",
        titulo: `${num(faltosos.length)} ${faltosos.length === 1 ? "jogador faltando" : "jogadores faltando"} aos eventos`,
        texto: `${nomes(faltosos.map(nome))} ${faltosos.length === 1 ? "faltou" : "faltaram"} a 2 ou mais eventos do time.`,
        href: "/time/painel/funil",
        cta: "Abrir o Funil",
      });
    }

    // Alertas agrupados por tipo ("Inatividade: Ana e Bruno").
    const porTipo = new Map<TeamAlertKind, string[]>();
    for (const a of t.alertas) {
      if (ALERTA_IRRELEVANTE.has(a.kind)) continue;
      porTipo.set(a.kind, [...(porTipo.get(a.kind) ?? []), a.playerId]);
    }
    for (const [tipo, ids] of porTipo) {
      const lista = ordenar(ids);
      dicas.push({
        chave: `time:alerta:${tipo}:${lista.join(",")}`,
        modulo: "Time",
        cor: "#6366F1",
        nivel: tipo === "inatividade" || tipo === "faltas_consecutivas" ? "ruim" : "atencao",
        titulo: `${ALERTA_LABEL[tipo]}: ${num(lista.length)} ${lista.length === 1 ? "jogador" : "jogadores"}`,
        texto: `${nomes(lista.map(nome))}. Aviso gerado nos últimos 14 dias.`,
        href: "/time/painel/funil",
        cta: "Abrir o Funil",
      });
    }

    // Leaks do time: o botão envia o drill pra todos os afetados ali mesmo.
    for (const l of t.leaks.slice(0, 3)) {
      const podeEnviar = l.treinavel && l.drillId != null;
      dicas.push({
        chave: `time:leak:${l.reasonCode}:${l.street}:${l.total}`,
        modulo: "Time",
        cor: "#6366F1",
        nivel: "atencao",
        titulo: `Leak do time: ${l.label}`,
        texto:
          `${num(l.total)} ${l.total === 1 ? "ocorrência" : "ocorrências"} em ${num(l.jogadores)} ` +
          `${l.jogadores === 1 ? "jogador" : "jogadores"}${l.street ? ` no ${l.street.toLowerCase()}` : ""}, nos últimos 30 dias.` +
          (podeEnviar && l.drillTitle ? ` Treino sugerido: ${l.drillTitle}.` : ""),
        href: "/time/painel?tab=jogadores",
        cta: "Ver jogadores",
        acao: podeEnviar
          ? {
              rotulo: "Enviar treino ao time",
              executar: async () => {
                const n = await assignTeamDrill(l.reasonCode, l.street, l.drillId!, 30);
                return n > 0
                  ? `Treino enviado para ${num(n)} ${n === 1 ? "jogador" : "jogadores"}.`
                  : "Os jogadores já estavam com esse treino recente.";
              },
            }
          : undefined,
      });
    }
  }

  return dicas.sort((a, b) => PESO[a.nivel] - PESO[b.nivel]);
}

// AI Coach — mostra UMA orientação por vez, a mais urgente primeiro.
// Assim que o jogador vê, ela é marcada como lida e dá lugar à próxima
// (pedido do usuário), então a mesma frase não fica ocupando o card
// todo dia.
export function AiCoachCard({
  style,
  className,
  ordem,
}: {
  style?: React.CSSProperties;
  className?: string;
  ordem?: number;
}) {
  const dados = usePainelDados();
  const [fila, setFila] = useState<Dica[] | null>(null);
  const [indice, setIndice] = useState(0);
  // Resultado da ação feita no próprio card (por chave da dica) e qual
  // está rodando agora -- evita clique duplo mandando o treino duas vezes.
  const [resultado, setResultado] = useState<Record<string, string>>({});
  const [executando, setExecutando] = useState<string | null>(null);

  async function rodarAcao(dica: Dica) {
    if (!dica.acao || executando) return;
    setExecutando(dica.chave);
    try {
      const msg = await dica.acao.executar();
      setResultado((r) => ({ ...r, [dica.chave]: msg }));
    } catch {
      setResultado((r) => ({ ...r, [dica.chave]: "Não deu pra enviar agora. Tente de novo." }));
    } finally {
      setExecutando(null);
    }
  }

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
      icon={<Brain size={15} />}
      action={
        atual &&
        total > 1 && (
          <span className="tnum flex items-center gap-1 overflow-hidden text-[11px] text-muted">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={indice}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {num(indice + 1)}
              </motion.span>
            </AnimatePresence>
            de {num(total)}
          </span>
        )
      }
      style={style}
      className={className}
      ordem={ordem}
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
        // Troca de dica: a atual sai pela esquerda e a próxima entra pela
        // direita -- lê como "passar pra frente" na fila.
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={atual.chave}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex flex-1 flex-col"
          >
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
            {/* Linhas finas em vez de caixinhas: o "A seguir" é apoio, não
                pode ter o mesmo peso da dica atual. Em janela baixa (menos
                de 820px de altura, no computador) ele sai, pra dica e os
                botões caberem sem barra de rolagem. */}
            {proximas.length > 0 && (
              <div className="mt-4 sm:pl-[54px] xl:[@media(max-height:819px)]:hidden">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">A seguir</p>
                <ul className="mt-1.5 flex flex-col">
                  {proximas.map((d, i) => {
                    const Icone = ICONE_MODULO[d.modulo] ?? Sparkles;
                    return (
                      <motion.li
                        key={d.chave}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, ease: EASE, delay: 0.12 + i * 0.06 }}
                      >
                        <span className="flex items-center gap-2.5 border-t border-white/[0.06] py-2">
                          <Icone size={14} className="shrink-0" style={{ color: d.cor }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/80">{d.titulo}</span>
                          <Selo cor={URGENCIA[d.nivel].cor} pequeno>
                            {URGENCIA[d.nivel].texto}
                          </Selo>
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Botões logo abaixo do conteúdo (não colados no rodapé do
                card): com poucas dicas, ficavam longe do texto a que se
                referem. */}
            <div className="flex flex-wrap items-center gap-2 pt-4 sm:pl-[54px]">
              {/* Dica com ação própria (leak do time): a ação é o botão
                  principal e o link vira secundário. Depois de rodar, o
                  botão dá lugar à frase de resultado. */}
              {atual.acao &&
                (resultado[atual.chave] ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-positive">
                    <Check size={13} />
                    {resultado[atual.chave]}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => rodarAcao(atual)}
                    disabled={executando === atual.chave}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#d4af37] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#d4af37]/20 transition hover:bg-[#e2c35a] active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
                  >
                    <Send size={13} />
                    {executando === atual.chave ? "Enviando…" : atual.acao.rotulo}
                  </button>
                ))}
              <Link
                href={atual.href}
                className={
                  atual.acao
                    ? "inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-muted transition hover:border-[#d4af37]/50 hover:text-ink active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
                    : "inline-flex items-center gap-1.5 rounded-full bg-[#d4af37] px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-[#d4af37]/20 transition hover:bg-[#e2c35a] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
                }
              >
                {atual.cta}
                <ArrowRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setIndice((i) => i + 1)}
                className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-muted transition hover:border-[#d4af37]/50 hover:text-ink active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
              >
                {proximas.length > 0 ? "Já vi, próxima" : "Já vi"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </PainelCard>
  );
}
