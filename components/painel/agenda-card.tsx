"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Radio } from "lucide-react";
import { fetchTeamEvents, type TeamEvent } from "@/lib/services/team-calendar-service";
import { fetchLiveTournaments, youtubeWatchUrl, type LiveStreamChannel } from "@/lib/services/live-stream-service";
import { CardHint, PainelCard } from "./painel-card";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Grade do mês atual começando no domingo, com os espaços vazios antes do
// dia 1 (null) pra alinhar as colunas — mesmo formato de um calendário
// de parede.
function gradeDoMes(ref: Date): (number | null)[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const totalDias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const vazios = Array.from({ length: primeiro.getDay() }, () => null);
  return [...vazios, ...Array.from({ length: totalDias }, (_, i) => i + 1)];
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diaDe(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  if (chaveDia(d) === chaveDia(hoje)) return "Hoje";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Agenda compacta: calendário do mês com os dias que têm compromisso
// marcados, mais a lista do que vem a seguir. As fontes são as reais —
// eventos do Modo Time (team_events) e transmissões ao vivo
// (live-stream-service), as mesmas que o Diário já usa. Agenda pessoal
// de estudo ainda não tem tabela própria no produto, então nada é
// inventado aqui.
export function AgendaCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [eventos, setEventos] = useState<TeamEvent[]>([]);
  const [aoVivo, setAoVivo] = useState<LiveStreamChannel[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [ev, live] = await Promise.all([
        // Sem time cadastrado a RLS devolve vazio ou erro — os dois casos
        // caem aqui sem quebrar o card.
        fetchTeamEvents({ onlyUpcoming: true, limit: 20 }).catch(() => [] as TeamEvent[]),
        fetchLiveTournaments().catch(() => [] as LiveStreamChannel[]),
      ]);
      if (!vivo) return;
      setEventos(ev);
      setAoVivo(live);
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Data de referência fixada uma vez por montagem: se fosse `new Date()`
  // a cada render, a grade do mês seria recalculada à toa e o eslint de
  // hooks reclamaria das dependências.
  const [hoje] = useState(() => new Date());
  const dias = useMemo(() => gradeDoMes(hoje), [hoje]);
  const comEvento = useMemo(() => {
    const set = new Set<number>();
    for (const e of eventos) {
      const d = new Date(e.startsAt);
      if (d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) set.add(d.getDate());
    }
    return set;
  }, [eventos, hoje]);

  return (
    <PainelCard
      title="Próximas sessões"
      icon={<CalendarDays size={13} />}
      action={
        <span className="text-[11px] capitalize text-muted/70">
          {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </span>
      }
      style={style}
      className={className}
    >
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {SEMANA.map((l, i) => (
          <span key={i} className="text-[10px] font-semibold text-muted/50">
            {l}
          </span>
        ))}
        {dias.map((dia, i) => {
          if (dia == null) return <span key={`v${i}`} />;
          const ehHoje = dia === hoje.getDate();
          const temEvento = comEvento.has(dia);
          return (
            <span key={dia} className="relative grid place-items-center">
              <span
                className={`tnum grid h-7 w-7 place-items-center rounded-full text-[11px] ${
                  ehHoje ? "bg-ink font-semibold text-void" : "text-muted"
                }`}
              >
                {dia}
              </span>
              {temEvento && !ehHoje && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-ink" />
              )}
            </span>
          );
        })}
      </div>

      <div className="mt-4 border-t border-hairline pt-3.5">
        {carregando ? (
          <CardHint>Carregando…</CardHint>
        ) : aoVivo.length === 0 && eventos.length === 0 ? (
          <CardHint>
            Nada agendado.{" "}
            <Link href="/time" className="font-semibold text-ink underline underline-offset-2">
              Ver calendário do time
            </Link>
          </CardHint>
        ) : (
          <ul className="painel-scroll flex max-h-[150px] flex-col gap-2.5 overflow-y-auto pr-1">
            {aoVivo.slice(0, 2).map((c) => (
              <li key={c.channelId}>
                <a
                  href={youtubeWatchUrl(c.videoId)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                >
                  <span className="h-8 w-[3px] shrink-0 rounded-full bg-negative" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.videoTitle || c.name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-negative">
                      <Radio size={10} /> ao vivo · {c.name}
                    </span>
                  </span>
                </a>
              </li>
            ))}
            {eventos.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-2.5">
                <span className="h-8 w-[3px] shrink-0 rounded-full bg-ink/60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{e.title}</span>
                  <span className="block text-[11px] text-muted/70">
                    {diaDe(e.startsAt)} · {horaDe(e.startsAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PainelCard>
  );
}
