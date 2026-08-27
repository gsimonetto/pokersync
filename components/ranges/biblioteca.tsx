"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, GitBranch, Search } from "lucide-react";
import { listRanges, type RangeHands, type RangeListItem } from "@/lib/services/range-service";
import { listTrees, type TreeListItem } from "@/lib/services/strategy-tree-service";
import { RangeGridPreview } from "@/components/ranges/range-grid-preview";
import { FilterChip } from "@/components/ui/filter-chip";

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
  | { kind: "range"; id: string; name: string; description: string | null; tags: string[]; hands: RangeHands }
  | { kind: "tree"; id: string; name: string; description: string | null; tags: string[] };

export function Biblioteca({ tabs }: { tabs?: React.ReactNode }) {
  const router = useRouter();
  const [ranges, setRanges] = useState<RangeListItem[]>([]);
  const [trees, setTrees] = useState<TreeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);

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
      ...ranges.map((r) => ({ kind: "range" as const, id: r.id, name: r.name, description: r.description, tags: r.tags, hands: r.hands })),
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

  const filtered = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return items.filter((i) => {
      if (activeTag && !i.tags.includes(activeTag)) return false;
      if (termo && !i.name.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [items, activeTag, busca]);

  function openItem(item: LibraryItem) {
    router.push(item.kind === "range" ? `/ranges/${item.id}` : `/ranges/arvores/${item.id}`);
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    // Container unico envolvendo filtros + grade -- mesmo padrao do
    // Funil e do construtor de ranges (RangeEditor), em vez do filtro
    // boiar solto acima dos cards.
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs && <div className="mb-3 flex justify-end">{tabs}</div>}
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {/* Chips + busca na mesma linha (busca vira botao que abre um
          campo, igual ao Funil/Jogadores) -- antes eram dois blocos
          empilhados, ocupando mais altura que precisava. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip label={`Tudo (${items.length})`} active={activeTag === null} onClick={() => setActiveTag(null)} />
        {themes.map(([tag, count]) => (
          <FilterChip key={tag} label={`${tag} (${count})`} active={activeTag === tag} onClick={() => setActiveTag(tag)} />
        ))}

        <button
          type="button"
          onClick={() => {
            setBuscaAberta((v) => !v);
            if (buscaAberta) setBusca("");
          }}
          aria-label={buscaAberta ? "Fechar busca" : "Buscar"}
          title="Buscar por nome"
          className={`ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
            buscaAberta || busca ? "border-ink bg-ink text-void" : "border-hairline text-muted hover:border-ink/40 hover:text-ink"
          }`}
        >
          <Search size={13} />
        </button>
      </div>

      {buscaAberta && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2">
          <Search size={13} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome…"
            className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted/50"
          />
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            {busca.trim()
              ? `Nada bate com "${busca}".`
              : activeTag
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
            {item.kind === "range" ? (
              <div className="mb-1 flex gap-3">
                <RangeGridPreview hands={item.hands} className="w-14 shrink-0" />
                <div className="min-w-0">
                  <h3 className="mb-1 truncate text-sm font-semibold">{item.name}</h3>
                  {item.description && <p className="line-clamp-2 text-xs text-muted">{item.description}</p>}
                </div>
              </div>
            ) : (
              <>
                <h3 className="mb-1 truncate text-sm font-semibold">{item.name}</h3>
                {item.description && <p className="mb-2 line-clamp-2 text-xs text-muted">{item.description}</p>}
              </>
            )}
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
