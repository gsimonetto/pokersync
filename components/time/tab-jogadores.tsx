"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Flame, ChevronRight, Search, ArrowUpDown, MoreVertical, X, Tag, UserCog, Send, UserMinus, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  assignCoach,
  diasSemAtividade,
  fetchTeamThread,
  markThreadRead,
  removeMember,
  sendTeamMessage,
  setMemberLabel,
  traduzErroTime,
  type TeamDashboardRow,
  type TeamLabel,
  type TeamMessage,
} from "@/lib/services/team-service";

// Lista de jogadores. Decisoes de UX:
// - nivel colado ao nome (identidade do jogador, nao metrica);
// - etiqueta como chip colorido, sempre visivel na linha;
// - coach e demais acoes administrativas saem da linha e vao para um
//   menu "Acoes" (⋮) com modal — a linha fica para leitura, o admin
//   so abre a modal quando de fato vai alterar algo;
// - filtro por etiqueta em cima, porque time grande se organiza por
//   buy-in e o coach quase sempre olha um recorte, nao a lista toda;
// - linha inteira clicavel para a ficha — menos fricção que um botao.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const INATIVO_DIAS = 7;

type Ordem = "nome" | "treinos" | "acerto" | "revisadas" | "resultado";

const OPCOES_ORDEM: { key: Ordem; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "treinos", label: "Mais treinos" },
  { key: "acerto", label: "Melhor acerto GTO" },
  { key: "revisadas", label: "Mais revisões" },
  { key: "resultado", label: "Melhor resultado" },
];

export function TabJogadores({
  jogadores,
  labels,
  isAdmin,
  coaches,
  onChange,
  onErro,
}: {
  jogadores: TeamDashboardRow[];
  labels: TeamLabel[];
  isAdmin: boolean;
  coaches: { userId: string; nome: string }[];
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [filtroLabel, setFiltroLabel] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [acaoAberta, setAcaoAberta] = useState<TeamDashboardRow | null>(null);
  const [conversaCom, setConversaCom] = useState<TeamDashboardRow | null>(null);

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
      treinos: (a, b) => b.treinos - a.treinos,
      acerto: (a, b) => acerto(b) - acerto(a),
      revisadas: (a, b) => b.maosRevisadas - a.maosRevisadas,
      resultado: (a, b) => b.lucroNoTime - a.lucroNoTime,
    };
    return [...filtrada].sort(sorters[ordem]);
  }, [jogadores, filtroLabel, busca, ordem]);

  return (
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
          <Chip ativo={filtroLabel === "todas"} onClick={() => setFiltroLabel("todas")}>Todas</Chip>
          {labels.map((l) => (
            <Chip key={l.id} ativo={filtroLabel === l.id} cor={l.color} onClick={() => setFiltroLabel(l.id)}>
              {l.name}
            </Chip>
          ))}
          <Chip ativo={filtroLabel === "sem"} onClick={() => setFiltroLabel("sem")}>Sem etiqueta</Chip>
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
            return (
              <li key={j.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex items-center gap-3">
                  {ordem !== "nome" && (
                    <span className={`w-5 shrink-0 text-center text-[13px] font-bold tnum ${
                      idx === 0 ? "text-evolution" : "text-muted"
                    }`}>
                      {idx + 1}
                    </span>
                  )}
                  <Avatar id={j.avatarId} url={j.avatarUrl} size={38} />

                  <div className="min-w-0 flex-1 sm:flex-[2]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/time/jogador/${j.userId}`} className="truncate text-sm font-medium hover:underline">
                        {j.nome}
                      </Link>
                      <span className="shrink-0 rounded-md bg-elevated px-1.5 py-px text-[10px] font-bold tracking-wide text-muted">
                        NÍVEL {j.level ?? 1}
                      </span>
                      {j.labelName && (
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${j.labelColor}22`, color: j.labelColor ?? undefined, border: `1px solid ${j.labelColor}55` }}
                        >
                          {j.labelName}
                        </span>
                      )}
                      {j.streakDays ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-evolution">
                          <Flame size={11} />
                          {j.streakDays}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Entrou em {new Date(j.joinedAt).toLocaleDateString("pt-BR")}
                      {" · "}
                      <span className={inativo ? "text-negative" : undefined}>
                        {d === null ? "nunca ativo" : d === 0 ? "ativo hoje" : `há ${d}d sem atividade`}
                      </span>
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => setAcaoAberta(j)}
                      className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden sm:hidden"
                      aria-label={`Ações para ${j.nome}`}
                    >
                      <MoreVertical size={15} />
                    </button>
                  )}
                </div>

                {/* Metricas: grid compacto no mobile (sem scroll horizontal),
                    volta a ser uma fileira de colunas a partir do sm. */}
                <div className="grid grid-cols-3 gap-x-2 gap-y-2 pl-[50px] sm:contents sm:pl-0">
                  <Metrica label="Treinos" valor={String(j.treinos)} />
                  <Metrica label="GTO" valor={pct === null ? "—" : `${pct}%`} />
                  <Metrica label="Revisadas" valor={String(j.maosRevisadas)} />
                  <Metrica label="Jogos" valor={String(j.jogosNoTime)} />
                  <Metrica
                    label="Resultado"
                    valor={j.jogosNoTime > 0 ? BRL.format(j.lucroNoTime) : "—"}
                    tom={j.lucroNoTime > 0 ? "positivo" : j.lucroNoTime < 0 ? "negativo" : undefined}
                    largo
                  />
                </div>

                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {isAdmin && (
                    <button
                      onClick={() => setAcaoAberta(j)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                      aria-label={`Ações para ${j.nome}`}
                    >
                      <MoreVertical size={15} />
                    </button>
                  )}

                  <Link href={`/time/jogador/${j.userId}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                    aria-label={`Abrir ficha de ${j.nome}`}>
                    <ChevronRight size={15} />
                  </Link>
                </div>
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
  );
}

// ------------------------------------------------------------
// Modal de ações administrativas por jogador. Etiqueta e coach usam
// os services ja existentes (setMemberLabel / assignCoach).
//
// ATENÇÃO: "Remover do time" e "Enviar mensagem" ainda não têm uma
// função correspondente confirmada em lib/services/team-service.ts
// (não temos esse arquivo pra checar). A UI está pronta e chama
// removeMember(userId) e sendTeamMessage(userId, texto) — preciso
// que você confirme os nomes reais (ou me mande o arquivo) antes de
// eu fechar essa parte, pra não assumir uma função que não existe.
// ------------------------------------------------------------
function AcoesJogadorModal({
  jogador,
  labels,
  coaches,
  onFechar,
  onAbrirConversa,
  onChange,
  onErro,
}: {
  jogador: TeamDashboardRow;
  labels: TeamLabel[];
  coaches: { userId: string; nome: string }[];
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

          <div className="border-t border-hairline pt-4">
            <button
              onClick={onAbrirConversa}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              <MessageCircle size={14} />
              Abrir conversa
            </button>
          </div>

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

function Chip({ children, ativo, cor, onClick }: { children: React.ReactNode; ativo: boolean; cor?: string; onClick: () => void }) {
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
