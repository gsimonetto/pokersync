"use client";

import { useEffect, useState } from "react";
import { parseSession, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { listRanges, getRange, type RangeListItem } from "@/lib/services/range-service";
import { analyzeSessionAdherence, type AdherenceResult, type AdherenceRow } from "@/lib/poker/range-adherence";
import { verdictColor } from "@/lib/poker/gto-verdict";
import {
  logAdherenceRun,
  fetchAdherenceHistory,
  type AdherenceRunPoint,
} from "@/lib/services/range-adherence-history-service";
import { AdherenceHistoryChart } from "@/components/revisor/adherence-history-chart";
import { createReview } from "@/lib/services/hand-review-service";
import { createClient } from "@/lib/supabase/client";
import { Send, Check } from "lucide-react";

const POSITIONS = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

const ACTION_LABEL: Record<string, string> = { fold: "Fold", call: "Call", raise: "Raise" };

export function AderenciaRange() {
  const [ranges, setRanges] = useState<RangeListItem[]>([]);
  const [rangeId, setRangeId] = useState("");
  const [position, setPosition] = useState("BTN");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdherenceResult | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const [history, setHistory] = useState<AdherenceRunPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Maos marcadas aqui viravam beco sem saida -- so' um link generico
  // pro treino, nunca entravam na fila de verdade do Revisor (hand_reviews)
  // nem no sistema de leaks/drills. Guarda as maos parseadas pra poder
  // criar uma revisao de verdade a partir de uma linha marcada.
  const [parsedHands, setParsedHands] = useState<ParsedHand[]>([]);
  const [sentHandIds, setSentHandIds] = useState<Set<string>>(new Set());
  const [sendingHandId, setSendingHandId] = useState<string | null>(null);

  useEffect(() => {
    listRanges()
      .then((rows) => {
        const trainable = rows.filter((r) => r.hand_count > 0);
        setRanges(trainable);
        if (trainable.length > 0) setRangeId(trainable[0].id);
      })
      .catch(() => setError("Erro ao carregar seus ranges."));
  }, []);

  // Sempre que o range ou a posicao muda, recarrega o historico daquela
  // combinacao especifica — misturar "BTN Open" com "CO Open" no mesmo
  // grafico nao faz sentido, cada par range+posicao tem sua propria
  // tendencia.
  useEffect(() => {
    if (!rangeId) return;
    setHistoryLoading(true);
    fetchAdherenceHistory(rangeId, position)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [rangeId, position]);

  async function handleAnalyze() {
    if (!rangeId) {
      setError("Selecione um range antes de analisar.");
      return;
    }
    if (!rawText.trim()) {
      setError("Cole o hand history da sessão antes de analisar.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const hands = parseSession(rawText);
      if (hands.length === 0) {
        setError("Nenhuma mão reconhecida nesse texto.");
        return;
      }
      const range = await getRange(rangeId);
      const analysis = analyzeSessionAdherence(hands, range.hands, position);
      setResult(analysis);
      setParsedHands(hands);
      setSentHandIds(new Set());

      if (analysis.comparable > 0) {
        const accuracyPct = Math.round(((analysis.comparable - analysis.flagged) / analysis.comparable) * 100);
        await logAdherenceRun({
          rangeId,
          rangeName: range.name,
          position,
          totalHands: analysis.totalHands,
          comparable: analysis.comparable,
          flagged: analysis.flagged,
          accuracyPct,
        }).catch(() => {});
        // Atualiza o grafico com o ponto que acabou de entrar, sem
        // esperar um novo fetch — ja sabemos exatamente o que foi gravado.
        setHistory((prev) => [...prev, { date: new Date().toISOString(), accuracyPct, comparable: analysis.comparable }]);
      }
    } catch (e) {
      if (e instanceof HandParseError) {
        setError("Não consegui interpretar esse hand history. Confira se é do PokerStars (EN ou PT-BR).");
      } else {
        setError("Erro inesperado ao analisar a sessão.");
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleRows = result ? (onlyFlagged ? result.rows.filter((r) => r.flagged) : result.rows) : [];

  async function handleSendToReview(row: AdherenceRow) {
    if (!row.handId) return;
    const hand = parsedHands.find((h) => h.handId === row.handId);
    if (!hand) return;
    setSendingHandId(row.handId);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("NO_SESSION");
      const rangeName = ranges.find((r) => r.id === rangeId)?.name;
      const title = [hand.format, hand.stakes, hand.heroPosition, `desvio de ${rangeName}`].filter(Boolean).join(" · ");
      // Veredito objetivo ja' foi calculado aqui (contra o range+posicao
      // que o jogador escolheu explicitamente) -- viaja junto pra revisao
      // em vez de pedir pro Revisor adivinhar contra qual range comparar
      // (nao ha vinculo salvo entre range e posicao, seria chute).
      await createReview(uid, {
        title,
        handHistory: hand.rawText,
        parsedData: {
          kind: "parsed",
          ...hand,
          objectiveVerdict: {
            verdict: row.verdict,
            heroAction: row.heroAction,
            decision: row.decision,
            rangeName: rangeName || null,
            position,
          },
        },
        source: "import",
      });
      setSentHandIds((prev) => new Set(prev).add(row.handId!));
    } catch {
      setError("Não foi possível enviar essa mão pra revisão.");
    } finally {
      setSendingHandId(null);
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <p className="mb-4 text-sm text-muted">
        Compara a ação real do hero em spots de <strong>RFI</strong> (primeiro a poder abrir, sem raise antes)
        contra um range salvo. Facing 3-bet, defesa de blind e squeeze ficam de fora por enquanto — comparariam
        contra o range errado.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Range</label>
          <select
            value={rangeId}
            onChange={(e) => setRangeId(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
          >
            {ranges.length === 0 && <option value="">Nenhum range treinável</option>}
            {ranges.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Posição do hero que esse range representa</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rangeId && (
        <div className="mb-6 rounded-xl border border-hairline bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Histórico de aderência — {ranges.find((r) => r.id === rangeId)?.name} ({position})
          </h3>
          {historyLoading ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : (
            <AdherenceHistoryChart points={history} />
          )}
        </div>
      )}

      <label className="mb-1 block text-xs text-muted">Hand history da sessão (colar texto do PokerStars)</label>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={8}
        placeholder="PokerStars Hand #..."
        className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
      />

      {error && <p className="mt-2 text-sm text-negative">{error}</p>}

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
      >
        {loading ? "Analisando…" : "Analisar sessão"}
      </button>

      {result && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-muted">
            {result.totalHands} mãos importadas · {result.comparable} comparáveis (RFI em {position}) ·{" "}
            <span className="font-medium text-ink">{result.flagged} marcadas para revisão</span>
          </p>

          {result.flagged > 0 && (
            <a
              href={`/treino?tab=ranges&rangeId=${rangeId}`}
              className="mb-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void"
            >
              Treinar esse range
            </a>
          )}

          {result.comparable > 0 && (
            <>
              <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
                Mostrar só as marcadas para revisão
              </label>

              <div className="overflow-hidden rounded-xl border border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-surface text-xs text-muted">
                      <th className="px-3 py-2 text-left">Mão</th>
                      <th className="px-3 py-2 text-left">Ação do hero</th>
                      <th className="px-3 py-2 text-left">Range (F/C/R)</th>
                      <th className="px-3 py-2 text-left">Veredito</th>
                      <th className="px-3 py-2 text-left">Revisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, i) => {
                      const sent = row.handId != null && sentHandIds.has(row.handId);
                      const canSend = row.flagged && row.handId != null && parsedHands.some((h) => h.handId === row.handId);
                      return (
                        <tr key={`${row.handId}-${i}`} className="border-b border-hairline last:border-0">
                          <td className="px-3 py-2 font-medium">{row.label}</td>
                          <td className="px-3 py-2 text-muted">{ACTION_LABEL[row.heroAction]}</td>
                          <td className="px-3 py-2 text-muted">
                            {row.decision.fold}/{row.decision.call}/{row.decision.raise}
                          </td>
                          <td className="px-3 py-2 font-medium" style={{ color: verdictColor(row.verdict) }}>
                            {row.verdict.replace("_", " ")}
                          </td>
                          <td className="px-3 py-2">
                            {canSend && (
                              <button
                                onClick={() => handleSendToReview(row)}
                                disabled={sent || sendingHandId === row.handId}
                                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                                  sent ? "border-positive/40 text-positive" : "border-hairline text-ink hover:border-ink/40"
                                }`}
                              >
                                {sent ? <Check size={11} /> : <Send size={11} />}
                                {sent ? "Na fila" : "Enviar pra revisão"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
