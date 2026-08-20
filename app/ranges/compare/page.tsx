"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompare } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RangeCompare } from "@/components/ranges/range-compare";

function RangeComparePageInner() {
  const searchParams = useSearchParams();
  const a = searchParams.get("a");
  const b = searchParams.get("b");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <AppHeader backHref="/ranges" icon={GitCompare} iconColor="var(--color-review)" title="Comparar Ranges" />

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
