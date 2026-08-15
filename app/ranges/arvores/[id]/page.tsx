"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";
import { TreeEditor } from "@/components/ranges/tree-editor";

export default function TreeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/ranges/arvores"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <GitBranch size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">{id === "nova" ? "Nova Árvore" : "Editar Árvore"}</h1>
      </header>

      <TreeEditor id={id} />
    </main>
  );
}
