"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { EmblemaEstilos, MATERIAIS, faixaDoNivel } from "@/components/hub/patentes/emblema";
import { CartaJogador, type AtributoCarta } from "@/components/perfil/carta-jogador";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchProgress, type Progress } from "@/lib/services/xp-service";
import { fetchRankingTemporada } from "@/lib/services/ranking-service";
import { fetchMyAchievements } from "@/lib/services/achievements-service";
import { fetchTournamentMetrics } from "@/lib/services/analysis-service";
import { fetchTrainingAccuracy } from "@/lib/services/drill-service";
import type { TournamentMetrics } from "@/types/analysis";

// Meu perfil: só a carta do jogador (pedido explícito: "a primeira
// [sugestão], pode tirar os troféus e o compartilhar, apenas a carta").
// Cada dado carrega sozinho: o que falhar aparece como "—" na carta.

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const inteiro = (v: number) => v.toLocaleString("pt-BR");

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [posicao, setPosicao] = useState<number | null>(null);
  const [fundador, setFundador] = useState(false);
  const [metricas, setMetricas] = useState<TournamentMetrics | null>(null);
  const [treino, setTreino] = useState<{ hits: number; total: number } | null>(null);
  const [maosVistas, setMaosVistas] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    fetchProfile()
      .then((p) => vivo && setPerfil(p))
      .catch(() => {});
    fetchProgress()
      .then((p) => vivo && setProgress(p))
      .catch(() => {});
    fetchMyAchievements()
      .then((c) => vivo && setFundador(c.some((x) => x.code === "founder")))
      .catch(() => {});
    fetchRankingTemporada("global", 200)
      .then((r) => vivo && setPosicao(r.jogadores.find((j) => j.souEu)?.posicao ?? null))
      .catch(() => {});
    fetchTournamentMetrics()
      .then((m) => vivo && setMetricas(m))
      .catch(() => {});
    fetchTrainingAccuracy()
      .then((t) => vivo && setTreino(t))
      .catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("hand_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .not("viewed_in_replayer_at", "is", null)
        .then(({ count }) => vivo && setMaosVistas(count ?? 0));
    });
    return () => {
      vivo = false;
    };
  }, []);

  const nivel = progress?.level ?? 1;
  const m = MATERIAIS[faixaDoNivel(nivel)];
  const temTorneio = (metricas?.total_games ?? 0) > 0;
  const atributos: AtributoCarta[] = [
    { sigla: "ITM", nome: "ITM: % dos torneios em que ficou no dinheiro", valor: temTorneio && metricas?.itm_pct != null ? pct(metricas.itm_pct) : null },
    {
      sigla: "ROI",
      nome: "ROI: lucro ÷ investido nos torneios",
      valor: temTorneio && metricas?.roi_pct != null ? `${metricas.roi_pct > 0 ? "+" : ""}${pct(metricas.roi_pct)}` : null,
    },
    { sigla: "TRN", nome: "Torneios jogados", valor: metricas ? inteiro(metricas.total_games) : null },
    { sigla: "KO", nome: "Bounties: jogadores eliminados em PKO", valor: metricas ? inteiro(metricas.total_bounties_won) : null },
    { sigla: "GTO", nome: "Acerto no modo Treino", valor: treino && treino.total > 0 ? pct(Math.round((treino.hits / treino.total) * 100)) : null },
    { sigla: "REV", nome: "Mãos revisadas na mesa", valor: maosVistas != null ? inteiro(maosVistas) : null },
  ];

  const nome = perfil?.apelido || perfil?.nome?.split(" ").slice(-1)[0] || "Jogador";

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf relative flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10 text-ink md:px-6">
            <PerfEstilos />
            <EmblemaEstilos />
            {/* Luz de fundo na cor da patente. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${m.base}22, transparent 65%)` }}
            />
            <div className="relative">
              <CartaJogador
                nome={nome}
                subtitulo={perfil?.nome && perfil.apelido ? perfil.nome : null}
                nivel={nivel}
                avatarId={perfil?.avatar_id ?? 1}
                avatarUrl={perfil?.avatar_url}
                fundador={fundador}
                atributos={atributos}
                rodape={posicao ? `#${posicao} na temporada` : null}
              />
            </div>
            <Link
              href="/configuracoes"
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:border-white/20 hover:text-ink"
            >
              <Pencil size={13} /> Editar foto e nome
            </Link>
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}
