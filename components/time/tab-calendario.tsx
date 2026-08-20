"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Clock, Link2, Repeat, Trash2, UserCheck, Users, Video, X, XCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Campo } from "@/components/time/campo";
import {
  cancelEventSeries,
  cancelTeamEvent,
  createRecurringTeamEvents,
  createTeamEvent,
  markAttendance,
  traduzErroCalendario,
  type EventType,
  type TeamEvent,
} from "@/lib/services/team-calendar-service";
import type { TeamDashboardRow, TeamRole } from "@/lib/services/team-service";

// Lista simples dos proximos eventos (sem grade de mes/semana).
// Criacao restrita a admin/coach — RLS ja bloqueia no banco, aqui so
// escondemos o botao pra nao criar expectativa de quem nao pode.

const TIPO_LABEL: Record<EventType, string> = { aula: "Aula", reuniao: "Reunião", outro: "Outro" };
const TIPO_COR: Record<EventType, string> = { aula: "#5AA6E0", reuniao: "#E0559E", outro: "#8A94A3" };

function fmtData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function TabCalendario({
  eventos,
  jogadores,
  teamId,
  meuUserId,
  meuPapel,
  podeCriar,
  prefillPlayerId,
  onPrefillConsumido,
  onChange,
  onErro,
}: {
  eventos: TeamEvent[];
  jogadores: TeamDashboardRow[];
  teamId: string;
  meuUserId: string;
  meuPapel: TeamRole;
  podeCriar: boolean;
  prefillPlayerId?: string | null;
  onPrefillConsumido?: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (prefillPlayerId) setModalAberto(true);
  }, [prefillPlayerId]);

  const porNome = useMemo(() => {
    const m = new Map<string, TeamDashboardRow>();
    jogadores.forEach((j) => m.set(j.userId, j));
    return m;
  }, [jogadores]);

  async function cancelar(ev: TeamEvent) {
    const ehSerie = Boolean(ev.recurrenceGroupId);
    const msg = ehSerie
      ? `Cancelar TODA a série de "${ev.title}" (esta e as próximas)? Quem confirmou presença será avisado.`
      : `Cancelar o evento "${ev.title}"? Quem confirmou presença será avisado.`;
    if (!confirm(msg)) return;
    try {
      if (ehSerie) await cancelEventSeries(ev.recurrenceGroupId as string);
      else await cancelTeamEvent(ev.id);
      onChange();
    } catch (e) {
      onErro(traduzErroCalendario(e));
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Próximos eventos</h2>
            <p className="mt-0.5 text-sm text-muted">Aulas e reuniões agendadas com o time.</p>
          </div>
          {podeCriar && (
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02]"
            >
              <CalendarPlus size={16} strokeWidth={2.5} />
              Agendar
            </button>
          )}
        </div>

        {eventos.length === 0 ? (
          <p className="mt-5 text-sm text-muted">Nenhum evento agendado.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {eventos.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-start gap-3 py-3.5">
                <div className="grid h-11 w-14 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-center">
                  <span className="text-[11px] font-semibold uppercase leading-tight text-muted">{fmtData(ev.startsAt)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${TIPO_COR[ev.eventType]}22`, color: TIPO_COR[ev.eventType] }}
                    >
                      {TIPO_LABEL[ev.eventType]}
                    </span>
                    {ev.recurrenceGroupId && (
                      <span className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        <Repeat size={10} /> semanal
                      </span>
                    )}
                    <p className="truncate text-sm font-medium">{ev.title}</p>
                  </div>

                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Clock size={12} />
                    {fmtHora(ev.startsAt)}
                    {ev.endsAt ? ` – ${fmtHora(ev.endsAt)}` : ""}
                    {ev.locationUrl && (
                      <>
                        <span className="text-hairline">·</span>
                        <a href={ev.locationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink/80 hover:underline">
                          <Video size={12} /> link
                        </a>
                      </>
                    )}
                  </p>

                  {ev.description && <p className="mt-1 text-[13px] text-muted">{ev.description}</p>}

                  {ev.participants.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <Users size={12} />
                        Participantes
                        {podeCriar && <span className="text-muted/70">· presença fica visível só pra você</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ev.participants.map((p) => {
                          const j = porNome.get(p.playerId);
                          return (
                            <span
                              key={p.playerId}
                              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                p.status === "confirmado"
                                  ? "border-positive/40 text-positive"
                                  : p.status === "recusado"
                                  ? "border-negative/40 text-negative"
                                  : "border-hairline text-muted"
                              }`}
                            >
                              {j?.nome ?? "Jogador"}
                              {podeCriar && (
                                <span className="ml-1 flex items-center gap-0.5 border-l border-hairline pl-1">
                                  <button
                                    onClick={() => markAttendance(ev.id, p.playerId, p.attended === true ? null : true).then(onChange).catch((e) => onErro(traduzErroCalendario(e)))}
                                    title="Marcar presente"
                                    className={`grid h-4 w-4 place-items-center rounded-full transition-colors ${
                                      p.attended === true ? "text-positive" : "text-muted/50 hover:text-positive"
                                    }`}
                                  >
                                    <CheckCircle2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => markAttendance(ev.id, p.playerId, p.attended === false ? null : false).then(onChange).catch((e) => onErro(traduzErroCalendario(e)))}
                                    title="Marcar ausente"
                                    className={`grid h-4 w-4 place-items-center rounded-full transition-colors ${
                                      p.attended === false ? "text-negative" : "text-muted/50 hover:text-negative"
                                    }`}
                                  >
                                    <XCircle size={12} />
                                  </button>
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {podeCriar && (
                  <button
                    onClick={() => cancelar(ev)}
                    aria-label="Cancelar evento"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-negative/50 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalAberto && (
        <ModalNovoEvento
          teamId={teamId}
          jogadores={jogadores}
          meuUserId={meuUserId}
          meuPapel={meuPapel}
          prefillPlayerId={prefillPlayerId}
          onFechar={() => {
            setModalAberto(false);
            onPrefillConsumido?.();
          }}
          onCriado={() => {
            setModalAberto(false);
            onPrefillConsumido?.();
            onChange();
          }}
          onErro={onErro}
        />
      )}
    </div>
  );
}

function ModalNovoEvento({
  teamId,
  jogadores,
  meuUserId,
  meuPapel,
  prefillPlayerId,
  onFechar,
  onCriado,
  onErro,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  meuUserId: string;
  meuPapel: TeamRole;
  prefillPlayerId?: string | null;
  onFechar: () => void;
  onCriado: () => void;
  onErro: (s: string) => void;
}) {
  const [titulo, setTitulo] = useState(prefillPlayerId ? "Conversa individual" : "");
  const [tipo, setTipo] = useState<EventType>(prefillPlayerId ? "reuniao" : "aula");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [duracaoMin, setDuracaoMin] = useState(60);
  const [link, setLink] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(prefillPlayerId ? [prefillPlayerId] : []));
  const [repetir, setRepetir] = useState(false);
  const [ateData, setAteData] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Calendario e' compartilhado entre todo o staff do time (qualquer
  // coach pode agendar/editar/cancelar evento de qualquer jogador — sem
  // isso, ninguem cobre a aula de um colega que faltou). "meusJogadores"
  // e' so' uma conveniencia de UI pra pre-selecionar os jogadores do
  // coach que esta' criando o evento, nao uma restricao de permissao.
  const meusJogadores = useMemo(
    () => (meuPapel === "coach" ? jogadores.filter((j) => j.coachId === meuUserId) : jogadores),
    [jogadores, meuPapel, meuUserId]
  );

  function alternar(userId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(meusJogadores.map((j) => j.userId)));
  }

  function limparSelecao() {
    setSelecionados(new Set());
  }

  async function salvar() {
    if (!titulo.trim()) return onErro("Dê um título ao evento.");
    if (!data || !hora) return onErro("Escolha data e horário.");
    if (repetir && !ateData) return onErro("Escolha até quando a série se repete.");

    const startsAt = new Date(`${data}T${hora}:00`);
    if (Number.isNaN(startsAt.getTime())) return onErro("Data ou horário inválido.");
    const endsAt = new Date(startsAt.getTime() + duracaoMin * 60 * 1000);

    if (repetir && new Date(`${ateData}T23:59:59`) < startsAt) {
      return onErro("A data final da repetição precisa ser depois do primeiro evento.");
    }

    setSalvando(true);
    try {
      if (repetir) {
        await createRecurringTeamEvents({
          teamId,
          title: titulo,
          description: descricao || undefined,
          eventType: tipo,
          locationUrl: link || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          participantIds: Array.from(selecionados),
          untilDate: ateData,
        });
      } else {
        await createTeamEvent({
          teamId,
          title: titulo,
          description: descricao || undefined,
          eventType: tipo,
          locationUrl: link || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          participantIds: Array.from(selecionados),
        });
      }
      onCriado();
    } catch (e) {
      onErro(traduzErroCalendario(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Agendar evento</h2>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Campo label="Título">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Aula de 3-bet pots"
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-ink/40"
            />
          </Campo>

          <Campo label="Tipo">
            <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
              {(["aula", "reuniao", "outro"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                    tipo === t ? "bg-ink text-void" : "text-muted hover:text-ink"
                  }`}
                >
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Data">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-ink/40"
              />
            </Campo>
            <Campo label="Horário">
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-ink/40"
              />
            </Campo>
          </div>

          <Campo label="Duração">
            <select
              value={duracaoMin}
              onChange={(e) => setDuracaoMin(Number(e.target.value))}
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none"
            >
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1h30</option>
              <option value={120}>2 horas</option>
            </select>
          </Campo>

          <div>
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="h-3.5 w-3.5" />
              <Repeat size={12} /> Repetir toda semana
            </label>
            {repetir && (
              <div className="mt-2">
                <Campo label="Repete até">
                  <input
                    type="date"
                    value={ateData}
                    onChange={(e) => setAteData(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-ink/40"
                  />
                </Campo>
                <p className="mt-1.5 text-xs text-muted">Cria uma ocorrência por semana, no mesmo dia e horário, até essa data.</p>
              </div>
            )}
          </div>

          <Campo label="Link (opcional)">
            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
              <Link2 size={14} className="shrink-0 text-muted" />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Zoom, Discord, Meet…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/50"
              />
            </div>
          </Campo>

          <Campo label="Assunto (opcional)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Ex.: revisão de leaks de 3-bet da semana"
              className="w-full resize-none rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-ink/40"
            />
          </Campo>

          <Campo label={`Participantes (${selecionados.size} de ${meusJogadores.length})`}>
            <div className="mb-1.5 flex gap-2">
              <button onClick={selecionarTodos} type="button"
                className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[11px] text-ink transition-colors hover:border-ink/40">
                <UserCheck size={12} />
                {meuPapel === "coach" ? "Todos os meus jogadores" : "Todo o time"}
              </button>
              {selecionados.size > 0 && (
                <button onClick={limparSelecao} type="button" className="rounded-lg px-2 py-1 text-[11px] text-muted hover:text-ink">
                  Limpar
                </button>
              )}
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-hairline p-2">
              {meusJogadores.length === 0 ? (
                <p className="p-1 text-xs text-muted">Nenhum jogador disponível.</p>
              ) : (
                meusJogadores.map((j) => (
                  <button
                    key={j.userId}
                    onClick={() => alternar(j.userId)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                      selecionados.has(j.userId) ? "bg-ink/10" : "hover:bg-elevated"
                    }`}
                  >
                    <Avatar id={j.avatarId} url={j.avatarUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate">{j.nome}</span>
                    {selecionados.has(j.userId) && <span className="text-xs text-ink/70">✓</span>}
                  </button>
                ))
              )}
            </div>
          </Campo>

          <button
            onClick={salvar}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <CalendarPlus size={16} strokeWidth={2.5} />
            {salvando ? "Agendando…" : repetir ? "Agendar série" : "Agendar evento"}
          </button>
        </div>
      </div>
    </div>
  );
}

