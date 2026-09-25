"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, MessageCircle, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AvatarNivel } from "@/components/avatar-nivel";
import { Chip } from "@/components/chip";
import { JanelaVidro, BotaoFechar } from "@/components/ui/janela-vidro";
import { MessageBubble, type ChatMessageLike } from "@/components/chat/message-bubble";
import { MessageComposer } from "@/components/chat/message-composer";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchContactTeamNames } from "@/lib/services/team-service";
import {
  acceptFriendRequest,
  fetchFriendThread,
  fetchFriendThreads,
  fetchFriends,
  fetchIncomingFriendRequests,
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
const OURO = "#d4af37";

interface Contato {
  id: string;
  nome: string;
  avatarId: number;
  avatarUrl: string | null;
  /** Time atual do contato -- null quando ele nao tem time. */
  teamName: string | null;
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

// Central de Conversas: só amigos (por @apelido#codigo). O chat com o
// time saiu daqui (pedido explícito) -- as tabelas/funções do time
// continuam no banco, só não aparecem mais no chat. Bolinha verde no
// avatar = online (last_seen_at recente, heartbeat do client -- ver
// lib/hooks/use-presence-heartbeat.ts).
export function ChatCenter({ onClose, initialOtherUserId }: { onClose: () => void; initialOtherUserId?: string | null }) {
  const [meId, setMeId] = useState<string | null>(null);
  const [meuPerfil, setMeuPerfil] = useState<Profile | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendThreads, setFriendThreads] = useState<FriendThreadSummary[]>([]);
  const [pedidos, setPedidos] = useState<FriendRequest[]>([]);
  const [amigoTeamNames, setAmigoTeamNames] = useState<Map<string, string>>(new Map());
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);

  const [ativoId, setAtivoId] = useState<string | null>(null);
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
      const [fList, fThreads, fReqs] = await Promise.all([
        fetchFriends(),
        fetchFriendThreads().catch(() => []),
        fetchIncomingFriendRequests().catch(() => []),
      ]);
      setFriends(fList);
      setFriendThreads(fThreads);
      setPedidos(fReqs);

      const idsAmigos = fList.map((f) => f.userId);
      if (idsAmigos.length) {
        fetchContactTeamNames(idsAmigos)
          .then(setAmigoTeamNames)
          .catch(() => {});
      }
    } catch (e) {
      setErro(traduzErroAmigos(e));
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    const id = setInterval(carregarTudo, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const contatos = useMemo<Contato[]>(() => {
    const threadsMap = new Map(friendThreads.map((t) => [t.otherUserId, t]));
    return friends
      .map((f) => {
        const t = threadsMap.get(f.userId);
        return {
          id: f.userId,
          nome: f.nome,
          avatarId: f.avatarId,
          avatarUrl: f.avatarUrl,
          teamName: amigoTeamNames.get(f.userId) ?? null,
          online: isOnline(f.lastSeenAt),
          lastMessage: t?.lastMessage,
          lastAt: t?.lastAt,
          lastIsMine: t?.lastIsMine,
          unreadCount: t?.unreadCount ?? 0,
        };
      })
      .sort(ordenarContatos);
  }, [friends, friendThreads, amigoTeamNames]);

  async function abrirConversa(id: string) {
    setAtivoId(id);
    setMostrarAdicionar(false);
    setCarregandoThread(true);
    try {
      const thread = await fetchFriendThread(id);
      setMensagens(thread);
      await markFriendThreadRead(id).catch(() => {});
      setFriendThreads((prev) => prev.map((t) => (t.otherUserId === id ? { ...t, unreadCount: 0 } : t)));
    } catch (e) {
      setErro(traduzErroAmigos(e));
    } finally {
      setCarregandoThread(false);
    }
  }

  // Deep link (?chat=<userId>) -- abre direto a conversa com esse amigo.
  useEffect(() => {
    if (initialOtherUserId) abrirConversa(initialOtherUserId);
  }, [initialOtherUserId]);

  useEffect(() => {
    if (!ativoId) return;
    const id = setInterval(async () => {
      try {
        const thread = await fetchFriendThread(ativoId);
        setMensagens(thread);
        await markFriendThreadRead(ativoId).catch(() => {});
      } catch {
        // silencioso -- proxima janela tenta de novo
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ativoId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens]);

  async function recarregarThreadAtiva() {
    if (!ativoId) return;
    setMensagens(await fetchFriendThread(ativoId));
  }

  async function enviarTexto(body: string) {
    if (!ativoId) return;
    try {
      await sendFriendMessage(ativoId, body);
      await recarregarThreadAtiva();
      carregarTudo();
    } catch (e) {
      setErro(traduzErroAmigos(e));
    }
  }

  async function enviarAudio(blob: Blob, seconds: number) {
    if (!ativoId) return;
    try {
      const path = await uploadFriendAudio(blob);
      await sendFriendAudioMessage(ativoId, path, seconds);
      await recarregarThreadAtiva();
      carregarTudo();
    } catch (e) {
      setErro(traduzErroAmigos(e));
    }
  }

  const contatoAtivo = useMemo(() => contatos.find((c) => c.id === ativoId), [contatos, ativoId]);
  const mostrarListaMobile = !ativoId && !mostrarAdicionar;
  const naoLidas = contatos.reduce((t, c) => t + c.unreadCount, 0);

  return (
    <JanelaVidro onClose={onClose} rotulo="Conversas" centro className="flex h-[min(760px,90vh)] max-w-4xl">
      {/* Coluna de conversas */}
      <div
        className={`flex w-full shrink-0 flex-col border-r border-white/[0.07] sm:w-80 ${
          mostrarListaMobile || mostrarAdicionar ? "flex" : "hidden sm:flex"
        }`}
      >
        <div className="border-b border-white/[0.07] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 text-[#d4af37]">
              <MessageCircle size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Conversas</h2>
              <p className="text-[11.5px] text-muted">{naoLidas > 0 ? `${naoLidas} não lida${naoLidas === 1 ? "" : "s"}` : "Seus amigos"}</p>
            </div>
            <BotaoFechar onClose={onClose} className="sm:hidden" />
          </div>
          {/* Tag propria sempre visivel ao abrir o chat, pra passar
              pra um amigo adicionar sem precisar entrar no painel
              de "Adicionar amigo". */}
          <MinhaTag perfil={meuPerfil} />
        </div>

        {/* Alterna entre a lista e o painel de adicionar amigo. */}
        <div className="flex items-center gap-1 border-b border-white/[0.07] p-2">
          <AbaChat ativa={!mostrarAdicionar} onClick={() => setMostrarAdicionar(false)} icone={<Users size={14} />}>
            Amigos
          </AbaChat>
          <AbaChat ativa={mostrarAdicionar} onClick={() => setMostrarAdicionar(true)} icone={<UserPlus size={14} />}>
            Adicionar
            {pedidos.length > 0 && (
              <span className="rounded-full px-1.5 text-[10px] font-bold leading-4 text-black" style={{ background: OURO }}>
                {pedidos.length}
              </span>
            )}
          </AbaChat>
        </div>

        {mostrarAdicionar ? (
          <AdicionarAmigo
            meuPerfil={meuPerfil}
            pedidos={pedidos}
            onPedidoRespondido={carregarTudo}
            onAdicionado={carregarTudo}
          />
        ) : (
          <div className="painel-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {carregandoLista ? (
              <div className="flex flex-col gap-1.5 p-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="painel-esqueleto h-14 rounded-2xl" />
                ))}
              </div>
            ) : contatos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#d4af37]">
                  <Users size={20} />
                </span>
                <p className="text-[13px] font-medium text-ink">Nenhum amigo ainda</p>
                <p className="text-[12px] text-muted">Adicione alguém pela tag (@apelido#0000) pra começar a conversar.</p>
                <button
                  onClick={() => setMostrarAdicionar(true)}
                  className="mt-1 flex items-center gap-1.5 rounded-xl bg-[#d4af37] px-3.5 py-2 text-[12.5px] font-semibold text-black transition hover:bg-[#e2c35a]"
                >
                  <UserPlus size={14} /> Adicionar amigo
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {contatos.map((c) => {
                  const ativo = ativoId === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => abrirConversa(c.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-colors ${
                          ativo ? "border-[#d4af37]/25 bg-[#d4af37]/[0.07]" : "border-transparent hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <AvatarNivel userId={c.id} avatarId={c.avatarId} avatarUrl={c.avatarUrl} tamanho={40} />
                          {c.online && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#111] bg-positive"
                              aria-label="Online"
                              title="Online"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`truncate text-[13px] ${c.unreadCount > 0 ? "font-semibold text-ink" : "font-medium text-ink"}`}>{c.nome}</p>
                            {c.lastAt && (
                              <span className={`shrink-0 text-[10.5px] tabular-nums ${c.unreadCount > 0 ? "text-[#d4af37]" : "text-muted"}`}>
                                {formatarQuando(c.lastAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[12px] text-muted">
                              {c.lastMessage ? `${c.lastIsMine ? "Você: " : ""}${c.lastMessage}` : "Sem mensagens ainda"}
                            </p>
                            {c.unreadCount > 0 && (
                              <span
                                className="grid min-w-[18px] shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold leading-[18px] text-black"
                                style={{ background: OURO }}
                              >
                                {c.unreadCount > 9 ? "9+" : c.unreadCount}
                              </span>
                            )}
                          </div>
                          {c.teamName && (
                            <Chip color="#5AA6E0" size="sm" className="mt-1">
                              {c.teamName}
                            </Chip>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Conversa ativa */}
      <div className={`flex min-w-0 flex-1 flex-col ${mostrarListaMobile || mostrarAdicionar ? "hidden sm:flex" : "flex"}`}>
        {!ativoId ? (
          <div className="relative grid flex-1 place-items-center p-6 text-center">
            <BotaoFechar onClose={onClose} className="absolute right-4 top-4 hidden sm:grid" />
            <div className="flex flex-col items-center gap-2">
              <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-muted">
                <MessageCircle size={22} />
              </span>
              <p className="text-[13px] text-muted">Escolha uma conversa ao lado.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
              <button
                onClick={() => setAtivoId(null)}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted hover:text-ink sm:hidden"
                aria-label="Voltar"
              >
                <ArrowLeft size={15} />
              </button>
              {contatoAtivo ? (
                <>
                  <div className="relative shrink-0">
                    <AvatarNivel userId={contatoAtivo.id} avatarId={contatoAtivo.avatarId} avatarUrl={contatoAtivo.avatarUrl} tamanho={36} />
                    {contatoAtivo.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#111] bg-positive" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[14px] font-semibold text-ink">{contatoAtivo.nome}</p>
                      {contatoAtivo.teamName && (
                        <Chip color="#5AA6E0" size="sm">
                          {contatoAtivo.teamName}
                        </Chip>
                      )}
                    </div>
                    <p className={`text-[11.5px] ${contatoAtivo.online ? "text-positive" : "text-muted"}`}>
                      {contatoAtivo.online ? "Online agora" : "Amigo"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="painel-esqueleto h-9 flex-1 rounded-xl" aria-hidden />
              )}
              <BotaoFechar onClose={onClose} className="hidden sm:grid" />
            </div>

            <div ref={scrollRef} className="painel-scroll flex-1 space-y-2 overflow-y-auto p-4">
              {carregandoThread ? (
                <p className="text-[13px] text-muted">Carregando…</p>
              ) : mensagens.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted">Nenhuma mensagem ainda. Diga oi 👋</p>
              ) : (
                mensagens.map((m) => (
                  <MessageBubble key={m.id} message={m} isMine={m.senderId === meId} getAudioUrl={getFriendAudioUrl} />
                ))
              )}
            </div>

            <MessageComposer onSendText={enviarTexto} onSendAudio={enviarAudio} disabled={!contatoAtivo} />
          </>
        )}
      </div>

      {erro && (
        <button
          type="button"
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-negative/40 bg-black/80 px-4 py-2 text-[13px] text-negative shadow-lg backdrop-blur"
          onClick={() => setErro(null)}
        >
          {erro}
        </button>
      )}
    </JanelaVidro>
  );
}

function AbaChat({ ativa, onClick, icone, children }: { ativa: boolean; onClick: () => void; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-medium transition-colors ${
        ativa ? "bg-white/[0.06] text-ink" : "text-muted hover:bg-white/[0.03] hover:text-ink"
      }`}
    >
      <span className={ativa ? "text-[#d4af37]" : undefined}>{icone}</span>
      {children}
    </button>
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
      className="mt-3 flex w-full items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:border-[#d4af37]/40"
    >
      <span className="shrink-0 text-[10.5px] text-muted">Sua tag</span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{tag}</span>
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
    <div className="painel-scroll min-h-0 flex-1 overflow-y-auto p-3">
      {minhaTag && (
        <div className="painel-bloco mb-4 rounded-2xl border border-white/[0.06] px-3.5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/60">Sua tag</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{minhaTag}</p>
            <button
              onClick={copiarTag}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted transition hover:border-white/20 hover:text-ink"
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
        <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/60">
          <UserPlus size={12} /> Adicionar por tag
        </p>
        <div className="flex gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            placeholder="@apelido#0000"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-[#d4af37]/60"
          />
          <button
            onClick={adicionar}
            disabled={enviando || !tag.trim()}
            className="shrink-0 rounded-xl bg-[#d4af37] px-3.5 py-2 text-[13px] font-semibold text-black transition hover:bg-[#e2c35a] disabled:opacity-50"
          >
            {enviando ? "…" : "Adicionar"}
          </button>
        </div>
        {msg && (
          <p className={`mt-1.5 text-[11px] ${msg.tipo === "ok" ? "text-positive" : "text-negative"}`}>{msg.texto}</p>
        )}
      </div>

      {pedidos.length > 0 && (
        <div className="border-t border-white/[0.07] pt-4">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/60">Pedidos recebidos</p>
          <ul className="space-y-1.5">
            {pedidos.map((p) => (
              <li key={p.friendshipId} className="painel-bloco rounded-2xl border border-[#d4af37]/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AvatarNivel userId={p.userId} avatarId={p.avatarId} avatarUrl={p.avatarUrl} tamanho={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{p.nome}</p>
                    <p className="truncate text-[10.5px] text-muted">{p.friendTag}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => responder(p, true)}
                    disabled={respondendo === p.friendshipId}
                    className="flex-1 rounded-lg bg-[#d4af37] py-1.5 text-[12px] font-semibold text-black transition hover:bg-[#e2c35a] disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => responder(p, false)}
                    disabled={respondendo === p.friendshipId}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-[12px] text-muted transition hover:border-white/20 hover:text-ink disabled:opacity-50"
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
