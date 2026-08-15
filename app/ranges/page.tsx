"use client";

import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { RangeEditor } from "@/components/ranges/range-editor";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

// /ranges abre o construtor pronto pra montar um range novo — sem
// precisar passar pela biblioteca e clicar em "Novo range" antes. A
// biblioteca continua acessivel pelo botao "Meus ranges" dentro do
// proprio construtor (RangeListModal), sem sair da tela.
export default function RangesPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-4 text-ink">
      <header className="mb-3 flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Layers size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">Construtor de Ranges</h1>
        <RangesTabs active="ranges" />
      </header>

      <RangeEditor id="novo" />
    </main>
  );
}
