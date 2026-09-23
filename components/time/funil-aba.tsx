"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Funil } from "@/components/time/funil/funil";
import { ModalNovoEvento } from "@/components/time/tab-calendario";
import { fetchTeamDashboardCached, traduzErroTime, type MyTeam, type TeamDashboardRow } from "@/lib/services/team-service";

// Funil como ABA do painel (antes era página própria em
// /time/painel/funil, que agora só redireciona pra cá). No computador o
// quadro precisa de altura pra respirar (colunas + arrastar), então a aba
// ocupa quase a tela inteira abaixo do menu, e a barra de rolagem
// horizontal do quadro fica colada no fim dessa área. No celular não:
// a barra de ferramentas quebra em várias linhas e a área visível do
// navegador é menor que 100vh, então altura fixa fazia o quadro vazar
// pra fora do painel -- lá a aba cresce com o conteúdo e a página rola.
export function FunilAba({ time, onErro }: { time: MyTeam; onErro: (s: string) => void }) {
  const [linhas, setLinhas] = useState<TeamDashboardRow[] | null>(null);
  const [agendarPlayerId, setAgendarPlayerId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      // 30 dias, o mesmo padrão do painel: o crachá do cartão (score,
      // acerto, treinos) mostra os mesmos números da aba Jogadores. O que
      // é da trajetória na fase (drills, reviews, sessões, resultado)
      // vem do próprio cartão, contado desde que entrou na fase.
      setLinhas(await fetchTeamDashboardCached(30));
    } catch (e) {
      onErro(traduzErroTime(e));
      setLinhas([]);
    }
  }, [onErro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const jogadores = useMemo(() => (linhas ?? []).filter((l) => l.role === "player"), [linhas]);
  const coaches = useMemo(() => time.members.filter((m) => m.isCoach).map((m) => ({ userId: m.userId, nome: m.name })), [time]);
  const meuUserId = time.members.find((m) => m.isMe)?.userId ?? null;

  if (linhas === null) return <div className="painel-esqueleto h-[480px] rounded-3xl" />;

  return (
    <div className="flex flex-col md:h-[calc(100vh-15rem)] md:min-h-[520px]">
      <Funil
        teamId={time.team.id}
        jogadores={jogadores}
        coaches={coaches}
        isAdmin={time.role === "admin"}
        meuUserId={meuUserId}
        onErro={onErro}
        onAgendarConversa={setAgendarPlayerId}
      />
      {/* Agenda sem sair do funil (trocar de aba perderia filtros e o card aberto). */}
      {agendarPlayerId && (
        <ModalNovoEvento
          teamId={time.team.id}
          jogadores={jogadores}
          meuUserId={meuUserId ?? ""}
          meuPapel={time.role}
          prefillPlayerId={agendarPlayerId}
          onFechar={() => setAgendarPlayerId(null)}
          onCriado={() => setAgendarPlayerId(null)}
          onErro={onErro}
        />
      )}
    </div>
  );
}
