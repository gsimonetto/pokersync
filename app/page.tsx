import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Check, CircleDashed } from "lucide-react";

type CheckItem = { label: string; done: boolean };

function buildChecklist(): CheckItem[] {
  return [
    { label: "Next.js 15 + App Router", done: true },
    { label: "TypeScript em modo strict", done: true },
    { label: "Tailwind v4 com tokens da marca", done: true },
    { label: "Repositório conectado ao GitHub", done: true },
    { label: "Domínio beta.pokersync.com.br", done: true },
    { label: "Variáveis de ambiente do Supabase", done: isSupabaseConfigured },
    { label: "Fase 1 — Login e Tela de Módulos", done: true },
    { label: "Fase 2 — Gestor de Banca e Hub de Evolução", done: true },
  ];
}

const proximasFases = ["Fase 3 — Modo Treino, Revisor de Maos, Hand Replayer"];

export default function Home() {
  const fase0 = buildChecklist();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
        Migracao
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Poker<span className="font-light">Sync</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Base tecnica da migracao para Next.js. Ambiente separado do projeto em
        producao — nenhum módulo real ainda usa este ambiente.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/login" className="rounded-lg bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-void">
          Ver Login
        </Link>
        <Link href="/modulos" className="rounded-lg border border-hairline px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink">
          Ver Módulos
        </Link>
        <Link href="/banca" className="rounded-lg border border-hairline px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink">
          Ver Banca
        </Link>
        <Link href="/hub" className="rounded-lg border border-hairline px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-ink">
          Ver Hub
        </Link>
      </div>
      <section className="mt-10 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Base instalada
        </h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {fase0.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              {item.done ? (
                <Check size={16} className="shrink-0 text-positive" />
              ) : (
                <CircleDashed size={16} className="shrink-0 text-muted" />
              )}
              <span className={item.done ? "text-ink" : "text-muted"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Proximas fases
        </h2>
        <ul className="mt-4 flex flex-col gap-2.5">
          {proximasFases.map((fase) => (
            <li key={fase} className="flex items-center gap-3 text-sm text-muted">
              <CircleDashed size={16} className="shrink-0" />
              {fase}
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-xs leading-relaxed text-muted">
        O dominio pokersync.com.br continua rodando a versao Vite normalmente.
      </p>
    </main>
  );
}
