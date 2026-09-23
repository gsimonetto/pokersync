"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PlayerDetailModal } from "@/components/time/player-detail-modal";
import { calcularScore, type TeamDashboardRow, type TeamLabel } from "@/lib/services/team-service";
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
