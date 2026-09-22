"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cake, CalendarDays, ChevronLeft, ChevronRight, Radio, Trophy, Users } from "lucide-react";
import { fetchTeamBirthdays, fetchTeamEvents, type TeamBirthday, type TeamEvent } from "@/lib/services/team-calendar-service";
import { fetchTeamDashboardCached } from "@/lib/services/team-service";
import { fetchLiveTournaments, youtubeWatchUrl, type LiveStreamChannel } from "@/lib/services/live-stream-service";
import { fetchSessions } from "@/lib/services/bankroll-service";
import { net } from "@/lib/bankroll/calc";
import { formatBRL } from "@/lib/format";
import type { Session } from "@/lib/bankroll/types";
import { CardHint, Linha, PainelCard, Selo, TileIcone } from "./painel-card";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

// Um item do dia. `cor` vale tanto pro quadradinho de ícone quanto pra
// bolinha que marca o dia na grade -- é o que liga as duas leituras.
type Item = {
  id: string;
  tipo: "evento" | "aniversario" | "sessao" | "ao-vivo";
  titulo: string;
  detalhe: string;
  cor: string;
  icone: typeof Users;
  href?: string;
  externo?: boolean;
  selo?: string;
};

const CHAVE = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Grade do mês começando no domingo, com os espaços vazios antes do dia 1
// (null) pra alinhar as colunas — mesmo formato de um calendário de parede.
function gradeDoMes(ref: Date): (number | null)[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const totalDias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return [...Array.from({ length: primeiro.getDay() }, () => null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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

  const [eventos, setEventos] = useState<TeamEvent[]>([]);
  const [aniversarios, setAniversarios] = useState<TeamBirthday[]>([]);
  const [sessoes, setSessoes] = useState<Session[]>([]);
  const [aoVivo, setAoVivo] = useState<LiveStreamChannel[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Sem time cadastrado, a RLS devolve vazio ou erro de permissão nos
      // dois primeiros — os catches deixam o calendário funcionar assim
      // mesmo, só com as sessões do próprio jogador.
      const [ev, live, sess] = await Promise.all([
        fetchTeamEvents({ onlyUpcoming: false, limit: 200 }).catch(() => [] as TeamEvent[]),
        fetchLiveTournaments().catch(() => [] as LiveStreamChannel[]),
        fetchSessions().catch(() => [] as Session[]),
      ]);
      if (!vivo) return;
      setEventos(ev);
      setAoVivo(live);
      setSessoes(sess);
      setCarregando(false);

      // Aniversários dependem de saber quem é do time: primeiro os
      // membros, depois a RPC que só devolve quem está no meu time.
      try {
        const membros = await fetchTeamDashboardCached();
        const nivers = await fetchTeamBirthdays(membros.map((m) => m.userId));
        if (vivo) setAniversarios(nivers);
      } catch {
        // sem time ou sem permissão: calendário segue sem aniversários
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

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
        selo: `${resultado >= 0 ? "+" : ""}${formatBRL(resultado)}`,
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
          <span className="min-w-[96px] text-center text-[11px] capitalize text-muted/70">
            {mesRef ? mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : ""}
          </span>
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
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {SEMANA.map((l, i) => (
          <span key={i} className="pb-1 text-[10px] font-semibold text-muted/50">
            {l}
          </span>
        ))}
        {dias.map((dia, i) => {
          if (dia == null) return <span key={`v${i}`} />;
          const chave = CHAVE(new Date(mesRef!.getFullYear(), mesRef!.getMonth(), dia));
          const itens = porDia.get(chave) ?? [];
          const ehHoje = hoje != null && chave === CHAVE(hoje);
          const escolhido = chave === diaEscolhido;
          // Até 3 bolinhas, uma por TIPO presente no dia (não uma por
          // item): dia com cinco sessões não vira uma fileira de pontos.
          const cores = [...new Set(itens.map((it) => it.cor))].slice(0, 3);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => setDiaEscolhido(chave)}
              aria-label={`${dia} — ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
              aria-pressed={escolhido}
              className={`relative mx-auto grid h-9 w-9 place-items-center rounded-xl text-[12px] transition-colors ${
                escolhido
                  ? "bg-[#a855f7] font-semibold text-white shadow-lg shadow-[#a855f7]/30"
                  : ehHoje
                    ? "bg-white/[0.08] font-semibold text-ink ring-1 ring-inset ring-[#a855f7]/50"
                    : itens.length > 0
                      ? "text-ink hover:bg-white/[0.06]"
                      : "text-muted/60 hover:bg-white/[0.04]"
              }`}
            >
              <span className="tnum leading-none">{dia}</span>
              {cores.length > 0 && (
                <span className="absolute bottom-1 flex gap-[3px]">
                  {cores.map((c) => (
                    <span
                      key={c}
                      className="h-1 w-1 rounded-full"
                      style={{ background: escolhido ? "#ffffffcc" : c }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <p className="text-[11px] font-semibold capitalize text-muted">
          {dataEscolhida
            ? dataEscolhida.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
            : "—"}
        </p>

        {carregando || !diaEscolhido ? (
          <div className="mt-3">
            <CardHint>Carregando…</CardHint>
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
          <ul className="painel-scroll mt-3 flex max-h-[176px] flex-col gap-2 overflow-y-auto pr-1">
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
                      <span className="block truncate text-[11px] text-muted/60">{it.detalhe}</span>
                    </span>
                    {it.selo && <Selo cor={it.cor}>{it.selo}</Selo>}
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
