"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listReviews, setSpotSaved, type ReviewListItem } from "@/lib/services/hand-review-service";
import { CardHint, Linha, PainelCard, TileIcone } from "./painel-card";

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
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// "Mãos para revisar": a fila real do módulo Revisor (hand_reviews), só
// as que ainda não foram concluídas. A estrela liga/desliga o "spot
// salvo" de verdade (setSpotSaved) — é a mesma marcação que aparece na
// Biblioteca do Revisor, não um favorito só desta tela.
export function ReviewHandsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [itens, setItens] = useState<ReviewListItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const todas = await listReviews(data.user.id);
        if (!vivo) return;
        setItens(todas.filter((r) => r.status !== "concluida").slice(0, 5));
      } catch {
        // sem sessão/Supabase: card mostra o estado vazio, sem quebrar a tela
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function alternarSalvo(r: ReviewListItem) {
    const novo = !r.saved;
    setSalvando(r.id);
    // Atualiza na tela antes da resposta do banco (a lista é curta e a
    // ação é reversível); se falhar, volta ao estado anterior.
    setItens((lista) => lista.map((x) => (x.id === r.id ? { ...x, saved: novo } : x)));
    try {
      await setSpotSaved(r.id, novo);
    } catch {
      setItens((lista) => lista.map((x) => (x.id === r.id ? { ...x, saved: !novo } : x)));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <PainelCard
      title="Mãos para revisar"
      icon={<BookOpen size={15} />}
      action={
        <Link
          href="/revisor"
          className="rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
        >
          Ver todas
        </Link>
      }
      style={style}
      className={className}
    >
      {carregando ? (
        <CardHint>Carregando…</CardHint>
      ) : itens.length === 0 ? (
        <CardHint>
          Nenhuma mão na fila.{" "}
          <Link href="/revisor" className="font-semibold text-ink underline underline-offset-2">
            Enviar uma mão
          </Link>
        </CardHint>
      ) : (
        <ul className="painel-scroll flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
          {itens.map((r) => (
            <li key={r.id}>
              <Linha>
                <div className="flex items-center gap-3">
                  <Link href="/revisor" className="flex min-w-0 flex-1 items-center gap-3">
                    <TileIcone cor="#A855F7">
                      <BookOpen size={14} />
                    </TileIcone>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{rotulo(r)}</span>
                      <span className="block truncate text-[11px] text-muted/60">
                        {r.tags.length > 0 ? r.tags.map((t) => t.label).join(" · ") : `enviada ${quando(r.created_at)}`}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => alternarSalvo(r)}
                    disabled={salvando === r.id}
                    aria-label={r.saved ? "Tirar dos spots salvos" : "Salvar spot"}
                    aria-pressed={r.saved}
                    className="shrink-0 text-muted/40 transition-colors hover:text-evolution disabled:opacity-40"
                  >
                    <Star size={15} className={r.saved ? "fill-evolution text-evolution" : ""} />
                  </button>
                </div>
              </Linha>
            </li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}
