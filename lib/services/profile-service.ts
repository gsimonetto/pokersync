import { createClient } from "@/lib/supabase/client";

export type TempoExperiencia = "menos_1_ano" | "1_2_anos" | "3_5_anos" | "5_mais_anos";
export type HorarioTreino = "manha" | "tarde" | "noite" | "madrugada";

export const TEMPO_EXPERIENCIA_LABEL: Record<TempoExperiencia, string> = {
  menos_1_ano: "Menos de 1 ano",
  "1_2_anos": "1 a 2 anos",
  "3_5_anos": "3 a 5 anos",
  "5_mais_anos": "5+ anos",
};

export const HORARIO_TREINO_LABEL: Record<HorarioTreino, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  madrugada: "Madrugada",
};

export interface Profile {
  id: string;
  nome: string;
  apelido: string;
  avatar_id: number;
  avatar_url: string | null;
  /** Campos opcionais pra futura curadoria de comunidade — aniversario
      alimenta o filtro do calendario do Time. */
  data_nascimento: string | null;
  tempo_experiencia: TempoExperiencia | null;
  horario_treino: HorarioTreino | null;
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
    .select("id, nome, apelido, avatar_id, avatar_url, data_nascimento, tempo_experiencia, horario_treino")
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
    data_nascimento: null,
    tempo_experiencia: null,
    horario_treino: null,
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

export async function updateProfileDetails(patch: {
  dataNascimento?: string | null;
  tempoExperiencia?: TempoExperiencia | null;
  horarioTreino?: HorarioTreino | null;
}) {
  const supabase = createClient();
  const user = await getUser();
  const row: Record<string, unknown> = {};
  if (patch.dataNascimento !== undefined) row.data_nascimento = patch.dataNascimento;
  if (patch.tempoExperiencia !== undefined) row.tempo_experiencia = patch.tempoExperiencia;
  if (patch.horarioTreino !== undefined) row.horario_treino = patch.horarioTreino;
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
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
