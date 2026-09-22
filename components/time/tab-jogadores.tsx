"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronDown, Info, Search, ArrowUpDown, Send, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { AssistenteCoach } from "@/components/time/assistente-coach";
import { PlayerDetailModal } from "@/components/time/player-detail-modal";
import {
  assignTeamDrill,
  calcularScore,
  fetchTeamLeakPlayers,
  traduzErroTime,
  type TeamDashboardRow,
  type TeamLabel,
  type TeamLeak,
  type TeamLeakPlayer,
} from "@/lib/services/team-service";
import { BRL } from "@/lib/format";

// Lista de jogadores. Decisoes de UX:
// - mesmo cartão "elenco de time" usado pros coaches/admin na aba
//   Perfil (foto grande + nome embaixo) — so' identidade + dinheiro
//   ganho/contribuído ao time; tudo mais (score, streak, etiqueta,
//   coach, remover, conversar) mora na ficha completa, que abre ao
//   clicar no nome/foto;
// - filtro por etiqueta em cima, porque time grande se organiza por
//   buy-in e o coach quase sempre olha um recorte, nao a lista toda.

type Ordem = "nome" | "risco" | "xp" | "treinos" | "acerto" | "revisadas" | "resultado";

const OPCOES_ORDEM: { key: Ordem; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "risco", label: "Prioridade (Score de evolução)" },
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
  const router = useRouter();
  const [filtroLabel, setFiltroLabel] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  // Ficha cadastral abre em modal em vez de navegar pra fora da lista --
  // preserva filtro e busca ao fechar.
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);

  // Conversar nunca abre um chat solto -- sempre manda pra Central de
  // Conversas (topbar, components/chat/chat-center.tsx), que ja sabe
  // ler ?chat=<userId> e abrir a thread certa (mesmo mecanismo do
  // deep-link da notificacao).
  function abrirConversa(userId: string) {
    router.push(`/modulos?chat=${userId}`);
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
      // Menor score primeiro: quem precisa de atenção do coach aparece no topo.
      risco: (a, b) => calcularScore(a).valor - calcularScore(b).valor,
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
      <AssistenteCoach teamId={teamId} jogadores={jogadores} onErro={onErro} onAbrirFicha={setFichaAberta} />
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
        // Cartela estilo "elenco de time" -- mesmo card usado pra
        // coaches/admin na aba Perfil (foto grande, nome embaixo): so'
        // identidade + dinheiro ganho/contribuído ao time. O resto
        // (score, streak, treinos, etiqueta, ações de admin) mora na
        // ficha completa, que abre ao clicar no nome.
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {lista.map((j) => (
            <li key={j.userId} className="flex flex-col items-center gap-2.5 rounded-lg border border-hairline bg-elevated px-3 py-4 text-center transition-colors hover:border-white/15">
              <button onClick={() => setFichaAberta(j.userId)} aria-label={`Ver ficha de ${j.nome}`}>
                <Avatar id={j.avatarId} url={j.avatarUrl} size={72} />
              </button>
              <div className="min-w-0">
                <button onClick={() => setFichaAberta(j.userId)} className="truncate text-sm font-semibold hover:underline">
                  {j.nome}
                </button>
                <p className={`mt-1 text-[13px] font-medium tnum ${
                  j.lucroNoTime > 0 ? "text-positive" : j.lucroNoTime < 0 ? "text-negative" : "text-muted"
                }`}>
                  {j.jogosNoTime > 0 ? BRL.format(j.lucroNoTime) : "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      </section>

      {fichaAberta && (
        <PlayerDetailModal
          playerId={fichaAberta}
          onFechar={() => setFichaAberta(null)}
          jogador={jogadores.find((j) => j.userId === fichaAberta)}
          labels={labels}
          coaches={coaches}
          isAdmin={isAdmin}
          podeConversar={podeConversar}
          onAbrirConversa={() => abrirConversa(fichaAberta)}
          onChange={onChange}
          onErro={onErro}
        />
      )}
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
