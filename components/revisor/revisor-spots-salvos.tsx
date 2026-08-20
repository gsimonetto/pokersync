"use client";

import { useEffect, useState } from "react";
import { Bookmark, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThumbUrl, listReviews, type ReviewListItem } from "@/lib/services/hand-review-service";

// Biblioteca dos spots marcados como "salvar pra rever depois" (botão
// bookmark em cada mão) — separada da fila normal porque misturar tudo
// junto faz o que realmente vale a pena revisar se perder no meio de
// mãos já concluídas ou sem interesse de voltar.
export function RevisorSpotsSalvos({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid) return;
        const rows = await listReviews(uid, { saved: true });
        setItems(rows);
        rows.slice(0, 30).forEach((r) => {
          if (!r.thumb) return;
          getThumbUrl(r.thumb).then((url) => setThumbs((prev) => ({ ...prev, [r.id]: url })));
        });
      } catch {
        setError("Erro ao carregar os spots salvos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
        Carregando…
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center">
        <Bookmark size={32} className="text-elevated" />
        <p className="mt-3 text-muted">
          Nenhum spot salvo ainda. Abra uma mão e clique no ícone de marcador pra guardá-la aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((r) => (
        <li
          key={r.id}
          onClick={() => onOpen(r.id)}
          className="flex cursor-pointer gap-3 rounded-xl border border-hairline bg-surface p-3 transition-colors hover:border-ink/40"
        >
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-void">
            {thumbs[r.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbs[r.id]!} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={22} className="text-elevated" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink">{r.title || "Mão sem título"}</span>
              <Bookmark size={13} fill="currentColor" className="shrink-0 text-ink" />
            </div>

            {r.free_text && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {r.free_text.length > 90 ? r.free_text.slice(0, 90) + "…" : r.free_text}
              </p>
            )}

            {r.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.tags.slice(0, 4).map((t) => (
                  <span key={t.id} className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
