"use client";

import { Layers } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RangeEditor } from "@/components/ranges/range-editor";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// /ranges abre o construtor pronto pra montar um range novo — sem
// precisar passar pela biblioteca e clicar em "Novo range" antes. A
// biblioteca continua acessivel pelo botao "Meus ranges" dentro do
// proprio construtor (RangeListModal), sem sair da tela.
// Largura maior que o padrao (max-w-6xl) e' proposital aqui: a matriz
// 13x13 do range precisa de espaco horizontal real.
export default function RangesPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-3 text-ink">
      <AppHeader backHref="/modulos" icon={Layers} iconColor="var(--color-review)" title="Construtor de Ranges"
        right={<RangesTabs active="ranges" />} />

      <RangeEditor id="novo" />
    </main>
  );
}
