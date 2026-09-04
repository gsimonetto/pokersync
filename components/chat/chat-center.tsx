"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, MessageCircle, Plus, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import { MessageBubble, type ChatMessageLike } from "@/components/chat/message-bubble";
import { MessageComposer } from "@/components/chat/message-composer";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import {
  fetchMyTeamCached,
  fetchTeamThread,
  fetchTeamThreads,
  getTeamAudioUrl,
  markThreadRead,
  sendTeamAudioMessage,
  sendTeamMessage,
  traduzErroTime,
  uploadTeamAudio,
  type MyTeam,
  type TeamThreadSummary,
} from "@/lib/services/team-service";
import {
  acceptFriendRequest,
  fetchFriendThread,
  fetchFriendThreads,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchLastSeenMap,
  getFriendAudioUrl,
  isOnline,
  markFriendThreadRead,
  removeFriendship,
  sendFriendAudioMessage,
  sendFriendMessage,
  sendFriendRequest,
  traduzErroAmigos,
  uploadFriendAudio,
  type Friend,
  type FriendRequest,
  type FriendThreadSummary,
} from "@/lib/services/friend-service";

const POLL_MS = 6000;

type Relacao = "time" | "amigo";

interface Contato {
  id: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  relacao: Relacao;
  role?: string;
  online: boolean;
  lastMessage?: string;
  lastAt?: string;
  lastIsMine?: boolean;
  unreadCount: number;
}

function ordenarContatos(a: Contato, b: Contato) {
  if (Boolean(a.lastAt) !== Boolean(b.lastAt)) return a.lastAt ? -1 : 1;
  if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

// Central de Conversas: dois filtros -- "Time" (todo mundo do time,
// mesmo sem historico ainda, tipo lista de contatos) e "Amigos" (fora
// do time, por @apelido#codigo). O filtro "Time" so' aparece se o
// usuario tiver time; sem time, cai direto pra Amigos. Bolinha verde
// no avatar = online (last_seen_at recente, heartbeat do client --
// ver lib/hooks/use-presence-heartbeat.ts).
export function ChatCenter({ onClose, initialOtherUserId }: { onClose: () => void; initialOtherUserId?: string | null }) {
  useEscapeToClose(onClose);

  const [meId, setMeId] = useState<string | null>(null);
  const [meuPerfil, setMeuPerfil] = useState<Profile | null>(null);

  const [team, setTeam] = useState<MyTeam | null>(null);
  const [teamThreads, setTeamThreads] = useState<TeamThreadSummary[]>([]);
  const [presenceMap, setPresenceMap] = useState<Map<string, string | null>>(new Map());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendThreads, setFriendThreads] = useState<FriendThreadSummary[]>([]);
  const [pedidos, setPedidos] = useState<FriendRequest[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<Relacao>("time");
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);

  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [ativoRelacao, setAtivoRelacao] = useState<Relacao>("time");
  const [mensagens, setMensagens] = useState<ChatMessageLike[]>([]);
  const [carregandoThread, setCarregandoThread] = useState(false);

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
      const [{ data }, perfil] = await Promise.all([supabase.auth.getUser(), fetchProfile().catch(() => null)]);
      if (!ativo) return;
      setMeId(data.user?.id ?? null);
      setMeuPerfil(perfil);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function carregarTudo() {
    try {
      const [myTeam, tThreads, fList, fThreads, fReqs] = await Promise.all([
        fetchMyTeamCached(),
        fetchTeamThreads().catch(() => []),
        fetchFriends().catch(() => []),
        fetchFriendThreads().catch(() => []),
        fetchIncomingFriendRequests().catch(() => []),
      ]);
      setTeam(myTeam);
      setTeamThreads(tThreads);
      setFriends(fList);
      setFriendThreads(fThreads);
      setPedidos(fReqs);

      const idsTime = (myTeam?.members ?? []).filter((m) => !m.isMe).map((m) => m.userId);
      if (idsTime.length) {
        fetchLastSeenMap(idsTime)
          .then(setPresenceMap)
          .catch(() => {});
      }
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    const id = setInterval(carregarTudo, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const contatosTime = useMemo<Contato[]>(() => {
    if (!team) return [];
    const threadsMap = new Map(teamThreads.map((t) => [t.otherUserId, t]));
    return team.members
      .filter((m) => !m.isMe)
      .map((m) => {
        const t = threadsMap.get(m.userId);
        return {
          id: m.userId,
          nome: m.name,
          avatarId: m.avatarId,
          avatarUrl: m.avatarUrl,
          relacao: "time" as const,
          role: m.role,
          online: isOnline(presenceMap.get(m.userId) ?? null),
          lastMessage: t?.lastMessage,
          lastAt: t?.lastAt,
          lastIsMine: t?.lastIsMine,
          unreadCount: t?.unreadCount ?? 0,
        };
      })
      .sort(ordenarContatos);
  }, [team, teamThreads, presenceMap]);

  const contatosAmigos = useMemo<Contato[]>(() => {
    const threadsMap = new Map(friendThreads.map((t) => [t.otherUserId, t]));
    return friends
      .map((f) => {
        const t = threadsMap.get(f.userId);
        return {
          id: f.userId,
          nome: f.nome,
          avatarId: f.avatarId,
          avatarUrl: f.avatarUrl,
          relacao: "amigo" as const,
          online: isOnline(f.lastSeenAt),
          lastMessage: t?.lastMessage,
          lastAt: t?.lastAt,
          lastIsMine: t?.lastIsMine,
          unreadCount: t?.unreadCount ?? 0,
        };
      })
      .sort(ordenarContatos);
  }, [friends, friendThreads]);

  const filtroEfetivo: Relacao = team ? filtro : "amigo";
  const contatos = filtroEfetivo === "time" ? contatosTime : contatosAmigos;

  async function abrirConversa(contato: Contato) {
    setAtivoId(contato.id);
    setAtivoRelacao(contato.relacao);
    setMostrarAdicionar(false);
    setCarregandoThread(true);
    try {
      if (contato.relacao === "time") {
        const thread = await fetchTeamThread(contato.id);
        setMensagens(thread);
        await markThreadRead(contato.id).catch(() => {});
        setTeamThreads((prev) => prev.map((t) => (t.otherUserId === contato.id ? { ...t, unreadCount: 0 } : t)));
      } else {
        const thread = await fetchFriendThread(contato.id);
        setMensagens(thread);
        await markFriendThreadRead(contato.id).catch(() => {});
        setFriendThreads((prev) => prev.map((t) => (t.otherUserId === contato.id ? { ...t, unreadCount: 0 } : t)));
      }
    } catch (e) {
      setErro(contato.relacao === "time" ? traduzErroTime(e) : traduzErroAmigos(e));
    } finally {
      setCarregandoThread(false);
    }
  }

  useEffect(() => {
    if (initialOtherUserId) {
      // Deep link (?chat=) sempre chega como contato de time -- unico
      // fluxo que gera esse link hoje (notificacao de mensagem de time).
      abrirConversa({ id: initialOtherUserId, relacao: "time" } as Contato);
    }
  }, [initialOtherUserId]);

  useEffect(() => {
    if (!ativoId) return;
    const id = setInterval(async () => {
      try {
        if (ativoRelacao === "time") {
          const thread = await fetchTeamThread(ativoId);
          setMensagens(thread);
          await markThreadRead(ativoId).catch(() => {});
        } else {
          const thread = await fetchFriendThread(ativoId);
          setMensagens(thread);
          await markFriendThreadRead(ativoId).catch(() => {});
        }
      } catch {
        // silencioso -- proxima janela tenta de novo
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ativoId, ativoRelacao]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens]);

  async function recarregarThreadAtiva() {
    if (!ativoId) return;
    const thread = ativoRelacao === "time" ? await fetchTeamThread(ativoId) : await fetchFriendThread(ativoId);
    setMensagens(thread);
  }

  async function enviarTexto(body: string) {
    if (!ativoId) return;
    try {
      if (ativoRelacao === "time") await sendTeamMessage(ativoId, body);
      else await sendFriendMessage(ativoId, body);
      await recarregarThreadAtiva();
      carregarTudo();
    } catch (e) {
      setErro(ativoRelacao === "time" ? traduzErroTime(e) : traduzErroAmigos(e));
    }
  }

  async function enviarAudio(blob: Blob, seconds: number) {
    if (!ativoId) return;
    try {
      if (ativoRelacao === "time") {
        if (!team) return;
        const path = await uploadTeamAudio(team.team.id, blob);
        await sendTeamAudioMessage(ativoId, path, seconds);
      } else {
        const path = await uploadFriendAudio(blob);
        await sendFriendAudioMessage(ativoId, path, seconds);
      }
      await recarregarThreadAtiva();
      carregarTudo();
    } catch (e) {
      setErro(ativoRelacao === "time" ? traduzErroTime(e) : traduzErroAmigos(e));
    }
  }

  // Busca nas duas listas (nao so' na do filtro atual): o usuario pode
  // trocar de aba (Time/Amigos) com uma conversa ja aberta -- o painel
  // da direita deve continuar mostrando ela normalmente.
  const contatoAtivo = useMemo(
    () => contatosTime.find((c) => c.id === ativoId) ?? contatosAmigos.find((c) => c.id === ativoId),
    [contatosTime, contatosAmigos, ativoId]
  );
  const mostrarListaMobile = !ativoId && !mostrarAdicionar;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
        <div
          className="flex h-[min(760px,90vh)] w-full max-w-4xl overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Coluna de conversas */}
          <div
            className={`flex w-full shrink-0 flex-col border-r border-hairline sm:w-72 ${
              mostrarListaMobile || mostrarAdicionar ? "flex" : "hidden sm:flex"
            }`}
          >
            <div className="border-b border-hairline p-4">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-training" />
                <h2 className="flex-1 text-sm font-bold text-ink">Conversas</h2>
                <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted hover:text-ink sm:hidden" aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              {/* Tag propria sempre visivel ao abrir o chat, pra passar
                  pra um amigo adicionar sem precisar entrar no painel
                  de "Adicionar amigo". */}
              <MinhaTag perfil={meuPerfil} />
            </div>

            {/* Filtros: Time (so' com time) / Amigos */}
            <div className="flex items-center gap-1 border-b border-hairline p-2">
              {team && (
                <button
                  onClick={() => {
                    setFiltro("time");
                    setMostrarAdicionar(false);
                  }}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                    filtroEfetivo === "time" ? "bg-ink text-void" : "text-muted hover:text-ink"
                  }`}
                >
                  Time
                </button>
              )}
              <button
                onClick={() => {
                  setFiltro("amigo");
                  setMostrarAdicionar(false);
                }}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  filtroEfetivo === "amigo" ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}
              >
                Amigos
                {pedidos.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-evolution px-1.5 py-0.5 text-[10px] font-bold text-void">{pedidos.length}</span>
                )}
              </button>
              {filtroEfetivo === "amigo" && (
                <button
                  onClick={() => setMostrarAdicionar((v) => !v)}
                  className={`grid size-7 shrink-0 place-items-center rounded-lg transition-colors ${
                    mostrarAdicionar ? "bg-ink text-void" : "text-muted hover:bg-white/[0.06] hover:text-ink"
                  }`}
                  aria-label="Adicionar amigo"
                  title="Adicionar amigo"
                >
                  <Plus size={15} />
                </button>
              )}
            </div>

            {mostrarAdicionar ? (
              <AdicionarAmigo
                meuPerfil={meuPerfil}
                pedidos={pedidos}
                onPedidoRespondido={carregarTudo}
                onAdicionado={carregarTudo}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {carregandoLista ? (
                  <p className="px-2 py-3 text-xs text-muted">Carregando…</p>
                ) : contatos.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-muted">
                      {filtroEfetivo === "time" ? "Ninguém mais no time ainda." : "Nenhum amigo adicionado ainda."}
                    </p>
                    {filtroEfetivo === "amigo" && (
                      <button onClick={() => setMostrarAdicionar(true)} className="mt-2 text-xs font-medium text-training hover:underline">
                        Adicionar amigo
                      </button>
                    )}
                  </div>
                ) : (
                  contatos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => abrirConversa(c)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        ativoId === c.id ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar id={c.avatarId} url={c.avatarUrl} size={34} />
                        {c.online && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-positive"
                            aria-label="Online"
                            title="Online"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-medium text-ink">{c.nome}</p>
                          {c.lastAt && <span className="shrink-0 text-[10px] text-muted">{formatarQuando(c.lastAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] text-muted">
                            {c.lastMessage ? `${c.lastIsMine ? "Você: " : ""}${c.lastMessage}` : "Sem mensagens ainda"}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="grid min-w-[18px] shrink-0 place-items-center rounded-full bg-evolution px-1 text-[10px] font-bold leading-[18px] text-void">
                              {c.unreadCount > 9 ? "9+" : c.unreadCount}
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
          <div className={`flex min-w-0 flex-1 flex-col ${mostrarListaMobile || mostrarAdicionar ? "hidden sm:flex" : "flex"}`}>
            {!ativoId || !contatoAtivo ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                  <MessageCircle size={28} className="mx-auto mb-2 text-muted/50" />
                  <p className="text-sm text-muted">Escolha uma conversa ao lado.</p>
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
                  <div className="relative shrink-0">
                    <Avatar id={contatoAtivo.avatarId} url={contatoAtivo.avatarUrl} size={32} />
                    {contatoAtivo.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-positive" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{contatoAtivo.nome}</p>
                    <p className="text-xs text-muted">
                      {contatoAtivo.online ? "Online" : contatoAtivo.relacao === "time" ? "Time" : "Amigo"}
                    </p>
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
                    mensagens.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isMine={m.senderId === meId}
                        getAudioUrl={ativoRelacao === "time" ? getTeamAudioUrl : getFriendAudioUrl}
                      />
                    ))
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

// ------------------------------------------------------------
// Tag propria (@apelido#codigo) compacta, com botao de copiar --
// mostrada no topo assim que o chat abre (pedido explicito: "quando
// abrir o chat, mostrar o proprio apelido + id no topo"), sem precisar
// entrar no painel de Adicionar amigo pra isso.
// ------------------------------------------------------------
function MinhaTag({ perfil }: { perfil: Profile | null }) {
  const [copiado, setCopiado] = useState(false);
  if (!perfil) return null;
  const tag = `@${perfil.apelido || perfil.nome}#${perfil.friend_code}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // sem permissao de clipboard -- a tag ja fica visivel na tela
    }
  }

  return (
    <button
      onClick={copiar}
      title="Copiar sua tag"
      className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-left transition-colors hover:border-ink/40"
    >
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">{tag}</span>
      {copiado ? <Check size={12} className="shrink-0 text-positive" /> : <Copy size={12} className="shrink-0 text-muted" />}
    </button>
  );
}

// ------------------------------------------------------------
// Painel "Adicionar amigo": mostra a propria tag (@apelido#codigo)
// pra compartilhar, um campo pra adicionar alguem pela tag dela, e os
// pedidos recebidos pendentes de resposta.
// ------------------------------------------------------------
function AdicionarAmigo({
  meuPerfil,
  pedidos,
  onPedidoRespondido,
  onAdicionado,
}: {
  meuPerfil: Profile | null;
  pedidos: FriendRequest[];
  onPedidoRespondido: () => void;
  onAdicionado: () => void;
}) {
  const [tag, setTag] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const minhaTag = meuPerfil ? `@${meuPerfil.apelido || meuPerfil.nome}#${meuPerfil.friend_code}` : null;

  async function copiarTag() {
    if (!minhaTag) return;
    try {
      await navigator.clipboard.writeText(minhaTag);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // sem permissao de clipboard -- sem problema, a tag ja esta visivel na tela
    }
  }

  async function adicionar() {
    const partes = tag.trim().split("#");
    if (partes.length !== 2 || !partes[0].trim() || !partes[1].trim()) {
      setMsg({ tipo: "err", texto: "Use o formato @apelido#0000." });
      return;
    }
    setEnviando(true);
    setMsg(null);
    try {
      const resultado = await sendFriendRequest(partes[0], partes[1]);
      setTag("");
      setMsg({
        tipo: "ok",
        texto: resultado === "aceito" ? "Vocês já eram um pedido mútuo — agora são amigos!" : "Pedido enviado.",
      });
      onAdicionado();
    } catch (e) {
      setMsg({ tipo: "err", texto: traduzErroAmigos(e) });
    } finally {
      setEnviando(false);
    }
  }

  async function responder(p: FriendRequest, aceitar: boolean) {
    setRespondendo(p.friendshipId);
    try {
      if (aceitar) await acceptFriendRequest(p.friendshipId);
      else await removeFriendship(p.friendshipId);
      onPedidoRespondido();
    } catch (e) {
      setMsg({ tipo: "err", texto: traduzErroAmigos(e) });
    } finally {
      setRespondendo(null);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {minhaTag && (
        <div className="mb-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/70">Sua tag</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{minhaTag}</p>
            <button
              onClick={copiarTag}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-ink"
              aria-label="Copiar tag"
              title="Copiar tag"
            >
              {copiado ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">Compartilhe pra alguém te adicionar.</p>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <UserPlus size={12} /> Adicionar por tag
        </p>
        <div className="flex gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="@apelido#0000"
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50"
          />
          <button
            onClick={adicionar}
            disabled={enviando || !tag.trim()}
            className="shrink-0 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
          >
            {enviando ? "…" : "Add"}
          </button>
        </div>
        {msg && (
          <p className={`mt-1.5 text-[11px] ${msg.tipo === "ok" ? "text-positive" : "text-negative"}`}>{msg.texto}</p>
        )}
      </div>

      {pedidos.length > 0 && (
        <div className="border-t border-hairline pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Pedidos recebidos</p>
          <ul className="space-y-1.5">
            {pedidos.map((p) => (
              <li key={p.friendshipId} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <Avatar id={p.avatarId} url={p.avatarUrl} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{p.nome}</p>
                    <p className="truncate text-[10.5px] text-muted">{p.friendTag}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => responder(p, true)}
                    disabled={respondendo === p.friendshipId}
                    className="flex-1 rounded-md bg-ink py-1.5 text-[11.5px] font-semibold text-void disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => responder(p, false)}
                    disabled={respondendo === p.friendshipId}
                    className="flex-1 rounded-md border border-hairline py-1.5 text-[11.5px] text-muted hover:text-ink disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatarQuando(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  if (mesmoDia) return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
