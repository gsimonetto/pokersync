"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, Star } from "lucide-react";
import { motion } from "framer-motion";
import { setSpotSaved, type ReviewListItem } from "@/lib/services/hand-review-service";
import { CardHint, Esqueleto, ItemAnimado, Linha, ListaLimitada, PainelCard, TileIcone } from "./painel-card";
import { usePainelDados } from "./painel-dados";
import { num } from "./formato";

// Quantas mãos entram na lista (3 à vista, o resto rolando dentro dela --
// ListaLimitada); o total da fila aparece no rodapé.
const VISIVEIS = 8;

function rotulo(r: ReviewListItem): string {
  const t = r.title?.trim();
  if (t) return t;
  const livre = r.free_text?.trim();
  if (livre) return livre.length > 46 ? `${livre.slice(0, 46)}…` : livre;
  return "Mão sem título";
}

function quando(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// "Mãos para revisar": a fila real do módulo Revisor (hand_reviews), só
// as que ainda não foram concluídas. A estrela liga/desliga o "spot
// salvo" de verdade (setSpotSaved) — é a mesma marcação que aparece na
// Biblioteca do Revisor, não um favorito só desta tela.
export function ReviewHandsCard({
  style,
  className,
  ordem,
}: {
  style?: React.CSSProperties;
  className?: string;
  ordem?: number;
}) {
  const { carregando, pendentes, setPendentes } = usePainelDados();
  const [salvando, setSalvando] = useState<string | null>(null);
  const itens = pendentes.slice(0, VISIVEIS);

  async function alternarSalvo(r: ReviewListItem) {
    const novo = !r.saved;
    setSalvando(r.id);
    // Atualiza na tela antes da resposta do banco (a lista é curta e a
    // ação é reversível); se falhar, volta ao estado anterior.
    setPendentes((lista) => lista.map((x) => (x.id === r.id ? { ...x, saved: novo } : x)));
    try {
      await setSpotSaved(r.id, novo);
    } catch {
      setPendentes((lista) => lista.map((x) => (x.id === r.id ? { ...x, saved: !novo } : x)));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <PainelCard
      title="Mãos para revisar"
      icon={<BookOpen size={15} />}
      action={
        // Mesmo formato do "Nova meta" do card de metas. Fica no topo
        // porque o canto de baixo à direita é do botão flutuante de conversa.
        <Link
          href="/revisor"
          className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-[#d4af37]/50 hover:text-ink"
        >
          <Plus size={12} />
          Enviar mão
        </Link>
      }
      style={style}
      className={className}
      ordem={ordem}
    >
      {carregando ? (
        <Esqueleto linhas={3} />
      ) : itens.length === 0 ? (
        <CardHint>
          Nenhuma mão na fila.{" "}
          <Link href="/revisor" className="font-semibold text-ink underline underline-offset-2">
            Enviar uma mão
          </Link>
        </CardHint>
      ) : (
        <>
          <ListaLimitada>
            {itens.map((r, i) => (
              <ItemAnimado key={r.id} indice={i}>
                <Linha>
                  <div className="flex items-center gap-3">
                    <Link href="/revisor" className="flex min-w-0 flex-1 items-center gap-3">
                      <TileIcone cor="#A855F7">
                        <BookOpen size={14} />
                      </TileIcone>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{rotulo(r)}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {r.tags.length > 0
                            ? r.tags.map((t) => t.label).join(" · ")
                            : `enviada ${quando(r.created_at)}`}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => alternarSalvo(r)}
                      disabled={salvando === r.id}
                      aria-label={r.saved ? "Tirar dos spots salvos" : "Salvar spot"}
                      aria-pressed={r.saved}
                      className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted/70 transition-colors hover:text-[#d4af37] disabled:opacity-40"
                    >
                      {/* "Pulo" ao marcar: confirma o clique sem precisar
                          de mensagem. A key força a animação a cada troca. */}
                      <motion.span
                        key={r.saved ? "salvo" : "livre"}
                        initial={{ scale: r.saved ? 0.6 : 1 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 600, damping: 14 }}
                        className="grid"
                      >
                        <Star size={15} className={r.saved ? "fill-[#d4af37] text-[#d4af37]" : ""} />
                      </motion.span>
                    </button>
                  </div>
                </Linha>
              </ItemAnimado>
            ))}
          </ListaLimitada>
          {/* Rodapé: o total da fila (o card só mostra as primeiras). À
            esquerda de propósito: o canto direito fica sob o botão
            flutuante de conversa. */}
          <p className="mt-auto pt-3 text-[12px] text-muted">
            {pendentes.length > VISIVEIS
              ? `Mostrando ${num(VISIVEIS)} de ${num(pendentes.length)} na fila`
              : `${num(pendentes.length)} ${pendentes.length === 1 ? "mão" : "mãos"} na fila`}
            {" · "}
            <Link href="/revisor" className="font-semibold text-[#d4af37] transition-colors hover:text-[#f1d78a]">
              Ver todas
            </Link>
          </p>
        </>
      )}
    </PainelCard>
  );
}
