"use client";

import { use } from "react";
import { GitBranch } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { TreeEditor } from "@/components/ranges/tree-editor";

export default function TreeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell backHref="/ranges/arvores" icon={GitBranch} iconColor="var(--color-review)"
          title={id === "nova" ? "Nova Árvore" : "Editar Árvore"} />

        <TreeEditor id={id} />
      </main>
    </AppShell>
  );
}
