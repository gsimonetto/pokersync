"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Briefcase, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { fetchNaoLidas, MENSAGENS_LIDAS } from "@/lib/services/marketplace-service";

export type AbaVagas = "vagas" | "candidaturas";

const ROTA: Record<AbaVagas, string> = {
  vagas: "/marketplace",
  candidaturas: "/marketplace/minhas-candidaturas",
};

// Casca das telas das Vagas: o mesmo visual de vidro da Performance e do
// Construtor -- título, ações à direita e as abas grudadas no topo (cada
// aba é uma página: Vagas e Minhas candidaturas). "Minhas candidaturas"
// mostra quantas mensagens do time a pessoa ainda não leu.
export function CascaVagas({
  titulo,
  subtitulo,
  acoes,
  aba,
  atalhos = true,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  /** Sem aba = tela sem a barra (ex.: Nova vaga). */
  aba?: AbaVagas;
  /** Teclas 1 e 2 trocam de aba -- desligue em telas de detalhe. */
  atalhos?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!aba) return;
    const buscar = () =>
      fetchNaoLidas()
        .then((n) => setNaoLidas(n.minhas))
        .catch(() => {});
    buscar();
    window.addEventListener(MENSAGENS_LIDAS, buscar);
    return () => window.removeEventListener(MENSAGENS_LIDAS, buscar);
  }, [aba]);
  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-3 pb-12 pt-4 text-ink sm:px-4 sm:pt-6 md:px-6">
            <PerfEstilos />
            <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[21px] font-semibold tracking-tight sm:text-3xl">{titulo}</h1>
                {subtitulo && <p className="mt-1 text-[12.5px] text-muted">{subtitulo}</p>}
              </div>
              {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
            </header>
            {aba && (
              <div className="sticky top-0 z-30 -mx-3 mb-3.5 border-b border-white/[0.06] bg-black/70 px-3 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
                <AbasAnimadas
                  value={aba}
                  onChange={(v) => v !== aba && router.push(ROTA[v])}
                  rotulo="Seções das Vagas"
                  atalhos={atalhos}
                  options={[
                    { value: "vagas", label: "Vagas", icon: Briefcase },
                    { value: "candidaturas", label: "Minhas candidaturas", icon: FileText, badge: naoLidas || undefined },
                  ]}
                />
              </div>
            )}
            {children}
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}
