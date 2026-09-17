"use client";

import { useEffect, useState } from "react";
import { BookOpen, Users } from "lucide-react";
import { fetchTeamEvents, type TeamEvent } from "@/lib/services/team-calendar-service";
import { fetchLiveTournaments, youtubeWatchUrl, type LiveStreamChannel } from "@/lib/services/live-stream-service";

// "Hoje na sua agenda" — junta transmissões ao vivo (BSOP/WSOP, ver
// live-stream-service.ts) com os próximos eventos de time (mesma fonte
// que /time usa, team-calendar-service.ts). Eventos particulares/estudo
// AINDA NÃO têm uma fonte de dados própria no produto — ver TODO abaixo.
export function AgendaCard({ style }: { style?: React.CSSProperties }) {
  const [liveChannels, setLiveChannels] = useState<LiveStreamChannel[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [live, events] = await Promise.all([
        fetchLiveTournaments().catch(() => [] as LiveStreamChannel[]),
        // Sem time (ou sem torneios cadastrados), a RLS de team_events
        // devolve lista vazia ou lança erro de permissão — os dois casos
        // caem no catch, sem quebrar o card pra quem não tem time.
        fetchTeamEvents({ onlyUpcoming: true, limit: 3 }).catch(() => [] as TeamEvent[]),
      ]);
      if (!alive) return;
      setLiveChannels(live);
      setTeamEvents(events);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // TODO: eventos particulares/estudo (agenda pessoal do jogador, fora
  // do Modo Team) ainda não têm tabela/serviço próprio no produto. Assim
  // que existir uma fonte real, ela entra aqui — sem mockar linha nenhuma
  // enquanto isso.

  const semNadaAgora = !loading && liveChannels.length === 0 && teamEvents.length === 0;

  return (
    <section className="fade-in-up rounded-2xl border border-hairline bg-surface p-5" style={style}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted">Hoje na sua agenda</h2>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Carregando…</p>
      ) : semNadaAgora ? (
        <p className="mt-4 text-sm text-muted">Nenhum evento por enquanto.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {liveChannels.map((c, i) => (
            <li key={c.channelId} className={i > 0 ? "border-t border-hairline pt-3 pb-3" : "pb-3"}>
              <a
                href={youtubeWatchUrl(c.videoId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 transition-opacity hover:opacity-80"
              >
                <LivePulseIcon />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{c.name} ao vivo</span>
                  {c.videoTitle && <span className="block truncate text-xs text-muted">{c.videoTitle}</span>}
                </span>
              </a>
            </li>
          ))}

          {teamEvents.map((e, i) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 py-3 ${
                i > 0 || liveChannels.length > 0 ? "border-t border-hairline" : ""
              }`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
                <Users size={15} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{e.title}</span>
                <span className="block text-xs text-muted">{fmtEventoQuando(e.startsAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Círculo pulsante vermelho — único emprego de animação contínua fora
// do 🔥 (não é emoji, é indicador de status "ao vivo agora", pedido
// explícito de ícone stroke fino em vez de emoji nos itens de agenda).
function LivePulseIcon() {
  return (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-negative/40 bg-negative/10">
      <span className="absolute size-2.5 animate-ping rounded-full bg-negative/70" aria-hidden="true" />
      <span className="relative size-2.5 rounded-full bg-negative" />
    </span>
  );
}

function fmtEventoQuando(startsAt: string): string {
  const d = new Date(startsAt);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (mesmoDia) return `Hoje, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hora}`;
}

// Ícone de estudo/particular (livro) — mantido exportado só pra reforçar
// o vocabulário visual descrito no design (usado assim que existir fonte
// real de eventos particulares, ver TODO acima).
export function StudyEventIcon() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
      <BookOpen size={15} strokeWidth={1.75} />
    </span>
  );
}
