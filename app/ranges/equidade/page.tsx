"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Percent } from "lucide-react";
import { EquityCalculator } from "@/components/ranges/equity-calculator";
import { RangesTabs } from "@/components/ranges/ranges-tabs";

function EquidadePageInner() {
  const searchParams = useSearchParams();
  const rangeId = searchParams.get("rangeId");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Percent size={20} className="text-review" />
        <h1 className="m-0 text-xl font-semibold">Equidade</h1>
        <RangesTabs active="equidade" />
      </header>

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
