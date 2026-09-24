"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Layers, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { PainelCard } from "@/components/painel/painel-card";
import { AvatarNivel } from "@/components/avatar-nivel";
import { CartaoNivel, HubEstilos, PatentesModal } from "@/components/hub/nivel";
import { Missoes } from "@/components/hub/missoes";
import { Ranking } from "@/components/hub/ranking/ranking";
import { EmblemaEstilos, EmblemaPatente } from "@/components/hub/patentes/emblema";
import { CartaPatente } from "@/components/hub/patentes/carta";
import { SubiuDeNivel, nivelVistoAntes } from "@/components/hub/patentes/subiu";
import { fetchProfile, type Profile } from "@/lib/services/profile-service";
import {
  MAX_LEVEL,
  fetchActiveMissions,
  fetchActiveSeason,
  fetchMissionCatalog,
  fetchProgress,
  levelColor,
  levelMaterial,
  levelSubTier,
  xpForNextLevel,
  type Progress,
  type Season,
} from "@/lib/services/xp-service";

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

  // Subiu desde a última visita? Compara com o nível que o Hub viu da
  // última vez (e já grava o atual) -- a comemoração aparece uma vez só.
  const conferiuSubida = useRef(false);
  useEffect(() => {
    if (!progress || conferiuSubida.current) return;
    conferiuSubida.current = true;
    const antes = nivelVistoAntes(progress.level);
    if (antes != null && progress.level > antes) setSubiu({ de: antes, para: progress.level });
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

            <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hub de Evolução</h1>
                <p className="mt-1 text-[12.5px] text-muted">Seu nível, suas missões e a disputa da temporada.</p>
              </div>
              {progress && <ResumoNivel progress={progress} perfil={perfil} onAbrirCarta={() => setCarta(true)} />}
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
                    <Missoes ativas={ativas} catalogo={catalogo} />
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

// Canto direito do cabeçalho: sua foto (anel de nível), o emblema da
// patente e quanto falta -- o "quem sou eu aqui" visível nas duas abas.
// Tocar abre a carta holográfica.
function ResumoNivel({ progress, perfil, onAbrirCarta }: { progress: Progress; perfil: Profile | null; onAbrirCarta: () => void }) {
  const max = progress.level >= MAX_LEVEL;
  const cor = levelColor(progress.level);
  return (
    <button
      type="button"
      onClick={onAbrirCarta}
      className="painel-vidro group flex items-center gap-3 self-start rounded-2xl border border-white/10 py-2 pl-2 pr-4 text-left transition-colors hover:border-white/20 sm:self-auto"
      title="Ver carta da patente"
      style={{ boxShadow: `inset 0 1px 0 ${cor}33` }}
    >
      <span className="relative">
        <AvatarNivel
          avatarId={perfil?.avatar_id ?? 1}
          avatarUrl={perfil?.avatar_url}
          nivel={progress.level}
          xpAtual={progress.xp_current}
          tamanho={46}
          mostrarNivel={false}
          animar
        />
        <span className="absolute -bottom-2 -right-2 transition-transform duration-300 group-hover:scale-110">
          <EmblemaPatente nivel={progress.level} tamanho={30} mostrarNumero={false} />
        </span>
      </span>
      <span className="min-w-0 pl-1">
        <span className="block text-[13px] font-semibold" style={{ color: cor }}>
          {levelMaterial(progress.level)} {levelSubTier(progress.level)} · Nível {progress.level}
        </span>
        <span className="block text-[11.5px] tabular-nums text-muted">
          {max ? "Nível máximo" : `faltam ${(xpForNextLevel(progress.level) - progress.xp_current).toLocaleString("pt-BR")} XP pro ${progress.level + 1}`}
        </span>
      </span>
    </button>
  );
}
