"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, Loader2, X, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchReasons, type Reason } from "@/lib/services/hand-review-service";

const CATEGORIES = [
  "sizing", "range", "icm", "blocker", "timing", "mental",
  "value", "bluff", "pot_control", "position", "fold_equity", "other",
];
const STREETS = ["preflop", "flop", "turn", "river"];

interface DrillRow {
  id?: string;
  reason_code: string;
  category: string;
  street: string;
  tag_label: string;
  drill_title: string;
  drill_description: string;
  filter_config_text: string;
  priority: number;
  active: boolean;
}

const EMPTY: DrillRow = {
  reason_code: "", category: "", street: "", tag_label: "",
  drill_title: "", drill_description: "",
  filter_config_text: "{}", priority: 50, active: true,
};

// Corrigido em relacao ao Vite original: o import de supabase apontava para
// '../../lib/supabaseClient' (pasta inexistente no repo) e a navegacao usava
// react-router (useNavigate). Aqui usa o cliente real (@/lib/supabase/client)
// e o roteador do Next (useRouter), consistente com o resto do projeto.
export function AdminDrillsPanel() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [editing, setEditing] = useState<DrillRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [r, list] = await Promise.all([fetchReasons(), loadDrills()]);
      setReasons(r);
      setItems(list);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDrills() {
    const supabase = createClient();
    const { data, error: e } = await supabase
      .from("hand_review_drill_suggestions")
      .select("*")
      .order("priority", { ascending: false });
    if (e) {
      setError("Erro ao carregar.");
      return [];
    }
    return data ?? [];
  }

  function openNew() {
    setEditing({ ...EMPTY });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function openEdit(item: any) {
    setEditing({
      ...item,
      reason_code: item.reason_code || "",
      category: item.category || "",
      street: item.street || "",
      tag_label: item.tag_label || "",
      drill_description: item.drill_description || "",
      filter_config_text: JSON.stringify(item.filter_config || {}, null, 2),
    });
  }
  function close() {
    setEditing(null);
    setError("");
  }

  async function save() {
    if (!editing) return;
    if (!editing.drill_title.trim()) return setError("Título obrigatório.");
    if (!editing.reason_code && !editing.category && !editing.tag_label)
      return setError("Preencha ao menos: reason_code, category ou tag_label.");

    let filter_config;
    try {
      filter_config = JSON.parse(editing.filter_config_text || "{}");
    } catch {
      return setError("filter_config inválido (JSON).");
    }

    setSaving(true);
    setError("");
    const payload = {
      reason_code: editing.reason_code || null,
      category: editing.category || null,
      street: editing.street || null,
      tag_label: editing.tag_label || null,
      drill_title: editing.drill_title.trim(),
      drill_description: editing.drill_description?.trim() || null,
      filter_config,
      priority: Number(editing.priority) || 0,
      active: !!editing.active,
    };

    const supabase = createClient();
    const q = editing.id
      ? supabase.from("hand_review_drill_suggestions").update(payload).eq("id", editing.id)
      : supabase.from("hand_review_drill_suggestions").insert(payload);

    const { error: e } = await q;
    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }

    const list = await loadDrills();
    setItems(list);
    setSaving(false);
    close();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta sugestão?")) return;
    const supabase = createClient();
    await supabase.from("hand_review_drill_suggestions").delete().eq("id", id);
    setItems(await loadDrills());
  }

  return (
    <div className="mx-auto max-w-2xl p-5 text-ink">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-hairline p-1.5 text-ink"
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <Target size={18} className="text-review" />
          <h1 className="m-0 text-xl">Drills Sugeridos</h1>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-review px-3 py-2 text-[13px] font-semibold text-void"
        >
          <Plus size={14} /> Novo
        </button>
      </header>

      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((d) => (
            <li
              key={d.id}
              onClick={() => openEdit(d)}
              className="flex cursor-pointer gap-2.5 rounded-[10px] border border-hairline bg-surface p-3"
              style={{ opacity: d.active ? 1 : 0.5 }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[13px]">{d.drill_title}</b>
                  <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted">prio {d.priority}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.reason_code && <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">{d.reason_code}</span>}
                  {d.category && <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">{d.category}</span>}
                  {d.street && <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">{d.street}</span>}
                  {d.tag_label && <span className="rounded border border-review/30 bg-review/[0.15] px-1.5 py-0.5 text-[10px] text-review">{d.tag_label}</span>}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(d.id);
                }}
                className="text-muted"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-[500px] overflow-auto rounded-xl border border-hairline bg-void p-5"
          >
            <div className="mb-4 flex justify-between">
              <b>{editing.id ? "Editar" : "Novo"} drill</b>
              <button onClick={close} className="text-ink">
                <X size={16} />
              </button>
            </div>

            <label className="mb-1 mt-2.5 block text-[11px] uppercase text-muted">Título*</label>
            <input
              value={editing.drill_title}
              onChange={(e) => setEditing({ ...editing, drill_title: e.target.value })}
              className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
            />

            <label className="mb-1 mt-2.5 block text-[11px] uppercase text-muted">Descrição</label>
            <textarea
              value={editing.drill_description}
              rows={2}
              onChange={(e) => setEditing({ ...editing, drill_description: e.target.value })}
              className="w-full resize-y rounded-md border border-hairline bg-void p-2.5 text-[13px] text-ink outline-none"
            />

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] uppercase text-muted">Reason code</label>
                <select
                  value={editing.reason_code}
                  onChange={(e) => setEditing({ ...editing, reason_code: e.target.value })}
                  className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
                >
                  <option value="">—</option>
                  {reasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase text-muted">Categoria</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
                >
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] uppercase text-muted">Street</label>
                <select
                  value={editing.street}
                  onChange={(e) => setEditing({ ...editing, street: e.target.value })}
                  className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
                >
                  <option value="">—</option>
                  {STREETS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase text-muted">Tag label</label>
                <input
                  value={editing.tag_label}
                  onChange={(e) => setEditing({ ...editing, tag_label: e.target.value })}
                  placeholder="Ex: 3-Bet Pot"
                  className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
                />
              </div>
            </div>

            <label className="mb-1 mt-2.5 block text-[11px] uppercase text-muted">filter_config (JSON)</label>
            <textarea
              value={editing.filter_config_text}
              rows={4}
              onChange={(e) => setEditing({ ...editing, filter_config_text: e.target.value })}
              className="w-full resize-y rounded-md border border-hairline bg-void p-2.5 font-mono text-[11px] text-ink outline-none"
            />

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] uppercase text-muted">Prioridade</label>
                <input
                  type="number"
                  value={editing.priority}
                  onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                  className="w-full rounded-md border border-hairline bg-void px-2.5 py-2 text-[13px] text-ink outline-none"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-1.5 text-xs text-ink/80">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Ativo
                </label>
              </div>
            </div>

            {error && (
              <div className="mt-2.5 rounded-md border border-negative/40 bg-negative/10 p-2 text-xs text-negative">{error}</div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-review px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
