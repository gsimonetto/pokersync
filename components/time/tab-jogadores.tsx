"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, ArrowUpDown, Flame, X } from "lucide-react";
import { EASE } from "@/components/painel/painel-card";
import { PlayerDetailModal } from "@/components/time/player-detail-modal";
import { PlayerBadge, crachaDoTime } from "@/components/time/player-badge";
import { calcularScore, diasSemAtividade, type TeamDashboardRow, type TeamLabel } from "@/lib/services/team-service";

// Lista de jogadores, no visual da tela inicial/Performance. Decisoes de UX:
// - cartão = crachá do jogador: foto com o anel do score de evolução
//   (escala própria do produto, 0-100), última atividade, sequência, e os
//   3 blocos do crachá (resultado, buy-in, acerto GTO); o resto
//   (etiqueta, coach, remover, conversar) mora na ficha, que abre ao
//   clicar no cartão;
// - filtro por etiqueta em etiquetas com "x" (mesmo padrão dos filtros da
//   Performance), porque time grande se organiza por buy-in e o coach
//   quase sempre olha um recorte, nao a lista toda.

type Ordem = "nome" | "risco" | "xp" | "treinos" | "acerto" | "revisadas" | "resultado";

const OPCOES_ORDEM: { key: Ordem; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "risco", label: "Prioridade (score)" },
  { key: "xp", label: "Ranking de XP" },
  { key: "treinos", label: "Mais treinos" },
  { key: "acerto", label: "Melhor acerto GTO" },
  { key: "revisadas", label: "Mais revisões" },
  { key: "resultado", label: "Melhor resultado" },
];

export function TabJogadores({
  jogadores,
  labels,
  isAdmin,
  podeConversar,
  coaches,
  onChange,
  onErro,
}: {
  jogadores: TeamDashboardRow[];
  labels: TeamLabel[];
  isAdmin: boolean;
  /** Admin ou coach: quem pode abrir o menu de ações (ao menos pra conversar). */
  podeConversar: boolean;
  coaches: { userId: string; nome: string }[];
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
      {/* O Assistente do coach e os "Leaks mais frequentes" do time (com o
          botão de enviar treino ao time) foram para o AI Coach da tela
          inicial -- único lugar com orientações automáticas. */}

      {/* Celular: título numa linha; busca + ordenação lado a lado; as
          etiquetas numa faixa que desliza de lado (antes tudo quebrava em
          várias linhas e o título partia no meio). */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <h2 className="flex items-baseline gap-1.5 whitespace-nowrap text-[15px] font-semibold tracking-tight sm:flex-1">
          Jogadores <span className="text-sm font-normal tabular-nums text-muted">{lista.length}</span>
        </h2>

        <div className="flex gap-2 print:hidden">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar jogador"
              aria-label="Buscar jogador"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-white/25 sm:w-48"
            />
          </div>

          <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5">
            <ArrowUpDown size={13} className="shrink-0 text-muted" />
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="max-w-[128px] bg-transparent py-2 text-[12.5px] text-ink outline-none sm:max-w-none"
              aria-label="Ordenar jogadores"
            >
              {OPCOES_ORDEM.map((o) => (
                <option key={o.key} value={o.key} className="bg-[#141414]">{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {labels.length > 0 && (
        <div
          className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 print:hidden [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filtrar por etiqueta"
        >
          <FiltroChip ativo={filtroLabel === "todas"} cor="#d4af37" onClick={() => setFiltroLabel("todas")}>
            Todas
          </FiltroChip>
          {labels.map((l) => (
            <FiltroChip
              key={l.id}
              ativo={filtroLabel === l.id}
              cor={l.color}
              onClick={() => setFiltroLabel(filtroLabel === l.id ? "todas" : l.id)}
            >
              {l.name}
            </FiltroChip>
          ))}
          <FiltroChip ativo={filtroLabel === "sem"} onClick={() => setFiltroLabel(filtroLabel === "sem" ? "todas" : "sem")}>
            Sem etiqueta
          </FiltroChip>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="py-6 text-sm text-muted">Nenhum jogador neste recorte.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {lista.map((j, i) => (
            <motion.li
              key={j.userId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 12) * 0.035 }}
            >
              <CartaoJogador j={j} onAbrir={() => setFichaAberta(j.userId)} />
            </motion.li>
          ))}
        </ul>
      )}

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

// Filtro de etiqueta: a escolhida acende na própria cor (fundo + borda
// cheia); as outras ficam só com o contorno. Tocar na acesa desmarca.
function FiltroChip({ children, cor, ativo, onClick }: { children: React.ReactNode; cor?: string; ativo: boolean; onClick: () => void }) {
  const c = cor ?? "#c4c7c8";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
        ativo ? "font-semibold" : "font-medium opacity-80 hover:opacity-100"
      }`}
      style={
        ativo
          ? { color: c, borderColor: c, background: `${c}22` }
          : { color: cor ?? undefined, borderColor: cor ? `${cor}55` : "rgba(255,255,255,0.1)" }
      }
    >
      {children}
      {ativo && cor !== "#d4af37" && <X size={11} aria-hidden />}
    </button>
  );
}

function ultimaAtividade(iso: string | null): string {
  const d = diasSemAtividade(iso);
  if (d == null) return "sem atividade ainda";
  // <= 0: horário da última atividade um pouco à frente do relógio do
  // aparelho não vira "há -1 dias".
  if (d <= 0) return "ativo hoje";
  if (d === 1) return "ativo ontem";
  return `há ${d} dias sem atividade`;
}

// O cartão da lista É o crachá do jogador (components/time/player-badge)
// -- o mesmo que aparece no funil e nas vagas; aqui só entra a linha de
// atividade/sequência, que é o que o coach decide de relance nesta aba.
function CartaoJogador({ j, onAbrir }: { j: TeamDashboardRow; onAbrir: () => void }) {
  const parado = diasSemAtividade(j.lastActivityAt);
  return (
    <PlayerBadge
      dados={crachaDoTime(j)}
      variante="cartao"
      onClick={onAbrir}
      ariaLabel={`Ver ficha de ${j.nome}`}
      subtitulo={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={parado != null && parado >= 7 ? "text-[#f08a8e]" : "text-muted"}>{ultimaAtividade(j.lastActivityAt)}</span>
          {(j.streakDays ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[#f59e0b]" title="Dias seguidos com atividade">
              <Flame size={11} />
              {j.streakDays}
            </span>
          )}
        </span>
      }
    />
  );
}
