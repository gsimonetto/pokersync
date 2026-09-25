import { createClient } from "@/lib/supabase/client";
import type { ProfileCard } from "@/lib/services/profile-card-type";
import type { Pesos } from "@/lib/ranges/notacao";
import { traduzirPronto, type LinhaPreflop, type RangePronto } from "@/lib/ranges/prontos";
import { tipoDoFlop, type FlopRepresentativo } from "@/lib/ranges/flops";
import { combosPorMao } from "@/lib/ranges/cartas";

// Construtor de Ranges (formato Flopzilla): cada range é um grupo de mãos
// com peso 0-100 (colunas hands/combo_overrides da tabela ranges), com o
// "spot" pra agrupar -- posição, contra quem, stack e ação.

export interface RangeSalvo {
  id: string;
  userId: string;
  nome: string;
  descricao: string | null;
  pesos: Pesos;
  pesosCombo: Pesos;
  posicao: string | null;
  vsPosicao: string | null;
  stack: number | null;
  acao: string | null;
  teamId: string | null;
  atualizadoEm: string;
  /** Quem criou -- só preenchido nos ranges do time. */
  donoNome?: string;
}

export interface RangeEntrada {
  nome: string;
  descricao?: string | null;
  pesos: Pesos;
  pesosCombo?: Pesos;
  posicao?: string | null;
  vsPosicao?: string | null;
  stack?: number | null;
  acao?: string | null;
}

const CAMPOS = "id, user_id, name, description, hands, combo_overrides, posicao, vs_posicao, stack_bb, acao, team_id, updated_at";

// Só números 0-100 entram -- um JSON estranho (ou do formato antigo, com
// fold/call/raise) não derruba a tela, só é ignorado. No combo o 0 vale:
// é o "tirei esse combo" de uma mão que está no range.
function limparPesos(bruto: unknown, manterZero = false): Pesos {
  const out: Pesos = {};
  if (!bruto || typeof bruto !== "object") return out;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof v === "number" && (v > 0 || (manterZero && v === 0))) out[k] = Math.min(100, v);
  }
  return out;
}

interface Linha {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  hands: unknown;
  combo_overrides: unknown;
  posicao: string | null;
  vs_posicao: string | null;
  stack_bb: number | null;
  acao: string | null;
  team_id: string | null;
  updated_at: string;
}

function daLinha(r: Linha): RangeSalvo {
  return {
    id: r.id,
    userId: r.user_id,
    nome: r.name,
    descricao: r.description,
    pesos: limparPesos(r.hands),
    pesosCombo: limparPesos(r.combo_overrides, true),
    posicao: r.posicao,
    vsPosicao: r.vs_posicao,
    stack: r.stack_bb,
    acao: r.acao,
    teamId: r.team_id,
    atualizadoEm: r.updated_at,
  };
}

function paraLinha(e: Partial<RangeEntrada>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (e.nome !== undefined) out.name = e.nome.trim() || "Range sem nome";
  if (e.descricao !== undefined) out.description = e.descricao;
  if (e.pesos !== undefined) out.hands = e.pesos;
  if (e.pesosCombo !== undefined) out.combo_overrides = e.pesosCombo;
  if (e.posicao !== undefined) out.posicao = e.posicao;
  if (e.vsPosicao !== undefined) out.vs_posicao = e.vsPosicao;
  if (e.stack !== undefined) out.stack_bb = e.stack;
  if (e.acao !== undefined) out.acao = e.acao;
  return out;
}

async function meuId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("NO_SESSION");
  return session.user.id;
}

export async function listarMeusRanges(): Promise<RangeSalvo[]> {
  const supabase = createClient();
  const id = await meuId();
  const { data, error } = await supabase.from("ranges").select(CAMPOS).eq("user_id", id).order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Linha[]).map(daLinha);
}

export async function abrirRange(id: string): Promise<RangeSalvo> {
  const supabase = createClient();
  const { data, error } = await supabase.from("ranges").select(CAMPOS).eq("id", id).single();
  if (error) throw error;
  return daLinha(data as Linha);
}

export async function criarRange(e: RangeEntrada): Promise<RangeSalvo> {
  const supabase = createClient();
  const id = await meuId();
  const { data, error } = await supabase
    .from("ranges")
    .insert({ user_id: id, ...paraLinha({ pesosCombo: {}, ...e }) })
    .select(CAMPOS)
    .single();
  if (error) throw error;
  return daLinha(data as Linha);
}

export async function atualizarRange(id: string, e: Partial<RangeEntrada>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("ranges")
    .update({ ...paraLinha(e), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function apagarRange(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ranges").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicarRange(r: RangeSalvo): Promise<RangeSalvo> {
  return criarRange({
    nome: `${r.nome} (cópia)`,
    descricao: r.descricao,
    pesos: r.pesos,
    pesosCombo: r.pesosCombo,
    posicao: r.posicao,
    vsPosicao: r.vsPosicao,
    stack: r.stack,
    acao: r.acao,
  });
}

// Compartilhar com o time só marca o team_id: o range continua sendo de
// quem criou, e a leitura pros outros membros vem da policy
// ranges_select_team_shared (o banco também confere que a pessoa é
// membro ativo desse time antes de aceitar).
export async function compartilharComTime(id: string, teamId: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ranges").update({ team_id: teamId }).eq("id", id);
  if (error) throw error;
}

export async function listarRangesDoTime(teamId: string): Promise<RangeSalvo[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("ranges").select(CAMPOS).eq("team_id", teamId).order("updated_at", { ascending: false });
  if (error) throw error;
  const linhas = (data ?? []) as Linha[];
  const donos = [...new Set(linhas.map((r) => r.user_id))];
  // public_profile_cards (RPC) em vez de .from("profiles"): a tabela só
  // deixa cada um ler a própria linha; a função devolve só nome/avatar.
  const { data: perfis } = (await supabase.rpc("public_profile_cards", {
    p_ids: donos.length ? donos : ["00000000-0000-0000-0000-000000000000"],
  })) as { data: ProfileCard[] | null };
  return linhas.map((r) => {
    const p = (perfis ?? []).find((x) => x.id === r.user_id);
    return { ...daLinha(r), donoNome: p?.apelido || p?.nome || "Membro do time" };
  });
}

let cacheProntos: Promise<RangePronto[]> | null = null;
/** Ranges prontos do PokerSync (GTO), os mesmos spots do Modo Treino. */
export function listarProntos(): Promise<RangePronto[]> {
  if (!cacheProntos) {
    cacheProntos = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("preflop_ranges")
        .select("spot_id, stack_bb, action_label, range_string, structure")
        .order("stack_bb", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as LinhaPreflop[]).map(traduzirPronto);
    })();
    cacheProntos.catch(() => {
      cacheProntos = null;
    });
  }
  return cacheProntos;
}

let cacheFlops: Promise<FlopRepresentativo[]> | null = null;
/** Os 184 flops que representam os 1.755 flops possíveis. */
export function listarFlops(): Promise<FlopRepresentativo[]> {
  if (!cacheFlops) {
    cacheFlops = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("flop_subsets").select("flop, weight");
      if (error) throw error;
      return (data ?? []).map((f: { flop: string; weight: number }) => ({ flop: f.flop, peso: Number(f.weight), ...tipoDoFlop(f.flop) }));
    })();
    cacheFlops.catch(() => {
      cacheFlops = null;
    });
  }
  return cacheFlops;
}

export type AcaoReal = "abrir" | "pagar" | "3bet";
export interface RangeReal {
  posicao: string;
  acao: AcaoReal;
  /** Peso de cada mão = quantas vezes fez / quantas vezes teve a chance. */
  pesos: Pesos;
  oportunidades: number;
  vezes: number;
}

/** "Seu range de verdade", por posição, montado com as mãos importadas. */
export async function rangeReal(acao: AcaoReal): Promise<RangeReal[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("range_real", { p_acao: acao });
  if (error) throw error;
  const porPosicao = new Map<string, RangeReal>();
  for (const l of (data ?? []) as { posicao: string; mao: string; vezes: number; oportunidades: number }[]) {
    const r = porPosicao.get(l.posicao) ?? { posicao: l.posicao, acao, pesos: {}, oportunidades: 0, vezes: 0 };
    r.oportunidades += l.oportunidades;
    r.vezes += l.vezes;
    if (l.vezes > 0) r.pesos[l.mao] = Math.round((l.vezes / l.oportunidades) * 100);
    porPosicao.set(l.posicao, r);
  }
  return [...porPosicao.values()];
}

/** Resposta do treino rápido do range (mesma tabela do treino de range antigo). */
export async function registrarRespostaTreino(e: { rangeId: string | null; rangeNome: string; mao: string; acertou: boolean; veredito: string }): Promise<void> {
  const supabase = createClient();
  const id = await meuId();
  const { error } = await supabase.from("range_drill_answers").insert({
    user_id: id,
    range_id: e.rangeId,
    range_name: e.rangeNome,
    hand_label: e.mao,
    combos: combosPorMao(e.mao),
    verdict: e.veredito,
    hit: e.acertou,
  });
  if (error) throw error;
}
