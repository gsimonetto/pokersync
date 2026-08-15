import { createClient } from "@/lib/supabase/client";
import type { RangeHands } from "@/components/ranges/range-grid";

// RangeHands agora vive em range-grid.tsx (fold/call/raise por mao, somando
// 100) — reexportado aqui pra quem so importa do service nao precisar
// saber que o tipo mora no componente.
export type { RangeHands };

export interface RangeListItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  hand_count: number;
  team_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RangeDetail extends RangeListItem {
  user_id: string;
  hands: RangeHands;
  comboOverrides: RangeHands;
}

export interface RangeInput {
  name: string;
  description?: string | null;
  hands: RangeHands;
  tags?: string[];
  comboOverrides?: RangeHands;
}

// Conta so as maos com alguma acao alem de fold — mao 100% fold (seja
// porque nunca foi pintada, seja porque foi zerada de volta) nao conta
// como "no range" pra contagem exibida na biblioteca.
function countActiveHands(hands: RangeHands): number {
  return Object.values(hands).filter((d) => d.call > 0 || d.raise > 0).length;
}

export async function listRanges(): Promise<RangeListItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ranges")
    .select("id, name, description, tags, hands, team_id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags ?? [],
    hand_count: countActiveHands((r.hands as RangeHands) ?? {}),
    team_id: r.team_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function getRange(id: string): Promise<RangeDetail> {
  const supabase = createClient();
  const { data, error } = await supabase.from("ranges").select("*").eq("id", id).single();

  if (error) throw error;
  if (!data) throw new Error("RANGE_NOT_FOUND");

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    tags: data.tags ?? [],
    hands: (data.hands as RangeHands) ?? {},
    comboOverrides: (data.combo_overrides as RangeHands) ?? {},
    hand_count: countActiveHands((data.hands as RangeHands) ?? {}),
    team_id: data.team_id ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createRange(input: RangeInput): Promise<RangeDetail> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data, error } = await supabase
    .from("ranges")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      hands: input.hands,
      tags: input.tags ?? [],
      combo_overrides: input.comboOverrides ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    tags: data.tags ?? [],
    hands: (data.hands as RangeHands) ?? {},
    comboOverrides: (data.combo_overrides as RangeHands) ?? {},
    hand_count: countActiveHands((data.hands as RangeHands) ?? {}),
    team_id: data.team_id ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Update parcial: so envia os campos passados, permitindo salvar so o
// nome (rename) sem reenviar o mapa de maos inteiro.
// Toda vez que o range e' salvo, o estado completo (nome/descricao/tags/
// hands) vira um snapshot em range_versions — historico append-only, o
// usuario nunca perde uma versao anterior. Update parcial (ex: so
// renomear) so tira snapshot se "hands" veio junto, pra nao poluir o
// historico com edicoes de metadado que nao mudam a estrategia em si.
export async function updateRange(id: string, input: Partial<RangeInput>, versionNote?: string): Promise<void> {
  const supabase = createClient();
  // RangeInput usa camelCase (comboOverrides) mas a coluna no banco e'
  // combo_overrides — sem esse mapeamento, um update com comboOverrides
  // tentaria gravar numa coluna que nao existe.
  const { comboOverrides, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (comboOverrides !== undefined) payload.combo_overrides = comboOverrides;

  const { error } = await supabase.from("ranges").update(payload).eq("id", id);
  if (error) throw error;

  if (input.hands) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const current = await getRange(id);
    await supabase.from("range_versions").insert({
      range_id: id,
      user_id: user.id,
      name: current.name,
      description: current.description,
      tags: current.tags,
      hands: current.hands,
      version_note: versionNote ?? null,
    });
  }
}

export interface RangeVersion {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  hands: RangeHands;
  version_note: string | null;
  created_at: string;
}

export async function listRangeVersions(rangeId: string): Promise<RangeVersion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("range_versions")
    .select("id, name, description, tags, hands, version_note, created_at")
    .eq("range_id", rangeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RangeVersion[];
}

// Restaurar uma versao antiga NAO apaga o historico — vira uma nova
// atualizacao (com nota automatica), entao o range volta ao estado de
// antes mas o historico continua completo, incluindo o momento da
// restauracao.
export async function restoreRangeVersion(rangeId: string, version: RangeVersion): Promise<void> {
  await updateRange(
    rangeId,
    { name: version.name, description: version.description, tags: version.tags, hands: version.hands },
    `Restaurado de ${new Date(version.created_at).toLocaleString("pt-BR")}`
  );
}

export async function deleteRange(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ranges").delete().eq("id", id);
  if (error) throw error;
}

// Duplica um range existente como base para versionamento (ex: "AKs Open
// 40bb (copia)") — usuario edita a copia sem alterar o original.
export async function duplicateRange(id: string): Promise<RangeDetail> {
  const original = await getRange(id);
  return createRange({
    name: `${original.name} (copia)`,
    description: original.description,
    hands: original.hands,
    tags: original.tags,
    comboOverrides: original.comboOverrides,
  });
}

// Export/import via JSON (copiar/colar) — a forma mais simples de "o
// treinador compartilha o range da equipe" sem depender de nenhuma
// infra de permissao de time. Cada usuario cola o JSON e vira um range
// proprio, independente do original (nao e' um link ao vivo).
const RANGE_EXPORT_VERSION = 1;

export interface RangeExport {
  pokersync_range_export: number;
  name: string;
  description: string | null;
  tags: string[];
  hands: RangeHands;
  comboOverrides: RangeHands;
}

// --- Compartilhamento com o Modo Time ---
// Publicar so' seta team_id — a propriedade do range continua sendo de
// quem criou (RLS de update ja exige auth.uid() = user_id, entao so' o
// dono publica/despublica o proprio range). A leitura pros demais
// membros do time vem da policy "ranges_select_team_shared" aplicada na
// migration, nao precisa de nenhuma logica extra aqui.
export async function publishRangeToTeam(rangeId: string, teamId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ranges").update({ team_id: teamId }).eq("id", rangeId);
  if (error) throw error;
}

export async function unpublishRange(rangeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ranges").update({ team_id: null }).eq("id", rangeId);
  if (error) throw error;
}

export interface TeamSharedRange extends RangeListItem {
  ownerName: string;
  isMine: boolean;
}

// Lista tudo que foi publicado pro time, de qualquer membro (inclusive
// o proprio usuario) — usa a policy nova de leitura compartilhada.
export async function listTeamSharedRanges(teamId: string): Promise<TeamSharedRange[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("ranges")
    .select("id, name, description, tags, hands, team_id, user_id, created_at, updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const ownerIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, apelido")
    .in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);

  return (data ?? []).map((r) => {
    const profile = (profiles ?? []).find((p) => p.id === r.user_id);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      tags: r.tags ?? [],
      hand_count: countActiveHands((r.hands as RangeHands) ?? {}),
      team_id: r.team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      ownerName: profile?.apelido || profile?.nome || "Jogador",
      isMine: user?.id === r.user_id,
    };
  });
}


export function exportRangeToJSON(range: Pick<RangeDetail, "name" | "description" | "tags" | "hands" | "comboOverrides">): string {
  const payload: RangeExport = {
    pokersync_range_export: RANGE_EXPORT_VERSION,
    name: range.name,
    description: range.description,
    tags: range.tags,
    hands: range.hands,
    comboOverrides: range.comboOverrides,
  };
  return JSON.stringify(payload, null, 2);
}

// Validacao deliberadamente tolerante: confere que cada mao tem os 3
// numeros esperados, mas nao valida se o label e' uma das 169 maos
// canonicas (ou, no caso de comboOverrides, um dos 1326 combos reais) —
// um JSON com uma chave estranha nao deveria travar o import inteiro,
// so aquela entrada.
function parseHandsMap(raw: unknown): RangeHands {
  const result: RangeHands = {};
  if (typeof raw !== "object" || raw === null) return result;
  for (const [label, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    const fold = typeof v.fold === "number" ? v.fold : 0;
    const call = typeof v.call === "number" ? v.call : 0;
    const raise = typeof v.raise === "number" ? v.raise : 0;
    result[label] = {
      fold: Math.max(0, Math.min(100, fold)),
      call: Math.max(0, Math.min(100, call)),
      raise: Math.max(0, Math.min(100, raise)),
    };
  }
  return result;
}

export function parseRangeImport(text: string): { data: RangeInput } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "JSON inválido — confira se colou o conteúdo completo." };
  }
  if (typeof raw !== "object" || raw === null) return { error: "Formato inesperado." };
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== "string" || !obj.name.trim()) return { error: "Faltando o nome do range." };
  if (typeof obj.hands !== "object" || obj.hands === null) return { error: "Faltando o mapa de mãos (hands)." };

  return {
    data: {
      name: obj.name,
      description: typeof obj.description === "string" ? obj.description : null,
      tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : [],
      hands: parseHandsMap(obj.hands),
      comboOverrides: parseHandsMap(obj.comboOverrides),
    },
  };
}
