"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Flame, ChevronRight, ChevronDown, Info, Search, ArrowUpDown, MoreVertical, X, Tag, UserCog, Send, UserMinus, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { AssistenteCoach } from "@/components/time/assistente-coach";
import {
  assignCoach,
  assignTeamDrill,
  diasSemAtividade,
  fetchTeamLeakPlayers,
  fetchTeamThread,
  markThreadRead,
  removeMember,
  sendTeamMessage,
  setMemberLabel,
  traduzErroTime,
  type TeamDashboardRow,
  type TeamLabel,
  type TeamLeak,
  type TeamLeakPlayer,
  type TeamMessage,
} from "@/lib/services/team-service";
import { BRL } from "@/lib/format";

// Lista de jogadores. Decisoes de UX:
// - nivel colado ao nome (identidade do jogador, nao metrica);
// - etiqueta como chip colorido, sempre visivel na linha;
// - coach e demais acoes administrativas saem da linha e vao para um
//   menu "Acoes" (⋮) com modal — a linha fica para leitura, o admin
//   so abre a modal quando de fato vai alterar algo;
// - filtro por etiqueta em cima, porque time grande se organiza por
//   buy-in e o coach quase sempre olha um recorte, nao a lista toda;
// - linha inteira clicavel para a ficha — menos fricção que um botao.

const INATIVO_DIAS = 7;

type Ordem = "nome" | "xp" | "treinos" | "acerto" | "revisadas" | "resultado";

const OPCOES_ORDEM: { key: Ordem; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "xp", label: "Ranking (XP no período)" },
  { key: "treinos", label: "Mais treinos" },
  { key: "acerto", label: "Melhor acerto GTO" },
  { key: "revisadas", label: "Mais revisões" },
  { key: "resultado", label: "Melhor resultado" },
];

export function TabJogadores({
  teamId,
  jogadores,
  labels,
  isAdmin,
  podeConversar,
  coaches,
  leaks,
  dias,
  onAtribuido,
  onChange,
  onErro,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  labels: TeamLabel[];
  isAdmin: boolean;
  /** Admin ou coach: quem pode abrir o menu de ações (ao menos pra conversar). */
  podeConversar: boolean;
  coaches: { userId: string; nome: string }[];
  leaks: TeamLeak[];
  dias: number;
  onAtribuido: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [filtroLabel, setFiltroLabel] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [acaoAberta, setAcaoAberta] = useState<TeamDashboardRow | null>(null);
  const [conversaCom, setConversaCom] = useState<TeamDashboardRow | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function alternarExpandido(userId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  const lista = useMemo(() => {
    const filtrada = jogadores.filter((j) => {
      if (filtroLabel === "sem" && j.labelId) return false;
      if (filtroLabel !== "todas" && filtroLabel !== "sem" && j.labelId !== filtroLabel) return false;
      if (busca.trim() && !j.nome.toLowerCase().includes(busca.trim().toLowerCase())) return false;
      return true;
    });
    const acerto = (j: TeamDashboardRow) => (j.treinos > 0 ? j.acertosGto / j.treinos : -1);
    const sorters: Record<Ordem, (a: TeamDashboardRow, b: TeamDashboardRow) => number> = {
      nome: (a, b) => a.nome.localeCompare(b.nome),
      xp: (a, b) => b.xpPeriodo - a.xpPeriodo || (b.streakDays ?? 0) - (a.streakDays ?? 0),
      treinos: (a, b) => b.treinos - a.treinos,
      acerto: (a, b) => acerto(b) - acerto(a),
      revisadas: (a, b) => b.maosRevisadas - a.maosRevisadas,
      resultado: (a, b) => b.lucroNoTime - a.lucroNoTime,
    };
    return [...filtrada].sort(sorters[ordem]);
  }, [jogadores, filtroLabel, busca, ordem]);

  return (
    <div className="space-y-4">
      <AssistenteCoach teamId={teamId} jogadores={jogadores} onErro={onErro} />
      <LeaksSection leaks={leaks} dias={dias} onAtribuido={onAtribuido} />

      <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-[15px] font-semibold">
          Jogadores <span className="ml-1 text-sm font-normal text-muted">{lista.length}</span>
        </h2>

        <div className="flex items-center gap-1.5 print:hidden">
          <ArrowUpDown size={13} className="text-muted" />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[13px] text-ink outline-none"
          >
            {OPCOES_ORDEM.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="relative print:hidden">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="w-40 rounded-lg border border-hairline bg-elevated py-1.5 pl-8 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-ink/40"
          />
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 print:hidden">
          <FiltroChip ativo={filtroLabel === "todas"} onClick={() => setFiltroLabel("todas")}>Todas</FiltroChip>
          {labels.map((l) => (
            <FiltroChip key={l.id} ativo={filtroLabel === l.id} cor={l.color} onClick={() => setFiltroLabel(l.id)}>
              {l.name}
            </FiltroChip>
          ))}
          <FiltroChip ativo={filtroLabel === "sem"} onClick={() => setFiltroLabel("sem")}>Sem etiqueta</FiltroChip>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhum jogador neste recorte.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {lista.map((j, idx) => {
            const d = diasSemAtividade(j.lastActivityAt);
            const inativo = d === null || d >= INATIVO_DIAS;
            const pct = j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null;
            const aberto = expandidos.has(j.userId);
            return (
              <li key={j.userId} className="py-2.5">
                {/* Grid com colunas fixas compartilhadas por todas as linhas —
                    resolve o desalinhamento do layout anterior (flex por
                    linha fazia cada linha calcular suas proprias larguras).
                    So' "Resultado" fica visivel de cara; o resto (treinos,
                    GTO, revisadas, jogos) entra no detalhe expansivel. */}
                <div className="grid grid-cols-[16px_auto_1fr_84px_36px_36px_36px] items-center gap-2.5 sm:grid-cols-[20px_auto_1fr_96px_36px_36px_36px] sm:gap-3">
                  <span className={`text-center text-[13px] font-bold tnum ${
                    ordem !== "nome" ? (idx === 0 ? "text-evolution" : "text-muted") : "invisible"
                  }`}>
                    {ordem !== "nome" ? idx + 1 : "·"}
                  </span>

                  <Avatar id={j.avatarId} url={j.avatarUrl} size={38} />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/time/jogador/${j.userId}`} className="truncate text-sm font-medium hover:underline">
                        {j.nome}
                      </Link>
                      <span className="shrink-0 rounded-md bg-elevated px-1.5 py-px text-[10px] font-bold tracking-wide text-muted">
                        NÍVEL {j.level ?? 1}
                      </span>
                      {j.labelName && j.labelColor && (
                        <Chip color={j.labelColor} size="sm">{j.labelName}</Chip>
                      )}
                      {j.streakDays ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-evolution">
                          <Flame size={11} />
                          {j.streakDays}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      Entrou em {new Date(j.joinedAt).toLocaleDateString("pt-BR")}
                      {" · "}
                      <span className={inativo ? "text-negative" : undefined}>
                        {d === null ? "nunca ativo" : d === 0 ? "ativo hoje" : `há ${d}d sem atividade`}
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    {ordem === "xp" ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">XP no período</p>
                        <p className="text-[13px] font-medium tnum text-evolution">{j.xpPeriodo} XP</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Resultado</p>
                        <p className={`text-[13px] font-medium tnum ${
                          j.lucroNoTime > 0 ? "text-positive" : j.lucroNoTime < 0 ? "text-negative" : "text-ink/90"
                        }`}>
                          {j.jogosNoTime > 0 ? BRL.format(j.lucroNoTime) : "—"}
                        </p>
                      </>
                    )}
                  </div>

                  {podeConversar ? (
                    <button
                      onClick={() => setConversaCom(j)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                      aria-label={`Conversar com ${j.nome}`}
                    >
                      <MessageCircle size={15} />
                    </button>
                  ) : <span />}

                  <button
                    onClick={() => alternarExpandido(j.userId)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                    aria-label={aberto ? `Recolher informações de ${j.nome}` : `Ver informações de ${j.nome}`}
                  >
                    <ChevronDown size={15} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
                  </button>

                  {isAdmin ? (
                    <button
                      onClick={() => setAcaoAberta(j)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                      aria-label={`Ações para ${j.nome}`}
                    >
                      <MoreVertical size={15} />
                    </button>
                  ) : <span />}
                </div>

                {aberto && (
                  <div className="mt-2.5 ml-[26px] flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-hairline bg-elevated px-3.5 py-3 sm:ml-[64px]">
                    <Metrica label="Treinos" valor={String(j.treinos)} />
                    <Metrica label="GTO" valor={pct === null ? "—" : `${pct}%`} />
                    <Metrica label="Revisadas" valor={String(j.maosRevisadas)} />
                    <Metrica label="Jogos" valor={String(j.jogosNoTime)} />
                    <Link href={`/time/jogador/${j.userId}`}
                      className="ml-auto flex items-center gap-1 text-[12px] font-medium text-ink hover:underline">
                      Ver ficha completa <ChevronRight size={13} />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {acaoAberta && (
        <AcoesJogadorModal
          jogador={acaoAberta}
          labels={labels}
          coaches={coaches}
          isAdmin={isAdmin}
          onFechar={() => setAcaoAberta(null)}
          onAbrirConversa={() => {
            setConversaCom(acaoAberta);
            setAcaoAberta(null);
          }}
          onChange={onChange}
          onErro={onErro}
        />
      )}

      {conversaCom && (
        <ConversaDrawer jogador={conversaCom} onFechar={() => setConversaCom(null)} onErro={onErro} />
      )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// Modal de ações por jogador. Etiqueta, coach e remoção são
// exclusivas de admin; conversar é liberado também pro coach (o
// backend send_team_message já aceita qualquer par do mesmo time).
// ------------------------------------------------------------
function AcoesJogadorModal({
  jogador,
  labels,
  coaches,
  isAdmin,
  onFechar,
  onAbrirConversa,
  onChange,
  onErro,
}: {
  jogador: TeamDashboardRow;
  labels: TeamLabel[];
  coaches: { userId: string; nome: string }[];
  isAdmin: boolean;
  onFechar: () => void;
  onAbrirConversa: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [labelId, setLabelId] = useState(jogador.labelId ?? "");
  const [coachId, setCoachId] = useState(jogador.coachId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  async function salvarEtiquetaCoach() {
    setSalvando(true);
    try {
      if (labelId !== (jogador.labelId ?? "")) await setMemberLabel(jogador.userId, labelId || null);
      if (coachId !== (jogador.coachId ?? "")) await assignCoach(jogador.userId, coachId || null);
      onChange();
      onFechar();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarRemocao() {
    setRemovendo(true);
    try {
      await removeMember(jogador.userId);
      onChange();
      onFechar();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Avatar id={jogador.avatarId} url={jogador.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{jogador.nome}</p>
            <p className="text-xs text-muted">Ações do jogador</p>
          </div>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {isAdmin && (
            <>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <Tag size={12} /> Etiqueta
                </label>
                <select
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="">Sem etiqueta</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {coaches.length > 0 && (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    <UserCog size={12} /> Coach
                  </label>
                  <select
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
                  >
                    <option value="">Sem coach</option>
                    {coaches.map((c) => (
                      <option key={c.userId} value={c.userId}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={salvarEtiquetaCoach}
                disabled={salvando}
                className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.01] disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar alterações"}
              </button>
            </>
          )}

          <div className={isAdmin ? "border-t border-hairline pt-4" : undefined}>
            <button
              onClick={onAbrirConversa}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              <MessageCircle size={14} />
              Abrir conversa
            </button>
          </div>

          {isAdmin && (
            <div className="border-t border-hairline pt-4">
              {!confirmarRemover ? (
                <button
                  onClick={() => setConfirmarRemover(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-negative/40 px-4 py-2 text-sm font-medium text-negative transition-colors hover:bg-negative/10"
                >
                  <UserMinus size={14} />
                  Remover do time
                </button>
              ) : (
                <div className="rounded-lg border border-negative/40 bg-negative/10 p-3">
                  <p className="text-[13px] text-negative">Remover {jogador.nome} do time? Essa ação não pode ser desfeita.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setConfirmarRemover(false)}
                      className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] text-ink hover:border-ink/40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarRemocao}
                      disabled={removendo}
                      className="flex-1 rounded-lg bg-negative px-3 py-1.5 text-[13px] font-semibold text-void transition-transform hover:scale-[1.01] disabled:opacity-50"
                    >
                      {removendo ? "Removendo…" : "Confirmar remoção"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Drawer de conversa 1:1 com o jogador. Fica reservado (nao vive
// dentro do modal de Acoes) pra nao competir com os controles rapidos
// de etiqueta/coach — o coach abre so quando de fato vai conversar.
// O envio ja dispara a notificacao de sino pro jogador (via RPC
// send_team_message -> notify_system, categoria "team").
// ------------------------------------------------------------
function ConversaDrawer({
  jogador,
  onFechar,
  onErro,
}: {
  jogador: TeamDashboardRow;
  onFechar: () => void;
  onErro: (s: string) => void;
}) {
  const [mensagens, setMensagens] = useState<TeamMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!ativo) return;
        setMeId(data.user?.id ?? null);
        const thread = await fetchTeamThread(jogador.userId);
        if (!ativo) return;
        setMensagens(thread);
        await markThreadRead(jogador.userId).catch(() => {});
      } catch (e) {
        if (ativo) onErro(traduzErroTime(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogador.userId]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    const corpo = texto.trim();
    setTexto("");
    try {
      await sendTeamMessage(jogador.userId, corpo);
      const thread = await fetchTeamThread(jogador.userId);
      setMensagens(thread);
    } catch (e) {
      onErro(traduzErroTime(e));
      setTexto(corpo);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-void/70" onClick={onFechar}>
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline p-4">
          <Avatar id={jogador.avatarId} url={jogador.avatarUrl} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{jogador.nome}</p>
            <p className="text-xs text-muted">Conversa</p>
          </div>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {carregando ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : mensagens.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma mensagem ainda. Diga oi.</p>
          ) : (
            mensagens.map((m) => {
              const minha = m.senderId === meId;
              return (
                <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] ${
                      minha ? "bg-ink text-void" : "border border-hairline bg-elevated text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${minha ? "text-void/60" : "text-muted"}`}>
                      {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-hairline p-3">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !enviando && enviar()}
            placeholder="Escreva uma mensagem…"
            className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/50"
          />
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-void disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Metrica({ label, valor, tom, largo }: { label: string; valor: string; tom?: "positivo" | "negativo"; largo?: boolean }) {
  const cor = tom === "positivo" ? "text-positive" : tom === "negativo" ? "text-negative" : "text-ink/90";
  return (
    <div className={largo ? "w-24 shrink-0 text-right" : "w-16 shrink-0 text-right"}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className={`text-[13px] font-medium tnum ${cor}`}>{valor}</p>
    </div>
  );
}

function FiltroChip({ children, ativo, cor, onClick }: { children: React.ReactNode; ativo: boolean; cor?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
        ativo ? "border-transparent bg-ink text-void" : "border-hairline text-muted hover:text-ink"
      }`}
      style={!ativo && cor ? { color: cor, borderColor: `${cor}55` } : undefined}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------
// Leaks do time com atribuicao em massa — morava na Visao Geral, mas
// faz mais sentido junto da lista de jogadores (o coach ja esta' olhando
// pra quem precisa de treino). Recolhivel e fechado por padrao, igual
// o Assistente do Kanban, pra nao competir com a lista logo abaixo.
// ------------------------------------------------------------
function severidade(indice: number, total: number): { label: string; cor: string } {
  const pct = total <= 1 ? 0 : indice / (total - 1);
  if (pct <= 0.33) return { label: "Alta", cor: "#F26D6D" };
  if (pct <= 0.66) return { label: "Média", cor: "#F2B84C" };
  return { label: "Baixa", cor: "#8b8b8b" };
}

function LeaksSection({ leaks, dias, onAtribuido }: { leaks: TeamLeak[]; dias: number; onAtribuido: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [leakVendo, setLeakVendo] = useState<TeamLeak | null>(null);

  if (leaks.length === 0) return null;

  async function atribuir(l: TeamLeak) {
    if (!l.drillId) return;
    const chave = `${l.reasonCode}:${l.street}`;
    setAtribuindo(chave);
    try {
      const n = await assignTeamDrill(l.reasonCode, l.street, l.drillId, dias);
      setFeedback((prev) => ({
        ...prev,
        [chave]: n > 0 ? `Enviado para ${n} jogador${n === 1 ? "" : "es"}` : "Já estavam com esse treino recente",
      }));
      onAtribuido();
    } catch {
      setFeedback((prev) => ({ ...prev, [chave]: "Não foi possível atribuir" }));
    } finally {
      setAtribuindo(null);
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 text-left text-[15px] font-semibold">
        Leaks mais frequentes
        <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{leaks.length}</span>
        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted" title="Baseado nas autoavaliações de rua feitas no Revisor de Mãos">
          <Info size={12} />
          avaliações de rua no Revisor
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <ul className="mt-4 space-y-2">
          {leaks.map((l, i) => {
            const chave = `${l.reasonCode}:${l.street}`;
            const msg = feedback[chave];
            const sev = severidade(i, leaks.length);
            return (
              <li key={chave} className="flex items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                <Chip color={sev.cor} size="sm" className="shrink-0">{sev.label}</Chip>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{l.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted">{l.street}</span>
                  </div>
                  {l.drillTitle && !msg && (
                    <p className="mt-0.5 text-[11px] text-muted">→ {l.drillTitle}</p>
                  )}
                  {msg && <p className="mt-0.5 text-[11px] text-training">{msg}</p>}
                </div>

                <button
                  onClick={() => setLeakVendo(l)}
                  className="shrink-0 text-xs text-muted tnum underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  {l.total}× · {l.jogadores} jogador(es)
                </button>

                {l.treinavel && (
                  <button
                    onClick={() => atribuir(l)}
                    disabled={atribuindo === chave}
                    title="Envia o drill correspondente a este leak para todos os jogadores afetados"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-review/40 px-2.5 py-1.5 text-[11px] font-semibold text-review transition-colors hover:bg-review/10 disabled:opacity-50 print:hidden"
                  >
                    <Send size={12} />
                    {atribuindo === chave ? "Enviando…" : "Enviar treino ao time"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {leakVendo && (
        <ModalLeakJogadores leak={leakVendo} dias={dias} onFechar={() => setLeakVendo(null)} />
      )}
    </section>
  );
}

// ------------------------------------------------------------
// So mostra quais jogadores tem determinado leak quando o coach pede
// (botao na linha) — a lista completa nao cabe na linha resumida, e
// nem toda vez que se olha os leaks se precisa saber os nomes.
// ------------------------------------------------------------
function ModalLeakJogadores({ leak, dias, onFechar }: { leak: TeamLeak; dias: number; onFechar: () => void }) {
  const [jogadores, setJogadores] = useState<TeamLeakPlayer[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchTeamLeakPlayers(leak.reasonCode, leak.street, dias)
      .then((r) => ativo && setJogadores(r))
      .catch((e) => ativo && setErro(traduzErroTime(e)));
    return () => {
      ativo = false;
    };
  }, [leak, dias]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{leak.label}</p>
            <p className="text-xs text-muted">{leak.street} · {leak.total}× nos últimos {dias}d</p>
          </div>
          <button onClick={onFechar} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4">
          {erro ? (
            <p className="text-sm text-negative">{erro}</p>
          ) : jogadores === null ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : jogadores.length === 0 ? (
            <p className="text-sm text-muted">Nenhum jogador encontrado.</p>
          ) : (
            <ul className="space-y-1">
              {jogadores.map((j) => (
                <li key={j.userId}>
                  <Link
                    href={`/time/jogador/${j.userId}`}
                    onClick={onFechar}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated"
                  >
                    <Avatar id={j.avatarId} url={j.avatarUrl} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm">{j.nome}</span>
                    <ChevronRight size={14} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
