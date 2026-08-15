"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, GitBranch } from "lucide-react";
import { listRanges, type RangeListItem } from "@/lib/services/range-service";
import { listTrees, type TreeListItem } from "@/lib/services/strategy-tree-service";

// Temas sugeridos como atalho — aparecem mesmo com 0 itens, pra sinalizar
// que sao categorias validas do produto (o usuario so precisa comecar a
// usar essa tag). Qualquer tag customizada que o usuario ja usou tambem
// entra na lista, misturada com essas.
const SUGGESTED_THEMES = [
  "3-bet pots",
  "C-bet",
  "Blind vs Blind",
  "ICM",
  "Mystery Bounty",
  "Push/Fold",
  "Defesa de BB",
];

type LibraryItem =
  | { kind: "range"; id: string; name: string; description: string | null; tags: string[] }
  | { kind: "tree"; id: string; name: string; description: string | null; tags: string[] };

export function Biblioteca() {
  const router = useRouter();
  const [ranges, setRanges] = useState<RangeListItem[]>([]);
  const [trees, setTrees] = useState<TreeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRanges(), listTrees()])
      .then(([r, t]) => {
        setRanges(r);
        setTrees(t);
      })
      .catch(() => setError("Erro ao carregar sua biblioteca."))
      .finally(() => setLoading(false));
  }, []);

  const items: LibraryItem[] = useMemo(
    () => [
      ...ranges.map((r) => ({ kind: "range" as const, id: r.id, name: r.name, description: r.description, tags: r.tags })),
      ...trees.map((t) => ({ kind: "tree" as const, id: t.id, name: t.name, description: t.description, tags: t.tags })),
    ],
    [ranges, trees]
  );

  const themes = useMemo(() => {
    const counts = new Map<string, number>();
    SUGGESTED_THEMES.forEach((t) => counts.set(t, 0));
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = activeTag ? items.filter((i) => i.tags.includes(activeTag)) : items;

  function openItem(item: LibraryItem) {
    router.push(item.kind === "range" ? `/ranges/${item.id}` : `/ranges/arvores/${item.id}`);
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div>
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTag(null)}
          className={`rounded-full border px-3 py-1 text-xs ${
            activeTag === null ? "border-ink bg-ink text-void" : "border-hairline bg-surface text-muted"
          }`}
        >
          Tudo ({items.length})
        </button>
        {themes.map(([tag, count]) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeTag === tag ? "border-ink bg-ink text-void" : "border-hairline bg-surface text-muted"
            }`}
          >
            {tag} ({count})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            {activeTag
              ? `Nenhum range ou árvore com a tag "${activeTag}" ainda.`
              : "Sua biblioteca está vazia. Crie um range ou uma árvore pra começar."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            onClick={() => openItem(item)}
            className="rounded-xl border border-hairline bg-surface p-4 text-left"
          >
            <div className="mb-1 flex items-center gap-2">
              {item.kind === "range" ? (
                <Layers size={14} className="text-review" />
              ) : (
                <GitBranch size={14} className="text-review" />
              )}
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {item.kind === "range" ? "Range" : "Árvore"}
              </span>
            </div>
            <h3 className="mb-1 truncate text-sm font-semibold">{item.name}</h3>
            {item.description && <p className="mb-2 line-clamp-2 text-xs text-muted">{item.description}</p>}
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <span key={t} className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
