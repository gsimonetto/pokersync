import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Termos de Uso — PokerSync" };

// Mesmo padrão visual de app/privacidade/page.tsx.
export default function TermosDeUsoPage() {
  return (
    <main className="min-h-screen bg-void px-4 py-10 text-ink">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo className="h-8 w-auto" />
          <Link href="/login" className="text-sm text-muted hover:text-ink">
            Voltar
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Termos de Uso</h1>
          <p className="mt-1 text-sm text-muted">Última atualização: setembro de 2026.</p>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink/90">
          <Secao titulo="1. Aceite">
            <p>
              Ao criar uma conta no PokerSync, você concorda com estes Termos de Uso e com a{" "}
              <Link href="/privacidade" className="text-training hover:underline">
                Política de Privacidade
              </Link>
              . Se não concordar, não crie uma conta nem use a plataforma.
            </p>
          </Secao>

          <Secao titulo="2. O que é o PokerSync">
            <p>
              O PokerSync é uma plataforma de organização e evolução para jogadores de poker: gestão de banca,
              revisão de mãos, treino e acompanhamento de performance. Não somos uma casa de apostas, não
              processamos apostas nem qualquer transação de jogo — só organizamos dados que você mesmo registra
              sobre o seu jogo.
            </p>
          </Secao>

          <Secao titulo="3. Sua conta">
            <p>
              Você é responsável por manter sua senha em segurança e pelas informações que registra na plataforma.
              É preciso ter pelo menos 18 anos para criar uma conta.
            </p>
          </Secao>

          <Secao titulo="4. Uso aceitável">
            <p>
              Não use o PokerSync para armazenar ou compartilhar dados que não sejam seus sem autorização, para
              tentar acessar contas de outras pessoas, ou para qualquer finalidade ilegal.
            </p>
          </Secao>

          <Secao titulo="5. Radar PokerSync (agente desktop)">
            <p>
              O agente desktop é opcional — você nunca é obrigado a instalá-lo, sempre pode registrar suas
              informações manualmente. Ao autorizar o agente, você concorda que ele leia arquivos de hand history
              nas pastas das salas de poker configuradas no seu computador e os envie para sua conta no PokerSync.
            </p>
          </Secao>

          <Secao titulo="6. Planos e pagamento">
            <p>
              Alguns módulos exigem assinatura paga, processada pela Stripe. Você pode cancelar a qualquer momento
              em Minha Conta — o acesso continua até o fim do período já pago, sem cobrança seguinte.
            </p>
          </Secao>

          <Secao titulo="7. Seus dados">
            <p>
              O tratamento dos seus dados pessoais é descrito na{" "}
              <Link href="/privacidade" className="text-training hover:underline">
                Política de Privacidade
              </Link>
              , incluindo como acessar, baixar e excluir seus dados diretamente pela plataforma.
            </p>
          </Secao>

          <Secao titulo="8. Isenção de responsabilidade sobre resultados">
            <p>
              O PokerSync organiza e analisa dados que você registra — não garante resultado financeiro nem
              substitui seu próprio julgamento sobre o jogo. Decisões de banca e de jogo são sempre suas.
            </p>
          </Secao>

          <Secao titulo="9. Alterações">
            <p>
              Podemos atualizar estes Termos e a Política de Privacidade conforme o produto evolui. Mudanças
              relevantes serão avisadas dentro da plataforma.
            </p>
          </Secao>

          <Secao titulo="10. Contato">
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:suporte@pokersync.com.br" className="text-training hover:underline">
                suporte@pokersync.com.br
              </a>
              .
            </p>
          </Secao>
        </div>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      <div className="mt-2 text-ink/80">{children}</div>
    </section>
  );
}
