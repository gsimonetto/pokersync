"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Image as ImageIcon, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getThumbUrl, listReviews, type ReviewListItem } from "@/lib/services/hand-review-service";
import { FilterChip } from "@/components/ui/filter-chip";
import {
  HERO_POSITION_LABEL,
  HERO_POSITION_ORDER,
  STACK_DEPTH_LABEL,
  type HeroPosition,
  type StackDepthBucket,
} from "@/types/analysis";

// Aba propria (ao lado de Fila/Salvos, nao dentro de nenhuma delas —
// pedido explicito do dono: abrir esta aba e' pra REVISAR mãos, nao
// analisar) -- busca em TODAS as maos do usuario (sessoes + avulsas +
// salvas), por posicao, stack e all-in. Mesmos tipos/rotulos/faixas de
// posicao e stack ja usados em AnalysisFilters.tsx (Performance), pra
// nao inventar uma segunda taxonomia — so' a fonte do dado muda (aqui e'
// direto do ParsedHand da propria mao, la' e' de hand_tags agregado).

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Mesmos cortes de STACK_DEPTH_LABEL (0-10/10-20/20-40/40-60/60+),
// aplicados aqui em cima do bb bruto da propria mao -- o pipeline de
// hand_tags que alimenta a Performance faz o mesmo corte, so' que la'
// já vem pronto do banco.
function stackDepthBucketOf(bb: number): StackDepthBucket {
  if (bb <= 10) return "0-10";
  if (bb <= 20) return "10-20";
  if (bb <= 40) return "20-40";
  if (bb <= 60) return "40-60";
  return "60+";
}

// Le' os campos crus do ParsedHand direto do parsed_data (jsonb) -- sem
// tipar como ParsedHand completo porque so' precisamos de alguns campos,
// e nem toda mao tem parsed_data no formato "parsed" (print/manual nao
// tem como entrar nesses filtros, ficam de fora sem erro).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heroStackBb(parsed: any): number | null {
  if (!parsed || parsed.kind !== "parsed" || !parsed.bigBlind) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heroSeat = (parsed.seats || []).find((s: any) => s.playerName === parsed.heroName);
  if (!heroSeat) return null;
  return heroSeat.startingChips / parsed.bigBlind;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function heroWentAllIn(parsed: any): boolean {
  if (!parsed || parsed.kind !== "parsed") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preflop = (parsed.streets || []).find((s: any) => s.name === "preflop");
  if (!preflop) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (preflop.actions || []).some((a: any) => a.player === parsed.heroName && a.isAllIn);
}

export function RevisorFiltrosAvancados({ onOpen }: { onOpen: (id: string) => void }) {
  const [positions, setPositions] = useState<HeroPosition[]>([]);
  const [stackDepths, setStackDepths] = useState<StackDepthBucket[]>([]);
  const [allInOnly, setAllInOnly] = useState(false);
  const [allItems, setAllItems] = useState<ReviewListItem[]>([]);
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
        const rows = await listReviews(uid);
        setAllItems(rows);
      } catch {
        setError("Erro ao carregar suas mãos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCount = positions.length + stackDepths.length + (allInOnly ? 1 : 0);

  const items = useMemo(() => {
    if (activeCount === 0) return [];
    return allItems.filter((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = r.parsed_data as any;
      if (allInOnly && !heroWentAllIn(parsed)) return false;
      if (positions.length > 0 && !positions.includes(parsed?.heroPosition)) return false;
      if (stackDepths.length > 0) {
        const bb = heroStackBb(parsed);
        if (bb === null || !stackDepths.includes(stackDepthBucketOf(bb))) return false;
      }
      return true;
    });
  }, [allItems, positions, stackDepths, allInOnly, activeCount]);

  useEffect(() => {
    items.slice(0, 30).forEach((r) => {
      if (!r.thumb || thumbs[r.id] !== undefined) return;
      getThumbUrl(r.thumb).then((url) => setThumbs((prev) => ({ ...prev, [r.id]: url })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div>
      <div className="mb-4 rounded-xl border border-hairline bg-surface p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal size={15} className="icon-glow text-review" />
          <h3 className="m-0 text-sm font-semibold text-ink">Buscar por posição, stack e resultado</h3>
        </div>
        <p className="mb-3 text-xs text-muted">
          Busca em todas as suas mãos (torneios/sessões, avulsas e salvas), pra você achar rápido o que quer revisar.
        </p>

        <div className="space-y-3">
          <FilterGroup label="Posição">
            {HERO_POSITION_ORDER.map((p) => (
              <FilterChip
                key={p}
                label={HERO_POSITION_LABEL[p]}
                active={positions.includes(p)}
                onClick={() => setPositions(toggle(positions, p))}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Stack">
            {(Object.keys(STACK_DEPTH_LABEL) as StackDepthBucket[]).map((s) => (
              <FilterChip
                key={s}
                label={STACK_DEPTH_LABEL[s]}
                active={stackDepths.includes(s)}
                onClick={() => setStackDepths(toggle(stackDepths, s))}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Resultado">
            <FilterChip label="Só all-in" icon={<Zap size={11} />} active={allInOnly} onClick={() => setAllInOnly((v) => !v)} />
          </FilterGroup>
        </div>
      </div>

      {error && <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{error}</div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
          Carregando…
        </div>
      ) : activeCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
          Escolha ao menos um filtro acima pra ver as mãos.
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
          Nenhuma mão bate com esses filtros.
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((r, idx) => (
            <li
              key={r.id}
              onClick={() => onOpen(r.id)}
              style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
              className="fade-in-up flex cursor-pointer gap-3 rounded-xl border border-hairline bg-surface p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-lg"
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
                <span className="truncate text-sm font-semibold text-ink">{r.title || "Mão sem título"}</span>
                {r.free_text && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    {r.free_text.length > 90 ? r.free_text.slice(0, 90) + "…" : r.free_text}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Mesmo padrao de FilterGroup usado em components/analysis/AnalysisFilters.tsx
// (rotulo pequeno em uppercase + linha de chips) -- reusado aqui pra manter
// a mesma linguagem visual de filtro em todo o produto.
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
