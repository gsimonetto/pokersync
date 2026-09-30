"use client";

import type { ComponentProps, ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";

type Abas<T extends string> = ComponentProps<typeof AbasAnimadas<T>>;

// Moldura padrão das telas do app: vidro fosco com brilho de fundo, título
// e ações no cabeçalho e, se houver, abas grudadas no topo ao rolar. Um
// lugar só pra esse visual -- antes cada tela copiava o mesmo bloco.
export function TelaVidro<T extends string = string>({
  titulo,
  subtitulo,
  acoes,
  abas,
  semCasca = false,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  abas?: Abas<T>;
  /** Tela fora do menu lateral (ex.: convite de time aberto sem login). */
  semCasca?: boolean;
  children: ReactNode;
}) {
  const tela = (
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
          {abas && (
            <div className="sticky top-0 z-30 -mx-3 mb-3.5 border-b border-white/[0.06] bg-black/70 px-3 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
              <AbasAnimadas<T> {...abas} />
            </div>
          )}
          {children}
        </main>
      </MotionConfig>
    </PainelVisual>
  );
  return semCasca ? <div className="min-h-screen bg-void">{tela}</div> : <AppShell>{tela}</AppShell>;
}

// Card de vidro padrão.
export const CARD_VIDRO = "painel-vidro rounded-3xl border border-white/10";
