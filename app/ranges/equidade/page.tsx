"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { EquityCalculator } from "@/components/ranges/equity-calculator";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

function EquidadePageInner() {
  const searchParams = useSearchParams();
  const rangeId = searchParams.get("rangeId");

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
        <AppHeader insideShell right={<RangesTabs active="equidade" />} />

        <EquityCalculator initialRangeId={rangeId} />
      </main>
    </AppShell>
  );
}

export default function EquidadePage() {
  return (
    <Suspense fallback={null}>
      <EquidadePageInner />
    </Suspense>
  );
}
