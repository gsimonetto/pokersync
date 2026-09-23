"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cake, CalendarDays, ChevronLeft, ChevronRight, Radio, Trophy, Users } from "lucide-react";
import { youtubeWatchUrl } from "@/lib/services/live-stream-service";
import { net } from "@/lib/bankroll/calc";
import { formatBRL } from "@/lib/format";
import { CardHint, Esqueleto, Linha, PainelCard, Selo, TileIcone } from "./painel-card";
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
export function AgendaCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  // A data NÃO pode ser calculada durante a renderização: o servidor
  // roda em UTC e o navegador no fuso do jogador, então "hoje" sairia
  // diferente nos dois lados e o React acusava erro de hidratação
  // (a tela inteira era descartada e remontada). Só depois de montar no
  // cliente é que o calendário ganha uma data — mesma técnica do relógio
  // em painel-header.tsx.
  const [hoje, setHoje] = useState<Date | null>(null);
  const [mesRef, setMesRef] = useState<Date | null>(null);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);

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
            className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[108px] text-center text-[12px] text-muted">{mesRef ? mesAno(mesRef) : ""}</span>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <ChevronRight size={15} />
          </button>
        </span>
      }
      style={style}
      className={className}
    >
      {/* Grade com linhas finas entre os dias, como uma tabela: sem elas
          os números ficavam soltos no card e o olho não sabia a que
          semana/coluna cada um pertencia. Linhas a 5-6% de branco -- dão
          estrutura sem competir com o dia marcado ou as bolinhas. */}
      <div className="shrink-0 overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02] text-center">
          {SEMANA.map((l, i) => (
            <span key={i} className="py-1.5 text-[11px] font-semibold text-muted/70">
              {l}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center">
          {/* Completa a última semana com casas vazias: sem isso as linhas
              paravam no meio da fileira. */}
          {[...dias, ...Array.from({ length: (7 - (dias.length % 7)) % 7 }, () => null)].map((dia, i) => {
            const linhas = `${i % 7 > 0 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} border-white/[0.05]`;
            if (dia == null) return <span key={`v${i}`} className={linhas} />;
            const chave = CHAVE(new Date(mesRef!.getFullYear(), mesRef!.getMonth(), dia));
            const itens = porDia.get(chave) ?? [];
            const ehHoje = hoje != null && chave === CHAVE(hoje);
            const escolhido = chave === diaEscolhido;
            // Até 3 bolinhas, uma por TIPO presente no dia (não uma por
            // item): dia com cinco sessões não vira uma fileira de pontos.
            const cores = [...new Set(itens.map((it) => it.cor))].slice(0, 3);
            return (
              <span key={dia} className={`flex items-center justify-center py-0.5 ${linhas}`}>
                <button
                  type="button"
                  onClick={() => setDiaEscolhido(chave)}
                  aria-label={`${dia} — ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                  aria-pressed={escolhido}
                  className={`relative mx-auto grid h-9 w-9 place-items-center rounded-xl text-[12px] transition-colors ${
                    escolhido
                      ? "bg-[#d4af37] font-semibold text-black shadow-lg shadow-[#d4af37]/25"
                      : ehHoje
                        ? "bg-white/[0.08] font-semibold text-[#f1d78a] ring-1 ring-inset ring-[#d4af37]/60"
                        : itens.length > 0
                          ? "text-ink hover:bg-white/[0.06]"
                          : "text-muted/70 hover:bg-white/[0.04]"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60`}
                >
                  <span className="tnum leading-none">{dia}</span>
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
        </div>
      </div>

      {tiposNoMes.size > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3.5 gap-y-1">
          {LEGENDA.filter((l) => tiposNoMes.has(l.tipo)).map((l) => (
            <span key={l.tipo} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.cor }} />
              {l.texto}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-hairline pt-4">
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
          <ul className="mt-3 flex flex-col gap-2">
            {itensDoDia.map((it) => {
              const Icone = it.icone;
              const conteudo = (
                <Linha>
                  <span className="flex items-center gap-3">
                    <TileIcone cor={it.cor}>
                      <Icone size={14} />
                    </TileIcone>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{it.titulo}</span>
                      <span className="block truncate text-[11px] text-muted">{it.detalhe}</span>
                    </span>
                    {it.selo && <Selo cor={it.corSelo ?? it.cor}>{it.selo}</Selo>}
                  </span>
                </Linha>
              );
              return (
                <li key={it.id}>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PainelCard>
  );
}
