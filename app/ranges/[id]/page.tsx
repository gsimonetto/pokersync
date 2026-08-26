"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { RangeEditor } from "@/components/ranges/range-editor";

// Sem AppHeader (nome do modulo + voltar) de proposito -- o menu lateral
// do AppShell ja identifica o modulo, e o alvo do "voltar" (/ranges) e' o
// mesmo pra onde o proprio menu leva. Conteudo sobe direto pro topo.
export default function RangeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <RangeEditor id={id} />
      </main>
    </AppShell>
  );
}
