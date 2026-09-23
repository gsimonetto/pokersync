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
  { key: "risco", label: "Prioridade (Score de evolução)" },
  { key: "xp", label: "Ranking (XP no período)" },
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

  const labelAtiva = labels.find((l) => l.id === filtroLabel);

  return (
    <div className="space-y-4">
      {/* O Assistente do coach e os "Leaks mais frequentes" do time (com o
          botão de enviar treino ao time) foram para o AI Coach da tela
          inicial -- único lugar com orientações automáticas. */}

      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="flex-1 text-[15px] font-semibold tracking-tight">
          Jogadores <span className="ml-1 text-sm font-normal tabular-nums text-muted">{lista.length}</span>
        </h2>

        <label className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 print:hidden">
          <ArrowUpDown size={13} className="text-muted" />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="bg-transparent text-[12.5px] text-ink outline-none"
            aria-label="Ordenar jogadores"
          >
            {OPCOES_ORDEM.map((o) => (
              <option key={o.key} value={o.key} className="bg-[#141414]">{o.label}</option>
            ))}
          </select>
        </label>

        <div className="relative print:hidden">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="w-40 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-8 pr-3 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-white/25"
          />
        </div>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          {/* Etiqueta ativa vira chip dourado com "x" (igual aos filtros da
              Performance); as outras ficam discretas, com a cor da etiqueta. */}
          {filtroLabel !== "todas" ? (
            <button
              onClick={() => setFiltroLabel("todas")}
              className="flex items-center gap-1 rounded-full border border-[#d4af37]/50 bg-[#d4af37]/12 px-3 py-1 text-[11.5px] font-semibold text-[#e6c763]"
            >
              {filtroLabel === "sem" ? "Sem etiqueta" : labelAtiva?.name}
              <X size={12} />
            </button>
          ) : (
            <span className="px-1 text-[11.5px] text-muted">Filtrar por etiqueta:</span>
          )}
          {labels
            .filter((l) => l.id !== filtroLabel)
            .map((l) => (
              <FiltroChip key={l.id} cor={l.color} onClick={() => setFiltroLabel(l.id)}>
                {l.name}
              </FiltroChip>
            ))}
          {filtroLabel !== "sem" && <FiltroChip onClick={() => setFiltroLabel("sem")}>Sem etiqueta</FiltroChip>}
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

function FiltroChip({ children, cor, onClick }: { children: React.ReactNode; cor?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/10 px-3 py-1 text-[11.5px] font-medium text-muted transition-colors hover:border-white/25 hover:text-ink"
      style={cor ? { color: cor, borderColor: `${cor}55` } : undefined}
    >
      {children}
    </button>
  );
}

function ultimaAtividade(iso: string | null): string {
  const d = diasSemAtividade(iso);
  if (d == null) return "sem atividade ainda";
  if (d === 0) return "ativo hoje";
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
