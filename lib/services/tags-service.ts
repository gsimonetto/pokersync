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

// Sem seed automatico de proposito: o jogador comeca sem nenhuma tag e
// so' aparece aqui o que ele mesmo criar em createProductTag.
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
  return data as ProductTag[];
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
