import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Política de Privacidade — PokerSync" };

// Página estática, mesmo padrão visual de app/not-found.tsx (fundo
// escuro do produto, não o branco padrão do Next). Conteúdo em
// linguagem simples de propósito -- é o documento que qualquer usuário
// pode abrir, não só quem entende termos jurídicos.
//
// ATENÇÃO ao publicar: os campos entre [colchetes] em "1. Quem trata
// seus dados" são placeholder -- preencher com a identificação legal
// real (nome/CPF ou razão social/CNPJ) antes de divulgar este link pra
// usuários de verdade.
export default function PoliticaDePrivacidadePage() {
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
          <h1 className="text-2xl font-bold">Política de Privacidade</h1>
          <p className="mt-1 text-sm text-muted">Última atualização: setembro de 2026.</p>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink/90">
          <Secao titulo="1. Quem trata seus dados">
            <p>
              O PokerSync é operado por <strong className="text-ink">[NOME COMPLETO DO RESPONSÁVEL], CPF nº [000.000.000-00]</strong>{" "}
              (&ldquo;nós&rdquo;), responsável pelo tratamento dos dados pessoais tratados nesta plataforma, nos termos da Lei
              Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </Secao>

          <Secao titulo="2. Como você exerce seus direitos">
            <p>
              Você pode acessar, corrigir, baixar (portabilidade) e excluir seus dados pessoais a qualquer momento,
              diretamente dentro da plataforma, em{" "}
              <Link href="/minha-conta" className="text-training hover:underline">
                Minha Conta → Privacidade e dados
              </Link>
              . É o jeito mais rápido de resolver.
            </p>
            <p className="mt-2">
              Para qualquer outra dúvida sobre privacidade que não dê pra resolver por lá — inclusive se você não é
              usuário do PokerSync e aparece nos dados de alguém que é (ver seção 6) — escreva pra{" "}
              <strong className="text-ink">[e-mail de privacidade a configurar]</strong>.
            </p>
          </Secao>

          <Secao titulo="3. Quais dados coletamos e por quê">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-ink">Cadastro:</strong> nome, apelido, WhatsApp e e-mail — base legal:
                execução do contrato de uso da plataforma (art. 7º, V).
              </li>
              <li>
                <strong className="text-ink">Gestão de banca:</strong> sessões, resultados financeiros, depósitos e
                saques que você registra — execução do contrato (é a função central desse módulo).
              </li>
              <li>
                <strong className="text-ink">Diário de sessão (humor/tilt/anotações):</strong> campo opcional de
                texto livre. Trate-o com cuidado — evite escrever dados de saúde ou identificar terceiros nele. Você
                pode editar ou apagar cada anotação a qualquer momento.
              </li>
              <li>
                <strong className="text-ink">Mãos de poker (hand history):</strong> coladas manualmente, importadas
                de arquivo, ou sincronizadas automaticamente pelo Radar PokerSync (agente desktop) — sempre com sua
                autorização explícita antes de cada conexão. Usadas pra alimentar Revisor, Treino e Análise.
              </li>
              <li>
                <strong className="text-ink">Pagamento:</strong> processado pela Stripe — recebemos apenas o e-mail
                de cobrança e o status da assinatura, nunca dados completos de cartão.
              </li>
              <li>
                <strong className="text-ink">Uso do produto:</strong> XP, progresso de treino, estatísticas de jogo —
                legítimo interesse em fazer o produto funcionar e evoluir.
              </li>
            </ul>
          </Secao>

          <Secao titulo="4. Dados sensíveis">
            <p>
              O campo de diário de sessão pode, dependendo do que você escrever, se aproximar de dado sensível (ex.:
              relatos ligados a saúde mental/comportamento de jogo). Tratamos esse campo com a mesma segurança dos
              demais dados de banca, e ele é 100% opcional e apagável por você a qualquer momento.
            </p>
          </Secao>

          <Secao titulo="5. Times, coaches e outros jogadores">
            <p>
              Se você entra num time, o coach/gestor responsável passa a ver seu progresso, atividade, leaks e o{" "}
              <strong className="text-ink">resultado financeiro agregado</strong> (ganhos menos buy-ins) no período —
              nunca o detalhamento diário da sua gestão de banca pessoal, nem sessões de staking. Isso fica claro no
              momento em que você aceita o convite do time.
            </p>
          </Secao>

          <Secao titulo="6. Estatísticas de outros jogadores (adversários)">
            <p>
              Quando você importa uma mão de poker, o PokerSync calcula estatísticas de jogo (VPIP, 3-bet, agressão
              etc.) também dos outros jogadores que estavam na mesa — não só as suas. Isso existe pra te ajudar a
              tomar decisão contra adversários recorrentes, do mesmo jeito que ferramentas de tracking de poker (HUD)
              fazem há anos.
            </p>
            <p className="mt-2">
              Base legal: legítimo interesse (art. 7º, IX), limitado à finalidade de apoio à decisão em jogo. Não
              coletamos nome completo, documento, e-mail nem qualquer dado de identificação real desses jogadores —
              só o nick usado na mesa e o comportamento observado no próprio jogo. Se você é um desses jogadores e
              quer que os dados vinculados ao seu nick sejam removidos, escreva pra{" "}
              <strong className="text-ink">[e-mail de privacidade a configurar]</strong> informando o(s) nick(s)
              usados.
            </p>
          </Secao>

          <Secao titulo="7. Com quem compartilhamos dados">
            <p>
              <strong className="text-ink">Stripe</strong> (processamento de pagamento) e{" "}
              <strong className="text-ink">Supabase</strong> (banco de dados e autenticação, com servidores fora do
              Brasil) — ambos sob contrato de processamento de dados compatível com a LGPD. Não vendemos nem
              compartilhamos seus dados com terceiros para fins de publicidade.
            </p>
          </Secao>

          <Secao titulo="8. Retenção e exclusão">
            <p>
              Mantemos seus dados enquanto sua conta existir. Ao excluir sua conta (seção 2), apagamos seus dados
              pessoais de forma definitiva em todas as áreas do produto — o que não pode ser desfeito. Faturas
              emitidas pela Stripe seguem o prazo de guarda fiscal exigido por lei, independente da exclusão da sua
              conta no PokerSync.
            </p>
          </Secao>

          <Secao titulo="9. Cookies">
            <p>
              O PokerSync usa apenas cookies estritamente necessários (sessão de login) — não usamos cookies de
              rastreamento ou analytics de terceiros.
            </p>
          </Secao>

          <Secao titulo="10. Segurança">
            <p>
              Seus dados são protegidos por controle de acesso a nível de banco de dados (row level security),
              conexão criptografada (HTTPS) e autenticação por sessão. Nenhum sistema é 100% infalível, mas
              revisamos ativamente a segurança da plataforma.
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
