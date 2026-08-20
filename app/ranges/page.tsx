"use client";

import { AppHeader } from "@/components/app-header";
import { RangeEditor } from "@/components/ranges/range-editor";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// /ranges abre o construtor pronto pra montar um range novo — sem
// precisar passar pela biblioteca e clicar em "Novo range" antes. A
// biblioteca continua acessivel pelo botao "Meus ranges" dentro do
// proprio construtor (RangeListModal), sem sair da tela.
export default function RangesPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader right={<RangesTabs active="ranges" />} />

      <RangeEditor id="novo" />
    </main>
  );
}
