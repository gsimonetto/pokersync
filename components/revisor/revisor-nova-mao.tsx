"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Tag as TagIcon, ImagePlus, X, Save, Play, Plus, Loader2,
  ClipboardPaste, Upload, ChevronDown, Link2, Check, Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchTags,
  createUserTag,
  createReview,
  validateImage,
  registerReviewEvent,
  createImportBatch,
  importSelectedHands,
  deleteImportBatch,
  fetchRecentBankrollSessions,
  type Tag,
  type ImportBatch,
  type BankrollSessionOption,
} from "@/lib/services/hand-review-service";
import {
  extractTournamentInfo,
  findExistingTournamentSession,
  createTournamentSession,
  findExistingCashSession,
  createCashSession,
  attachReviewsToSession,
  type FormatType,
  type HandSession,
} from "@/lib/services/hand-session-service";

const MAX_IMAGES = 3;

interface ImageDraft {
  file: File;
  previewUrl: string;
}

// Estado do fluxo de resolucao de sessao, disparado apos confirmImport.
// "checking": consultando se ja existe torneio/cash com esse id/stakes.
// "attach_or_new": torneio ja existe pro usuario — pergunta anexar ou criar novo.
// "new_tournament_form": torneio novo — pede tipo (Regular/PKO/Mystery) + bounty.
// "done": sessao resolvida, import finalizado.
type SessionFlowStep =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "attach_or_new"; existing: HandSession; tournamentIdPs: string; label: string; buyin: number | null }
  | { kind: "new_tournament_form"; tournamentIdPs: string | null; label: string; buyin: number | null };

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "pko", label: "PKO" },
  { value: "mystery", label: "Mystery Bounty" },
];

export function RevisorNovaMao({
  onSaved,
  onSavedAndReview,
}: {
  onSaved: () => void;
  onSavedAndReview: (id: string) => void;
  onCancel?: () => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);

  // ---- Import (bloco primario) ----
  const [importText, setImportText] = useState("");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [selectedHands, setSelectedHands] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedOk, setImportedOk] = useState<number | null>(null);

  // ---- Resolucao de sessao (novo) ----
  const [sessionFlow, setSessionFlow] = useState<SessionFlowStep>({ kind: "idle" });
  const [pendingReviewIds, setPendingReviewIds] = useState<string[] | null>(null);
  const [formatChoice, setFormatChoice] = useState<FormatType>("regular");
  const [bountyInput, setBountyInput] = useState("");
  const [sessionError, setSessionError] = useState("");

  // ---- Manual / print (bloco secundario, recolhido) ----
  const [manualOpen, setManualOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [freeText, setFreeText] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // ---- Vinculo com sessao de banca (opcional, recolhido) ----
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessions, setSessions] = useState<BankrollSessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
      try {
        const t = await fetchTags();
        setTags(t);
      } catch {
        setError("Erro ao carregar etiquetas.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionOpen || sessions.length > 0) return;
    fetchRecentBankrollSessions(5)
      .then(setSessions)
      .catch(() => {});
  }, [sessionOpen, sessions.length]);

  // Cola screenshot direto (Ctrl+V) sem precisar salvar o arquivo antes —
  // principal causa de fricção/erro silencioso no fluxo antigo de print.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!manualOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFiles([file]);
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualOpen, images.length]);

  const canSaveManual = useMemo(() => {
    return Boolean(freeText.trim() || images.length > 0 || selectedTagIds.length > 0);
  }, [freeText, images, selectedTagIds]);

  // ---- Import ----
  async function handleImport() {
    if (!userId || !importText.trim() || importing) return;
    setImporting(true);
    setError("");
    setImportedOk(null);
    try {
      const b = await createImportBatch(userId, importText);
      if (b.parsed_hands.length === 0) {
        setError("Não consegui identificar nenhuma mão nesse texto. Confirme se é hand history do PokerStars ou GGPoker.");
        setBatch(null);
      } else {
        setBatch(b);
        setSelectedHands(b.parsed_hands.map((_, i) => i));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setImporting(false);
    }
  }

  function toggleHandSelection(idx: number) {
    setSelectedHands((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]));
  }

  // Passo 1 do import: salva as maos (sem sessao ainda) e decide o proximo
  // passo do fluxo de sessao a partir da PRIMEIRA mao selecionada — assume-se
  // que um HH colado de uma vez pertence a um unico torneio/mesa de cash
  // (premissa razoavel; multi-torneio no mesmo paste e' caso raro nao coberto).
  async function confirmImport() {
    if (!userId || !batch || selectedHands.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const ids = await importSelectedHands(batch.id, userId, selectedHands);
      setPendingReviewIds(ids);

      const firstHand = batch.parsed_hands[selectedHands[0]];
      const tournInfo = extractTournamentInfo(firstHand);

      if (tournInfo.tournamentIdPs) {
        setSessionFlow({ kind: "checking" });
        const existing = await findExistingTournamentSession(userId, tournInfo.tournamentIdPs);
        if (existing) {
          setSessionFlow({
            kind: "attach_or_new",
            existing,
            tournamentIdPs: tournInfo.tournamentIdPs,
            label: tournInfo.tournamentName ?? `Torneio #${tournInfo.tournamentIdPs}`,
            buyin: tournInfo.buyin,
          });
        } else {
          setSessionFlow({
            kind: "new_tournament_form",
            tournamentIdPs: tournInfo.tournamentIdPs,
            label: tournInfo.tournamentName ?? `Torneio #${tournInfo.tournamentIdPs}`,
            buyin: tournInfo.buyin,
          });
        }
        return; // espera resolucao do modal antes de finalizar
      }

      // Cash game (sem Tournament #): agrupa por stakes automaticamente,
      // sem modal — cash nao tem tipo/bounty pra escolher.
      if (firstHand.stakes) {
        const existingCash = await findExistingCashSession(userId, firstHand.stakes);
        const cashSession = existingCash ?? (await createCashSession({
          userId,
          label: `Cash · ${firstHand.stakes}`,
          stakes: firstHand.stakes,
        }));
        await attachReviewsToSession(ids, cashSession.id);
      }

      finishImport(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar as mãos importadas.");
      setImporting(false);
    }
  }

  function finishImport(ids: string[]) {
    setImporting(false);
    setSessionFlow({ kind: "idle" });
    setPendingReviewIds(null);
    if (ids.length === 1) {
      onSavedAndReview(ids[0]);
      return;
    }
    setImportedOk(ids.length);
    setBatch(null);
    setImportText("");
  }

  async function handleAttachToExisting() {
    if (sessionFlow.kind !== "attach_or_new" || !pendingReviewIds) return;
    try {
      await attachReviewsToSession(pendingReviewIds, sessionFlow.existing.id);
      finishImport(pendingReviewIds);
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : "Erro ao anexar ao torneio.");
    }
  }

  function handleStartNewFromExisting() {
    if (sessionFlow.kind !== "attach_or_new") return;
    setSessionFlow({
      kind: "new_tournament_form",
      tournamentIdPs: sessionFlow.tournamentIdPs,
      label: sessionFlow.label,
      buyin: sessionFlow.buyin,
    });
  }

  async function handleCreateTournamentSession() {
    if (sessionFlow.kind !== "new_tournament_form" || !userId || !pendingReviewIds) return;
    setSessionError("");
    const bounty = bountyInput.trim() ? Number(bountyInput.replace(",", ".")) : null;
    if (bountyInput.trim() && !Number.isFinite(bounty)) {
      setSessionError("Bounty inválido.");
      return;
    }
    try {
      const created = await createTournamentSession({
        userId,
        label: sessionFlow.label,
        tournamentIdPs: sessionFlow.tournamentIdPs,
        formatType: formatChoice,
        bountyCurrent: formatChoice === "regular" ? null : bounty,
        buyin: sessionFlow.buyin,
      });
      await attachReviewsToSession(pendingReviewIds, created.id);
      setFormatChoice("regular");
      setBountyInput("");
      finishImport(pendingReviewIds);
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : "Erro ao criar o torneio.");
    }
  }

  async function discardImport() {
    if (batch) await deleteImportBatch(batch.id).catch(() => {});
    setBatch(null);
    setImportText("");
    setSelectedHands([]);
  }

  function handleFileUpload(fileList: FileList) {
    const file = fileList[0];
    if (!file) return;
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Envie um arquivo .txt de hand history.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
  }

  // ---- Manual / print ----
  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAddNewTag() {
    const clean = newTagLabel.trim();
    if (!clean || !userId) return;
    try {
      const created = await createUserTag(userId, clean);
      setTags((prev) => [...prev, created]);
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar etiqueta.");
    }
  }

  function handleFiles(files: File[]) {
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setError(`Máximo de ${MAX_IMAGES} imagens.`);
      return;
    }
    const next: ImageDraft[] = [];
    for (const file of files.slice(0, room)) {
      const err = validateImage(file);
      if (err) {
        setError(err);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...next]);
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      const clone = [...prev];
      URL.revokeObjectURL(clone[idx].previewUrl);
      clone.splice(idx, 1);
      return clone;
    });
  }

  async function saveManual(goToReview: boolean) {
    if (!userId || !canSaveManual || saving) return;
    setSaving(true);
    setError("");
    try {
      const review = await createReview(userId, {
        title,
        freeText,
        tagIds: selectedTagIds,
        images: images.map((i) => i.file),
        source: images.length > 0 && !freeText.trim() ? "print" : "manual",
        sessionId: selectedSessionId,
      });

      await registerReviewEvent("registered", review.id);

      if (goToReview) {
        onSavedAndReview(review.id);
      } else {
        onSaved();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a mão.");
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="mb-4 mt-0 text-lg font-semibold text-ink">Nova Mão</h2>

      {/* ================= MODAL: RESOLUCAO DE SESSAO ================= */}
      {sessionFlow.kind === "attach_or_new" && (
        <div className="mb-3.5 rounded-xl border border-review/40 bg-surface p-4">
          <div className="mb-1 flex items-center gap-2">
            <Trophy size={16} className="text-review" />
            <label className="text-sm font-semibold text-ink">Torneio já existe</label>
          </div>
          <p className="mb-3 text-xs text-muted">
            Encontrei <b className="text-ink">{sessionFlow.existing.label}</b> na sua lista. Anexar essa mão a ele ou criar um torneio novo?
          </p>
          {sessionError && <p className="mb-2 text-xs text-negative">{sessionError}</p>}
          <div className="flex gap-2.5">
            <button
              onClick={handleAttachToExisting}
              className="flex-1 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void"
            >
              Anexar a {sessionFlow.existing.label}
            </button>
            <button
              onClick={handleStartNewFromExisting}
              className="flex-1 rounded-lg border border-hairline px-3.5 py-2 text-[13px] text-ink"
            >
              Criar novo
            </button>
          </div>
        </div>
      )}

      {sessionFlow.kind === "new_tournament_form" && (
        <div className="mb-3.5 rounded-xl border border-review/40 bg-surface p-4">
          <div className="mb-1 flex items-center gap-2">
            <Trophy size={16} className="text-review" />
            <label className="text-sm font-semibold text-ink">{sessionFlow.label}</label>
          </div>
          <p className="mb-3 text-xs text-muted">Que tipo de torneio é esse?</p>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormatChoice(f.value)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  formatChoice === f.value ? "border-review bg-review text-void" : "border-hairline bg-void text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(formatChoice === "pko" || formatChoice === "mystery") && (
            <div className="mb-3">
              <label className="mb-1.5 block text-[13px] text-muted">Bounty atual (opcional, dá pra atualizar depois)</label>
              <input
                type="number"
                step="0.01"
                value={bountyInput}
                onChange={(e) => setBountyInput(e.target.value)}
                placeholder="Ex.: 12.50"
                className="w-full rounded-lg border border-hairline bg-void px-3 py-2.5 text-sm text-ink outline-none focus:border-review"
              />
            </div>
          )}

          {sessionError && <p className="mb-2 text-xs text-negative">{sessionError}</p>}

          <button
            onClick={handleCreateTournamentSession}
            className="w-full rounded-lg bg-review px-3.5 py-2.5 text-[13px] font-semibold text-void"
          >
            Criar torneio e salvar mão
          </button>
        </div>
      )}

      {sessionFlow.kind === "checking" && (
        <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-hairline bg-surface p-4 text-xs text-muted">
          <Loader2 size={14} className="animate-spin" />
          Verificando se esse torneio já está na sua lista...
        </div>
      )}

      {/* ================= BLOCO PRIMARIO: IMPORT ================= */}
      {sessionFlow.kind === "idle" && (
        <section className="mb-3.5 rounded-xl border border-review/40 bg-surface p-4">
          <div className="mb-1 flex items-center gap-2">
            <Upload size={16} className="text-review" />
            <label className="text-sm font-semibold text-ink">Importar hand history</label>
          </div>
          <p className="mb-3 text-xs text-muted">
            Cole o texto do PokerStars ou GGPoker — uma mão ou uma sessão inteira. Eu identifico e separo automaticamente, e agrupo por torneio ou cash game.
          </p>

          {!batch ? (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
                }}
              >
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="PokerStars Hand #123456789: Tournament #..."
                  rows={7}
                  className="w-full resize-y rounded-lg border border-hairline bg-void p-3 font-mono text-xs text-ink outline-none focus:border-review"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-ink">
                  <ClipboardPaste size={13} />
                  ou arraste/selecione um arquivo .txt
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </label>
                <button
                  onClick={handleImport}
                  disabled={!importText.trim() || importing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
                >
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Importar
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2 text-xs text-muted">
                {batch.parsed_hands.length === 1
                  ? "1 mão identificada:"
                  : `${batch.parsed_hands.length} mãos identificadas — selecione quais quer revisar:`}
              </p>
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {batch.parsed_hands.map((h, idx) => {
                  const checked = selectedHands.includes(idx);
                  return (
                    <li
                      key={idx}
                      onClick={() => toggleHandSelection(idx)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                        checked ? "border-review bg-review/10" : "border-hairline bg-void"
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                          checked ? "border-review bg-review" : "border-hairline"
                        }`}
                      >
                        {checked && <Check size={11} className="text-void" />}
                      </span>
                      <span className="flex-1 truncate text-ink">
                        {[h.format, h.stakes, h.heroPosition, h.heroCards?.join(" ")].filter(Boolean).join(" · ") ||
                          "Mão sem detalhes identificados"}
                      </span>
                      {h.date && <span className="shrink-0 text-[10px] text-muted">{h.date}</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={discardImport} className="text-xs text-muted hover:text-ink">
                  Descartar
                </button>
                <button
                  onClick={confirmImport}
                  disabled={selectedHands.length === 0 || importing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-review px-3.5 py-2 text-[13px] font-semibold text-void disabled:opacity-50"
                >
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Importar {selectedHands.length} selecionada{selectedHands.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          )}

          {importedOk !== null && (
            <p className="mt-2 text-xs text-positive">
              {importedOk} mão{importedOk === 1 ? "" : "s"} importada{importedOk === 1 ? "" : "s"} para a fila.
            </p>
          )}
        </section>
      )}

      {/* ================= BLOCO SECUNDARIO: MANUAL / PRINT ================= */}
      {sessionFlow.kind === "idle" && (
        <section className="mb-3.5 rounded-xl border border-hairline bg-surface">
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="text-sm text-muted">Não tenho a hand history — adicionar manualmente (print ou texto)</span>
            <ChevronDown size={16} className={`text-muted transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>

          {manualOpen && (
            <div className="border-t border-hairline p-4">
              <label className="mb-2 block text-[13px] text-muted">Título (opcional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: 3B pot vs BTN — river tough"
                className="mb-3.5 w-full rounded-lg border border-hairline bg-void px-3 py-2.5 text-sm text-ink outline-none focus:border-review"
              />

              <label className="mb-2 block text-[13px] text-muted">Descrição livre</label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Descreva o contexto, sizings, reads, dúvidas..."
                rows={4}
                className="mb-3.5 w-full resize-y rounded-lg border border-hairline bg-void p-3 text-sm text-ink outline-none focus:border-review"
              />

              <div className="mb-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] text-muted">
                    Prints ({images.length}/{MAX_IMAGES})
                  </label>
                  <span className="text-[11px] text-muted">Cole com Ctrl+V, arraste ou clique — até 5MB cada</span>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
                  }}
                  className="mt-2 grid grid-cols-3 gap-2.5"
                >
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-[10px] bg-void">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1.5 top-1.5 flex rounded-full border border-hairline bg-black/70 p-1 text-ink"
                        aria-label="Remover"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {images.length < MAX_IMAGES && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-hairline bg-void text-center">
                      <ImagePlus size={20} className="text-review" />
                      <span className="mt-1.5 px-2 text-[11px] text-muted">Colar (Ctrl+V) ou clicar</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="mb-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-[13px] text-muted">
                    <TagIcon size={14} className="mr-1.5" />
                    Etiquetas
                  </label>
                  <span className="text-[11px] text-muted">{selectedTagIds.length} selecionada(s)</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const active = selectedTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
                          active ? "border-review bg-review text-void" : "border-hairline bg-transparent text-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                    placeholder="Criar nova etiqueta"
                    className="flex-1 rounded-lg border border-hairline bg-void px-3 py-2.5 text-sm text-ink outline-none focus:border-review"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewTag}
                    className="flex items-center rounded-lg border border-hairline px-2.5 py-2.5 text-ink"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= VINCULO COM SESSAO DE BANCA (opcional, recolhido) ================= */}
      {sessionFlow.kind === "idle" && (
        <section className="mb-3.5 rounded-xl border border-hairline bg-surface">
          <button
            onClick={() => setSessionOpen((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Link2 size={14} />
              Vincular a uma sessão de banca (opcional)
            </span>
            <ChevronDown size={16} className={`text-muted transition-transform ${sessionOpen ? "rotate-180" : ""}`} />
          </button>
          {sessionOpen && (
            <div className="border-t border-hairline p-4">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted">Nenhuma sessão recente encontrada.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sessions.map((s) => {
                    const active = selectedSessionId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSessionId(active ? null : s.id)}
                        className={`rounded-full border px-2.5 py-1.5 text-xs transition-colors ${
                          active ? "border-review bg-review text-void" : "border-hairline bg-void text-ink"
                        }`}
                      >
                        {[s.format, s.stake, s.date].filter(Boolean).join(" · ")}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="mb-2.5 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">
          {error}
        </div>
      )}

      {sessionFlow.kind === "idle" && manualOpen && (
        <footer className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => saveManual(false)}
            disabled={!canSaveManual || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-hairline px-4 py-3 text-sm text-ink disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar e revisar depois
          </button>
          <button
            type="button"
            onClick={() => saveManual(true)}
            disabled={!canSaveManual || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-review px-4 py-3 text-sm font-semibold text-void disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Salvar e começar revisão
          </button>
        </footer>
      )}
      {sessionFlow.kind === "idle" && manualOpen && !canSaveManual && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Adicione um print, uma descrição ou uma etiqueta para salvar.
        </p>
      )}
    </div>
  );
}
