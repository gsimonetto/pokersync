import { createClient } from "@/lib/supabase/client";

// Paleta fechada (nao e' um color-picker livre) — mantem visual
// consistente entre todas as tags do produto, em vez de cada usuario
// escolher uma cor aleatoria que pode nao combinar com o dark mode.
export const TAG_PALETTE = [
  "#22c55e", // positive
  "#3b82f6", // training
  "#f59e0b", // evolution
  "#a855f7", // review
  "#e0555a", // negative
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#c4c7c8", // neutro
] as const;

export interface ProductTag {
  id: string;
  label: string;
  color: string;
}

// Toda conta nova comeca com esse conjunto — os mesmos temas ja
// sugeridos na Biblioteca antes dessa tabela existir. So' e' inserido
// se o usuario ainda nao tem NENHUMA tag (nao reinsere se ele ja
// apagou/customizou).
const DEFAULT_TAGS = ["3-bet pots", "C-bet", "Blind vs Blind", "ICM", "Mystery Bounty", "Push/Fold", "Defesa de BB"];

export async function listProductTags(): Promise<ProductTag[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("product_tags")
    .select("id, label, color")
    .order("label", { ascending: true });
  if (error) throw error;

  if ((data ?? []).length > 0) return data as ProductTag[];

  const seeded = DEFAULT_TAGS.map((label, i) => ({
    user_id: user.id,
    label,
    color: TAG_PALETTE[i % TAG_PALETTE.length],
  }));
  const { data: inserted, error: insertError } = await supabase
    .from("product_tags")
    .insert(seeded)
    .select("id, label, color");
  if (insertError) throw insertError;
  return (inserted as ProductTag[]).sort((a, b) => a.label.localeCompare(b.label));
}

export async function createProductTag(label: string, color: string): Promise<ProductTag> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data, error } = await supabase
    .from("product_tags")
    .insert({ user_id: user.id, label: label.trim(), color })
    .select("id, label, color")
    .single();
  if (error) throw error;
  return data as ProductTag;
}

export async function deleteProductTag(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("product_tags").delete().eq("id", id);
  if (error) throw error;
}
