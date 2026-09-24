"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cake, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, CheckCircle2, Clock, ExternalLink, Link2, Repeat, Trash2, UserCheck, Users, Video, X, XCircle } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import { Campo } from "@/components/time/campo";
import {
  cancelEventSeries,
  cancelTeamEvent,
  createRecurringTeamEvents,
  createTeamEvent,
  fetchTeamBirthdays,
  googleCalendarUrl,
  markAttendance,
  traduzErroCalendario,
  type EventType,
  type TeamBirthday,
  type TeamEvent,
} from "@/lib/services/team-calendar-service";
import type { TeamDashboardRow, TeamRole } from "@/lib/services/team-service";
import { useConfirm } from "@/components/confirm-dialog";
import { CardHint, EASE, PainelCard } from "@/components/painel/painel-card";
import { dataLonga, mesAno } from "@/components/painel/formato";

// Calendário do time no MESMO formato do Calendário da tela de Início
// (components/painel/agenda-card.tsx): grade do mês com bolinhas por tipo
// no dia, legenda, e o dia escolhido ao lado (no celular, embaixo) com o
// que acontece nele. Aqui o dia traz o que é do time: aulas, reuniões,
// outros eventos (com presença, link, Google Agenda e cancelar pra quem
// gerencia) e aniversários dos colegas. Criação restrita a admin/coach --
// a RLS já bloqueia no banco; aqui só escondemos o botão.

const TIPO_LABEL: Record<EventType, string> = { aula: "Aula", reuniao: "Reunião", outro: "Outro" };
// Mesmas cores da tela de Início: aniversário rosa, eventos do time em
// azul/índigo; "outro" neutro.
const TIPO_COR: Record<EventType, string> = { aula: "#5AA6E0", reuniao: "#6366F1", outro: "#8A94A3" };
const COR_ANIVERSARIO = "#E0559E";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const CHAVE = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function gradeDoMes(ref: Date): (number | null)[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const totalDias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: primeiro.getDay() }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];
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
  const confirm = useConfirm();
  const [modalAberto, setModalAberto] = useState(false);
  const [hoje] = useState(() => new Date());
  const [mesRef, setMesRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaEscolhido, setDiaEscolhido] = useState(() => CHAVE(hoje));
  // Mês novo entra pelo lado da seta clicada (próximo = da direita).
  const [direcao, setDirecao] = useState(1);
  const [aniversarios, setAniversarios] = useState<TeamBirthday[]>([]);

  useEffect(() => {
    if (prefillPlayerId) setModalAberto(true);
  }, [prefillPlayerId]);

  // Aniversários entram direto na grade (como no Início). Quem não
  // preencheu a data ou não liberou simplesmente não aparece -- sem erro
  // na tela por isso.
  const idsMembros = useMemo(() => jogadores.map((j) => j.userId).sort().join(","), [jogadores]);
  useEffect(() => {
    let vivo = true;
    const ids = idsMembros ? idsMembros.split(",") : [];
    if (ids.length === 0) return;
    fetchTeamBirthdays(ids)
      .then((a) => vivo && setAniversarios(a))
      .catch(() => vivo && setAniversarios([]));
    return () => {
      vivo = false;
    };
  }, [idsMembros]);

  const porNome = useMemo(() => new Map(jogadores.map((j) => [j.userId, j])), [jogadores]);

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, TeamEvent[]>();
    for (const e of eventos) {
      const k = CHAVE(new Date(e.startsAt));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const lista of m.values()) lista.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [eventos]);

  // Aniversário se repete todo ano: entra pelo dia/mês no ano em exibição.
  const aniversariosPorDia = useMemo(() => {
    const m = new Map<string, TeamBirthday[]>();
    for (const a of aniversarios) {
      const nasc = new Date(`${a.dataNascimento}T00:00:00`);
      const k = CHAVE(new Date(mesRef.getFullYear(), nasc.getMonth(), nasc.getDate()));
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [aniversarios, mesRef]);

  const dias = useMemo(() => gradeDoMes(mesRef), [mesRef]);
  const prefixoMes = CHAVE(mesRef).slice(0, 7);

  const tiposNoMes = useMemo(() => {
    const t = new Set<string>();
    for (const [k, lista] of eventosPorDia) if (k.startsWith(prefixoMes)) lista.forEach((e) => t.add(e.eventType));
    for (const k of aniversariosPorDia.keys()) if (k.startsWith(prefixoMes)) t.add("aniversario");
    return t;
  }, [eventosPorDia, aniversariosPorDia, prefixoMes]);

  const eventosDoDia = eventosPorDia.get(diaEscolhido) ?? [];
  const aniversariosDoDia = aniversariosPorDia.get(diaEscolhido) ?? [];
  const dataEscolhida = new Date(`${diaEscolhido}T12:00:00`);
  const proximo = useMemo(() => {
    const agora = Date.now();
    return eventos.find((e) => new Date(e.startsAt).getTime() >= agora) ?? null;
  }, [eventos]);

  function mudarMes(passo: number) {
    setDirecao(passo);
    setMesRef((m) => new Date(m.getFullYear(), m.getMonth() + passo, 1));
  }

  function irPara(iso: string) {
    const d = new Date(iso);
    const alvo = new Date(d.getFullYear(), d.getMonth(), 1);
    setDirecao(alvo > mesRef ? 1 : -1);
    setMesRef(alvo);
    setDiaEscolhido(CHAVE(d));
  }

  async function cancelar(ev: TeamEvent) {
    const ehSerie = Boolean(ev.recurrenceGroupId);
    const msg = ehSerie
      ? `Cancelar TODA a série de "${ev.title}" (esta e as próximas)? Quem confirmou presença será avisado.`
      : `Cancelar o evento "${ev.title}"? Quem confirmou presença será avisado.`;
    if (!(await confirm({ title: ehSerie ? "Cancelar série" : "Cancelar evento", message: msg, confirmLabel: "Cancelar evento", cancelLabel: "Voltar" }))) return;
    try {
      if (ehSerie) await cancelEventSeries(ev.recurrenceGroupId as string);
      else await cancelTeamEvent(ev.id);
      onChange();
    } catch (e) {
      onErro(traduzErroCalendario(e));
    }
  }

  const legenda = [
    ...(["aula", "reuniao", "outro"] as EventType[]).map((t) => ({ chave: t, texto: TIPO_LABEL[t] === "Outro" ? "Outros" : `${TIPO_LABEL[t]}s`, cor: TIPO_COR[t] })),
    { chave: "aniversario", texto: "Aniversários", cor: COR_ANIVERSARIO },
  ].filter((l) => tiposNoMes.has(l.chave));

  return (
    <>
      <PainelCard
        title="Calendário"
        icon={<CalendarDays size={15} />}
        rolagem={false}
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
            <span className="relative min-w-[108px] overflow-hidden whitespace-nowrap text-center text-[12px] text-muted">
              <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
                <motion.span
                  key={prefixoMes}
                  className="block"
                  initial={{ y: 10 * direcao, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10 * direcao, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  {mesAno(mesRef)}
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
            {podeCriar && (
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="ml-1 hidden items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-void transition-transform hover:scale-[1.03] sm:flex"
              >
                <CalendarPlus size={13} strokeWidth={2.5} />
                Agendar
              </button>
            )}
          </span>
        }
      >
        <div className="@container">
          <div className="flex flex-col gap-4 @2xl:flex-row">
            {/* Grade com linhas finas entre os dias, igual à do Início. */}
            <div className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] @2xl:w-[52%]">
              <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02] text-center">
                {SEMANA.map((l, i) => (
                  <span key={i} className="py-1.5 text-[11px] font-semibold text-muted/70">
                    {l}
                  </span>
                ))}
              </div>
              <div className="relative">
                <AnimatePresence mode="popLayout" initial={false} custom={direcao}>
                  <motion.div
                    key={prefixoMes}
                    initial={{ x: 28 * direcao, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -28 * direcao, opacity: 0 }}
                    transition={{ duration: 0.32, ease: EASE }}
                    className="grid grid-cols-7 text-center"
                  >
                    {[...dias, ...Array.from({ length: (7 - (dias.length % 7)) % 7 }, () => null)].map((dia, i) => {
                      const linhas = `${i % 7 > 0 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} border-white/[0.05]`;
                      if (dia == null) return <span key={`v${i}`} className={linhas} />;
                      const chave = CHAVE(new Date(mesRef.getFullYear(), mesRef.getMonth(), dia));
                      const evs = eventosPorDia.get(chave) ?? [];
                      const nivers = aniversariosPorDia.get(chave) ?? [];
                      const total = evs.length + nivers.length;
                      const ehHoje = chave === CHAVE(hoje);
                      const escolhido = chave === diaEscolhido;
                      // Até 3 bolinhas, uma por TIPO presente no dia.
                      const cores = [
                        ...new Set([...evs.map((e) => TIPO_COR[e.eventType]), ...(nivers.length ? [COR_ANIVERSARIO] : [])]),
                      ].slice(0, 3);
                      return (
                        <span key={dia} className={`flex items-center justify-center p-0.5 sm:p-1 ${linhas}`}>
                          <button
                            type="button"
                            onClick={() => setDiaEscolhido(chave)}
                            aria-label={`${dia} — ${total} ${total === 1 ? "item" : "itens"}`}
                            aria-pressed={escolhido}
                            className={`relative grid h-10 w-10 place-items-center rounded-xl text-[12.5px] transition active:scale-90 sm:h-11 sm:w-11 ${
                              escolhido
                                ? "font-semibold text-black"
                                : ehHoje
                                  ? "bg-white/[0.08] font-semibold text-[#f1d78a] ring-1 ring-inset ring-[#d4af37]/60"
                                  : total > 0
                                    ? "text-ink hover:bg-white/[0.06]"
                                    : "text-muted/70 hover:bg-white/[0.04]"
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60`}
                          >
                            {escolhido && (
                              <motion.span
                                layoutId="time-dia-escolhido"
                                className="absolute inset-0 rounded-xl bg-[#d4af37] shadow-lg shadow-[#d4af37]/25"
                                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                              />
                            )}
                            <span className="tnum relative leading-none">{dia}</span>
                            {cores.length > 0 && (
                              <span className="absolute bottom-1 flex gap-[3px]">
                                {cores.map((c) => (
                                  <span key={c} className="h-1 w-1 rounded-full" style={{ background: escolhido ? "#000000b3" : c }} />
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
              {legenda.length > 0 && (
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 border-t border-white/[0.06] px-3 py-1.5">
                  {legenda.map((l) => (
                    <span key={l.chave} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.cor }} />
                      {l.texto}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dia escolhido */}
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={diaEscolhido}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  <p className="text-[12px] font-semibold text-muted">{dataLonga(dataEscolhida)}</p>

                  {eventosDoDia.length === 0 && aniversariosDoDia.length === 0 ? (
                    <div className="mt-3 space-y-2.5">
                      <CardHint>Nada neste dia.</CardHint>
                      {proximo && CHAVE(new Date(proximo.startsAt)) !== diaEscolhido && (
                        <button
                          type="button"
                          onClick={() => irPara(proximo.startsAt)}
                          className="block text-left text-[12.5px] text-muted transition-colors hover:text-ink"
                        >
                          Próximo: <span className="font-semibold text-ink">{proximo.title}</span> ·{" "}
                          {new Date(proximo.startsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {fmtHora(proximo.startsAt)}
                        </button>
                      )}
                      {podeCriar && (
                        <button
                          type="button"
                          onClick={() => setModalAberto(true)}
                          className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-[#d4af37] transition-colors hover:text-[#f1d78a] sm:flex"
                        >
                          <CalendarPlus size={13} /> Agendar neste dia
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-2 flex flex-col">
                      {aniversariosDoDia.map((a) => (
                        <li key={`niver-${a.userId}`} className="flex items-center gap-2.5 border-t border-white/[0.06] px-1 py-2.5">
                          <Cake size={15} className="shrink-0" style={{ color: COR_ANIVERSARIO }} aria-hidden />
                          <AvatarNivel userId={a.userId} avatarId={a.avatarId} avatarUrl={a.avatarUrl} tamanho={24} />
                          <span className="min-w-0 flex-1 truncate text-[13px]">Aniversário de {a.nome}</span>
                        </li>
                      ))}
                      {eventosDoDia.map((ev) => (
                        <li key={ev.id} className="border-t border-white/[0.06] px-1 py-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: TIPO_COR[ev.eventType] }} aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium leading-tight">{ev.title}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted">
                                <span>{TIPO_LABEL[ev.eventType]}</span>
                                <span className="text-muted/40">·</span>
                                <span className="flex items-center gap-1 tabular-nums">
                                  <Clock size={11} />
                                  {fmtHora(ev.startsAt)}
                                  {ev.endsAt ? `–${fmtHora(ev.endsAt)}` : ""}
                                </span>
                                {ev.recurrenceGroupId && (
                                  <>
                                    <span className="text-muted/40">·</span>
                                    <span className="flex items-center gap-1"><Repeat size={10} /> semanal</span>
                                  </>
                                )}
                                {ev.locationUrl && (
                                  <>
                                    <span className="text-muted/40">·</span>
                                    <a href={ev.locationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink/80 hover:underline">
                                      <Video size={11} /> link
                                    </a>
                                  </>
                                )}
                              </p>
                              {ev.description && <p className="mt-1 text-[12.5px] text-muted">{ev.description}</p>}

                              {ev.participants.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <Users size={12} className="text-muted" aria-label="Participantes" />
                                  {ev.participants.map((pt) => {
                                    const j = porNome.get(pt.playerId);
                                    return (
                                      <span
                                        key={pt.playerId}
                                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                          pt.status === "confirmado"
                                            ? "border-positive/40 text-positive"
                                            : pt.status === "recusado"
                                              ? "border-negative/40 text-negative"
                                              : "border-hairline text-muted"
                                        }`}
                                      >
                                        {j?.nome ?? "Jogador"}
                                        {podeCriar && (
                                          <span className="ml-1 flex items-center gap-0.5 border-l border-hairline pl-1">
                                            <button
                                              onClick={() => markAttendance(ev.id, pt.playerId, pt.attended === true ? null : true).then(onChange).catch((e) => onErro(traduzErroCalendario(e)))}
                                              title="Marcar presente"
                                              aria-label={`Marcar ${j?.nome ?? "jogador"} presente`}
                                              className={`grid h-5 w-5 place-items-center rounded-full transition-colors ${pt.attended === true ? "text-positive" : "text-muted/50 hover:text-positive"}`}
                                            >
                                              <CheckCircle2 size={12} />
                                            </button>
                                            <button
                                              onClick={() => markAttendance(ev.id, pt.playerId, pt.attended === false ? null : false).then(onChange).catch((e) => onErro(traduzErroCalendario(e)))}
                                              title="Marcar ausente"
                                              aria-label={`Marcar ${j?.nome ?? "jogador"} ausente`}
                                              className={`grid h-5 w-5 place-items-center rounded-full transition-colors ${pt.attended === false ? "text-negative" : "text-muted/50 hover:text-negative"}`}
                                            >
                                              <XCircle size={12} />
                                            </button>
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <a
                                href={googleCalendarUrl(ev)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Adicionar ao Google Agenda"
                                title="Adicionar ao Google Agenda"
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
                              >
                                <ExternalLink size={14} />
                              </a>
                              {podeCriar && (
                                <button
                                  onClick={() => cancelar(ev)}
                                  aria-label="Cancelar evento"
                                  title="Cancelar evento"
                                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-negative/10 hover:text-negative"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Celular: o Agendar sai do cabeçalho (não cabia) e vem aqui. */}
              {podeCriar && (
                <button
                  type="button"
                  onClick={() => setModalAberto(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void sm:hidden"
                >
                  <CalendarPlus size={15} strokeWidth={2.5} />
                  Agendar evento
                </button>
              )}
            </div>
          </div>
        </div>
      </PainelCard>

      {modalAberto && (
        <ModalNovoEvento
          teamId={teamId}
          jogadores={jogadores}
          meuUserId={meuUserId}
          meuPapel={meuPapel}
          prefillPlayerId={prefillPlayerId}
          prefillData={diaEscolhido >= CHAVE(hoje) ? diaEscolhido : undefined}
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
    </>
  );
}

export function ModalNovoEvento({
  teamId,
  jogadores,
  meuUserId,
  meuPapel,
  prefillPlayerId,
  prefillData,
  onFechar,
  onCriado,
  onErro,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  meuUserId: string;
  meuPapel: TeamRole;
  prefillPlayerId?: string | null;
  /** "AAAA-MM-DD" -- dia escolhido no calendário. */
  prefillData?: string;
  onFechar: () => void;
  onCriado: () => void;
  onErro: (s: string) => void;
}) {
  const [titulo, setTitulo] = useState(prefillPlayerId ? "Conversa individual" : "");
  const [tipo, setTipo] = useState<EventType>(prefillPlayerId ? "reuniao" : "aula");
  const [data, setData] = useState(prefillData ?? "");
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
                    <AvatarNivel userId={j.userId} avatarId={j.avatarId} avatarUrl={j.avatarUrl} tamanho={26} />
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

