// Serviço consumido pela rota app/api/agent/sync-tournaments — recebe o
// texto bruto de Tournament Summary que o agente desktop leu do disco
// (ver crates/scanner em pokersync-agent, FileKind::TournamentSummary),
// extrai buy-in/colocação/premiação (lib/poker/tournament-summary-parser.ts,
// best-effort — ver aviso lá) e grava em `tournament_payouts` com
// `source: "agent"`. É a automação que faltava pro card "Estrutura de
// premiação" (StatisticsTab, Player Evolution): antes só dava pra
// preencher manualmente.
//
// Sem hand_sync_batches próprio: essa tabela foi desenhada pra sync de
// mãos (colunas total_hands/imported/etc não fazem sentido pra "arquivo
// de resumo") — em vez de forçar torneio nesse molde, ou criar uma
// migração só pra isso agora, o resultado do batch fica só na resposta
// HTTP (mesmo formato que o agente já espera, ver crates/sync-client).
// O que factualmente muda no banco é só tournament_payouts (e
// hand_sync_devices.last_sync_at, reaproveitando upsertDevice).
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { parseTournamentSummary } from "@/lib/poker/tournament-summary-parser";
import { upsertDevice, type AgentDeviceInfo } from "@/lib/services/agent-sync-service";

export interface AgentTournamentSyncFile {
  rawText: string;
  capturedAt?: string | null;
}

export interface AgentTournamentSyncInput {
  device: AgentDeviceInfo;
  pokerRoom: string;
  files: AgentTournamentSyncFile[];
}

export interface AgentTournamentSyncResult {
  batchId: string;
  totalFiles: number;
  imported: number;
  duplicates: number;
  errors: number;
}

export async function processAgentTournamentSync(
  supabase: SupabaseClient,
  userId: string,
  input: AgentTournamentSyncInput
): Promise<AgentTournamentSyncResult> {
  await upsertDevice(supabase, userId, input.device);

  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  const seenThisBatch = new Set<string>();

  for (const file of input.files) {
    const parsed = parseTournamentSummary(file.rawText);
    if (!parsed.tournamentIdPs) {
      // Não achou nem o número do torneio no texto — arquivo não
      // reconhecido (sala sem suporte ainda, ou formato inesperado).
      errors += 1;
      continue;
    }
    if (seenThisBatch.has(parsed.tournamentIdPs)) {
      duplicates += 1;
      continue;
    }
    seenThisBatch.add(parsed.tournamentIdPs);

    if (parsed.heroFinishPlace == null && parsed.heroPayoutAmount == null) {
      // Achou o torneio mas não a colocação nem o valor ganho — sem os
      // dois não há nada de novo pra registrar (evita sobrescrever um
      // registro manual já preenchido com tudo em branco).
      errors += 1;
      continue;
    }

    // `places` (estrutura completa de premiação, usada pelo cEV/ICM) não
    // vem do resumo — o parser hoje só extrai a colocação/premiação do
    // próprio herói. Preserva o que já estiver salvo (manual ou de um
    // sync anterior) em vez de sobrescrever com vazio a cada sync
    // automático.
    const { data: existing } = await supabase
      .from("tournament_payouts")
      .select("places")
      .eq("user_id", userId)
      .eq("tournament_id_ps", parsed.tournamentIdPs)
      .maybeSingle();

    const { error } = await supabase.from("tournament_payouts").upsert(
      {
        user_id: userId,
        tournament_id_ps: parsed.tournamentIdPs,
        source: "agent",
        poker_room: input.pokerRoom,
        total_entrants: parsed.totalEntrants,
        prize_pool: parsed.prizePool,
        places: existing?.places ?? [],
        hero_finish_place: parsed.heroFinishPlace,
        hero_payout_amount: parsed.heroPayoutAmount,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tournament_id_ps" }
    );
    if (error) {
      errors += 1;
      continue;
    }
    imported += 1;
  }

  return {
    batchId: randomUUID(),
    totalFiles: input.files.length,
    imported,
    duplicates,
    errors,
  };
}
