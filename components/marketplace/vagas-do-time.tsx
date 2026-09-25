"use client";

import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { Rotulo } from "@/components/ranges/pecas";
import type { ContagemCandidatos, Listing } from "@/lib/services/marketplace-service";
import { OURO_CLARO, diasAte, situacaoDaVaga } from "./pecas";

// Vagas do time de quem é admin/coach: cada vaga com a situação, quantos
// candidatos novos (ainda sem decisão) e mensagens de candidato por ler.
export function VagasDoTime({
  nomeTime,
  vagas,
  contagem,
  naoLidas,
}: {
  nomeTime: string;
  vagas: Listing[];
  contagem: Map<string, ContagemCandidatos>;
  naoLidas: Map<string, number>;
}) {
  return (
    <section className="painel-vidro flex flex-col gap-2 rounded-2xl border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <Rotulo className="min-w-0 truncate">Vagas do {nomeTime}</Rotulo>
        <Link href="/marketplace/nova" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: OURO_CLARO }}>
          <Plus size={13} /> Nova
        </Link>
      </div>
      {vagas.length === 0 ? (
        <p className="m-0 px-1 pb-1 text-[12.5px] leading-snug text-muted">
          Seu time ainda não publicou vagas. Publique uma e os jogadores que batem com ela são avisados.
        </p>
      ) : (
        vagas.map((v) => {
          const c = contagem.get(v.id);
          const msgs = (c?.ids ?? []).reduce((s, id) => s + (naoLidas.get(id) ?? 0), 0);
          const sit = situacaoDaVaga(v);
          const dias = sit.texto === "Aberta" ? diasAte(v.expiresAt) : null;
          return (
            <Link
              key={v.id}
              href={`/marketplace/${v.id}`}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <p className="m-0 truncate text-[13px] font-semibold text-ink">{v.title}</p>
              <p className="m-0 mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11.5px] text-muted">
                <span>
                  <span style={{ color: sit.cor }}>{sit.texto}</span>
                  {dias !== null && ` · encerra em ${dias <= 0 ? "menos de 1 dia" : `${dias} ${dias === 1 ? "dia" : "dias"}`}`}
                </span>
                <span className="flex items-center gap-1.5">
                  {msgs > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-ink/90" title={`${msgs} mensagens de candidato por ler`}>
                      <MessageCircle size={12} /> {msgs}
                    </span>
                  )}
                  {(c?.pendentes ?? 0) > 0 && (
                    <b className="rounded-full bg-[#d4af37] px-1.5 text-[10px] text-black">
                      {c!.pendentes} {c!.pendentes === 1 ? "novo" : "novos"}
                    </b>
                  )}
                  <span>
                    {c?.total ?? 0} no total
                  </span>
                </span>
              </p>
            </Link>
          );
        })
      )}
    </section>
  );
}
