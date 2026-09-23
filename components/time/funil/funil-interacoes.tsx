"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Loader2, MessageSquare, Paperclip, Trophy, X } from "lucide-react";
import { EmojiPickerButton } from "@/components/emoji-picker";
import {
  addCardComment,
  fetchCardComments,
  fetchCardPhaseHistory,
  fetchPlayerAchievements,
  getCardAttachmentUrl,
  traduzErroFunil,
  uploadCardAttachment,
  type CardComment,
  type CardPhaseHistoryEntry,
  type PlayerAchievement,
} from "@/lib/services/team-funnel-service";

// Coluna da direita do cartão aberto: interações (imutáveis, com anexo),
// histórico de fases e conquistas. Veio do antigo tab-kanban.tsx sem
// mudança de comportamento.

// ------------------------------------------------------------
// Aba "Interações" do card: historico de auditoria (comentarios do
// coach, imutaveis, com anexo opcional), historico de fases e a linha
// do tempo de conquistas do jogador -- tudo carregado sozinho, fora do
// estado da aba Detalhes.
// ------------------------------------------------------------
export function AbaInteracoes({
  cardId,
  playerId,
  onErro,
}: {
  cardId: string;
  playerId: string;
  onErro: (s: string) => void;
}) {
  const [comentarios, setComentarios] = useState<CardComment[]>([]);
  const [historicoFases, setHistoricoFases] = useState<CardPhaseHistoryEntry[]>([]);
  const [conquistas, setConquistas] = useState<PlayerAchievement[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  async function recarregarComentarios() {
    try {
      setComentarios(await fetchCardComments(cardId));
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [com, hist, conq] = await Promise.allSettled([
        fetchCardComments(cardId),
        fetchCardPhaseHistory(playerId),
        fetchPlayerAchievements(playerId),
      ]);
      if (!ativo) return;
      if (com.status === "fulfilled") setComentarios(com.value);
      if (hist.status === "fulfilled") setHistoricoFases(hist.value);
      setConquistas(conq.status === "fulfilled" ? conq.value : []);
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [cardId, playerId]);

  return (
    <div className="space-y-5 rounded-xl border border-hairline bg-elevated/40 p-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <MessageSquare size={12} /> Linha do tempo
          </label>
          {/* Historico de fases sai da rolagem principal (pedido explicito:
              "esta muito ruim") e vira um icone que abre modal a parte --
              a linha do tempo de notas e' o que o coach usa toda hora,
              movimentacao de funil e' consulta ocasional. */}
          <button
            type="button"
            onClick={() => setHistoricoAberto(true)}
            title="Ver histórico de fases"
            aria-label="Ver histórico de fases"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            <Clock3 size={13} />
          </button>
        </div>

        {carregando ? (
          <p className="text-[12.5px] text-muted">Carregando…</p>
        ) : comentarios.length === 0 ? (
          <p className="text-[12.5px] text-muted">Nenhuma interação registrada ainda.</p>
        ) : (
          <ul className="mb-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-ink">{c.authorName}</span>
                  <span className="text-[10px] text-muted">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {c.body && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{c.body}</p>}
                {c.attachmentUrl && (
                  <AnexoInteracao path={c.attachmentUrl} name={c.attachmentName} type={c.attachmentType} />
                )}
              </li>
            ))}
          </ul>
        )}
        <ComposerInteracao cardId={cardId} onEnviado={recarregarComentarios} onErro={onErro} />
        <p className="mt-1.5 text-[10.5px] text-muted/70">
          Fica registrado pra sempre, sem editar ou apagar depois — segurança pro coach e pro jogador.
        </p>
      </div>

      <div className="border-t border-hairline pt-4">
        <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          <Trophy size={12} /> Conquistas e evolução
        </label>
        {conquistas === null ? (
          <p className="text-[12.5px] text-muted">Carregando…</p>
        ) : conquistas.length === 0 ? (
          <p className="text-[12.5px] text-muted">Nenhuma missão concluída ainda no PokerSync.</p>
        ) : (
          <ul className="space-y-1.5">
            {conquistas.map((a) => (
              <li key={a.missionId} className="flex items-start gap-2 rounded-lg border border-hairline bg-elevated px-2.5 py-2">
                <Trophy size={14} className="mt-0.5 shrink-0 text-evolution" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{a.title}</p>
                  <p className="text-[10.5px] text-muted">
                    +{a.xpReward} XP · {new Date(a.completedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {historicoAberto && (
        <ModalHistoricoFases historico={historicoFases} onFechar={() => setHistoricoAberto(false)} />
      )}
    </div>
  );
}

// Junta entradas adjacentes da MESMA fase em um so' periodo -- o bug de
// move_player_card (corrigido no banco) deixou card antigo com varias
// entradas identicas, minutos ou segundos entre si, sem mudanca real de
// fase (ver historico de migracoes). Sem isso a lista fica poluida com
// "Prospecção" repetido dezenas de vezes no mesmo dia.
function mesclarHistoricoFases(entradas: CardPhaseHistoryEntry[]): CardPhaseHistoryEntry[] {
  const mescladas: CardPhaseHistoryEntry[] = [];
  for (const e of entradas) {
    const ultima = mescladas[mescladas.length - 1];
    if (ultima && ultima.phaseId === e.phaseId) {
      ultima.enteredAt = e.enteredAt;
    } else {
      mescladas.push({ ...e });
    }
  }
  return mescladas;
}

// Modal a parte pro historico de movimentacao entre fases do funil
// (pedido explicito) -- consulta ocasional, nao compete espaco com a
// linha do tempo de notas/interacoes do dia a dia.
function ModalHistoricoFases({ historico, onFechar }: { historico: CardPhaseHistoryEntry[]; onFechar: () => void }) {
  const mesclado = useMemo(() => mesclarHistoricoFases(historico), [historico]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-hairline bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Clock3 size={14} /> Histórico de fases
          </h3>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {mesclado.length === 0 ? (
          <p className="text-[12.5px] text-muted">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {mesclado.map((h, i) => (
              <li key={`${h.phaseId}-${h.enteredAt}-${i}`} className="flex items-center gap-2 text-[12.5px] text-ink/85">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: h.phaseColor }} />
                <span className="min-w-0 flex-1 truncate font-medium">{h.phaseName}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {new Date(h.enteredAt).toLocaleDateString("pt-BR")}
                  {h.leftAt ? ` – ${new Date(h.leftAt).toLocaleDateString("pt-BR")}` : " (atual)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Composer da interacao: texto e/ou um anexo (print/arquivo). Precisa
// de pelo menos um dos dois pra habilitar o envio.
function ComposerInteracao({
  cardId,
  onEnviado,
  onErro,
}: {
  cardId: string;
  onEnviado: () => void;
  onErro: (s: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function enviar() {
    if (!texto.trim() && !arquivo) return;
    setEnviando(true);
    try {
      const anexo = arquivo ? await uploadCardAttachment(cardId, arquivo) : null;
      await addCardComment(cardId, texto, anexo);
      setTexto("");
      setArquivo(null);
      onEnviado();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {arquivo && (
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12px] text-ink">
          <Paperclip size={12} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
          <button type="button" onClick={() => setArquivo(null)} className="shrink-0 text-muted hover:text-negative" aria-label="Remover anexo">
            <X size={12} />
          </button>
        </div>
      )}
      {/* Textarea grande (pedido explicito: "muito pequena") -- registrar
          uma interacao de verdade (o que foi conversado, combinado)
          precisa de espaco pra escrever igual o CRM de exemplo, nao um
          campo de uma linha so'. Ctrl/Cmd+Enter envia -- Enter sozinho
          quebra linha, senao escrever mais de uma frase vira briga com
          o atalho. */}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" && (e.metaKey || e.ctrlKey)) && !enviando && (e.preventDefault(), enviar())}
        placeholder="Registrar uma interação… (o que foi conversado, combinado, próximos passos)"
        rows={4}
        className="w-full resize-y rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted/50 focus:border-training/50"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <EmojiPickerButton
            onPick={(emoji) => setTexto((t) => t + emoji)}
            className="shrink-0 rounded-lg border border-hairline px-3 py-2 text-[13px] text-muted transition-colors hover:border-ink/40 hover:text-ink"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && setArquivo(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Anexar print ou arquivo"
            className="shrink-0 rounded-lg border border-hairline px-3 py-2 text-[13px] text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            <Paperclip size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || (!texto.trim() && !arquivo)}
          title="Ctrl/Cmd + Enter"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-void transition-opacity disabled:opacity-40"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
          Registrar
        </button>
      </div>
    </div>
  );
}

// Anexo de uma interacao -- bucket privado, entao a URL e' assinada sob
// demanda (nao fica cacheada entre sessoes). Imagem mostra miniatura;
// qualquer outro tipo vira link com nome do arquivo.
function AnexoInteracao({ path, name, type }: { path: string; name: string | null; type: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    getCardAttachmentUrl(path)
      .then((u) => ativo && setUrl(u))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [path]);

  if (erro) return <p className="mt-1 text-[11px] text-negative">Anexo indisponível.</p>;
  if (!url) return <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Loader2 size={11} className="animate-spin" /> Carregando anexo…</p>;

  if (type?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? "Anexo"} className="max-h-40 rounded-lg border border-hairline object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-training hover:underline">
      <Paperclip size={12} /> {name ?? "Anexo"}
    </a>
  );
}
