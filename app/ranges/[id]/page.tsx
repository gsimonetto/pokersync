"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { RangeEditor } from "@/components/ranges/range-editor";

export default function RangeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-4 text-ink">
      <header className="mb-3 flex items-center gap-3">
        <Link
          href="/ranges"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Layers size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">{id === "novo" ? "Novo Range" : "Editar Range"}</h1>
      </header>

      <RangeEditor id={id} />
    </main>
  );
}
