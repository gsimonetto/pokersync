"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TabKanban } from "@/components/time/tab-kanban";
import { AppShell } from "@/components/app-shell";
import { ModalNovoEvento } from "@/components/time/tab-calendario";
import {
  fetchMyTeamCached,
  fetchTeamDashboardCached,
  traduzErroTime,
  type MyTeam,
  type TeamDashboardRow,
} from "@/lib/services/team-service";

// Funil tem pagina propria (em vez de aba dentro do painel) porque o
// Kanban precisa de espaco vertical pra respirar (colunas + drag-and-
// drop) — dentro das abas, o header+nav do painel empurrava o conteudo
// pra baixo e obrigava rolar pra ver os cards.
export default function FunilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [time, setTime] = useState<MyTeam | null>(null);
  const [linhas, setLinhas] = useState<TeamDashboardRow[]>([]);
  const [agendarPlayerId, setAgendarPlayerId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const t = await fetchMyTeamCached();
      if (!t) {
        router.replace("/time");
        return;
      }
      setTime(t);
      setLinhas(await fetchTeamDashboardCached(365));
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const jogadores = useMemo(() => linhas.filter((l) => l.role === "player"), [linhas]);
  const coaches = useMemo(
    () => (time?.members ?? []).filter((m) => m.isCoach).map((m) => ({ userId: m.userId, nome: m.name })),
    [time]
  );

  return (
    <AppShell>
    <main className="flex h-full w-full flex-col px-6 py-10 text-ink">
      {/* Sem AppHeader aqui de proposito — a barra de abas do Painel ja'
          identifica "Funil", e o header sozinho virava uma faixa vazia
          no topo. O voltar mora na propria barra de filtros do board.
          h-full + flex-col aqui (pedido explicito: "a barra de rolagem
          do funil esta no meio da tela, precisa ir pro final") -- o
          board (TabKanban) ocupa o resto da altura disponivel em vez de
          uma altura fixa, entao a barra de rolagem horizontal sempre
          cai exatamente na borda inferior da tela, nunca sobra vazio
          embaixo dela. */}
      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando funil…</p>
      ) : (
        // Sem `time` aqui so' acontece apos erro (esgotado o "!t" ->
        // router.replace("/time")) -- a mensagem ja aparece acima; sem
        // esse `time &&`, a tela ficava presa em "Carregando funil..."
        // pra sempre mesmo com o carregamento ja' terminado (loading
        // false), so' porque o guard antigo tratava "sem time" e "ainda
        // carregando" como a mesma coisa.
        time && (
          <TabKanban
            teamId={time.team.id}
            jogadores={jogadores}
            coaches={coaches}
            isAdmin={time.role === "admin"}
            backHref="/time/painel"
            onErro={setErro}
            onAgendarConversa={setAgendarPlayerId}
          />
        )
      )}

      {/* Agenda sem sair do funil — navegar pra /time/painel perdia todo o
          estado do board (filtros, card aberto, scroll). */}
      {agendarPlayerId && time && (
        <ModalNovoEvento
          teamId={time.team.id}
          jogadores={jogadores}
          meuUserId={time.members.find((m) => m.isMe)?.userId ?? ""}
          meuPapel={time.role}
          prefillPlayerId={agendarPlayerId}
          onFechar={() => setAgendarPlayerId(null)}
          onCriado={() => setAgendarPlayerId(null)}
          onErro={setErro}
        />
      )}
    </main>
    </AppShell>
  );
}
