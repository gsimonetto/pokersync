"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompare } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RangeCompare } from "@/components/ranges/range-compare";

function RangeComparePageInner() {
  const searchParams = useSearchParams();
  const a = searchParams.get("a");
  const b = searchParams.get("b");

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell backHref="/ranges" icon={GitCompare} iconColor="var(--color-review)" title="Comparar Ranges" />

        <RangeCompare initialA={a} initialB={b} />
      </main>
    </AppShell>
  );
}

export default function RangeComparePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
            <p className="text-sm text-muted">Carregando…</p>
          </main>
        </AppShell>
      }
    >
      <RangeComparePageInner />
    </Suspense>
  );
}
