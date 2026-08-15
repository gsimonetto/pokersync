"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, GitCompare } from "lucide-react";
import { RangeCompare } from "@/components/ranges/range-compare";

function RangeComparePageInner() {
  const searchParams = useSearchParams();
  const a = searchParams.get("a");
  const b = searchParams.get("b");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/ranges"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <GitCompare size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">Comparar Ranges</h1>
      </header>

      <RangeCompare initialA={a} initialB={b} />
    </main>
  );
}

export default function RangeComparePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
          <p className="text-sm text-muted">Carregando…</p>
        </main>
      }
    >
      <RangeComparePageInner />
    </Suspense>
  );
}
