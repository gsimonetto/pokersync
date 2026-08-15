"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Tag as TagIcon, Check } from "lucide-react";
import { listProductTags, createProductTag, TAG_PALETTE, type ProductTag } from "@/lib/services/tags-service";

// Usado em qualquer lugar do produto que precise de tags (Ranges,
// Arvores, e futuramente outros modulos) — a lista de tags disponiveis
// e' a MESMA em todo lugar (vem de product_tags, por usuario), entao
// uma tag criada aqui ja aparece pronta pra usar em outro modulo.
export function TagPicker({ value, onChange }: { value: string[]; onChange: (labels: string[]) => void }) {
  const [allTags, setAllTags] = useState<ProductTag[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_PALETTE[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listProductTags().then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function colorFor(label: string): string {
    return allTags.find((t) => t.label === label)?.color ?? TAG_PALETTE[TAG_PALETTE.length - 1];
  }

  function toggle(label: string) {
    if (value.includes(label)) onChange(value.filter((l) => l !== label));
    else onChange([...value, label]);
  }

  async function handleCreate() {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const created = await createProductTag(label, newColor);
      setAllTags((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
      onChange([...value, created.label]);
      setNewLabel("");
      setCreating(false);
    } catch {
      const existing = allTags.find((t) => t.label.toLowerCase() === label.toLowerCase());
      if (existing && !value.includes(existing.label)) onChange([...value, existing.label]);
      setNewLabel("");
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2 py-1.5"
      >
        {value.length === 0 && (
          <span className="flex items-center gap-1.5 px-1 text-xs text-muted">
            <TagIcon size={13} />
            Adicionar tags…
          </span>
        )}
        {value.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${colorFor(label)}26`, color: colorFor(label) }}
          >
            {label}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(label);
              }}
              className="cursor-pointer opacity-70 hover:opacity-100"
            >
              <X size={10} />
            </span>
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-xl border border-hairline bg-surface p-2 shadow-lg">
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {allTags.map((t) => {
              const selected = value.includes(t.label);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.label)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-elevated"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="flex-1 truncate">{t.label}</span>
                  {selected && <Check size={14} className="text-positive" />}
                </button>
              );
            })}
            {allTags.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">Nenhuma tag ainda.</p>}
          </div>

          <div className="mt-2 border-t border-hairline pt-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-elevated hover:text-ink"
              >
                <Plus size={14} />
                Criar nova tag
              </button>
            ) : (
              <div className="space-y-2 px-2 py-1">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Nome da tag"
                  autoFocus
                  className="w-full rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-sm outline-none"
                />
                <div className="flex items-center gap-1.5">
                  {TAG_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className="h-5 w-5 shrink-0 rounded-full"
                      style={{ backgroundColor: c, outline: newColor === c ? "2px solid white" : "none", outlineOffset: 2 }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full rounded-lg bg-ink px-2 py-1.5 text-xs font-medium text-void"
                >
                  Criar e adicionar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
