"use client";

import Link from "next/link";
import { Check, Minus, Sparkles, X } from "lucide-react";
import type { Listing, MeuMatch, Moeda, Requisito } from "@/lib/services/marketplace-service";
import { AnelMatch, NOME_REQUISITO, requisitosDaVaga, textoMeu, textoPedido, type EstadoMatch } from "./pecas";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// A dica embaixo do match: o que falta de dado, ou o requisito que mais
// sobe o match se o jogador passar a bater (com a conta do banco:
// pontos agora x pontos batendo, pelo peso).
function dicaDoMatch(meu: MeuMatch, moeda: Moeda): { texto: string; href?: string; link?: string } | null {
  const semDado = meu.requisitos.filter((r) => r.ok === null);
  if (semDado.length) {
    return semDado.some((r) => r.chave !== "evolucao")
      ? { texto: "Registre suas sessões na Gestão de Banca pra entrar na conta o que ainda está sem dado.", href: "/banca", link: "Abrir a Banca" }
      : { texto: "Treine e revise mãos no PokerSync pra ter sua nota de evolução.", href: "/treino", link: "Treinar" };
  }
  let melhor: { r: Requisito; ganho: number } | null = null;
  for (const r of meu.requisitos) {
    if (r.ok !== false || r.pontos == null || r.pontosSeBater == null) continue;
    const ganho = (r.peso * (r.pontosSeBater - r.pontos)) / 100;
    if (!melhor || ganho > melhor.ganho) melhor = { r, ganho };
  }
  if (!melhor || melhor.ganho < 1) return null;
  const { r } = melhor;
  const novo = Math.min(100, Math.round(meu.match + melhor.ganho));
  const alvo: Record<Requisito["chave"], string> = {
    roi: `Chegando a ${fmt(r.pedidoMin)}% de ROI`,
    volume: `Subindo pra ${fmt(r.pedidoMin)} sessões por mês`,
    evolucao: `Levando sua evolução a ${fmt(r.pedidoMin)}`,
    buyin: `Jogando buy-ins de ${textoPedido(r, moeda)}`,
  };
  return { texto: `${alvo[r.chave]}, seu match vai pra perto de ${novo}.` };
}

function LinhaRequisito({ r, moeda }: { r: Requisito; moeda: Moeda }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="flex items-center gap-1.5 font-semibold">
          <span
            className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
              r.ok === true ? "bg-[#34D399]/20 text-[#34D399]" : r.ok === false ? "bg-[#F87171]/20 text-[#F87171]" : "bg-white/10 text-muted"
            }`}
          >
            {r.ok === true ? <Check size={10} strokeWidth={3} /> : r.ok === false ? <X size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
          </span>
          {NOME_REQUISITO[r.chave]}
        </span>
        <span className="shrink-0 text-[11px] text-muted">pesa {r.peso}%</span>
      </div>
      <div className="mt-1 text-[12px] leading-snug text-muted">
        O seu: <b className={r.meu == null ? "font-medium text-muted" : "text-ink/90"}>{textoMeu(r, moeda)}</b> · pedido:{" "}
        <b className="text-ink/90">{textoPedido(r, moeda)}</b>
      </div>
    </div>
  );
}

// "Seu match com a vaga": o número, quantos requisitos o jogador bate e,
// um por um, o número dele ao lado do que a vaga pede.
export function MatchExplicado({ vaga, meu }: { vaga: Listing; meu: MeuMatch | null | undefined }) {
  const reqs = meu?.requisitos ?? requisitosDaVaga(vaga);
  const avaliados = reqs.filter((r) => r.ok !== null);
  const batidos = reqs.filter((r) => r.ok === true).length;
  const semDado = reqs.length - avaliados.length;
  const estado: EstadoMatch = reqs.length === 0 ? "livre" : avaliados.length === 0 || !meu ? "sem-dados" : "numero";
  const dica = meu ? dicaDoMatch(meu, vaga.moeda) : null;

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-4">
      <div className="flex items-center gap-4">
        {meu === undefined ? (
          <span className="h-24 w-24 shrink-0 animate-pulse rounded-full border border-white/10" aria-hidden />
        ) : (
          <AnelMatch valor={meu?.match ?? null} estado={estado} tamanho={96} />
        )}
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-semibold">Seu match com a vaga</h3>
          <p className="m-0 mt-1 text-[12.5px] leading-snug text-muted">
            {estado === "livre" ? (
              "Essa vaga não pede requisitos: qualquer jogador pode se candidatar."
            ) : estado === "sem-dados" ? (
              "Ainda não temos seus números pra comparar com o que a vaga pede."
            ) : (
              <>
                Você bate{" "}
                <b className="text-ink/90">
                  {batidos} de {reqs.length}
                </b>{" "}
                {reqs.length === 1 ? "requisito" : "requisitos"}.
                {semDado > 0 && ` ${semDado} ainda sem dado.`}
              </>
            )}
          </p>
        </div>
      </div>

      {reqs.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          {reqs.map((r) => (
            <LinhaRequisito key={r.chave} r={r} moeda={vaga.moeda} />
          ))}
        </div>
      )}

      {dica && (
        <p className="m-0 mt-3 rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/[0.07] px-3 py-2 text-[12px] leading-snug text-ink/90">
          <Sparkles size={12} className="mr-1 inline text-[#e8cb6a]" />
          {dica.texto}
          {dica.href && (
            <>
              {" "}
              <Link href={dica.href} className="font-semibold text-[#e8cb6a] hover:underline">
                {dica.link} ›
              </Link>
            </>
          )}
        </p>
      )}

      {reqs.length > 0 && (
        <p className="m-0 mt-2.5 text-[11px] leading-snug text-muted/80">
          Cada requisito pesa um tanto no match. O que a vaga não pede, ou que você ainda não tem, fica no meio (50).
        </p>
      )}
    </section>
  );
}
