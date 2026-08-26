import Link from "next/link";
import { Logo } from "@/components/logo";

// Pagina 404 padrao do Next tem fundo branco fixo (estilo proprio,
// ignora o dark mode do resto do app) -- qualquer link quebrado saia do
// tema escuro pra uma tela branca. Essa aqui usa as mesmas cores do
// resto do produto.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void px-6 text-center text-ink">
      <Logo className="h-10 w-auto" />
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Erro 404</p>
        <h1 className="mt-2 text-2xl font-bold">Essa página não existe</h1>
        <p className="mt-2 text-sm text-muted">O link pode estar errado ou a página pode ter mudado de lugar.</p>
      </div>
      <Link
        href="/modulos"
        className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-void transition-transform hover:scale-[1.02]"
      >
        Voltar para os módulos
      </Link>
    </main>
  );
}
