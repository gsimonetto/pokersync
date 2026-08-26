"use client";

import { Logo } from "@/components/logo";

// Mesma logica do not-found.tsx: a tela de erro padrao do Next tem
// fundo branco fixo, quebrando o dark mode do resto do app quando
// alguma pagina quebra em producao.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void px-6 text-center text-ink">
      <Logo className="h-10 w-auto" />
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-negative">Algo deu errado</p>
        <h1 className="mt-2 text-2xl font-bold">Não foi possível carregar essa página</h1>
        <p className="mt-2 text-sm text-muted">Tente de novo — se continuar acontecendo, avise o suporte.</p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-void transition-transform hover:scale-[1.02]"
      >
        Tentar novamente
      </button>
    </main>
  );
}
