"use client";

import { useState } from "react";
import { Loader2, Upload, Check, ClipboardPaste } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createImportBatch, importSelectedHands, deleteImportBatch, type ImportBatch } from "@/lib/services/hand-review-service";
import {
  extractTournamentInfo,
  findExistingTournamentSession,
  createTournamentSession,
  findExistingCashSession,
  createCashSession,
  attachReviewsToSession,
  updateSessionBounty,
  linkOrCreateBankrollSessionForTournament,
  type HandSession,
} from "@/lib/services/hand-session-service";

// Lembra a última escolha do jogador (marcado/desmarcado) entre uma
// importação e outra -- pedido explícito, pra não ter que decidir de
// novo toda vez.
const ALSO_LOG_BANKROLL_KEY = "pokersync:import:alsoLogToBankroll";

// Versão compacta do import de hand history (mesmo motor de
// components/revisor/revisor-nova-mao.tsx: createImportBatch +
// importSelectedHands, hand_import_batches -> hand_reviews).
//
// FIX (bug reportado: "cEV sempre dá 0 mãos mesmo com mão elegível") --
// até aqui, esse painel salvava as mãos SEM vincular a nenhuma sessão de
// torneio (hand_session_id ficava null pra sempre) -- o cálculo de cEV
// em app/api/hand-ev/compute/route.ts exige esse vínculo pra achar a
// premiação. Agora, ao confirmar, o torneio/cash é detectado e
// anexado/criado automaticamente (mesma lógica de
// revisor-nova-mao.tsx::confirmImport, MAS sem o modal de
// "anexar ou criar novo" -- esse painel é o "rápido", então resolve
// sozinho com os valores lidos do próprio hand history; quem quiser
// controlar tipo/bounty manualmente continua tendo o fluxo completo no
// Revisor).
export function ManualImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState("");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [alsoLogToBankroll, setAlsoLogToBankroll] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(ALSO_LOG_BANKROLL_KEY);
    return saved === null ? true : saved === "true";
  });

  function toggleAlsoLogToBankroll() {
    setAlsoLogToBankroll((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(ALSO_LOG_BANKROLL_KEY, String(next));
      } catch {
        // preferencia nao salva -- sem impacto, so nao lembra da proxima vez
      }
      return next;
    });
  }

  async function handleParse() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sessão expirada — faça login novamente.");
      const b = await createImportBatch(data.user.id, text);
      if (b.parsed_hands.length === 0) {
        setError("Não consegui identificar nenhuma mão nesse texto. Confirme se é hand history do PokerStars ou GGPoker.");
        setBatch(null);
      } else {
        setBatch(b);
        setSelected(b.parsed_hands.map((_, i) => i));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!batch || selected.length === 0 || busy) return;
    setBusy(true);
    setError("");
    setWarning("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sessão expirada — faça login novamente.");
      const userId = data.user.id;
      const ids = await importSelectedHands(batch.id, userId, selected);

      // Torneio/buy-in vem da PRIMEIRA mão selecionada (constante durante
      // o torneio inteiro); bounty do herói vem da ÚLTIMA (cresce mão a
      // mão) -- mesmo critério de revisor-nova-mao.tsx.
      const sortedSelected = [...selected].sort((a, b) => a - b);
      const selectedParsedHands = sortedSelected.map((i) => batch.parsed_hands[i]);
      const firstHand = selectedParsedHands[0];
      const lastHand = selectedParsedHands[selectedParsedHands.length - 1];
      const tournInfo = extractTournamentInfo(firstHand);
      const suggestedBounty = extractTournamentInfo(lastHand).heroBountyFromHand ?? tournInfo.heroBountyFromHand;

      if (tournInfo.tournamentIdPs) {
        const existing = await findExistingTournamentSession(userId, tournInfo.tournamentIdPs);
        let tournamentSession: HandSession;
        if (existing) {
          await attachReviewsToSession(ids, existing.id, selectedParsedHands);
          if (suggestedBounty != null && (existing.bounty_current == null || suggestedBounty > existing.bounty_current)) {
            await updateSessionBounty(existing.id, suggestedBounty).catch(() => {});
          }
          tournamentSession = existing;
        } else {
          const formatType = tournInfo.looksLikeBounty ? "pko" : "regular";
          const created = await createTournamentSession({
            userId,
            label: tournInfo.tournamentName ?? `Torneio #${tournInfo.tournamentIdPs}`,
            tournamentIdPs: tournInfo.tournamentIdPs,
            formatType,
            bountyCurrent: formatType === "pko" ? suggestedBounty : null,
            buyin: tournInfo.buyin,
          });
          await attachReviewsToSession(ids, created.id, selectedParsedHands);
          tournamentSession = created;
        }

        // "Também lançar na Banca" (pedido explícito) -- so' pra torneio
        // (cash nao tem buyin/resultado pra inferir so do hand history).
        // Falha de cotação/rede aqui NAO derruba a importação inteira (a
        // mão já está salva) -- só avisa, o jogador ainda pode lançar essa
        // sessão manualmente na Banca depois.
        if (alsoLogToBankroll) {
          try {
            const result = await linkOrCreateBankrollSessionForTournament({ userId, handSession: tournamentSession });
            if (!result) {
              setWarning(
                "Mão importada, mas não consegui lançar na Banca agora (sem cotação USD→BRL disponível) — lance manualmente por lá quando puder."
              );
            }
          } catch {
            setWarning("Mão importada, mas houve um erro ao lançar na Banca — confira/lance manualmente por lá.");
          }
        }
      } else if (firstHand.stakes) {
        // Cash game (sem "Tournament #"): agrupa por stakes, sem premiação
        // pra cadastrar (cEV/ICM não se aplica a cash -- ver decisão 012).
        const existingCash = await findExistingCashSession(userId, firstHand.stakes);
        const cashSession = existingCash ?? (await createCashSession({ userId, label: `Cash · ${firstHand.stakes}`, stakes: firstHand.stakes }));
        await attachReviewsToSession(ids, cashSession.id);
      }
      // Sem "Tournament #" nem stakes identificados: mão fica salva solta
      // mesmo (igual antes) -- não dá pra inventar um torneio sem dado.

      setText("");
      setBatch(null);
      setSelected([]);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar as mãos importadas.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (batch) await deleteImportBatch(batch.id).catch(() => {});
    setBatch(null);
    setText("");
    setSelected([]);
  }

  function handleFile(fileList: FileList) {
    const file = fileList[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="mb-2.5 text-xs leading-relaxed text-muted">
        Cole o hand history do PokerStars ou GGPoker — todas as métricas desta tela (VPIP, C-Bet, steal, matriz de mãos...)
        vêm daqui. Sem hand history a análise fica limitada ao que o agente desktop sincronizar automaticamente.
      </p>

      {!batch ? (
        <>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files); }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="PokerStars Hand #123456789: Tournament #..."
              rows={5}
              className="w-full resize-y rounded-lg border border-hairline bg-void p-3 font-mono text-xs text-ink outline-none focus:border-ink/40"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-ink">
              <ClipboardPaste size={13} />
              ou arraste/selecione um arquivo .txt
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files)} />
            </label>
            <button
              onClick={handleParse}
              disabled={!text.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importar
            </button>
          </div>
        </>
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted">
            {batch.parsed_hands.length === 1 ? "1 mão identificada:" : `${batch.parsed_hands.length} mãos identificadas:`}
          </p>
          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {batch.parsed_hands.map((h, idx) => {
              const checked = selected.includes(idx);
              return (
                <li
                  key={idx}
                  onClick={() => setSelected((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]))}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                    checked ? "border-ink bg-ink/10" : "border-hairline bg-void"
                  }`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-ink bg-ink" : "border-hairline"}`}>
                    {checked && <Check size={11} className="text-void" />}
                  </span>
                  <span className="flex-1 truncate text-ink">
                    {[h.format, h.stakes, h.heroPosition, h.heroCards?.join(" ")].filter(Boolean).join(" · ") || "Mão sem detalhes identificados"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div
            onClick={toggleAlsoLogToBankroll}
            className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-void p-2.5 text-xs text-muted hover:text-ink"
          >
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${alsoLogToBankroll ? "border-ink bg-ink" : "border-hairline"}`}>
              {alsoLogToBankroll && <Check size={11} className="text-void" />}
            </span>
            <span className="flex-1">
              Também lançar essa sessão na Gestão de Banca (torneio identificado — buy-in/resultado convertidos automaticamente)
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button onClick={handleDiscard} className="text-xs text-muted hover:text-ink">
              Descartar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.length === 0 || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Importar {selected.length} selecionada{selected.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{error}</p>}
      {warning && !error && (
        <p className="mt-2.5 rounded-lg border border-hairline bg-elevated p-2.5 text-[13px] text-muted">{warning}</p>
      )}
    </div>
  );
}
