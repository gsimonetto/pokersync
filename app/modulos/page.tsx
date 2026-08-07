import Link from "next/link";
import { modules } from "@/lib/modules-data";
import { ModuleCard } from "@/components/module-card";

export default function ModulosPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Fase 1</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Modulos Principais</h1>
          <p className="mt-2 text-sm text-muted">{modules.length} modulos</p>
        </div>
        <Link
          href="/hub"
          className="rounded-lg border border-hairline px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink"
        >
          Hub de Evolucao
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {modules.map(({ key, ...mod }) => (
          <ModuleCard key={key} {...mod} />
        ))}
      </div>
    </main>
  );
}
