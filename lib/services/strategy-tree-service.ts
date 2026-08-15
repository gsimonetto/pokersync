import { createClient } from "@/lib/supabase/client";

// Um no de arvore SEMPRE tem um label (o que aparece na sequencia, ex:
// "BTN Open", "Flop Ks8d2c", "C-bet pequena"). rangeId e' opcional — so
// os nos de decisao preflop (e no futuro, postflop, quando existir range
// pos-flop no produto) linkam num Range real; board/acao/nota ficam
// como texto livre porque o produto ainda nao tem estrutura de dados
// pra "range de c-bet" ou "board texture".
//
// children permite ramificacao de verdade: um no pode ter varios
// filhos, cada um representando um caminho diferente (ex: "BTN Open"
// tem dois filhos, "BB Defende" e "BB Folda" — cada um com sua propria
// continuacao). O proprio label do filho e' a condicao da ramificacao,
// sem precisar de um campo separado. No sem filhos = fim de uma linha.
export interface TreeNode {
  id: string;
  label: string;
  rangeId?: string | null;
  note?: string;
  children: TreeNode[];
}

export interface TreeListItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface TreeDetail extends TreeListItem {
  user_id: string;
  nodes: TreeNode[];
}

export interface TreeInput {
  name: string;
  description?: string | null;
  nodes: TreeNode[];
  tags?: string[];
}

// Conta todos os nos da arvore inteira (nao so a raiz) — soma recursiva
// contando cada no + a contagem de cada um dos filhos.
export function countNodes(nodes: TreeNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += 1;
    total += countNodes(n.children ?? []);
  }
  return total;
}

// Normaliza um no vindo do banco/import garantindo children sempre como
// array (json antigo sem o campo, ou vindo de import externo, nao deve
// quebrar a recursao por causa de um `undefined`).
function normalizeNodes(raw: unknown): TreeNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => {
    const r = n as Record<string, unknown>;
    return {
      id: typeof r.id === "string" ? r.id : Math.random().toString(36).slice(2, 10),
      label: typeof r.label === "string" ? r.label : "",
      rangeId: typeof r.rangeId === "string" ? r.rangeId : null,
      note: typeof r.note === "string" ? r.note : undefined,
      children: normalizeNodes(r.children),
    };
  });
}

export async function listTrees(): Promise<TreeListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategy_trees")
    .select("id, name, description, tags, nodes, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tags: t.tags ?? [],
    node_count: countNodes(normalizeNodes(t.nodes)),
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));
}

export async function getTree(id: string): Promise<TreeDetail> {
  const supabase = createClient();
  const { data, error } = await supabase.from("strategy_trees").select("*").eq("id", id).single();

  if (error) throw error;
  if (!data) throw new Error("TREE_NOT_FOUND");

  const nodes = normalizeNodes(data.nodes);
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    tags: data.tags ?? [],
    nodes,
    node_count: countNodes(nodes),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createTree(input: TreeInput): Promise<TreeDetail> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data, error } = await supabase
    .from("strategy_trees")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      nodes: input.nodes,
      tags: input.tags ?? [],
    })
    .select("*")
    .single();

  if (error) throw error;

  const nodes = normalizeNodes(data.nodes);
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    tags: data.tags ?? [],
    nodes,
    node_count: countNodes(nodes),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateTree(id: string, input: Partial<TreeInput>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("strategy_trees").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteTree(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("strategy_trees").delete().eq("id", id);
  if (error) throw error;
}

// --- Helpers de edicao recursiva ---
// A arvore agora e' aninhada (children), entao adicionar/remover/mover
// um no exige achar ele em qualquer profundidade, nao so no topo. Todas
// essas funcoes sao imutaveis (retornam uma arvore nova) pra encaixar
// direto no setState do editor.

export function addChildNode(nodes: TreeNode[], parentId: string, newNode: TreeNode): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addChildNode(n.children, parentId, newNode) };
  });
}

export function updateNodeById(nodes: TreeNode[], id: string, patch: Partial<TreeNode>): TreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    return { ...n, children: updateNodeById(n.children, id, patch) };
  });
}

// Remove o no (e toda a subarvore dele, ja que os filhos vao junto ao
// tirar o pai do array).
export function removeNodeById(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: removeNodeById(n.children, id) }));
}

// Troca de posicao com o irmao adjacente (na mesma lista de children,
// nao pula pra outro ramo) — precisa achar em que nivel o id esta pra
// saber quem sao os irmaos.
export function moveNodeById(nodes: TreeNode[], id: string, dir: -1 | 1): TreeNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const target = idx + dir;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  }
  return nodes.map((n) => ({ ...n, children: moveNodeById(n.children, id, dir) }));
}

// --- Export/import via JSON ---
// Mesmo padrao do range-service. O rangeId de cada no e' removido no
// import de proposito — o range vinculado provavelmente nao existe na
// conta de quem esta importando (e' de outro usuario), entao manter o
// id la seria um link morto. A UI avisa quantos nos perderam o vinculo.
const TREE_EXPORT_VERSION = 2;

export interface TreeExport {
  pokersync_tree_export: number;
  name: string;
  description: string | null;
  tags: string[];
  nodes: TreeNode[];
}

export function exportTreeToJSON(tree: Pick<TreeDetail, "name" | "description" | "tags" | "nodes">): string {
  const payload: TreeExport = {
    pokersync_tree_export: TREE_EXPORT_VERSION,
    name: tree.name,
    description: tree.description,
    tags: tree.tags,
    nodes: tree.nodes,
  };
  return JSON.stringify(payload, null, 2);
}

function stripRangeLinks(nodes: TreeNode[]): { nodes: TreeNode[]; unlinkedCount: number } {
  let unlinkedCount = 0;
  function walk(list: TreeNode[]): TreeNode[] {
    return list.map((n) => {
      if (n.rangeId) unlinkedCount += 1;
      return { ...n, rangeId: null, children: walk(n.children ?? []) };
    });
  }
  const nodes2 = walk(nodes);
  return { nodes: nodes2, unlinkedCount };
}

export function parseTreeImport(text: string): { data: TreeInput; unlinkedCount: number } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "JSON inválido — confira se colou o conteúdo completo." };
  }
  if (typeof raw !== "object" || raw === null) return { error: "Formato inesperado." };
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== "string" || !obj.name.trim()) return { error: "Faltando o nome da árvore." };
  if (!Array.isArray(obj.nodes)) return { error: "Faltando a lista de passos (nodes)." };

  const normalized = normalizeNodes(obj.nodes);
  const { nodes, unlinkedCount } = stripRangeLinks(normalized);

  return {
    data: {
      name: obj.name,
      description: typeof obj.description === "string" ? obj.description : null,
      tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : [],
      nodes,
    },
    unlinkedCount,
  };
}
