"use client";

import { AppShell } from "@/components/app-shell";
import { RangeEditor } from "@/components/ranges/range-editor";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// /ranges abre o construtor pronto pra montar um range novo — sem
// precisar passar pela biblioteca e clicar em "Novo range" antes. A
// biblioteca continua acessivel pelo botao "Meus ranges" dentro do
// proprio construtor (RangeListModal), sem sair da tela.
//
// Sem AppHeader: as abas do modulo (RangesTabs) entram dentro do
// container unico do editor (prop `tabs`), no lugar de uma barra sticky
// separada por cima -- mesmo padrao do Treino (RfiJamDrill ja recebe
// `tabs` assim).
export default function RangesPage() {
  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <RangeEditor id="novo" tabs={<RangesTabs active="ranges" />} />
      </main>
    </AppShell>
  );
}
