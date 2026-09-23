"use client";

import { useEffect, useState } from "react";
import { Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TabNav } from "@/components/ui/tab-nav";
import { Esqueleto } from "@/components/painel/painel-card";
import { CartaoNivel, HubEstilos, PatentesModal } from "@/components/hub/nivel";
import { Missoes } from "@/components/hub/missoes";
import { Ranking } from "@/components/hub/ranking/ranking";
import {
  fetchActiveMissions,
  fetchActiveSeason,
  fetchMissionCatalog,
  fetchProgress,
  type Progress,
  type Season,
} from "@/lib/services/xp-service";

type Vista = "missoes" | "ranking";

// Hub de Evolução: duas vistas (Missões / Ranking) no mesmo lugar. A aba
// vai pra URL (?aba=ranking) pra dar pra linkar direto no ranking -- ex.:
// avisos de fim de temporada -- e pro "voltar" do navegador respeitar a
// aba em que a pessoa estava.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ativas, setAtivas] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [seasonPronta, setSeasonPronta] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [patentes, setPatentes] = useState(false);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let vivo = true;
    fetchActiveSeason()
      .then((s) => vivo && setSeason(s))
      .catch(() => {})
      .finally(() => vivo && setSeasonPronta(true));
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
      <main className="w-full px-4 py-6 md:px-6 md:py-8">
        <HubEstilos />
        <div className="rounded-3xl border border-hairline bg-surface p-4 sm:p-5">
          <TabNav
            value={vista}
            onChange={trocarVista}
            options={[
              { value: "missoes", label: "Missões", icon: Target },
              { value: "ranking", label: "Ranking", icon: Trophy },
            ]}
          />

          {vista === "missoes" ? (
            carregando ? (
              <div className="mt-4 space-y-3">
                <div className="painel-esqueleto h-[236px] rounded-2xl" />
                <Esqueleto linhas={3} altura={96} />
              </div>
            ) : erro || !progress ? (
              <p className="p-10 text-center text-sm text-negative">{erro || "Falha ao carregar o Hub."}</p>
            ) : (
              <div className="mt-4">
                <CartaoNivel progress={progress} onVerPatentes={() => setPatentes(true)} />
                <Missoes ativas={ativas} catalogo={catalogo} />
              </div>
            )
          ) : seasonPronta ? (
            <Ranking season={season} onIrParaMissoes={() => trocarVista("missoes")} />
          ) : (
            <div className="mt-4">
              <Esqueleto linhas={4} altura={64} />
            </div>
          )}
        </div>
      </main>
      {patentes && progress && <PatentesModal nivelAtual={progress.level} onFechar={() => setPatentes(false)} />}
    </AppShell>
  );
}
