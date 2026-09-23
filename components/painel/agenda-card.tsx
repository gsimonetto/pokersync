"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Cake, CalendarDays, ChevronLeft, ChevronRight, Radio, Trophy, Users } from "lucide-react";
import { youtubeWatchUrl } from "@/lib/services/live-stream-service";
import { net } from "@/lib/bankroll/calc";
import { formatBRL } from "@/lib/format";
import { CardHint, EASE, Esqueleto, PainelCard, Selo } from "./painel-card";
import { usePainelDados } from "./painel-dados";
import { dataLonga, mesAno } from "./formato";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

// Um item do dia. `cor` vale tanto pro quadradinho de ícone quanto pra
// bolinha que marca o dia na grade -- é o que liga as duas leituras.
type Tipo = "evento" | "aniversario" | "sessao" | "ao-vivo";

type Item = {
  id: string;
  tipo: Tipo;
  titulo: string;
  detalhe: string;
  cor: string;
  icone: typeof Users;
  href?: string;
  externo?: boolean;
  selo?: string;
  corSelo?: string;
};

// Legenda das bolinhas: sem ela, o jogador precisava clicar num dia pra
// descobrir o que cada cor queria dizer. Só aparece o que existe no mês.
const LEGENDA: { tipo: Tipo; texto: string; cor: string }[] = [
  { tipo: "sessao", texto: "Sessões", cor: "#5AA6E0" },
  { tipo: "evento", texto: "Time", cor: "#6366F1" },
  { tipo: "aniversario", texto: "Aniversários", cor: "#E0559E" },
  { tipo: "ao-vivo", texto: "Ao vivo", cor: "#e0555a" },
];

const CHAVE = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Grade do mês começando no domingo, com os espaços vazios antes do dia 1
// (null) pra alinhar as colunas — mesmo formato de um calendário de parede.
function gradeDoMes(ref: Date): (number | null)[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const totalDias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: primeiro.getDay() }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calendário do mês, clicável: cada dia mostra bolinhas do que acontece
// nele e, ao ser escolhido, a lista abaixo diz exatamente o que é. As
// fontes são as reais do produto — eventos do Modo Time, aniversários
// dos colegas (RPC teammates_birthdays), sessões/torneios lançados na
// Gestão de Banca e transmissões ao vivo.
export function AgendaCard({
  style,
  className,
  ordem,
}: {
  style?: React.CSSProperties;
  className?: string;
  ordem?: number;
}) {
  // A data NÃO pode ser calculada durante a renderização: o servidor
  // roda em UTC e o navegador no fuso do jogador, então "hoje" sairia
  // diferente nos dois lados e o React acusava erro de hidratação
  // (a tela inteira era descartada e remontada). Só depois de montar no
  // cliente é que o calendário ganha uma data — mesma técnica do relógio
  // em painel-header.tsx.
  const [hoje, setHoje] = useState<Date | null>(null);
  const [mesRef, setMesRef] = useState<Date | null>(null);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  // Direção da última troca de mês: o mês novo entra pelo lado da seta
  // clicada (próximo = da direita), que é o que o olho espera.
  const [direcao, setDirecao] = useState(1);

  useEffect(() => {
    const agora = new Date();
    setHoje(agora);
    setMesRef(new Date(agora.getFullYear(), agora.getMonth(), 1));
    setDiaEscolhido(CHAVE(agora));
  }, []);

  // Sem time cadastrado, eventos e aniversários chegam vazios e o
  // calendário funciona só com as sessões do próprio jogador. As sessões
  // seguem o mesmo corte do Radar da Gestão de Banca.
  const { carregando, eventos, aniversarios, sessoes, aoVivo } = usePainelDados();

  // Tudo indexado por dia. Aniversário se repete todo ano, então entra
  // pelo dia/mês do mês em exibição, não pela data de nascimento crua.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    if (!mesRef || !hoje) return mapa;
    const guarda = (chave: string, item: Item) => {
      const lista = mapa.get(chave) ?? [];
      lista.push(item);
      mapa.set(chave, lista);
    };

    for (const e of eventos) {
      const d = new Date(e.startsAt);
      guarda(CHAVE(d), {
        id: `ev-${e.id}`,
        tipo: "evento",
        titulo: e.title,
        detalhe: `${e.eventType === "aula" ? "Aula" : e.eventType === "reuniao" ? "Reunião" : "Evento"} do time · ${hora(e.startsAt)}`,
        cor: "#6366F1",
        icone: Users,
        href: "/time",
      });
    }

    for (const a of aniversarios) {
      const nasc = new Date(`${a.dataNascimento}T00:00:00`);
      const noAno = new Date(mesRef.getFullYear(), nasc.getMonth(), nasc.getDate());
      guarda(CHAVE(noAno), {
        id: `niver-${a.userId}`,
        tipo: "aniversario",
        titulo: `Aniversário de ${a.nome}`,
        detalhe: "Colega de time",
        cor: "#E0559E",
        icone: Cake,
        href: "/time",
      });
    }

    for (const s of sessoes) {
      const resultado = net(s);
      guarda(s.date, {
        id: `sess-${s.id}`,
        tipo: "sessao",
        titulo: s.format || "Sessão",
        detalhe: `${s.stake ? `${s.stake} · ` : ""}buy-in ${formatBRL(s.buyIn)}`,
        cor: "#5AA6E0",
        icone: Trophy,
        href: "/banca",
        selo: `${resultado > 0 ? "+" : ""}${formatBRL(resultado)}`,
        // Resultado em verde/vermelho, como no resto do app -- em azul
        // (cor da sessão) o jogador não lia de relance se ganhou ou perdeu.
        corSelo: resultado > 0 ? "#22c55e" : resultado < 0 ? "#e0555a" : "#c4c7c8",
      });
    }

    for (const c of aoVivo) {
      guarda(CHAVE(hoje), {
        id: `live-${c.channelId}`,
        tipo: "ao-vivo",
        titulo: c.videoTitle || c.name,
        detalhe: `${c.name} · transmitindo agora`,
        cor: "#e0555a",
        icone: Radio,
        href: youtubeWatchUrl(c.videoId),
        externo: true,
        selo: "ao vivo",
      });
    }

    return mapa;
  }, [eventos, aniversarios, sessoes, aoVivo, mesRef, hoje]);

  const dias = useMemo(() => (mesRef ? gradeDoMes(mesRef) : []), [mesRef]);

  const tiposNoMes = useMemo(() => {
    const tipos = new Set<Tipo>();
    if (!mesRef) return tipos;
    const prefixo = CHAVE(mesRef).slice(0, 7);
    for (const [chave, itens] of porDia) if (chave.startsWith(prefixo)) for (const it of itens) tipos.add(it.tipo);
    return tipos;
  }, [porDia, mesRef]);
  const itensDoDia = diaEscolhido ? (porDia.get(diaEscolhido) ?? []) : [];
  const dataEscolhida = diaEscolhido ? new Date(`${diaEscolhido}T12:00:00`) : null;

  function mudarMes(passo: number) {
    setDirecao(passo);
    setMesRef((m) => (m ? new Date(m.getFullYear(), m.getMonth() + passo, 1) : m));
  }

  return (
    <PainelCard
      title="Calendário"
      icon={<CalendarDays size={15} />}
      action={
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            aria-label="Mês anterior"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-ink active:scale-90"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="relative min-w-[108px] overflow-hidden text-center text-[12px] text-muted">
            <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
              <motion.span
                key={mesRef ? CHAVE(mesRef) : "-"}
                className="block"
                initial={{ y: 10 * direcao, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10 * direcao, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {mesRef ? mesAno(mesRef) : ""}
              </motion.span>
            </AnimatePresence>
          </span>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-ink active:scale-90"
          >
            <ChevronRight size={15} />
          </button>
        </span>
      }
      style={style}
      className={className}
      ordem={ordem}
      rolagem={false}
    >
      {/* Sem barra de rolagem (pedido explícito). No card largo, grade à
          esquerda e o dia escolhido à direita; no estreito (celular e
          tablet) um embaixo do outro. No computador a grade ESTICA pra
          ocupar a altura do card e os dias encolhem se a janela for baixa
          -- nunca sobra conteúdo escondido atrás de uma rolagem. */}
      <div className="@container flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 @lg:flex-row">
          {/* Grade com linhas finas entre os dias, como uma tabela: sem elas
              os números ficavam soltos no card e o olho não sabia a que
              semana/coluna cada um pertencia. */}
          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] @lg:w-[58%]">
            <div className="grid shrink-0 grid-cols-7 border-b border-white/[0.06] bg-white/[0.02] text-center">
              {SEMANA.map((l, i) => (
                <span key={i} className="py-1.5 text-[11px] font-semibold text-muted/70">
                  {l}
                </span>
              ))}
            </div>
            <div className="relative min-h-0 xl:flex-1">
              <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
                <motion.div
                  key={mesRef ? CHAVE(mesRef) : "-"}
                  initial={{ x: 28 * direcao, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -28 * direcao, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="grid h-full grid-cols-7 text-center"
                  style={{ gridTemplateRows: `repeat(${Math.ceil(dias.length / 7)}, minmax(0, 1fr))` }}
                >
                  {/* Completa a última semana com casas vazias: sem isso as
                      linhas paravam no meio da fileira. */}
                  {[...dias, ...Array.from({ length: (7 - (dias.length % 7)) % 7 }, () => null)].map((dia, i) => {
                    const linhas = `${i % 7 > 0 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} border-white/[0.05]`;
                    if (dia == null) return <span key={`v${i}`} className={linhas} />;
                    const chave = CHAVE(new Date(mesRef!.getFullYear(), mesRef!.getMonth(), dia));
                    const itens = porDia.get(chave) ?? [];
                    const ehHoje = hoje != null && chave === CHAVE(hoje);
                    const escolhido = chave === diaEscolhido;
                    // Até 3 bolinhas, uma por TIPO presente no dia (não uma
                    // por item): dia com cinco sessões não vira uma fileira.
                    const cores = [...new Set(itens.map((it) => it.cor))].slice(0, 3);
                    return (
                      <span key={dia} className={`flex min-h-0 items-center justify-center p-0.5 ${linhas}`}>
                        <button
                          type="button"
                          onClick={() => setDiaEscolhido(chave)}
                          aria-label={`${dia} — ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                          aria-pressed={escolhido}
                          className={`relative grid h-9 w-9 place-items-center rounded-xl text-[12px] transition active:scale-90 xl:aspect-square xl:h-[min(100%,2.25rem)] xl:w-auto ${
                            escolhido
                              ? "font-semibold text-black"
                              : ehHoje
                                ? "bg-white/[0.08] font-semibold text-[#f1d78a] ring-1 ring-inset ring-[#d4af37]/60"
                                : itens.length > 0
                                  ? "text-ink hover:bg-white/[0.06]"
                                  : "text-muted/70 hover:bg-white/[0.04]"
                          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60`}
                        >
                          {/* O destaque dourado DESLIZA do dia antigo pro
                              novo (layoutId), em vez de sumir e aparecer. */}
                          {escolhido && (
                            <motion.span
                              layoutId="painel-dia-escolhido"
                              className="absolute inset-0 rounded-xl bg-[#d4af37] shadow-lg shadow-[#d4af37]/25"
                              transition={{ type: "spring", stiffness: 520, damping: 38 }}
                            />
                          )}
                          <span className="tnum relative leading-none">{dia}</span>
                          {cores.length > 0 && (
                            <span className="absolute bottom-1 flex gap-[3px]">
                              {cores.map((c) => (
                                <span
                                  key={c}
                                  className="h-1 w-1 rounded-full"
                                  style={{ background: escolhido ? "#000000b3" : c }}
                                />
                              ))}
                            </span>
                          )}
                        </button>
                      </span>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
            {tiposNoMes.size > 0 && (
              <div className="flex shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-t border-white/[0.06] px-3 py-1.5">
                {LEGENDA.filter((l) => tiposNoMes.has(l.tipo)).map((l) => (
                  <span key={l.tipo} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.cor }} />
                    {l.texto}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dia escolhido: no máximo 3 itens, o resto vira um link -- o
              card não rola, então nada pode passar do espaço. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={diaEscolhido ?? "-"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex min-h-0 flex-col"
              >
                <p className="text-[12px] font-semibold text-muted">{dataEscolhida ? dataLonga(dataEscolhida) : "—"}</p>

                {carregando || !diaEscolhido ? (
                  <div className="mt-3">
                    <Esqueleto linhas={2} />
                  </div>
                ) : itensDoDia.length === 0 ? (
                  <div className="mt-3">
                    <CardHint>
                      Nada neste dia.{" "}
                      <Link href="/time" className="font-semibold text-ink underline underline-offset-2">
                        Ver calendário do time
                      </Link>
                    </CardHint>
                  </div>
                ) : (
                  <>
                    <ul className="mt-2 flex flex-col">
                      {itensDoDia.slice(0, 3).map((it, i) => {
                        const Icone = it.icone;
                        const conteudo = (
                          // Linha compacta com fio fino: 3 itens cabem até em
                          // janela baixa, e o card nunca precisa rolar.
                          <span className="flex items-center gap-2.5 rounded-lg border-t border-white/[0.06] px-1 py-2 transition-colors hover:bg-white/[0.04]">
                            <Icone size={15} className="shrink-0" style={{ color: it.cor }} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] leading-tight">{it.titulo}</span>
                              <span className="block truncate text-[11px] leading-tight text-muted">{it.detalhe}</span>
                            </span>
                            {it.selo && (
                              <Selo cor={it.corSelo ?? it.cor} pequeno>
                                {it.selo}
                              </Selo>
                            )}
                          </span>
                        );
                        return (
                          <motion.li
                            key={it.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, ease: EASE, delay: i * 0.05 }}
                          >
                            {it.href ? (
                              it.externo ? (
                                <a href={it.href} target="_blank" rel="noreferrer" className="block">
                                  {conteudo}
                                </a>
                              ) : (
                                <Link href={it.href} className="block">
                                  {conteudo}
                                </Link>
                              )
                            ) : (
                              conteudo
                            )}
                          </motion.li>
                        );
                      })}
                    </ul>
                    {itensDoDia.length > 3 && (
                      <Link
                        href={itensDoDia[3].tipo === "sessao" ? "/banca" : "/time"}
                        className="mt-2 text-[12px] font-semibold text-[#d4af37] transition-colors hover:text-[#f1d78a]"
                      >
                        + {itensDoDia.length - 3} {itensDoDia.length - 3 === 1 ? "item" : "itens"} neste dia
                      </Link>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </div>
    </PainelCard>
  );
}
