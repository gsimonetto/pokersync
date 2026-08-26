"use client";

import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { TreeEditor } from "@/components/ranges/tree-editor";

// Sem AppHeader (nome do modulo + voltar) de proposito -- o menu lateral
// do AppShell ja identifica o modulo. Conteudo sobe direto pro topo.
export default function TreeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <TreeEditor id={id} />
      </main>
    </AppShell>
  );
}
