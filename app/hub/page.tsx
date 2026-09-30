"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Layers, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { PainelCard } from "@/components/painel/painel-card";
import { CartaoNivel, HubEstilos, PatentesModal } from "@/components/hub/nivel";
import { Missoes } from "@/components/hub/missoes";
import { Ranking } from "@/components/hub/ranking/ranking";
import { EmblemaEstilos } from "@/components/hub/patentes/emblema";
import { CartaPatente } from "@/components/hub/patentes/carta";
import { SubiuDeNivel } from "@/components/hub/patentes/subiu";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import { fetchActiveMissions, fetchActiveSeason, fetchMissionCatalog, fetchProgress, marcarNivelComemorado, type Progress, type Season } from "@/lib/services/xp-service";

type Vista = "missoes" | "ranking";

const ABAS = [
  { value: "missoes" as const, label: "Missões", icon: Target },
  { value: "ranking" as const, label: "Ranking", icon: Trophy },
];

// Hub de Evolução. Mesmo padrão visual do Início, do Time e da
// Performance (pedido explícito): fundo com brilho suave (PerfEstilos),
// título grande no topo, abas presas ao rolar (AbasAnimadas) e todo
// conteúdo em cards de vidro (PainelCard / PainelVisual "vidro").
//
// A aba vai pra URL (?aba=ranking) pra dar pra linkar direto no ranking
// -- ex.: avisos de fim de temporada.
function vistaDaUrl(): Vista {
  try {
    return new URLSearchParams(window.location.search).get("aba") === "ranking" ? "ranking" : "missoes";
  } catch {
    return "missoes";
  }
}

export default function HubPage() {
  const [vista, setVista] = useState<Vista>("missoes");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [perfil, setPerfil] = useState<Profile | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ativas, setAtivas] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [seasonPronta, setSeasonPronta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [patentes, setPatentes] = useState(false);
  const [carta, setCarta] = useState(false);
  const [subiu, setSubiu] = useState<{ de: number; para: number } | null>(null);

  // Subiu desde a última comemoração? O nível já comemorado fica na conta
  // (não no navegador), então a animação aparece uma vez só, em qualquer
  // aparelho. Já marca ao abrir: recarregar a página não repete.
  const conferiuSubida = useRef(false);
  useEffect(() => {
    if (!progress || conferiuSubida.current) return;
    conferiuSubida.current = true;
    const visto = progress.nivel_comemorado;
    if (visto === progress.level) return;
    if (visto != null && progress.level > visto) setSubiu({ de: visto, para: progress.level });
    marcarNivelComemorado(progress.level).catch(() => {});
  }, [progress]);

  useEffect(() => setVista(vistaDaUrl()), []);

  const trocarVista = (v: Vista) => {
    setVista(v);
    try {
      const url = new URL(window.location.href);
      if (v === "ranking") url.searchParams.set("aba", "ranking");
      else url.searchParams.delete("aba");
      window.history.replaceState(null, "", url);
    } catch {
      // sem URL: só troca a aba
    }
  };

  useEffect(() => {
    let vivo = true;
    fetchActiveSeason()
      .then((s) => vivo && setSeason(s))
      .catch(() => {})
      .finally(() => vivo && setSeasonPronta(true));
    fetchProfile()
      .then((p) => vivo && setPerfil(p))
      .catch(() => {});
    (async () => {
      try {
        const [p, m, c] = await Promise.all([fetchProgress(), fetchActiveMissions(), fetchMissionCatalog()]);
        if (!vivo) return;
        setProgress(p);
        setAtivas(m);
        setCatalogo(c);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Falha ao carregar o Hub.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6">
            <PerfEstilos />
            <HubEstilos />
            <EmblemaEstilos />

            {/* O resumo do nível (foto + patente + quanto falta) foi pra tela
                inicial, ao lado da Banca -- aqui ele duplicava o "Seu nível". */}
            <header className="mb-4">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hub de Evolução</h1>
              <p className="mt-1 text-[12.5px] text-muted">Seu nível, suas missões e a disputa da temporada.</p>
            </header>

            <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/[0.06] bg-black/70 px-4 pt-2 backdrop-blur-xl md:-mx-6 md:px-6">
              <AbasAnimadas value={vista} onChange={trocarVista} options={ABAS} rotulo="Seções do Hub" />
            </div>

            {vista === "missoes" ? (
              carregando ? (
                <div className="grid gap-3.5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                  <div className="painel-esqueleto h-[300px] rounded-3xl" />
                  <div className="painel-esqueleto h-[300px] rounded-3xl" />
                </div>
              ) : erro || !progress ? (
                <p className="rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro || "Falha ao carregar o Hub."}</p>
              ) : (
                <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                  <PainelCard title="Seu nível" icon={<Layers size={15} />} ordem={0} rolagem={false}>
                    <CartaoNivel progress={progress} onVerPatentes={() => setPatentes(true)} onAbrirCarta={() => setCarta(true)} semMoldura />
                  </PainelCard>
                  <PainelCard title="Missões" icon={<Target size={15} />} ordem={1} rolagem={false}>
                    <Missoes ativas={ativas} catalogo={catalogo} temporada={season?.seasonNumber ?? null} />
                  </PainelCard>
                </div>
              )
            ) : seasonPronta ? (
              <Ranking season={season} onIrParaMissoes={() => trocarVista("missoes")} />
            ) : (
              <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="painel-esqueleto h-[420px] rounded-3xl" />
                <div className="painel-esqueleto h-[220px] rounded-3xl" />
              </div>
            )}
          </main>
        </MotionConfig>
      </PainelVisual>
      {patentes && progress && <PatentesModal nivelAtual={progress.level} onFechar={() => setPatentes(false)} />}
      {carta && progress && (
        <CartaPatente progress={progress} nome={perfil?.apelido || perfil?.nome || "Jogador"} onFechar={() => setCarta(false)} />
      )}
      {subiu && <SubiuDeNivel de={subiu.de} para={subiu.para} onFechar={() => setSubiu(null)} />}
    </AppShell>
  );
}
