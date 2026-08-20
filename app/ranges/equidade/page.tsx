"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Percent } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { EquityCalculator } from "@/components/ranges/equity-calculator";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

function EquidadePageInner() {
  const searchParams = useSearchParams();
  const rangeId = searchParams.get("rangeId");

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader backHref="/modulos" icon={Percent} iconColor="var(--color-review)" title="Equidade"
        right={<RangesTabs active="equidade" />} />

      <EquityCalculator initialRangeId={rangeId} />
    </main>
  );
}

export default function EquidadePage() {
  return (
    <Suspense fallback={null}>
      <EquidadePageInner />
    </Suspense>
  );
}
