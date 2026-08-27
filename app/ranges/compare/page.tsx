"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RangeCompare } from "@/components/ranges/range-compare";

// Sem AppHeader (nome do modulo + voltar) de proposito -- o menu lateral
// do AppShell ja identifica o modulo. Conteudo sobe direto pro topo.
function RangeComparePageInner() {
  const searchParams = useSearchParams();
  const a = searchParams.get("a");
  const b = searchParams.get("b");

  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
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
          <main className="w-full px-6 py-10 text-ink">
            <p className="text-sm text-muted">Carregando…</p>
          </main>
        </AppShell>
      }
    >
      <RangeComparePageInner />
    </Suspense>
  );
}
