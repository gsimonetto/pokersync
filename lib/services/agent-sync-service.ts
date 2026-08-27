// Serviço consumido pela rota app/api/agent/sync — recebe o texto bruto que
// o agente desktop leu do disco do usuário (um ou mais hand histories por
// arquivo), reaproveita o parser existente (lib/poker/hand-parser.ts, o
// mesmo do fluxo de colar mão manual) e grava hand_reviews com source:
// "agent". Nenhuma lógica de parsing é duplicada aqui — só o encanamento de
// sync (device, batch, dedupe, contagem).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { splitHands, parseHand, type ParsedHand } from "@/lib/poker/hand-parser";

export interface AgentDeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  agentVersion: string;
}

export interface AgentSyncFile {
  rawText: string;
  capturedAt?: string | null;
}

export interface AgentSyncInput {
  device: AgentDeviceInfo;
  pokerRoom: string;
  files: AgentSyncFile[];
}

export interface AgentSyncResult {
  batchId: string;
  totalHands: number;
  imported: number;
  duplicates: number;
  errors: number;
}

// Fallback quando o parser não acha um handId no texto (ex.: formato de sala
// ainda não suportado). Hash do bloco garante dedupe estável entre syncs.
function fallbackHandId(block: string): string {
  return `hash:${createHash("sha256").update(block).digest("hex").slice(0, 32)}`;
}

function buildTitle(parsed: ParsedHand | null, pokerRoom: string): string {
  if (!parsed) return `Mão importada (${pokerRoom})`;
  return (
    [parsed.format, parsed.stakes, parsed.heroPosition].filter(Boolean).join(" · ") ||
    `Mão importada (${pokerRoom})`
  );
}

async function upsertDevice(
  supabase: SupabaseClient,
  userId: string,
  device: AgentDeviceInfo
): Promise<void> {
  const { data: existing, error: eSel } = await supabase
    .from("hand_sync_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", device.deviceId)
    .maybeSingle();
  if (eSel) throw eSel;

  if (existing) {
    const { error } = await supabase
      .from("hand_sync_devices")
      .update({
        device_name: device.deviceName,
        platform: device.platform,
        agent_version: device.agentVersion,
        last_sync_at: new Date().toISOString(),
        active: true,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("hand_sync_devices").insert({
    user_id: userId,
    device_id: device.deviceId,
    device_name: device.deviceName,
    platform: device.platform,
    agent_version: device.agentVersion,
    last_sync_at: new Date().toISOString(),
    active: true,
  });
  if (error) throw error;
}

export async function processAgentSync(
  supabase: SupabaseClient,
  userId: string,
  input: AgentSyncInput
): Promise<AgentSyncResult> {
  await upsertDevice(supabase, userId, input.device);

  const { data: batch, error: eBatch } = await supabase
    .from("hand_sync_batches")
    .insert({
      user_id: userId,
      device_id: input.device.deviceId,
      source: "agent",
      poker_room: input.pokerRoom,
      status: "processing",
    })
    .select("id")
    .single();
  if (eBatch) throw eBatch;
  const batchId: string = batch.id;

  // Cada arquivo pode conter várias mãos concatenadas (histórico do dia
  // inteiro) — splitHands já sabe separar; quando não reconhece nenhum
  // marcador de início, trata o arquivo inteiro como uma mão só.
  type Block = { rawText: string; capturedAt: string | null };
  const blocks: Block[] = [];
  for (const file of input.files) {
    const parts = splitHands(file.rawText);
    const capturedAt = file.capturedAt ?? null;
    if (parts.length === 0) {
      if (file.rawText.trim()) blocks.push({ rawText: file.rawText, capturedAt });
    } else {
      for (const part of parts) blocks.push({ rawText: part, capturedAt });
    }
  }

  const totalHands = blocks.length;
  let errors = 0;

  type Candidate = {
    externalHandId: string;
    capturedAt: string | null;
    parsed: ParsedHand | null;
    rawText: string;
  };
  const candidates: Candidate[] = [];

  for (const block of blocks) {
    let parsed: ParsedHand | null = null;
    try {
      parsed = parseHand(block.rawText);
    } catch {
      errors += 1;
      continue;
    }
    const externalHandId = parsed.handId ?? fallbackHandId(block.rawText);
    candidates.push({ externalHandId, capturedAt: block.capturedAt, parsed, rawText: block.rawText });
  }

  let imported = 0;
  let duplicates = 0;

  if (candidates.length > 0) {
    const ids = Array.from(new Set(candidates.map((c) => c.externalHandId)));
    const { data: existingRows, error: eExisting } = await supabase
      .from("hand_reviews")
      .select("external_hand_id")
      .eq("user_id", userId)
      .eq("poker_room", input.pokerRoom)
      .in("external_hand_id", ids);
    if (eExisting) throw eExisting;
    const existingIds = new Set((existingRows ?? []).map((r) => r.external_hand_id as string));

    const seenThisBatch = new Set<string>();
    const rowsToInsert = [];
    for (const c of candidates) {
      if (existingIds.has(c.externalHandId) || seenThisBatch.has(c.externalHandId)) {
        duplicates += 1;
        continue;
      }
      seenThisBatch.add(c.externalHandId);
      rowsToInsert.push({
        user_id: userId,
        title: buildTitle(c.parsed, input.pokerRoom),
        hand_history: c.rawText,
        parsed_data: c.parsed ? { kind: "parsed", ...c.parsed } : null,
        raw_payload: { rawText: c.rawText },
        status: "pendente",
        source: "agent",
        poker_room: input.pokerRoom,
        external_hand_id: c.externalHandId,
        captured_at: c.capturedAt,
        agent_version: input.device.agentVersion,
        device_id: input.device.deviceId,
        sync_batch_id: batchId,
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: eIns } = await supabase.from("hand_reviews").insert(rowsToInsert);
      if (eIns) throw eIns;
      imported = rowsToInsert.length;
    }
  }

  const { error: eUp } = await supabase
    .from("hand_sync_batches")
    .update({
      total_hands: totalHands,
      imported,
      duplicates,
      errors,
      status: "completed",
      finished_at: new Date().toISOString(),
    })
    .eq("id", batchId);
  if (eUp) throw eUp;

  return { batchId, totalHands, imported, duplicates, errors };
}
