import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  nome: string;
  apelido: string;
  avatar_id: number;
  avatar_url: string | null;
}

async function getUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("NO_SESSION");
  return data.user;
}

// Le nome/apelido/avatar do usuario logado. Se a linha em `profiles` ainda
// nao existir (usuarios criados antes desta migracao, ou signup que falhou
// no meio), cria com os dados do auth.user_metadata como fallback — nunca
// deixa a tela quebrar por falta de linha.
export async function fetchProfile(): Promise<Profile> {
  const supabase = createClient();
  const user = await getUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, apelido, avatar_id, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const meta = user.user_metadata || {};
  const fallback: Profile = {
    id: user.id,
    nome: meta.nome || "",
    apelido: meta.apelido || "",
    avatar_id: 1,
    avatar_url: null,
  };
  const { error: eIns } = await supabase.from("profiles").insert(fallback);
  if (eIns) throw eIns;
  return fallback;
}

export async function updateAvatarIcon(avatarId: number) {
  const supabase = createClient();
  const user = await getUser();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_id: avatarId, avatar_url: null })
    .eq("id", user.id);
  if (error) throw error;
}

const BUCKET = "avatars";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatarPhoto(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error("Formato inválido (use JPG, PNG ou WEBP).");
  if (file.size > MAX_SIZE) throw new Error("Arquivo excede 5MB.");

  const supabase = createClient();
  const user = await getUser();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type,
  });
  if (eUp) throw eUp;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: mesmo caminho sempre, sem isso o navegador mostraria a foto antiga.
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: eProf } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (eProf) throw eProf;

  return url;
}

export async function removeAvatarPhoto() {
  const supabase = createClient();
  const user = await getUser();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("A senha precisa ter ao menos 6 caracteres.");
  }
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
