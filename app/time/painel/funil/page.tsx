"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { TabKanban } from "@/components/time/tab-kanban";
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
    <main className="mx-auto max-w-[1600px] px-6 py-10 text-ink">
      {/* Sem titulo/subtitulo aqui de proposito — a barra de abas do
          Painel ja' identifica "Funil"; repetir o nome + descricao so'
          empurra os cards pra baixo sem agregar informacao nova. */}
      <AppHeader backHref="/time/painel" />

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading || !time ? (
        <p className="text-sm text-muted">Carregando funil…</p>
      ) : (
        <TabKanban
          teamId={time.team.id}
          jogadores={jogadores}
          coaches={coaches}
          isAdmin={time.role === "admin"}
          onErro={setErro}
          onAgendarConversa={(playerId) => router.push(`/time/painel?tab=calendario&prefill=${playerId}`)}
        />
      )}
    </main>
  );
}
