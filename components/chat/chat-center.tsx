"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageComposer } from "@/components/chat/message-composer";
import {
  fetchMyTeamCached,
  fetchTeamThread,
  fetchTeamThreads,
  markThreadRead,
  sendTeamAudioMessage,
  sendTeamMessage,
  traduzErroTime,
  uploadTeamAudio,
  type MyTeam,
  type TeamMessage,
  type TeamThreadSummary,
} from "@/lib/services/team-service";

const POLL_MS = 6000;

// Central de Conversas: lista de threads (esquerda) + conversa ativa
// (direita), tipo Discord. Reaproveita o mesmo par sender/recipient de
// team_messages ja usado no ConversaDrawer do Painel do Time -- aqui
// so' generaliza pra "qualquer membro fala com qualquer membro" e junta
// tudo num unico lugar acessivel da topbar, em vez de precisar entrar
// no Painel > Jogadores pra falar com alguem.
export function ChatCenter({ onClose, initialOtherUserId }: { onClose: () => void; initialOtherUserId?: string | null }) {
  useEscapeToClose(onClose);

  const [meId, setMeId] = useState<string | null>(null);
  const [team, setTeam] = useState<MyTeam | null>(null);
  const [threads, setThreads] = useState<TeamThreadSummary[]>([]);
  const [carregandoThreads, setCarregandoThreads] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<TeamMessage[]>([]);
  const [carregandoThread, setCarregandoThread] = useState(false);

  const [novaConversa, setNovaConversa] = useState(false);
  const [busca, setBusca] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      let supabase: ReturnType<typeof createClient>;
      try {
        supabase = createClient();
      } catch {
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (ativo) setMeId(data.user?.id ?? null);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function carregarThreads() {
    try {
      const [t, myTeam] = await Promise.all([fetchTeamThreads(), fetchMyTeamCached()]);
      setThreads(t);
      setTeam(myTeam);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setCarregandoThreads(false);
    }
  }

  useEffect(() => {
    carregarThreads();
    const id = setInterval(carregarThreads, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirConversa(otherUserId: string) {
    setAtivoId(otherUserId);
    setNovaConversa(false);
    setCarregandoThread(true);
    try {
      const thread = await fetchTeamThread(otherUserId);
      setMensagens(thread);
      await markThreadRead(otherUserId).catch(() => {});
      setThreads((prev) => prev.map((t) => (t.otherUserId === otherUserId ? { ...t, unreadCount: 0 } : t)));
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setCarregandoThread(false);
    }
  }

  useEffect(() => {
    if (initialOtherUserId) abrirConversa(initialOtherUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOtherUserId]);

  // Poll da conversa ativa -- sem realtime no projeto ainda, entao
  // reconsulta a thread aberta no mesmo intervalo da lista.
  useEffect(() => {
    if (!ativoId) return;
    const id = setInterval(async () => {
      try {
        const thread = await fetchTeamThread(ativoId);
        setMensagens(thread);
        await markThreadRead(ativoId).catch(() => {});
      } catch {
        // silencioso -- proxima janela tenta de novo
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ativoId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens]);

  async function enviarTexto(body: string) {
    if (!ativoId) return;
    try {
      await sendTeamMessage(ativoId, body);
      const thread = await fetchTeamThread(ativoId);
      setMensagens(thread);
      carregarThreads();
    } catch (e) {
      setErro(traduzErroTime(e));
    }
  }

  async function enviarAudio(blob: Blob, seconds: number) {
    if (!ativoId || !team) return;
    try {
      const path = await uploadTeamAudio(team.team.id, blob);
      await sendTeamAudioMessage(ativoId, path, seconds);
      const thread = await fetchTeamThread(ativoId);
      setMensagens(thread);
      carregarThreads();
    } catch (e) {
      setErro(traduzErroTime(e));
    }
  }

  const contatoAtivo = useMemo(
    () => threads.find((t) => t.otherUserId === ativoId) ?? membroParaContato(team, ativoId),
    [threads, team, ativoId]
  );

  const candidatos = useMemo(() => {
    if (!team) return [];
    const jaTemThread = new Set(threads.map((t) => t.otherUserId));
    const termo = busca.trim().toLowerCase();
    return team.members
      .filter((m) => !m.isMe)
      .filter((m) => !termo || m.name.toLowerCase().includes(termo))
      .sort((a, b) => Number(jaTemThread.has(b.userId)) - Number(jaTemThread.has(a.userId)));
  }, [team, threads, busca]);

  const mostrarListaMobile = !ativoId;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div
          className="flex h-[min(680px,88vh)] w-full max-w-3xl overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Coluna de conversas */}
          <div
            className={`flex w-full shrink-0 flex-col border-r border-hairline sm:w-72 ${
              mostrarListaMobile ? "flex" : "hidden sm:flex"
            }`}
          >
            <div className="flex items-center gap-2 border-b border-hairline p-4">
              <MessageCircle size={18} className="text-training" />
              <h2 className="flex-1 text-sm font-bold text-ink">Conversas</h2>
              {team && (
                <button
                  onClick={() => setNovaConversa((v) => !v)}
                  className={`grid size-7 place-items-center rounded-lg transition-colors ${
                    novaConversa ? "bg-ink text-void" : "text-muted hover:bg-white/[0.06] hover:text-ink"
                  }`}
                  aria-label="Nova conversa"
                  title="Nova conversa"
                >
                  <Plus size={16} />
                </button>
              )}
              <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted hover:text-ink sm:hidden" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {novaConversa ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="relative shrink-0 p-3 pb-2">
                  <Search size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar no time…"
                    className="w-full rounded-lg border border-hairline bg-elevated py-2 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-muted/50"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                  {candidatos.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted">Ninguém encontrado.</p>
                  ) : (
                    candidatos.map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => abrirConversa(m.userId)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <Avatar id={m.avatarId} url={m.avatarUrl} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{m.name}</p>
                          <p className="text-[11px] capitalize text-muted">{m.role}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {carregandoThreads ? (
                  <p className="px-2 py-3 text-xs text-muted">Carregando…</p>
                ) : threads.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-muted">Nenhuma conversa ainda.</p>
                    {team && (
                      <button onClick={() => setNovaConversa(true)} className="mt-2 text-xs font-medium text-training hover:underline">
                        Iniciar conversa
                      </button>
                    )}
                  </div>
                ) : (
                  threads.map((t) => (
                    <button
                      key={t.otherUserId}
                      onClick={() => abrirConversa(t.otherUserId)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        ativoId === t.otherUserId ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <Avatar id={t.avatarId} url={t.avatarUrl} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-medium text-ink">{t.nome}</p>
                          <span className="shrink-0 text-[10px] text-muted">{formatarQuando(t.lastAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] text-muted">
                            {t.lastIsMine && "Você: "}
                            {t.lastMessage || "Sem mensagens"}
                          </p>
                          {t.unreadCount > 0 && (
                            <span className="grid min-w-[18px] shrink-0 place-items-center rounded-full bg-evolution px-1 text-[10px] font-bold leading-[18px] text-void">
                              {t.unreadCount > 9 ? "9+" : t.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Conversa ativa */}
          <div className={`flex min-w-0 flex-1 flex-col ${mostrarListaMobile ? "hidden sm:flex" : "flex"}`}>
            {!ativoId || !contatoAtivo ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                  <MessageCircle size={28} className="mx-auto mb-2 text-muted/50" />
                  <p className="text-sm text-muted">
                    {team ? "Escolha uma conversa ao lado." : "Você ainda não faz parte de um time."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-hairline p-4">
                  <button
                    onClick={() => setAtivoId(null)}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:text-ink sm:hidden"
                    aria-label="Voltar"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <Avatar id={contatoAtivo.avatarId} url={contatoAtivo.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{contatoAtivo.nome}</p>
                    <p className="text-xs capitalize text-muted">{contatoAtivo.role}</p>
                  </div>
                  <button onClick={onClose} className="hidden size-7 shrink-0 place-items-center rounded-lg text-muted hover:text-ink sm:grid" aria-label="Fechar">
                    <X size={16} />
                  </button>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                  {carregandoThread ? (
                    <p className="text-sm text-muted">Carregando…</p>
                  ) : mensagens.length === 0 ? (
                    <p className="text-sm text-muted">Nenhuma mensagem ainda. Diga oi.</p>
                  ) : (
                    mensagens.map((m) => <MessageBubble key={m.id} message={m} isMine={m.senderId === meId} />)
                  )}
                </div>

                <MessageComposer onSendText={enviarTexto} onSendAudio={enviarAudio} />
              </>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-negative/40 bg-surface px-4 py-2 text-sm text-negative shadow-lg"
          onClick={() => setErro(null)}
        >
          {erro}
        </div>
      )}
    </ModalPortal>
  );
}

function membroParaContato(team: MyTeam | null, userId: string | null) {
  if (!team || !userId) return undefined;
  const m = team.members.find((x) => x.userId === userId);
  if (!m) return undefined;
  return { avatarId: m.avatarId, avatarUrl: m.avatarUrl, nome: m.name, role: m.role };
}

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  if (mesmoDia) return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
